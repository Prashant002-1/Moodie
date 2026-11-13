import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../src/app';
import pool from '../src/config/database';

type Person = { id: number; cookie: string };
const get = (url: string, p: Person) => request(app).get(`/api${url}`).set('Cookie', p.cookie);
const send = (url: string, p: Person, body: object = {}, method: 'post'|'patch'|'put'|'delete' = 'post') => request(app)[method](`/api${url}`).set('Cookie',p.cookie).set('X-Moodie-Request','1').send(body);
const register = async (name: string): Promise<Person> => {
  const result = await request(app).post('/api/auth/register').set('X-Moodie-Request','1').send({ username: name, email: `${name}@example.test`, password: 'suggestion-test-password' });
  expect(result.status).toBe(201);
  return { id: result.body.user.id, cookie: result.headers['set-cookie'][0].split(';')[0] };
};
const feelings = { neutral: 0.1, happy: 0.8, sad: 0.5, angry: 0, fearful: 0, disgusted: 0, surprised: 0.4 };
const viewing = (movieId = 101, extra: object = {}) => ({ movieId,watchedOn: '2026-01-01',note: 'Private diary words',visibility: 'private',emotions: feelings,enjoyment: 'mixed',highlights: ['music','ending'],...extra });
let alice: Person, bob: Person, third: Person;
beforeEach(async () => {
  await pool.query('TRUNCATE users,movies,auth_attempts,moderation_actions RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies(id,title,release_date) VALUES(101,'A Film','2020-01-01'),(102,'Another Film','2021-01-01')");
  alice = await register('rec_alice'); bob = await register('rec_bob'); third = await register('rec_third');
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [bob.id,alice.id]);
});
const suggest = async () => {
  const result = await send('/suggestions',alice,{ origin:'sent',movieId:101,recipientId:bob.id,reason:'The quiet ending made me think of our conversation.' });
  expect(result.status).toBe(201);
  return result.body.suggestion;
};

it('completes send, save, private viewing, explicit reply and conversation without leaking a diary', async () => {
  const rec = await suggest();
  expect((await get('/suggestions',bob)).body.suggestions[0]).toMatchObject({ reason:rec.reason,status:'suggested',sender_username:'rec_alice' });
  expect((await send(`/suggestions/${rec.id}`,bob,{action:'save'},'patch')).body.suggestion.status).toBe('saved');
  expect((await get('/library/saved',bob)).body.films).toHaveLength(1);
  const entry = await send('/diary',bob,viewing(101,{ suggestionId:rec.id,clientRequestId:randomUUID() }));
  expect(entry.status).toBe(201);
  expect(entry.body.entry).toMatchObject({ enjoyment:'mixed',highlights:['ending','music'] });
  expect((await get(`/suggestions/${rec.id}`,bob)).body.suggestion.status).toBe('watched');
  const beforeReply = (await get(`/suggestions/${rec.id}`,alice)).body.suggestion;
  expect(beforeReply).toMatchObject({ status:'sent',linked_entry_id:null,reply:null });
  expect(JSON.stringify(beforeReply)).not.toContain('Private diary words');
  const reply = { entryId:entry.body.entry.id,enjoyment:'mixed',highlights:['music'],note:'The music stayed with me. The ending worked differently for me.',shareFeelings:true,containsSpoilers:true };
  expect((await send(`/suggestions/${rec.id}/reply`,bob,reply,'put')).status).toBe(200);
  const shared = (await get(`/suggestions/${rec.id}`,alice)).body.suggestion;
  expect(shared.reply).toMatchObject({ enjoyment:'mixed',feelings,contains_spoilers:true });
  expect(JSON.stringify(shared)).not.toContain('Private diary words');
  const message = { body:'I would love to hear why.',clientRequestId:randomUUID() };
  expect((await send(`/suggestions/${rec.id}/messages`,alice,message)).status).toBe(201);
  expect((await send(`/suggestions/${rec.id}/messages`,alice,message)).status).toBe(201);
  const messages = (await get(`/suggestions/${rec.id}/messages`,bob)).body.messages;
  expect(messages).toHaveLength(1);
  expect((await send(`/suggestions/${rec.id}/messages/${messages[0].id}`,bob,{},'delete')).status).toBe(404);
  expect((await send(`/suggestions/${rec.id}/messages/${messages[0].id}`,alice,{},'delete')).status).toBe(204);
});

