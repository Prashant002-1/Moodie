import request from 'supertest';
import { readFileSync } from 'fs';
import path from 'path';
import app from '../src/app';
import pool from '../src/config/database';
import { projectRoot } from '../src/config/env';
import { emailColours, emailKinds, NoteEmailData, personColour, personColours, personHue, recommendationEmail, reminderEmail, renderEmail, replyEmail, ReplyEmailData } from '../src/notifications/emails';
import { deliverPending, Mailer, MailMessage, NO_LONGER_APPLIES, NO_PROVIDER, unconnectedMailer } from '../src/notifications/mailer';
import { queueDueReminders } from '../src/notifications/outbox';
// The web's own function: the server must choose the same colour for the same person.
import { personHue as webPersonHue } from '../../src/utils/person';

type Person = { id: number; cookie: string };
const get = (url: string, p: Person) => request(app).get(`/api${url}`).set('Cookie', p.cookie);
const send = (url: string, p: Person, body: object = {}, method: 'post'|'patch'|'put'|'delete' = 'post') => request(app)[method](`/api${url}`).set('Cookie', p.cookie).set('X-Moodie-Request', '1').send(body);
const register = async (name: string): Promise<Person> => {
  const result = await request(app).post('/api/auth/register').set('X-Moodie-Request', '1').send({ username: name, email: `${name}@example.test`, password: 'notification-test-password' });
  expect(result.status).toBe(201);
  return { id: result.body.user.id, cookie: result.headers['set-cookie'][0].split(';')[0] };
};
const feelings = { neutral: 0.1, happy: 0.8, sad: 0.5, angry: 0, fearful: 0, disgusted: 0, surprised: 0.4 };
const reason = 'The quiet ending made me think of our conversation.';
const outbox = async () => (await pool.query('SELECT o.kind, o.status, o.error, o.payload, o.suggestion_id, u.username AS reader FROM notification_outbox o JOIN users u ON u.id = o.recipient_id ORDER BY o.id'))
  .rows.map(row => ({ ...row, suggestion_id: Number(row.suggestion_id) }));
const due = (id: number, interval = "- INTERVAL '1 hour'") => pool.query(`UPDATE film_suggestions SET remind_at = CURRENT_TIMESTAMP ${interval} WHERE id = $1`, [id]);

let alice: Person, bob: Person;
beforeEach(async () => {
  await pool.query('TRUNCATE users,movies,auth_attempts,moderation_actions RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies(id,title,release_date,poster_path) VALUES(101,'A Film','2020-01-01','/aFilm.jpg'),(102,'Another Film','2021-01-01',NULL)");
  alice = await register('note_alice'); bob = await register('note_bob');
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [bob.id, alice.id]);
});
const recommend = async (movieId = 101) => {
  const result = await send('/suggestions', alice, { origin: 'sent', movieId, recipientId: bob.id, reason });
  expect(result.status).toBe(201);
  return result.body.suggestion.id as number;
};
const reply = async (id: number, extra: object = {}) => {
  const entry = await send('/diary', bob, { movieId: 101, watchedOn: '2026-01-01', note: 'Private diary words', visibility: 'private', emotions: feelings });
  expect(entry.status).toBe(201);
  const result = await send(`/suggestions/${id}/reply`, bob, { entryId: entry.body.entry.id, enjoyment: 'loved', highlights: ['music'], note: 'It stayed with me all week.', ...extra }, 'put');
  expect(result.status).toBe(200);
  return entry.body.entry.id as number;
};

