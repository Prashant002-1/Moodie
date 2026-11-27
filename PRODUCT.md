# Product

## Product purpose

Moodie is social film discovery driven by people: a log, a way of responding to what you watched, and recommendations that keep the person and the reason attached. The principles behind every decision here are in [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md); where this file and that one disagree, the philosophy wins and this file is out of date.

Television, reminders that carry the reason, and a feeling vocabulary that records without measuring are part of the direction but not yet built. See [docs/ROADMAP.md](docs/ROADMAP.md).

A person shares a film alongside what it meant to them and the feelings that stayed with them. A shared film and overlapping feelings can connect that person to someone else's response, then to another film. The signed-in feed keeps people and their responses at the center. The diary preserves a person's history, and the catalog remains available underneath discovery.

Moodie invites a first-person response: how the film felt, what it brought up, and what remained afterward. A person can also say whether they enjoyed it and what stood out, without assigning a score or writing formal criticism.

## The social response

One shared response contains:

- the film;
- a first-person note about what the film meant to the person;
- a reviewed mix of feelings;
- public or private visibility;
- an optional expression photo chosen by the person.

The note and feeling controls are the complete path. The person sets the feelings that belong to the viewing before saving.

An expression photo is an optional, playful reaction attached to a response. It adds a little life when the person wants it; it is not emotional evidence, is never analyzed, and is optional even when the response is public.

There are no user ratings. TMDB metadata may contain catalog values internally, but ratings and vote counts do not appear in the product experience and do not power personal recommendations.

## With or without AI

The first screen after joining asks how Moodie should work: **People only** or **People, with AI**. The choice is stored on the account (`users.ai_mode`), can be changed in Account, and is enforced by the server.

- Everything in this document works identically in both modes. People-led matching compares feelings two people entered on the same film; it is not a language-model feature and is not what the choice controls.
- With AI off, or not yet chosen, every assistant tool refuses the account. No language model reads its diary, notes or conversations and no external assistant can be connected.
- With AI on, the account may use model-backed explanation and connect its own assistant through authorized, read-only tools. Neither is live yet; the choice is recorded now so it applies from the first release that includes them.
- AI never posts, follows, recommends or replies for a person.

## Product surfaces

The complete signed-in information architecture and user journeys live in `docs/PRODUCT_SPEC.md`.

### Public overview

The public landing page explains the product as a human sequence: the small moment after a film, keeping words and feelings, recognizing another person, and finding films through them. It shows multiple films so the discovery network is legible, explains who the product is for, and makes the care behind privacy, contradiction, and optional media visible. It does not expose a streaming-style catalog. Sign up creates an individual account; sign in restores the same diary and social connections.

### Feed

The signed-in home has For you, Following, and Everyone views. For you leads with what people sent, then new films from friends, then films that reach the person through people, people to meet, and recent responses. Each film through people names who loved it, carries their words, and says what the two have in common. Someone with a nearly empty diary is asked about films they may have seen. Following and Everyone become chronological streams of complete responses. Every response keeps the person, film, note, feeling trace, and optional photo together. The home is dense enough to support several discovery paths without becoming a metrics dashboard or making photos and likes the primary content.

### Add a film

The composer starts with a film, then asks: how did it make you feel, and what did it mean to you? Direct controls and writing create one complete response.

### Discovery paths

A film reaches a person through someone they follow, someone whose pick landed with them before, someone who responded alike to a film both have seen, or, more weakly, a friend of a friend. What that person made of the film ("loved it", "liked it") decides how strongly it is offered. How this works, how it was tested and what did not work are in [docs/DISCOVERY.md](docs/DISCOVERY.md).

One shared film can begin a path. Agreement strengthens it and disagreement weakens it as both diaries grow. A person can follow the path into a focused exploration view, open the film, or continue to the source person's responses. Search remains a supporting tool, not the product's organizing idea.

### Diary

The diary is a person's private and public history. It supports editing, visibility, saved films, and reflection over time. It does not turn the person into a taste score or genre profile.

### People

People is the connection surface. It separates people already followed from wider discovery, keeps each person's latest film and response visible, shows a shared film when one exists, and supports following in place. It does not show compatibility scores or reduce a person to a taste profile.

### Search

Search covers films, feelings, and people. Film search supports saving and adding a response. Feeling search starts with how the person wants to feel, keeps genre open, and returns films that connected people described with those feelings. Every result keeps the person, shared film, overlapping feelings, and source response visible. People results keep shared-film context and follow actions visible.

### Activity

Activity is the return trail for likes, comments, followers, and recent responses from people already followed. Every event links to the person, film, or exact response that caused it. The product does not claim unread state without storing it.

