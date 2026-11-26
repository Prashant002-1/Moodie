import express from 'express';
import { EmailKind, emailKinds, NoteEmailData, renderEmail, ReplyEmailData } from '../notifications/emails';

/**
 * Previews for people building Moodie. app.ts registers this router only when
 * NODE_ENV is not production. Nothing here reads the database or an account:
 * the samples are the people and films of the preview fixture (ios/scripts/start-fixture.ts).
 */
const router = express.Router();

const samples = (webUrl: string): { recommendation: NoteEmailData; reminder: NoteEmailData; reply: ReplyEmailData } => ({
  recommendation: {
    from: 'hiro', origin: 'sent', suggestionId: 2, title: 'Past Lives', releaseDate: '2023-06-02',
    posterPath: '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', backdropPath: '/7HR38hMBl23lf38MAN63y4pKsHz.jpg',
    words: 'For that conversation we had about the lives we might have lived. The last scene stayed with me.', webUrl,
  },
  reminder: {
    from: 'ananya', origin: 'sent', suggestionId: 1, title: 'Scream', releaseDate: '1996-12-20',
    posterPath: '/lr9ZIrmuwVmZhpZuTCW8D9g0ZJe.jpg', backdropPath: null,
    words: 'You said you wanted something we could laugh through together. This is that kind of scary.', webUrl,
  },
  reply: {
    from: 'ananya', origin: 'sent', suggestionId: 4, title: 'Whiplash', releaseDate: '2014-10-10',
    posterPath: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', backdropPath: null,
    words: 'It felt like a win and a loss at once. I have not stopped thinking about his face.',
    enjoyment: 'loved', highlights: ['ending', 'music'], containsSpoilers: false, webUrl,
  },
});

router.get('/emails', (_req, res) => {
  res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Moodie emails</title>
<body style="margin:40px;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#111110;color:#F2EFE9">
<h1 style="font:700 28px Georgia,serif">Moodie emails</h1>
<ul>${emailKinds.map(kind => `<li><a style="color:#F2EFE9" href="emails/${kind}">${kind}</a> · <a style="color:#BEBAB2" href="emails/${kind}?format=text">plain text</a></li>`).join('')}</ul>
</body></html>`);
});

router.get('/emails/:kind', (req, res) => {
  const kind = req.params.kind as EmailKind;
  if (!emailKinds.includes(kind)) return res.status(404).json({ error: 'No such email. Try recommendation, reminder or reply.' });
  // Links in the preview lead back to the address it was opened from.
  const email = renderEmail(kind, samples(`${req.protocol}://${req.get('host')}`)[kind]);
  if (req.query.format === 'text') return res.type('text/plain').send(`Subject: ${email.subject}\n\n${email.text}`);
  res.type('html').send(email.html);
});

export default router;