describe('the emails', () => {
  const hostile = '<script>alert("x")</script>';
  const note: NoteEmailData = {
    from: `hi<b>ro</b>${hostile}`, origin: 'sent', suggestionId: 7, title: `Past "Lives" & <img src=x onerror=alert(1)>`, releaseDate: '2023-06-02',
    posterPath: '/poster.jpg', backdropPath: '/backdrop.jpg', words: `Line one\n</td></table>${hostile}<a href='javascript:alert(1)'>x</a>`, webUrl: 'https://moodie.example',
  };
  const answered: ReplyEmailData = { ...note, enjoyment: 'loved', highlights: ['music', '<i>ending</i>'], containsSpoilers: false };
  const all = () => [recommendationEmail(note), reminderEmail(note), replyEmail(answered)];

  it('escapes hostile input in every email and keeps it out of links, images and the subject', () => {
    for (const email of all()) {
      expect(email.html).not.toMatch(/<script|<img src=x|<b>|<i>|onerror=alert\(1\)>|href='javascript/i);
      expect(email.html).toContain('hi&lt;b&gt;ro&lt;/b&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
      expect(email.html).toContain('Past &quot;Lives&quot; &amp; &lt;img src=x onerror=alert(1)&gt;');
      expect(email.html).toContain('Line one<br>&lt;/td&gt;&lt;/table&gt;&lt;script&gt;');
      // The only tags are the ones the template wrote: every table it opened is still closed by it.
      expect(email.html.match(/<table/g)).toHaveLength(email.html.match(/<\/table>/g)!.length);
      expect(email.html.match(/<script/g)).toBeNull();
      expect(email.subject).not.toMatch(/[\r\n]/);
    }
    const breakout = { ...note, words: 'Plain words.', title: 'Film\r\nBcc: someone@example.test', posterPath: '/x.jpg" onerror="alert(1)', backdropPath: 'javascript:alert(1)', webUrl: 'javascript:alert(1)//"><script>' };
    for (const email of [recommendationEmail(breakout), reminderEmail(breakout), replyEmail({ ...answered, ...breakout })]) {
      expect(email.subject).not.toMatch(/[\r\n]/);
      expect(email.html).not.toMatch(/<img|javascript:|<script/);
      expect(email.html).toContain('href="/suggestions/7"');
    }
  });

  it('is specific, human and complete as HTML and as plain text', () => {
    const data: NoteEmailData = { from: 'hiro', origin: 'sent', suggestionId: 2, title: 'Past Lives', releaseDate: '2023-06-02', posterPath: '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', backdropPath: null, words: 'The last scene stayed with me.', webUrl: 'https://moodie.example/' };
    const email = recommendationEmail(data);
    expect(email.subject).toBe('hiro thought of you: Past Lives');
    expect(email.html).toContain('alt="Poster for Past Lives"');
    expect(email.html).toContain('src="https://image.tmdb.org/t/p/w342/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg"');
    expect(email.html).toContain('href="https://moodie.example/suggestions/2"');
    expect(email.html).toContain('href="https://moodie.example/account?view=notifications"');
    expect(email.html).toContain('Read it on Moodie');
    // Mail clients need tables and inline styles; nothing is loaded from Moodie but the links.
    expect(email.html).not.toMatch(/<link|@import|<script|url\(/);
    expect(email.text).toBe(['hiro thought of you', 'Past Lives (2023)', '“The last scene stayed with me.”', 'Read it on Moodie:\nhttps://moodie.example/suggestions/2',
      '--\nYou got this because hiro recommended a film to you on Moodie.\nTurn these emails off in Account, under Notifications:\nhttps://moodie.example/account?view=notifications'].join('\n\n') + '\n');
    expect(email.text).not.toMatch(/<|&amp;/);

    const reminder = reminderEmail(data);
    expect(reminder.subject).toBe('You asked to be reminded: Past Lives');
    expect(reminder.html.indexOf('You asked to be reminded')).toBeLessThan(reminder.html.indexOf('thought of you'));
    expect(reminder.text.startsWith('You asked to be reminded\n\nhiro thought of you')).toBe(true);
    expect(reminderEmail({ ...data, origin: 'discovered', words: '' }).text).toContain('Found through hiro');

    const told = replyEmail({ ...data, from: 'ananya', words: 'A win and a loss at once.', enjoyment: 'loved', highlights: ['ending', 'music'], containsSpoilers: false });
    expect(told.subject).toBe('ananya told you how Past Lives landed');
    expect(told.html).toContain('A win and a loss at once.');
    expect(told.text).toContain('Loved it · Ending · Music');
    // A reply marked as having spoilers is never shown in an inbox.
    const spoiler = replyEmail({ ...data, from: 'ananya', words: 'He dies at the end.', enjoyment: 'mixed', highlights: [], containsSpoilers: true });
    expect(spoiler.html + spoiler.text).not.toContain('He dies');
    expect(spoiler.text).toContain('marked the reply as having spoilers');
  });

  it('is dark like the product and still reads when a client drops the page background', () => {
    for (const email of all()) {
      expect(email.html).toContain('<meta name="color-scheme" content="dark">');
      // Every cell that holds words carries its own background, as an attribute and as a style.
      const cells = email.html.match(/<td[^>]*>(?=\s*[^<\s])/g) ?? [];
      expect(cells.length).toBeGreaterThanOrEqual(3);
      for (const cell of cells) expect(cell).toMatch(/bgcolor="#[0-9A-F]{6}"[^>]*background-color:#[0-9A-F]{6}/);
    }
  });

  it('gives a person the same colour as the web does, from the same tokens', () => {
    const tokens = JSON.parse(readFileSync(path.join(projectRoot, 'design/tokens.json'), 'utf8'));
    expect(personColours).toEqual(tokens.person.dark);
    expect(emailColours).toEqual({ canvas: tokens.color.dark.canvas, surface: tokens.color.dark.surface, surfaceRaised: tokens.color.dark.surfaceRaised,
      ink: tokens.color.dark.ink, inkSecondary: tokens.color.dark.inkSecondary, inkMuted: tokens.color.dark.inkMuted, rule: tokens.color.dark.rule,
      accent: tokens.color.dark.accent, onAccent: tokens.color.dark.onAccent, onPerson: tokens.person.onDark });
    const names = ['hiro', 'ananya', 'elena', 'ios_viewer', 'Prashant', 'a', 'zz_top_99', 'note_alice', 'note_bob', ...Array.from({ length: 200 }, (_, n) => `person_${n * 7919}`)];
    for (const name of names) {
      expect(personHue(name)).toBe(webPersonHue(name));
      expect(personColour(name)).toBe(tokens.person.dark[webPersonHue(name) - 1]);
    }
    expect(new Set(names.map(personHue)).size).toBe(7);
    const email = recommendationEmail({ ...note, from: 'hiro' });
    expect(email.html).toContain(`bgcolor="${personColour('hiro')}"`);
    // The colour fills the avatar only; the name is ink, and no coloured rule runs down the side of the note.
    expect(email.html).toContain(`color:${emailColours.ink};">hiro</strong> thought of you`);
    expect(email.html).not.toContain(`<td width="3" bgcolor="${personColour('hiro')}"`);
  });
});

describe('queueing', () => {
  it('queues one email to the recipient when a film is sent, never twice, and none for a film kept through a public response', async () => {
    const id = await recommend();
    expect(await outbox()).toEqual([{ kind: 'recommendation', status: 'pending', error: null, reader: 'note_bob', suggestion_id: id, payload: { from: 'note_alice', title: 'A Film', remindAt: null } }]);
    // Nobody's words are copied into the outbox.
    expect(JSON.stringify(await outbox())).not.toContain('quiet ending');
    expect(await recommend()).toBe(id);
    expect(await outbox()).toHaveLength(1);
    const source = await send('/diary', alice, { movieId: 102, watchedOn: '2026-01-01', note: 'Published', visibility: 'public', emotions: feelings });
    expect((await send('/suggestions', bob, { origin: 'discovered', sourceEntryId: source.body.entry.id })).status).toBe(201);
    expect(await outbox()).toHaveLength(1);
  });

  it('queues one email to the sender when the recipient replies, and not again when the reply is edited', async () => {
    const id = await recommend();
    const entryId = await reply(id);
    expect((await outbox()).map(row => [row.kind, row.reader])).toEqual([['recommendation', 'note_bob'], ['reply', 'note_alice']]);
    expect((await send(`/suggestions/${id}/reply`, bob, { entryId, enjoyment: 'liked', note: 'On reflection, liked.' }, 'put')).status).toBe(200);
    expect(await outbox()).toHaveLength(2);
    expect(JSON.stringify(await outbox())).not.toMatch(/stayed with me|Private diary words|On reflection/);
  });

  it('respects a person who turned email off, through the preferences endpoint, without touching their AI choice', async () => {
    const preference = (p: Person, body: object) => send('/auth/preferences', p, body, 'patch');
    expect((await get('/auth/me', bob)).body.user).toMatchObject({ ai_mode: null, email_notifications: true });
    expect((await preference(bob, {})).status).toBe(400);
    expect((await preference(bob, { emailNotifications: 'no' })).status).toBe(400);
    expect((await preference(bob, { emailNotifications: false, other: 1 })).status).toBe(400);
    expect((await preference(bob, { aiMode: 'on' })).body.user).toMatchObject({ ai_mode: 'on', email_notifications: true });
    expect((await preference(bob, { emailNotifications: false })).body.user).toMatchObject({ ai_mode: 'on', email_notifications: false });
    expect((await preference(bob, { aiMode: 'off' })).body.user).toMatchObject({ ai_mode: 'off', email_notifications: false });
    expect((await get('/auth/me', bob)).body.user).toMatchObject({ ai_mode: 'off', email_notifications: false });

    const id = await recommend();
    await due(id);
    expect(await queueDueReminders()).toBe(0);
    expect(await outbox()).toEqual([]);
    // The sender still has email on, so they hear about the reply.
    await reply(id);
    expect((await outbox()).map(row => [row.kind, row.reader])).toEqual([['reply', 'note_alice']]);
    // Turning it off after an email was queued stops that email too.
    expect((await preference(alice, { emailNotifications: false })).status).toBe(200);
    const mailer = { send: jest.fn() };
    expect(await deliverPending(mailer)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(mailer.send).not.toHaveBeenCalled();
    expect((await outbox())[0]).toMatchObject({ status: 'skipped', error: NO_LONGER_APPLIES });
    // Both together, and back on.
    expect((await preference(bob, { aiMode: 'on', emailNotifications: true })).body.user).toMatchObject({ ai_mode: 'on', email_notifications: true });
  });

  it('never queues or delivers for a blocked pair, a restricted person or a deleted account', async () => {
    const id = await recommend();
    await due(id);
    await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [bob.id, alice.id]);
    // A due reminder on a recommendation from someone since blocked is not emailed.
    expect(await queueDueReminders()).toBe(0);
    // The recommendation email queued before the block does not go out either.
    const mailer = { send: jest.fn() };
    expect(await deliverPending(mailer)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(mailer.send).not.toHaveBeenCalled();
    expect(await outbox()).toEqual([expect.objectContaining({ kind: 'recommendation', status: 'skipped', error: NO_LONGER_APPLIES })]);
    // Nothing new can be sent or queued across the block.
    expect((await send('/suggestions', alice, { origin: 'sent', movieId: 102, recipientId: bob.id, reason })).status).toBe(404);
    expect(await outbox()).toHaveLength(1);

    await pool.query('DELETE FROM user_blocks');
    await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES('person',$1,'test')", [alice.id]);
    expect(await queueDueReminders()).toBe(0);
    await pool.query('DELETE FROM moderation_actions');
    expect(await queueDueReminders()).toBe(1);

    // Deleting an account takes its recommendations and everything queued about them with it.
    expect((await send('/auth/account', alice, { password: 'notification-test-password' }, 'delete')).status).toBe(204);
    expect(await outbox()).toEqual([]);
    expect(await queueDueReminders()).toBe(0);
  });

  it('queues a due reminder once, leaves one that is not due, and queues it again only when it was moved and came due again', async () => {
    const first = await recommend(101), second = await recommend(102);
    await pool.query('DELETE FROM notification_outbox');
    await due(first);
    await due(second, "+ INTERVAL '3 days'");
    expect(await queueDueReminders()).toBe(1);
    expect(await queueDueReminders()).toBe(0);
    expect(await outbox()).toEqual([expect.objectContaining({ kind: 'reminder', status: 'pending', reader: 'note_bob', suggestion_id: first })]);
    expect(await deliverPending()).toEqual({ sent: 0, skipped: 1, failed: 0 });
    // Already handled: the same reminder is never queued a second time.
    expect(await queueDueReminders()).toBe(0);
    // "Later" moves it. Nothing until the new time comes, then once more.
    await due(first, "+ INTERVAL '1 day'");
    expect(await queueDueReminders()).toBe(0);
    await due(first, "- INTERVAL '1 minute'");
    expect(await queueDueReminders()).toBe(1);
    expect(await queueDueReminders()).toBe(0);
    expect(await outbox()).toEqual([expect.objectContaining({ kind: 'reminder', status: 'pending', error: null })]);
    // Archived or watched: the reminder is cleared by the API, and a cleared reminder is not emailed.
    expect((await send(`/suggestions/${first}`, bob, { action: 'archive' }, 'patch')).status).toBe(200);
    const mailer = { send: jest.fn() };
    expect(await deliverPending(mailer)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(mailer.send).not.toHaveBeenCalled();
  });
});

describe('delivery', () => {
  it('sends nothing by default and marks each row skipped because no provider is connected', async () => {
    const id = await recommend();
    await reply(id);
    expect(await unconnectedMailer.send({ to: 'x@example.test', kind: 'reply', subject: '', html: '', text: '' })).toEqual({ status: 'skipped', reason: NO_PROVIDER });
    expect(NO_PROVIDER).toBe('no email provider connected');
    expect(await deliverPending()).toEqual({ sent: 0, skipped: 2, failed: 0 });
    expect((await outbox()).map(row => [row.kind, row.status, row.error])).toEqual([['recommendation', 'skipped', NO_PROVIDER], ['reply', 'skipped', NO_PROVIDER]]);
    // Skipped is final: connecting a provider later does not send a backlog.
    expect(await deliverPending()).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it('hands a provider the rendered email for the right person, records what happened and never hands a row over twice', async () => {
    const id = await recommend();
    await reply(id);
    await due(await recommend(102));
    expect(await queueDueReminders()).toBe(1);
    const sent: MailMessage[] = [];
    const mailer: Mailer = { send: async message => { if (message.kind === 'reminder') throw new Error('provider said no'); sent.push(message); return { status: 'sent' }; } };
    const [once, twice] = await Promise.all([deliverPending(mailer), deliverPending(mailer)]);
    expect({ sent: once.sent + twice.sent, skipped: once.skipped + twice.skipped, failed: once.failed + twice.failed }).toEqual({ sent: 3, skipped: 0, failed: 1 });
    expect(sent.map(message => [message.kind, message.to, message.subject])).toEqual([
      ['recommendation', 'note_bob@example.test', 'note_alice thought of you: A Film'],
      ['reply', 'note_alice@example.test', 'note_bob told you how A Film landed'],
      ['recommendation', 'note_bob@example.test', 'note_alice thought of you: Another Film'],
    ]);
    expect(sent[0].html).toContain(reason);
    expect(sent[0].html).toContain('https://image.tmdb.org/t/p/w342/aFilm.jpg');
    expect(sent[0].text).toContain(`/suggestions/${id}`);
    expect(sent[1].html).toContain('It stayed with me all week.');
    expect(sent[1].html).not.toContain('Private diary words');
    expect((await outbox()).map(row => [row.kind, row.status, row.error])).toEqual([
      ['recommendation', 'sent', null], ['reply', 'sent', null], ['recommendation', 'sent', null], ['reminder', 'failed', 'provider said no']]);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM notification_outbox WHERE status = 'sent' AND sent_at IS NOT NULL AND claimed_at IS NULL")).rows[0].n).toBe(3);
    expect(await deliverPending(mailer)).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it('does not email a reply that was removed before delivery', async () => {
    const id = await recommend();
    await reply(id);
    expect((await send(`/suggestions/${id}/reply`, bob, {}, 'delete')).status).toBe(204);
    const sent: MailMessage[] = [];
    await deliverPending({ send: async message => { sent.push(message); return { status: 'sent' }; } });
    expect(sent.map(message => message.kind)).toEqual(['recommendation']);
    expect((await outbox())[1]).toMatchObject({ kind: 'reply', status: 'skipped', error: NO_LONGER_APPLIES });
  });
});

describe('the preview', () => {
  it('shows each email in a browser outside production, as HTML or as plain text, without an account', async () => {
    for (const kind of emailKinds) {
      const page = await request(app).get(`/api/dev/emails/${kind}`).set('Host', 'localhost:5273');
      expect(page.status).toBe(200);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.text).toContain('<!doctype html>');
      expect(page.text).toContain('href="http://localhost:5273/suggestions/');
      const text = await request(app).get(`/api/dev/emails/${kind}?format=text`);
      expect(text.headers['content-type']).toContain('text/plain');
      expect(text.text).toMatch(/^Subject: /);
    }
    expect((await request(app).get('/api/dev/emails/recommendation')).text).toContain(renderEmail('recommendation', {
      from: 'hiro', origin: 'sent', suggestionId: 2, title: 'Past Lives', releaseDate: '2023-06-02', posterPath: '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', backdropPath: null, words: '', webUrl: '',
    }).subject);
    expect((await request(app).get('/api/dev/emails')).text).toContain('emails/reminder');
    expect((await request(app).get('/api/dev/emails/password')).status).toBe(404);
  });

  it('does not exist in production', async () => {
    const before = process.env.NODE_ENV;
    let production: typeof app | undefined;
    process.env.NODE_ENV = 'production';
    try { jest.isolateModules(() => { production = require('../src/app').default; }); }
    finally { process.env.NODE_ENV = before; }
    for (const url of ['/api/dev/emails', '/api/dev/emails/recommendation', '/api/dev/emails/reminder?format=text', '/api/dev/emails/reply']) {
      const response = await request(production!).get(url);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'API route not found' });
    }
    // The same build still serves the API.
    expect((await request(production!).get('/api/auth/me')).status).toBe(401);
  });
});
