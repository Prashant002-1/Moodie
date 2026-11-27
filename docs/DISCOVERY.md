# Discovery through people

Written 2026-11-27. How Moodie decides which films, people and recipients to put in front of someone, what was tried, and what did and did not hold up. It follows [PHILOSOPHY.md](PHILOSOPHY.md): every film reaches a person through a person, and nothing is shown as a score.

The web app runs on this. The iPhone app still calls the older `/api/recommendations` ([LEARNED_RECOMMENDATIONS.md](LEARNED_RECOMMENDATIONS.md)), which is unchanged; moving it over is listed under "Not done".

## What it does

A person is a **source** for you when any of these is true:

| Evidence | What it is | Shown as |
| --- | --- | --- |
| A pick that landed | They sent you a film, or you kept one through their response, and you then enjoyed it. A pick you did not take to counts against them. | "You loved Aftersun, which came from clara." |
| A shared film | You both responded to the same film. Your verdicts and the words you chose are compared. Disagreement counts against. | "You both felt melancholy after Past Lives." |
| A follow | You follow them. | Nothing more is said. |
| A friend of a friend | Someone you follow follows them. Weak, and only one step out. | "clara follows hiro." |

Each source's public responses to films you have not responded to become **paths**. How strongly a path counts is the trust in the person times what they made of the film: loved, liked, no verdict, mixed. A trusted person's "not for me" pulls the film down and is shown ("Not for tariq").

The rules that shape the list:

- Up to three people count towards one film. A fourth adds nothing.
- The same person does not lead film after film: each repeat is worth less.
- A film is left out if you have responded to it, set it aside, saved it, or been sent it.
- A person you keep disagreeing with stops being a source.

The same evidence orders **people to meet** (a shared film, friends in common, or that they follow you) and **who to send a film to** (followers who loved something you sent, or felt the same about a film you both saw).

Code: `server/src/discovery/engine.ts` (pure functions, no database), `service.ts` (what may be read, and privacy), `routes/paths.ts`. Contract: `docs/api/discovery.openapi.json`.

## Privacy

- Only other people's **public** responses are read. Your own private responses count for you alone.
- Blocks and moderation apply to every row.
- Someone who sent you a film learns how it went only from a reply you chose to send. Your private viewing never connects them to you.
- What you set aside is private.
- Tests in `server/tests/discovery-paths.test.ts` hold each of these.

## How it was tested

There are no members yet, so there is no real answer to "did this recommendation work". The lab (`npm run discovery:lab`, `server/src/evaluation/`) builds made-up communities in which the truth is known: for every person and film, whether that person would have liked it. People have hidden tastes, follow others, choose films partly through friends, write verdicts and feelings, and send recommendations. The clock stops four fifths of the way through; each strategy sees only what was public then and is judged on the first five films it offers each person.

The settings Moodie cannot know yet are varied on purpose: how much the feelings people choose say about whether they enjoyed a film, how alike the people someone follows are to them, how often people give a verdict, and the size of the community. A finding counts only if it holds across them.

**This tests mechanics and robustness. It says nothing about real people.** The tastes in it are invented. Real members are the only real test.

Columns: **yield** is how many of the first five a person would have liked, averaged over everyone. **Finds** counts only liked films outside the most written-about twentieth, the ones a person would not have met anyway. **Personal** is yield minus the yield of handing each person somebody else's list. **New** is yield for people with an empty diary.

A town of 150 people (mean of three seeds):

| Strategy | Yield | Finds | Personal | New |
| --- | --- | --- | --- | --- |
| Any film someone wrote about | 2.37 | 2.23 | −0.01 | 2.53 |
| Most written about (not offered by Moodie) | 3.59 | 0.06 | 0.10 | 3.07 |
| Best loved overall (not offered by Moodie) | 3.81 | 2.16 | 0.07 | 3.80 |
| The engine before this one | 2.45 | 2.40 | 0.12 | 0.00 |
| Feelings on shared films only | 3.10 | 1.66 | 0.25 | 0.00 |
| Verdicts only | 3.56 | 2.15 | 0.33 | 0.00 |
| Feelings and verdicts | 3.67 | 2.22 | 0.41 | 0.00 |
| + follows | 3.93 | 2.32 | 0.45 | 3.80 |
| + what landed | 3.93 | 2.34 | 0.47 | 3.80 |
| + friends of friends (**what ships**) | 4.01 | 2.46 | 0.50 | 4.07 |
| If Moodie knew exactly how alike two people are | 4.42 | 2.66 | 1.10 | 4.60 |