it('keeps discovered attribution distinct, hidden from its source until a voluntary reply, and retracts private source evidence', async () => {
  const source = (await send('/diary',alice,viewing(101,{visibility:'public',note:'My published experience'}))).body.entry;
  const result = await send('/suggestions',bob,{ origin:'discovered',sourceEntryId:source.id });
  expect(result.status).toBe(201);
  const rec = result.body.suggestion;
  expect(rec).toMatchObject({ origin:'discovered',source_entry_id:source.id,source_note:'My published experience',status:'saved' });
  expect((await get('/suggestions?box=sent',alice)).body.suggestions).toEqual([]);
  expect((await get(`/suggestions/${rec.id}`,alice)).status).toBe(404);
  expect((await send(`/suggestions/${rec.id}/messages`,bob,{body:'hello',clientRequestId:randomUUID()})).status).toBe(409);
  await send(`/diary/${source.id}`,alice,{visibility:'private'},'patch');
  expect((await get(`/suggestions/${rec.id}`,bob)).body.suggestion).toMatchObject({ source_entry_id:null,source_note:null,source_feelings:null });
  expect((await send('/suggestions',third,{ origin:'discovered',sourceEntryId:source.id })).status).toBe(404);
  const entry = (await send('/diary',bob,viewing())).body.entry;
  await send(`/suggestions/${rec.id}/reply`,bob,{entryId:entry.id,enjoyment:'liked',note:'Thank you for putting this on my radar.'},'put');
  expect((await get('/suggestions?box=sent',alice)).body.suggestions[0].reply.note).toContain('Thank you');
  await send(`/suggestions/${rec.id}/messages`,alice,{body:'Glad you found it.',clientRequestId:randomUUID()});
  await send(`/suggestions/${rec.id}/reply`,bob,{},'delete');
  expect((await get(`/suggestions/${rec.id}`,alice)).body.suggestion).toMatchObject({reply:null,status:'shared',linked_entry_id:null,conversation_open:true});
  const messages = (await get(`/suggestions/${rec.id}/messages`,alice)).body.messages;
  expect(messages).toHaveLength(1);
  expect((await send(`/suggestions/${rec.id}/messages/${messages[0].id}`,alice,{},'delete')).status).toBe(204);
});

it('requires participant ownership, recipient consent to receiving, same-film source and same-film viewing', async () => {
  expect((await send('/suggestions',alice,{origin:'sent',movieId:101,recipientId:third.id,reason:'Try this'})).status).toBe(403);
  const rec = await suggest();
  for (const url of [`/suggestions/${rec.id}`,`/suggestions/${rec.id}/messages`]) expect((await get(url,third)).status).toBe(404);
  expect((await send(`/suggestions/${rec.id}`,alice,{action:'save'},'patch')).status).toBe(404);
  const foreign = (await send('/diary',alice,viewing())).body.entry;
  const wrongFilm = (await send('/diary',bob,viewing(102))).body.entry;
  for (const entryId of [foreign.id,wrongFilm.id]) {
    expect((await send(`/suggestions/${rec.id}/reply`,bob,{entryId,enjoyment:'loved'},'put')).status).toBe(400);
    expect((await send(`/suggestions/${rec.id}`,bob,{action:'link',entryId},'patch')).status).toBe(400);
  }
  const publicSource = (await send('/diary',third,viewing(101,{visibility:'public'}))).body.entry;
  expect((await send('/suggestions',alice,{origin:'sent',movieId:101,recipientId:bob.id,reason:'Try it',sourceEntryId:publicSource.id})).status).toBe(400);
});

it('rolls back invalid diary attribution and makes an interrupted create safe to retry', async () => {
  const rec = await suggest(), requestId = randomUUID();
  const body = viewing(101,{suggestionId:rec.id,clientRequestId:requestId});
  expect((await send('/diary',bob,viewing(102,{suggestionId:rec.id}))).status).toBe(400);
  expect((await get('/diary',bob)).body.entries).toEqual([]);
  const first = await send('/diary',bob,body), retry = await send('/diary',bob,body);
  expect(first.body.entry.id).toBe(retry.body.entry.id);
  expect((await get('/diary',bob)).body.entries).toHaveLength(1);
  expect((await send('/diary',bob,{...body,note:'Different payload'})).status).toBe(409);
  expect((await suggest()).id).toBe(rec.id);
});

