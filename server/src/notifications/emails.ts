/**
 * Moodie's emails as pure functions: plain data in, `{ subject, html, text }` out.
 * Nothing here reads a database, a clock or the environment.
 *
 * The email is the recommendation note from the web (`.rec` in src/styles/app.css)
 * rebuilt for mail clients: tables, inline styles, 600px, system fonts because web
 * fonts do not load in mail. It is dark like the product, and every cell carries
 * its own background so the words still read when a client drops the page colour.
 * Every string that came from a person is HTML-escaped before it is placed.
 */

export type EmailKind = 'recommendation' | 'reminder' | 'reply';
export const emailKinds: EmailKind[] = ['recommendation', 'reminder', 'reply'];
export type RenderedEmail = { subject: string; html: string; text: string };

/** What every email needs. `from` is the other person; the email goes to someone else. */
export type NoteEmailData = {
  /** The other person in the recommendation: who sent it, or for a reply, who answered. */
  from: string;
  /** 'sent' when one person chose the other; 'discovered' when a film was kept through a public response. */
  origin: 'sent' | 'discovered';
  suggestionId: number;
  title: string;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  /** The reason on a recommendation, or the note on a reply. */
  words: string;
  /** Where the web app lives, without a trailing slash. */
  webUrl: string;
};
export type ReplyEmailData = NoteEmailData & {
  enjoyment: 'loved' | 'liked' | 'mixed' | 'not_for_me';
  highlights: string[];
  containsSpoilers: boolean;
};

// The dark palette of design/tokens.json. A test keeps these equal to the tokens.
export const emailColours = {
  canvas: '#0E1220', surface: '#171D31', surfaceRaised: '#1F2742', ink: '#F3F5FB', inkSecondary: '#B7C0D4',
  inkMuted: '#8591AB', rule: '#222A43', accent: '#FFC53D', onAccent: '#17130A', onPerson: '#0E1220',
};
export const personColours = ['#FFB224', '#3DD68C', '#52B8FF', '#B79CFF', '#2CD4C0', '#FF8468', '#C4E85A'];

/** The same choice as `personHue` in src/utils/person.ts, so a person has one colour everywhere. */
export const personHue = (username: string) => {
  let sum = 0;
  for (const character of username.toLowerCase()) sum = (sum * 31 + character.charCodeAt(0)) % 9973;
  return (sum % personColours.length) + 1;
};
export const personColour = (username: string) => personColours[personHue(username) - 1];

export const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const c = emailColours;
const enjoymentLabels: Record<ReplyEmailData['enjoyment'], string> = { loved: 'Loved it', liked: 'Liked it', mixed: 'Mixed', not_for_me: 'Not for me' };
const highlightLabels: Record<string, string> = { story: 'Story', characters: 'Characters', performances: 'Performances', dialogue: 'Dialogue', images: 'Images', music: 'Music', ending: 'Ending' };

// One line, no control characters: a subject is a mail header.
const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
const year = (date: string | null) => /^\d{4}/.exec(date ?? '')?.[0] ?? '';
// TMDB image paths are a slash and a file name. Anything else is left out, never placed in a URL.
const image = (path: string | null, size: string) => path && /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(path)
  ? `https://image.tmdb.org/t/p/${size}${path}` : null;
