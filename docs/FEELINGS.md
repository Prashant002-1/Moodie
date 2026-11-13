# Feelings

Written 2026-11-13. How Moodie records what a film felt like without pretending to measure it. This replaces the approach in [EMOTIONAL_SIGNAL_MODEL.md](EMOTIONAL_SIGNAL_MODEL.md) wherever they differ.

## The rule

A feeling is a word a person chose. Moodie records which words and in what order. It records nothing else about them.

There is no right way to measure how happy a film made someone, so Moodie does not ask. Asking "how much, from 0 to 100" invents a number with no answer. Asking "which of these, and which first" is a question a person can answer honestly.

## What a response is

| Part | Question | Form |
| --- | --- | --- |
| Feelings | What did you feel? | Up to three words, in order. The first is the strongest. |
| Verdict | How was it? | Loved it, Liked it, Mixed, Not for me. Optional. |
| What stood out | What stood out? | Any of: story, characters, performances, dialogue, images, music, ending. Optional. |
| Note | | Free text. |
| For whom | Who would like it, and why? | Written when recommending it to a person. |

The verdict is separate from the feelings on purpose. A film can leave someone tense and heartbroken and be the best thing they saw all year. Sadness is not a low score.

## What changed on the web (built)

- The picker is seven word chips. Choosing one adds it to the order; the chip shows 1, 2 or 3. A fourth cannot be added until one is removed.
- The intensity sliders and percentages are gone.
- Feelings are displayed as plain words, strongest first, in ink. The per-feeling colours, the coloured bars and the colour legend are gone.
- The diary no longer opens with an averaged "your feelings over 30 days" headline and stat tiles. A chart of the self is a diagnosis.
- "Choose a feeling" on recommendations and the search-by-feeling tab are gone. Those were mood pickers.

## What is still scaffold

- **The words.** The seven are still the ones inherited from a facial-expression model, relabelled: Stillness, Joy, Melancholy, Friction, Tension, Unease, Wonder. They are not how people talk about films.
- **Storage.** The server still stores seven decimals per response. The web now writes fixed values by position (first 1, second 0.6, third 0.3) so the existing comparison between two people keeps working. The numbers are never shown.
- **iPhone.** The native app still has the sliders and reads intensity aloud as a percentage. It changes when the phone is redesigned.

## Proposed vocabulary (needs your decision)

Sixteen words people use after a film, including the unflattering ones, so a response can be honest about a film that did nothing:

Moved · Heartbroken · Comforted · Hopeful · Delighted · Amused · Thrilled · Tense · Scared · Disturbed · Angry · Awed · Nostalgic · Lonely · Bored · Unmoved

Rules for the list: every word finishes the sentence "It left me…"; none is a genre; none is a judgement of quality (that is the verdict); the list is versioned so it can grow without breaking old responses.

## How two people are compared

Only on a film both have responded to, and only in words: "You both felt tense. You felt angry; Ananya was amused." No percentage, no compatibility score. The overlap decides whose other films are offered to you, and the two responses are always shown as the reason.

## Migration when the vocabulary is decided

1. Add an ordered `feelings` list to a response on the server, validated against the versioned vocabulary.
2. Keep the seven legacy columns for now, derived from the list by a fixed mapping, so matching keeps working while it is rebuilt on word overlap.
3. Old clients that send the seven numbers are converted to an ordered list on the server.
4. Update the three API contracts, the web types, then the iPhone app.