### Film and member pages

A film page leads with the film, then separates responses from related films. A member page uses separate views for that person's public responses and the films that stayed with them. Navigation should move naturally between a person, a shared film, and another response without placing every path on screen at once.

## Recommendation rules

- People-led recommendations are the primary personalized source.
- A person is a source through a follow, a pick that landed, a film both responded to, or a friend in common. Each is shown as the reason.
- A recommended film must come from a real public response by that person, and their verdict on it counts.
- A film the viewer set aside ("Not for me") is not offered again.
- A person may compare both written responses to the shared film without seeing an internal score.
- Genre, TMDB rating, vote count, and universal emotion-to-genre mappings do not determine recommendations.
- Popular or trending catalog items may be used only as an explicitly separate cold-start or browse fallback.
- Pseudo-scientific percentages are not presented as proof of compatibility.

## Product principles

1. **People are the discovery engine.** Films become relevant through another person's lived response.
2. **Response, not review.** The product invites meaning and feeling, not scores or criticism.
3. **The person is the authority.** Direct input is complete.
4. **Social has a purpose.** Follows, public responses, likes, and comments create paths to films rather than popularity theater.
5. **Private stays private.** A private response may improve the owner's matching but never appears in another person's feed or recommendation explanation.
6. **Media is not evidence.** An attached expression photo is optional social context, not a biometric signal.
7. **No emotional stereotypes.** Sadness does not mean drama, and joy does not mean comedy. Relationships are learned between people and films.
8. **Simple language.** Use response, feelings, note, person, film, diary, and recommendation only when the word is needed. Avoid invented system names, page-sized labels, and technical explanations in the interface.
9. **Film art and human words carry the experience.** Technology should remain quiet.

## Data boundaries

`diary_entries` is the source of truth for one person's response to one viewing. The film, note, visibility, and reviewed feeling mix are saved atomically.

The reviewed feeling mix is set directly by the person. Only those saved values are used for matching.

Optional post media is stored separately from the reviewed feeling mix. Removing the media must not change the meaning or recommendation value of the response.

Saved films, follows, likes, and comments are separate relationships. A like expresses resonance with a response, not a universal judgment of a film.

Personal recommendations preserve who suggested a film, why, and what happened after the viewing. Deliberate suggestions and discovery through a public response remain distinct. Enjoyment and memorable details supplement feeling input. A private diary response can lead to a separately composed reply to one person, followed by a conversation. The native-first behavior and portable API are defined in [Recommendation lifecycle](docs/RECOMMENDATION_LIFECYCLE.md), with [Beli research](docs/BELI_RESEARCH.md).

The current seven-key vector is a prototype constraint. It must not become the permanent feeling vocabulary. The target is defined in `docs/EMOTIONAL_SIGNAL_MODEL.md`.

## API boundaries

- `/api/catalog`: server-side TMDB access; keys never ship to the browser.
- `/api/diary`: complete response reads and writes plus diary summary.
- `/api/library`: saved films only.
- `/api/suggestions`: personal recommendations, attribution, viewing links, explicit replies, and participant conversations.
- `/api/recommendations`: people-led recommendations and separate catalog fallbacks.
- `/api/discovery`: feed, public responses, people, follows, likes, and comments.
- `/api/discovery/for-you`, `/introductions`, `/recipients`, `/starter`: films through people, people to meet, who to send a film to, and a newcomer's first films ([contract](docs/api/discovery.openapi.json)).
- `/api/discovery/activity`: likes, comments, and follows that lead back to the exact social event.
- `/api/discovery/pulse`: films with recent public responses from the community.
- `/api/auth`: sign up, sign in, persistent sessions, profile, the AI choice (`PATCH /api/auth/preferences`), password, recovery code, sign out, and account deletion.

## Accessibility and inclusion

Target WCAG 2.2 AA. Every core flow works with keyboard input. Focus remains visible. Tap targets are at least 44 by 44 pixels. Motion respects `prefers-reduced-motion`. Feeling data never relies on color alone.

## Data policy

Attaching a photo is a separate, explicit choice. Photos are never analyzed and do not affect recommendations. Private responses remain private. Written notes remain part of the diary. No demo-content seeding runs at server startup. `database/seed-contract.json` defines the separate seed-data task.


The discovery mechanism now learns cross-film emotional response transfer from public, user-entered feelings. Its model activates only after beating simple baselines on later validation responses; small communities retain transparent shared-film paths while collecting evidence. The same connection evidence drives recommended films, connected-response previews and people discovery. Implementation and evaluation: [Learned recommendations and feed](docs/LEARNED_RECOMMENDATIONS.md).
