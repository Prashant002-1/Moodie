# Moodie philosophy

Status: living document. First recorded 2026-11-13 from Prashant's own description of the project. Nothing here is permanent. When a principle changes, change this file first and add a line to the change log at the bottom, so the product, design and architecture documents can follow it.

This is the north star. [PRODUCT.md](../PRODUCT.md) says what the product does, [DESIGN.md](../DESIGN.md) says how it looks, [ROADMAP.md](ROADMAP.md) says what happens next. When they disagree with this file, this file wins.

## What Moodie is

Moodie is a social place for discovering films and television through people.

It is a log, a recommendation system and a way of responding to what you watched. It is a personal side project that Prashant is building because he wants to use it, in the hope that other people will see it and want to use it too.

It is not an AI application. It is not a streaming catalog. It is not a review site with a star average.

## The problem

Film discovery really runs on recommendations between people. The existing tools lose that.

Letterboxd and its relatives are logs: reviews, stars, lists. When someone recommends a film to you today, this is what happens:

1. You note it down or add it to a watchlist.
2. You forget about it.
3. Nothing reminds you.
4. If you do find it again, you no longer know who recommended it or why.
5. If you watch it, the person who recommended it never hears how it landed.
6. The two of you never talk about it.

Every step after the first is a place where something human was lost. Moodie exists to keep it.

## The loop Moodie protects

Someone recommends a title and says why → Moodie keeps the person and the reason attached to it → a gentle nudge brings it back, with the reason → you watch it → you record how it felt, what you liked, and who else might like it → the person who recommended it hears back → you talk → where two people responded alike, each becomes a path to more films for the other.

A feature earns its place by strengthening a link in that loop.

## Principles

### 1. People drive it

Discovery comes from people: friends who recommend things, and people who responded the way you did to something you both saw. The inspiration is Beli, the restaurant app, where there is no numbered rating and the whole thing is driven by people and comparison.

In Moodie the comparison is between two people on the same title: what you felt and what they felt. A match is specific. Two people can match on one film and differ completely on another, and both facts are worth showing.

*In the product:* no global scores, no popularity ranking as the default answer, no "the algorithm thinks". Every recommendation names a person.

### 2. A recommendation is a relationship, not a bookmark

A recommendation has a sender, a recipient, a title and a reason. All four stay together for as long as the recommendation exists. "They sent this to me" and "I found this through their response" are different things and are never blurred.

*In the product:* saving a title never strips the person or the reason. Watching it offers a way back to them.

### 3. Response, not rating

Stars say how many. They do not say what happened to you. A Moodie response says:

- how the film made you feel;
- what you liked about it, specifically;
- if you would recommend it, who would like it and why.

*In the product:* there are no stars and no numeric scores anywhere, for films or for people.

### 4. Feelings are recorded, never measured

This is the principle most likely to go wrong, so it is stated carefully.

There are many emotion-driven recommenders, and most feel like a gimmick, because the moment you measure how happy something made you, you have invented a number with no right answer. Moodie will let people capture what they felt, explicitly, but it must never pretend to measure it.

So there has to be a system for recording sentiment that stays honest:

- The person chooses words for what they felt. Moodie never detects, infers or scores a feeling from a face, a photo, a genre or a piece of writing.
- A feeling is present, or strongly present. It is not 63 percent.
- Feelings are never shown back as percentages, charts of the self, "taste DNA" or a diagnosis.
- Mixed and contradictory feelings are normal. A horror film can be joyful. Sadness is not a low score.
- Feelings are a way for two people to recognise each other on a title. They are not a mood picker that prescribes what to watch.

*In the product:* the feeling vocabulary and the way it is captured are still a scaffold (see the divergences below). Getting this right matters more than shipping it quickly.

### 5. AI is a choice

Every person chooses, on the first page of onboarding, between Moodie with AI and Moodie without it. The choice can be changed at any time.

- The core is identical in both. People, recommendations, responses, the diary and the matching between two people work the same way and never depend on a language model.
- With AI on, the same data is additionally available through tool schemas: optional analysis and explanation, and a connection so a person can bring their own agent.
- Moodie is not a chatbot. There is no agent at the centre of the product. People who want agents bring their own, and Moodie provides the connection.
- With AI off, no language model reads the person's diary, notes or conversations, and no assistant can be connected to the account. This is enforced on the server, not just hidden in the interface.
- AI never speaks for a person: it does not post, follow, recommend or reply in their name.