Full results for ten worlds are in `docs/discovery-lab.json`.

## What worked

1. **Reading the verdict.** The earlier engine ranked by how alike two people felt about a shared film and never looked at whether the person liked the film they were being cited for. In every world it did about as well as picking any film (2.45 against 2.37 here). Using "loved it" and "liked it" is the largest single gain.
2. **Follows.** They are the only thing that reaches someone with an empty diary (0.00 to 3.80), and they never hurt, even when follows were made random.
3. **Feelings and verdicts together.** Verdicts carry most of the ranking. Feelings add a little, and they keep it working when few people give a verdict (verdicts alone fell to 2.30 and reached only 73 percent of people; with feelings, 3.33 and 95 percent). When feelings were made to say nothing about enjoyment, using them cost nothing.
4. **Three voices per film.** Letting one person decide loses accuracy (3.67). Letting everyone count turns the list into "most popular among your people" (finds fall from 2.46 to 1.77). Three is better than both.
5. **Showing disagreement.** Lowering a film when a trusted person disliked it barely changes yield but keeps the list off the films everyone has already heard of (finds 2.46 against 1.81 without it).
6. **Spreading people out.** Costs about 0.03 of a film in five and puts five different people in front of you instead of three.
7. **Asking a newcomer about films they have seen.** The biggest lever found, and it is a product step, not arithmetic. When each new person answered for four well-known films, yield rose from 4.01 to 4.20 and finds from 2.46 to 3.69, because everyone then shares films with everyone. Most of that came from the answers being public: kept private, yield was 4.01. This is why the first answers default to "Everyone", with "Only me" beside it.
8. **Friends of friends, weakly.** Small gains in most worlds, mainly for newcomers (new people 3.80 to 4.07 here, 3.52 to 4.09 in the city). It did slightly worse in the 30-person world, where almost everyone is already one step away.

## What did not work

- **The learned model** (`response-transfer-v1`). It needs 30 usable later responses before it switches on, so in any community of the size Moodie will start with it never does, and what is left ranks no better than chance. It is still in the repository and still serves the iPhone app.
- **Weighting agreement by how rare the film is.** No measurable effect. Removed.
- **Judging agreement against what most people made of the film** (two people loving a film everyone loves says little). A plausible idea; the gain was 0.00 to 0.04. Removed.
- **Counting well-tested people much more than barely known ones.** No consistent effect. Removed.
- **How past recommendations landed** makes no measurable difference in the lab, because few recommendations are sent in it. It is kept: it costs nothing, it is the most direct evidence there is, and it gives the most concrete reason on screen. Whether it matters is a question for real use.

## What the lab cannot tell us

- Whether real people's feelings and verdicts relate the way the simulation assumes.
- Whether people act on these: save, watch, reply. The measure is "would have liked", not "did watch".
- Anything about notes. Words are never read by the engine.
- The honest ceiling. Even told exactly how alike two people are, the engine reaches 4.42 of 5, and its own knowledge of people gets it under half of the personal part of that. Most of what it offers is "films people near you loved", not "films only you would love". Knowing people better needs more shared films, which is what the first answers are for.

## What it drives in the interface

| Screen | What it shows |
| --- | --- |
| Home, "Through people" | Three films, each with who loved it, their words, the reason, other voices, and Save, Seen it, Not for me. |
| `/recommendations` | The whole list, a page at a time. |
| Home and People, "People to meet" | People with a reason, and Follow in place. |
| `/start`, and Home for a nearly empty diary | "Seen any of these?": tap a film, say how it was. |
| Recommend a film | Followers the film suits come first, each with the reason. People who already wrote about it are named. |
| After saving a response | "Who might like it?", when there is someone with a reason. |

## Not done

- **The iPhone app** still uses the old ranking. Its endpoint was left alone because the app cannot be built or checked here.
- **First answers are dated the day they are given.** The diary has no "seen some time ago".
- **Scale.** Every request reads all public responses. Fine for a small community; measure before it grows.
- **Likes and comments** are not used as evidence. They could be; nothing here tested it.
- **The vocabulary.** The engine compares words without knowing what they mean, so the sixteen-word proposal in [FEELINGS.md](FEELINGS.md) can replace the seven without touching it.