it('keeps save/archive/viewing state private and restores recommendations without deleting the viewing', async () => {
  const rec = await suggest();
  await send(`/suggestions/${rec.id}`,bob,{action:'archive'},'patch');
  expect((await get('/suggestions',bob)).body.suggestions).toEqual([]);
  expect((await get('/suggestions?box=archived',bob)).body.suggestions).toHaveLength(1);
  expect((await get(`/suggestions/${rec.id}`,alice)).body.suggestion).toMatchObject({archived:false,status:'sent'});
  await send(`/suggestions/${rec.id}`,bob,{action:'restore'},'patch');
  const entry = (await send('/diary',bob,viewing())).body.entry;
  await send(`/suggestions/${rec.id}`,bob,{action:'link',entryId:entry.id},'patch');
  expect((await get(`/suggestions?entryId=${entry.id}`,bob)).body.suggestions).toHaveLength(1);
  expect((await get(`/suggestions?box=sent&entryId=${entry.id}`,alice)).body.suggestions).toEqual([]);
  expect((await get('/suggestions?q=REC_ALICE',bob)).body.suggestions).toHaveLength(1);
  expect((await get('/suggestions?q=%25_',bob)).body.suggestions).toEqual([]);
});

it('enforces reciprocal blocks and moderation on reads and writes', async () => {
  const rec = await suggest();
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)',[alice.id,bob.id]);
  for (const person of [alice,bob]) {
    expect((await get(`/suggestions/${rec.id}`,person)).status).toBe(404);
    expect((await send(`/suggestions/${rec.id}/messages`,person,{body:'Test',clientRequestId:randomUUID()})).status).toBe(404);
  }
  expect((await get('/suggestions',bob)).body.suggestions).toEqual([]);
  await pool.query('DELETE FROM user_blocks');
  await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES('person',$1,'Removed')",[alice.id]);
  expect((await get(`/suggestions/${rec.id}`,bob)).status).toBe(404);
});

it('preserves explicit reply boundaries through edits, revocation and diary/account deletion', async () => {
  const rec = await suggest();
  const entry = (await send('/diary',bob,viewing(101,{suggestionId:rec.id}))).body.entry;
  const payload = {entryId:entry.id,enjoyment:'not_for_me',note:'Thanks for thinking of me.'};
  await send(`/suggestions/${rec.id}/reply`,bob,payload,'put');
  const first = (await get(`/suggestions/${rec.id}`,alice)).body.suggestion.reply;
  expect(first.feelings).toBeNull();
  await send(`/suggestions/${rec.id}/reply`,bob,payload,'put');
  expect((await get(`/suggestions/${rec.id}`,alice)).body.suggestion.reply.updated_at).toBe(first.updated_at);
  await send(`/diary/${entry.id}`,bob,{note:'New private details',visibility:'public'},'patch');
  expect((await get(`/suggestions/${rec.id}`,alice)).body.suggestion.reply.note).toBe(payload.note);
  await send(`/diary/${entry.id}`,bob,{},'delete');
  expect((await get(`/suggestions/${rec.id}`,alice)).body.suggestion).toMatchObject({reply:null,status:'sent',linked_entry_id:null});
  await pool.query('DELETE FROM users WHERE id=$1',[bob.id]);
  expect((await get('/suggestions?box=sent',alice)).body.suggestions).toEqual([]);
});

it('paginates recommendations and conversation without silently truncating the history', async () => {
  const rec = await suggest();
  await pool.query(`INSERT INTO suggestion_messages(suggestion_id,user_id,client_request_id,body)
    SELECT $1,$2,('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'Message ' || n FROM generate_series(1,53) n`,[rec.id,alice.id]);
  const first = await get(`/suggestions/${rec.id}/messages`,bob), second = await get(`/suggestions/${rec.id}/messages?offset=50`,bob);
  expect(first.body.messages).toHaveLength(50); expect(first.body.nextOffset).toBe(50);
  expect(second.body.messages).toHaveLength(3); expect(second.body.nextOffset).toBeNull();
  expect((await get('/suggestions?limit=1&offset=1',bob)).body.suggestions).toEqual([]);
});

it('links activity to the exact recommendation, hides spoiler previews, and keeps legacy activity opt-in', async () => {
  const rec = await suggest();
  expect((await get('/discovery/activity',bob)).body.activity).toEqual([]);
  expect((await get('/discovery/activity?includeSuggestions=true',bob)).body.activity).toEqual([
    expect.objectContaining({ kind:'suggestion',suggestion_id:rec.id,comment_body:rec.reason })
  ]);
  const entry = (await send('/diary',bob,viewing())).body.entry;
  await send(`/suggestions/${rec.id}/reply`,bob,{entryId:entry.id,enjoyment:'liked',note:'Spoiler ending',containsSpoilers:true},'put');
  const events = (await get('/discovery/activity?includeSuggestions=true',alice)).body.activity;
  expect(events).toContainEqual(expect.objectContaining({kind:'suggestion_reply',suggestion_id:rec.id,comment_body:null}));
  expect(JSON.stringify(events)).not.toContain('Private diary words');
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)',[alice.id,bob.id]);
  expect((await get('/discovery/activity?includeSuggestions=true',bob)).body.activity).toEqual([]);
});