The people-led matching (comparing feelings two people entered on the same title) is ordinary arithmetic on what they wrote down. It is not what this switch controls and it works in both modes.

### 6. It should feel like walking into a cinémathèque

Moodie should be beautiful, smooth, fluid and artistic. The references are MUBI, the archives and directories of film institutions, a film festival such as Cannes, an art museum, and the shops that used to be lined with film discs.

What those places share: the work is the decoration. Composition, hierarchy and typography are clean and deliberate. It looks premium because nothing is competing with the films.

- Films and people's words carry the colour. The interface stays still.
- No ambient colour: no pink, orange or red gradient fields, no glows, no fog. They are visually distracting. They suit a product marketing page and do not belong in the product. (Direct feedback, 2026-11-13.)
- Typography does the work that ornament would otherwise do.
- Motion is smooth and has a reason.
- It should feel like a celebration of film, not a utility.

### 7. A celebration of film and of television

Moodie is not limited to films. Television belongs here too. Over time a person's Moodie becomes a record of what they watch and love, and a place to show it: favourites, the things that stayed, what they are recommending.

### 8. Gentle memory

The nudge is part of the product, not growth machinery. A reminder is welcome when it carries the reason: who thought of you, and what they said. It is not a streak, a deadline or a guilt counter.

### 9. Everywhere people are

An iOS app first, on the App Store as soon as it is good enough. Then the web, and Android, because people should be able to get it wherever they are. The three clients share one account, one API and one design system.

### 10. Built to last, built to change

This will run for months. Good foundations and scaffolding matter more than any single feature. Goals, principles and this philosophy will evolve. Work that no longer fits the direction can be dropped without ceremony.

## What should make Moodie different

Desk research on 2026-11-13 is in [MARKET_LANDSCAPE.md](MARKET_LANDSCAPE.md). The short version:

- Several small apps now remember who recommended something. Remembering alone is not the difference.
- Nobody found connects the whole loop: the reason, the later viewing, a response that is not a number, and a reply to the person who recommended it.
- Mood pickers are widely seen as gimmicks. Recording a response *after* watching is a different act from picking a mood *before* watching, and Moodie has to make that difference obvious. The name "Moodie" points at the weak version of the idea, which is a risk to manage.
- No product found offers AI as an explicit choice at onboarding.
- Trackers die and take people's data with them. Export and a plain account of how Moodie pays for itself would stand out.

## Where the current build diverges from this

Recorded honestly so the gap is visible. Each item is tracked in [ROADMAP.md](ROADMAP.md).

| Principle | State on 2026-11-13 |
| --- | --- |
| 2. Recommendation as relationship | Built on both clients: reason, linked viewing, reply, conversation. |
| 3. Response, not rating | Built. No stars. "Who would like it and why" is only captured when sending a recommendation, not as part of a response. |
| 4. Recorded, not measured | Partly. Feelings are chosen directly, but the scaffold still stores seven keys inherited from a facial-emotion model (`happy`, `angry`, `disgusted`…), offers 0 to 100 intensity sliders behind a disclosure, and iOS reads intensity aloud as a percentage. This is the gimmick risk in concrete form. |
| 5. AI is a choice | The choice exists at onboarding and in Account on web and iOS, and the server enforces it. No AI feature or agent connection is live yet, so today "on" changes nothing visible. |
| 6. Cinémathèque | The ambient gradient field, scanlines and grain were removed and a shared token system introduced. The landing page and several signed-in screens still need to be recomposed to this standard. |
| 7. Television | Not built. The catalog and data model are film-only. |
| 8. Gentle memory | Not built. There are no notifications of any kind, and an earlier decision ruled reminders out. That decision is reversed by this document. |
| 9. Everywhere | iOS (SwiftUI) and web (React) exist and run. Android does not exist. Nothing is deployed for real use. |

## Open questions

- What is the feeling vocabulary, and how is strength expressed without a number?
- Is the name right, given what the market research says about "mood"?
- What exactly does a person get from AI mode on day one?
- How does a nudge decide when to speak, and how does a person quiet it?
- How does a brand-new person get value before any friend has joined?
- How does Moodie pay for itself, given the catalog licence terms?

## Change log

- 2026-11-13: First version, from Prashant's spoken brief. Added the instruction to remove gradient colour fields the same day.
