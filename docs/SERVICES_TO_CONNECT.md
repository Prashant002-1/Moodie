# Services to connect

Last updated 2026-11-16. Moodie's code is written against these services, but none of them is connected. Each entry says what exists, what is missing, and what you need to decide or provide. Nothing here is running anywhere.

| Service | What it is for | What exists in the code | What is missing |
| --- | --- | --- | --- |
| **Email delivery** (Amazon SES is the natural fit with your AWS credits) | "A friend recommended a film", a reminder coming due, a reply to a film you recommended | Everything up to the provider: the three emails (`server/src/notifications/emails.ts`), an outbox table that queues them (`notification_outbox`), a per-person on/off setting (Account, Notifications), a `Mailer` port with a default that sends nothing (`server/src/notifications/mailer.ts`), and a one-pass delivery command. See "Email" below. | Three things: a provider implementation of `Mailer` (SES), a verified sending domain (an SES identity with SPF and DKIM records, and a sender address), and something to run the delivery command on a schedule. Account recovery by email is not built. |
| **Push notifications** (APNs for iPhone, later FCM for Android) | The same moments, on the phone | Nothing | An Apple Developer account, a push key, device-token storage, and a permission prompt in the app. |
| **A scheduler** (EventBridge Scheduler or a small worker) | Sending a reminder when its time comes, and handing queued email to the provider | Reminders are stored with a time and show as due inside the app. `npm --workspace server run notifications:deliver` finds due reminders, queues their email and hands every pending email to the mailer, once. | Something that runs that command every minute or so. Nothing runs it today. |
| **Hosting for the API** | Using Moodie from a real phone | A private AWS stack definition (`infra/aws`) and a container build | Your approval to upload the image and place the TMDB key in its secret store, then a public HTTPS address. Set `MOODIE_AWS_ACCOUNT_ID` before running `infra/aws/moodie.py`. |
| **Hosting for the web app** | A public address for the site | A production build (`npm run build`) | A host and a domain. Vercel is connected to this workspace and would work; so would S3 with CloudFront. |
| **Object storage** (S3) | Photos attached to responses | Photos are stored in the database today | A private bucket, signed uploads, and a move of existing photos. |
| **TMDB** | Film and show data and artwork | A key read from the environment locally | A written answer from TMDB on commercial use and on AI features before launch. |
| **A language model** (Amazon Bedrock) | The optional AI mode | The account-level AI choice and two server-enforced read tools | A model provider behind the explanation port, and an MCP endpoint for people who bring their own assistant. |
| **Moderation** | Reports and blocks at App Store standard | Reporting, blocking and a command-line review tool | A routine that does not require stopping the API, and image moderation for photos. |
| **Error and usage monitoring** | Knowing when something breaks | Nothing | A choice of tool and a privacy statement that covers it. |

## What "not connected" means in the app today

- No email leaves Moodie. No provider is connected, and no code in the repository can reach one.
- Recommending a film to someone creates the recommendation, an activity entry and one row in `notification_outbox` for the recipient. Replying queues one row for the person who recommended it. The rows wait as `pending`.
- A reminder you set is saved and comes due on Home and in Recommendations. Its email is queued only when the delivery command runs, and nothing runs it on a schedule.
- If the delivery command is run by hand, the default mailer sends nothing and marks each row `skipped` with the reason "no email provider connected". Skipped is final, so connecting a provider later does not send a backlog of old news.
- Account, Notifications has one checkbox, on by default. It is saved to the account and already respected by queueing; the page says that emails are not being sent yet.
- Nothing is sent to a phone. Push is not started.

## Email

What exists:

- **The emails.** `server/src/notifications/emails.ts` holds three pure functions that return `{ subject, html, text }`: a friend recommended a film (to the recipient), a reminder came due (to the recipient), and they told you how it landed (to the sender). Each is the recommendation note from the web, rebuilt for mail clients: tables, inline styles, 600px, system fonts, dark, with the sender's colour chosen the same way the web chooses it. Every string a person wrote is HTML-escaped. A reply marked as having spoilers is never shown in an email.
- **A preview.** With the API running outside production, open `/api/dev/emails/recommendation`, `/api/dev/emails/reminder` or `/api/dev/emails/reply` (`?format=text` for the plain-text part; `/api/dev/emails` lists them). In the preview that is `http://localhost:5273/api/dev/emails/recommendation`. The route is not registered when `NODE_ENV` is `production`.
- **The outbox.** `notification_outbox` (migration `202611160002-notification-outbox.sql`): who it is for, the kind, the recommendation, a status (`pending`, `sent`, `skipped`, `failed`), why it was skipped or failed, and times. One row per person, kind and recommendation, so nothing is queued twice. A row holds who and which film, never anyone's words: the email is rendered from the recommendation when it is delivered.
- **The rules.** One query (`emailSource` in `server/src/notifications/outbox.ts`) decides who may be emailed, at queueing and again at delivery: never across a block in either direction, never to or about a restricted or deleted account, never to a person who turned email off, never a reply that was removed or a reminder that was cleared, moved or already acted on.
- **The setting.** `users.email_notifications`, on by default, returned on the user payload and changed with `PATCH /api/auth/preferences` and `{ "emailNotifications": false }`.
- **Delivery behind a port.** `Mailer` has one method, `send({ to, kind, subject, html, text })`. `deliverPending(mailer)` claims pending rows, renders each and hands it over, then records `sent`, `skipped` or `failed`. `npm --workspace server run notifications:deliver` runs `queueDueReminders()` and `deliverPending()` once and prints the counts.

To switch it on, three things:

1. **A provider implementation of `Mailer`.** For SES, a small class that calls `SendEmail` with the HTML and text parts and resolves `{ status: 'sent' }`, passed to `deliverPending` in `server/src/scripts/deliverNotifications.ts`. Add `List-Unsubscribe` pointing at Account, Notifications. Keep its timeout well under ten minutes, the length of a row's claim.
2. **A verified sending domain.** An SES identity for the domain with its SPF and DKIM records, a sender address, production access for the SES account, and `MOODIE_WEB_URL` set to the public address of the web app so the links in an email lead somewhere.
3. **Something to run the delivery command on a schedule.** EventBridge Scheduler or a timer on the API host, about once a minute. Locally the embedded database can be opened by one process at a time, so the command cannot run beside a running API; hosted PostgreSQL has no such limit.

A failed row stays `failed` until someone sets it back to `pending`. There is no automatic retry and no bounce or complaint handling yet; both belong with the provider.
