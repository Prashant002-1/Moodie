# Human recommendations: Beli to Moodie

Research date: 2026-09-21. Scope: public product material, published interviews, App Store reviews, and a small qualitative sample of user discussions. This is product discovery, not a representative survey or market-size estimate. iPhone is the first client.

## Findings and decisions

| Evidence | What matters | Moodie decision |
| --- | --- | --- |
| Beli's [official site](https://beliapp.com/) presents tracking, sharing friends' experiences, and discovery together. Its [App Store listing](https://apps.apple.com/us/app/beli/id1478375386) documents notes, favorite dishes, tags, a friend feed, taste profiles, and match scores. | The remembered experience and the person make a saved place useful. | Keep the title, the person, the reason, and the eventual response together. Translate favorite dishes into specific things that stayed: performances, characters, dialogue, images, music, story, ending. |
| [TASTE's interviews, June 24, 2025](https://tastecooking.com/beli-invites-the-loneliest-generation-to-dine-out/) describe people connecting through Beli and consolidating scattered Notes lists. Interviewees also describe a lower-pressure alternative to public reviews. | Personal utility works before an audience exists; a record can become a relationship. | Saving through somebody's response works immediately. Direct suggestions carry a short personal reason. Private diary writing and a reply to one person are separate choices. |
| [Users discussing Beli, July 2025](https://www.reddit.com/r/finedining/comments/1ls6pvj/) like having photos, notes, recommendations, and personal history together. Others dislike comparing very different experiences or need more friends before the feed is useful. | Context is more useful than one universal ordering. | No pairwise film ranking, scores, streaks, invitation gates, or compatibility percentages. Keep the existing emotional evidence and add subjective enjoyment independently. |
| [A September 2025 discussion](https://www.reddit.com/r/finedining/comments/1n600fm/i_changed_my_mind_about_beli/) praises fast bookmarking but criticizes long ranking flows, onboarding gates, and recommendations that ignore dislikes. | People need a low-effort capture path and permission to disagree. | Keep recommendations with one action; use optional enjoyment choices and highlights; retain finer feeling sliders behind a disclosure. "Not for me" is a valid reply, never a penalty for the recommender. |
| [April 2026 tracking discussion](https://www.reddit.com/r/finedining/comments/1sof6gz/what_apps_are_people_using_to_track_restaurants/) distinguishes wanting to try something from wanting it urgently and questions comparisons across unlike restaurants. | A backlog needs context and state, not more pressure. | Separate received, sent, and archived suggestions. Preserve reasons across saving and viewing. No overdue reminders or publicly visible rejection state. |
| [Film viewers, July 2025](https://www.reddit.com/r/Cinema/comments/1m94hht/) explicitly ask to recommend a movie to a particular friend with a note. [Letterboxd discussion, January 2025](https://www.reddit.com/r/Letterboxd/comments/1hyakr2/) asks for recommendations organized by friend. | There is a concrete unserved job within some users' existing film routines. | A conversation belongs to the recommendation and its title, with a return path to the person. Treat this as a hypothesis worth testing, not proof of a market. |

## Public API check

Beli publicly describes features, but this check found no official public developer API or supported integration documentation. The [unofficial SDK's own documentation](https://www.npmjs.com/package/%40mergd/beli) explicitly calls its interface Beli's private mobile API and says it is unaffiliated. Publicly visible reverse-engineered clients are not an official API. No Beli credentials, private endpoints, or SDK are needed for this implementation.

## Distinctive hypothesis

The useful unit is a recommendation between two people, not a rating on a title. Preserve the difference between "they sent this to me" and "I found this through their response." Then close the loop with what actually happened: a viewing, enjoyment, specific highlights, chosen feelings, and a conversation. Shared-film emotional evidence can open that relationship; an explicit reply gives it continuity. Never pretend that algorithmic discovery was a personal endorsement.

This combination is a product hypothesis, not a claim of research novelty. [LaterRex](https://laterrex.com/) already advertises recommending to a friend with a note across media. Moodie's differentiation therefore has to come from the connected emotional evidence, the private-to-person reply boundary, and the quality of the complete journey, not the mere existence of a send button.

## Follow-up validation

Use small consenting friend pairs. Can each person retrieve who suggested a title and why? Does a viewing produce a voluntary reply? Can they disagree comfortably? Can a person use the diary before inviting anyone? Compare completed suggestion-to-reply journeys and meaningful follow-up conversations, not time spent, notification opens, ranking volume, or claims about inferred feelings. No analytics SDK is added here.

Implementation contract: [Recommendation lifecycle](RECOMMENDATION_LIFECYCLE.md). Machine-readable API: [OpenAPI](api/suggestions.openapi.json).