const base = (webUrl: string) => /^https?:\/\/[^\s"'<>]+$/.test(webUrl) ? webUrl.replace(/\/+$/, '') : '';
const links = (data: NoteEmailData) => ({
  open: `${base(data.webUrl)}/suggestions/${Number(data.suggestionId) || 0}`,
  settings: `${base(data.webUrl)}/account?view=notifications`,
});

type Parts = {
  data: NoteEmailData;
  subject: string;
  /** A line above the note, when the email is about something other than the note arriving. */
  lead?: string;
  /** The line beside the avatar, around the person's name. */
  byline: { before?: string; after: string };
  /** Small lines between the title and the words. */
  details?: { badge: string; rest: string };
  /** Said in place of the words when they are not shown. */
  withheld?: string;
  button: string;
  why: string;
};

function compose({ data, subject, lead, byline, details, withheld, button, why }: Parts): RenderedEmail {
  const hue = personColour(data.from);
  const who = escapeHtml(data.from), title = escapeHtml(data.title), released = year(data.releaseDate);
  const { open, settings } = links(data);
  const poster = image(data.posterPath, 'w342'), art = image(data.backdropPath, 'w780');
  const words = withheld ? '' : data.words.trim();
  const cell = (colour: string) => `bgcolor="${colour}" style="background-color:${colour};`;
  const preheader = escapeHtml(clip(oneLine(words || withheld || `${data.title}${released ? ` (${released})` : ''}`), 140));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
<style>
:root { color-scheme: dark; }
a { color: ${c.ink}; }
@media (max-width: 520px) {
  .m-outer { padding: 24px 14px 32px !important; }
  .m-inner { padding: 18px !important; }
  .m-lead { font-size: 26px !important; line-height: 30px !important; }
  .m-title { font-size: 26px !important; line-height: 30px !important; }
  .m-quote { font-size: 17px !important; line-height: 26px !important; }
  .m-poster { padding-right: 14px !important; }
  .m-poster img { width: 92px !important; }
  .m-button, .m-button a { display: block !important; text-align: center !important; }
}
</style>
</head>
<body ${cell(c.canvas)}margin:0;padding:0;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${c.canvas};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${cell(c.canvas)}">
<tr><td align="center" class="m-outer" ${cell(c.canvas)}padding:36px 24px 44px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

<tr><td ${cell(c.canvas)}padding:0 0 30px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td ${cell(c.canvas)}font-size:0;line-height:0;white-space:nowrap;"><span style="display:inline-block;width:20px;height:20px;border-radius:10px;background-color:${c.accent};vertical-align:middle;"></span><span style="display:inline-block;width:20px;height:20px;border-radius:12px;background-color:${hue};border:2px solid ${c.canvas};margin-left:-9px;vertical-align:middle;"></span></td>
    <td ${cell(c.canvas)}padding-left:10px;font-family:${SERIF};font-size:20px;line-height:22px;font-weight:700;letter-spacing:-0.01em;color:${c.ink};">Moodie</td>
  </tr></table>
</td></tr>
${lead ? `
<tr><td ${cell(c.canvas)}padding:0 0 22px;">
  <h1 class="m-lead" style="margin:0;font-family:${SERIF};font-size:32px;line-height:36px;font-weight:700;letter-spacing:-0.02em;color:${c.ink};">${escapeHtml(lead)}</h1>
</td></tr>` : ''}
<tr><td ${cell(c.canvas)}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${cell(c.surface)}border:1px solid ${c.rule};border-radius:10px;border-collapse:separate;overflow:hidden;">
  <tr>
    <td width="3" bgcolor="${hue}" style="width:3px;background-color:${hue};font-size:0;line-height:0;">&nbsp;</td>
    <td ${cell(c.surface)}">
${art ? `      <a href="${escapeHtml(open)}" style="display:block;text-decoration:none;"><img src="${escapeHtml(art)}" width="595" alt="A scene from ${title}" style="display:block;width:100%;max-width:100%;height:auto;border:0;background-color:${c.surfaceRaised};color:${c.inkMuted};font-family:${SANS};font-size:13px;"></a>\n` : ''}      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="m-inner" ${cell(c.surface)}padding:26px 28px 28px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="40" height="40" align="center" valign="middle" bgcolor="${hue}" style="width:40px;height:40px;border-radius:20px;background-color:${hue};color:${c.onPerson};font-family:${SERIF};font-size:19px;line-height:40px;font-weight:700;text-transform:uppercase;">${escapeHtml(data.from.charAt(0))}</td>
          <td ${cell(c.surface)}padding-left:12px;font-family:${SANS};font-size:17px;line-height:24px;color:${c.inkSecondary};">${escapeHtml(byline.before ?? '')}<strong style="font-weight:700;color:${hue};">${who}</strong>${escapeHtml(byline.after)}</td>
        </tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>
${poster ? `          <td class="m-poster" valign="top" ${cell(c.surface)}padding-right:22px;"><a href="${escapeHtml(open)}" style="display:block;text-decoration:none;"><img src="${escapeHtml(poster)}" width="132" alt="Poster for ${title}" style="display:block;width:132px;height:auto;border:0;border-radius:4px;background-color:${c.surfaceRaised};color:${c.inkMuted};font-family:${SANS};font-size:12px;line-height:16px;"></a></td>\n` : ''}          <td width="100%" valign="top" ${cell(c.surface)}">
            <h2 class="m-title" style="margin:0;font-family:${SERIF};font-size:34px;line-height:38px;font-weight:700;letter-spacing:-0.02em;color:${c.ink};"><a href="${escapeHtml(open)}" style="color:${c.ink};text-decoration:none;">${title}</a>${released ? ` <span style="font-family:${SANS};font-size:0.56em;font-weight:400;letter-spacing:0;color:${c.inkMuted};white-space:nowrap;">${released}</span>` : ''}</h2>
${details?.badge ? `            <p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:22px;color:${c.inkMuted};"><span style="display:inline-block;padding:0 9px;border-radius:11px;background-color:${c.surfaceRaised};color:${hue};font-size:11px;line-height:22px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;">${escapeHtml(details.badge)}</span>${details.rest ? `&nbsp;&nbsp;${escapeHtml(details.rest)}` : ''}</p>\n` : ''}${words ? `            <p class="m-quote" style="margin:14px 0 0;font-family:${SERIF};font-size:20px;line-height:30px;font-style:italic;font-weight:400;color:${c.ink};">${escapeHtml(words).replace(/\r?\n/g, '<br>')}</p>\n` : ''}${withheld ? `            <p style="margin:14px 0 0;font-family:${SANS};font-size:15px;line-height:22px;color:${c.inkSecondary};">${escapeHtml(withheld)}</p>\n` : ''}            <table role="presentation" class="m-button" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr>
              <td align="center" bgcolor="${c.accent}" style="background-color:${c.accent};border-radius:6px;"><a href="${escapeHtml(open)}" style="display:inline-block;padding:13px 22px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:700;color:${c.onAccent};text-decoration:none;border-radius:6px;">${escapeHtml(button)}</a></td>
            </tr></table>
          </td>
        </tr></table>

      </td></tr></table>
    </td>
  </tr>
  </table>
</td></tr>

<tr><td ${cell(c.canvas)}padding:26px 4px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${c.inkMuted};">
  ${escapeHtml(why)} <a href="${escapeHtml(settings)}" style="color:${c.inkSecondary};text-decoration:underline;">Turn these emails off</a> in Account, under Notifications.${poster || art ? '<br>Film artwork comes from TMDB.' : ''}
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;

  const said = `${byline.before ?? ''}${data.from}${byline.after}`;
  const text = [
    lead,
    oneLine(said),
    `${data.title}${released ? ` (${released})` : ''}`,
    details?.badge ? [details.badge, details.rest].filter(Boolean).join(' · ') : '',
    words ? `“${words}”` : withheld ?? '',
    `${button}:\n${open}`,
    `--\n${why}\nTurn these emails off in Account, under Notifications:\n${settings}`,
  ].filter(Boolean).join('\n\n') + '\n';

  return { subject, html, text };
}

const film = (data: NoteEmailData) => oneLine(data.title);
const received = (data: NoteEmailData) => data.origin === 'sent'
  ? { after: ' thought of you' } : { before: 'Found through ', after: '' };

/** To the recipient, when someone recommends a film to them. */
export function recommendationEmail(data: NoteEmailData): RenderedEmail {
  return compose({
    data, subject: `${oneLine(data.from)} thought of you: ${film(data)}`,
    byline: received(data), button: 'Read it on Moodie',
    why: `You got this because ${oneLine(data.from)} recommended a film to you on Moodie.`,
  });
}

/** To the recipient, when a reminder they set on a recommendation comes due. */
export function reminderEmail(data: NoteEmailData): RenderedEmail {
  return compose({
    data, subject: `You asked to be reminded: ${film(data)}`,
    lead: 'You asked to be reminded',
    byline: received(data), button: 'Open it on Moodie',
    why: 'You got this because you set a reminder on this recommendation.',
  });
}

/** To the person who recommended the film, when the recipient tells them how it landed. */
export function replyEmail(data: ReplyEmailData): RenderedEmail {
  const highlights = data.highlights.map(key => highlightLabels[key]).filter(Boolean).join(' · ');
  return compose({
    data, subject: `${oneLine(data.from)} told you how ${film(data)} landed`,
    byline: { after: data.origin === 'sent' ? ' told you how it landed' : ' found this through you, and told you how it landed' },
    details: { badge: enjoymentLabels[data.enjoyment] ?? '', rest: highlights },
    withheld: data.containsSpoilers ? `${oneLine(data.from)} marked the reply as having spoilers, so it is not shown here.` : undefined,
    button: 'Read it on Moodie',
    why: `You got this because ${oneLine(data.from)} replied to ${data.origin === 'sent' ? 'a film you recommended' : 'a film they found through you'} on Moodie.`,
  });
}

export function renderEmail(kind: EmailKind, data: NoteEmailData | ReplyEmailData): RenderedEmail {
  if (kind === 'reply') return replyEmail(data as ReplyEmailData);
  return kind === 'reminder' ? reminderEmail(data) : recommendationEmail(data);
}
