# Web UI rules (working brief)

Moodie's identity is **The Lobby**: the room outside a cinema after the film, where people talk about what they just saw. Dark midnight walls, warm marquee light, posters, and friends, each with their own colour. It should feel alive, personal and a little playful, like a well-made film magazine, and never like a database or a settings screen.

Every screen is built from the shared classes in `src/styles/app.css`, which uses only the tokens in `design/tokens.json`. **Read that stylesheet in full first.** Worked examples of the look: `src/pages/Feed.tsx` (home), `src/components/suggestions/RecommendationNote.tsx` (the signature object), `src/components/response/ResponseCard.tsx`, `src/components/layout/Layout.tsx`, `src/components/common/Avatar.tsx`.

## The system

- **Canvas and bands.** Pages sit on the midnight canvas inside a fixed box (`.page`, 1040px; `.page--narrow` 720 for reading; `.page--form` 420). A page that deserves an opening gets a **band**: `<section class="band"><div class="box">…</div></section>` in the second tone, placed before the `.page`. A band may carry film artwork: add `band--art` and `<img class="band__art" src={backdrop}>` as its first child (the scrim is built in). Use bands for the top of home, a film, a person, the recommendations hub. One band per page.
- **Type has three voices.**
  - Serif, heavy (`h1`–`h3`, `.row__title`, `.rec__title`, `.response__film`, `.tile__title`): film titles and page titles. A year beside a title is `<span class="year">`.
  - Serif, regular: people's words. `.note` for what someone wrote about a film; `.quote` (italic, larger) for what someone said *to you*, such as the reason on a recommendation or a reply.
  - Sans: everything the interface says. Section headings are small capitals: `<header class="section__head"><h2>New from friends</h2><a>All activity</a></header>`. `.label` for a small-capital label on its own.
- **People have colours.** Every person has a colour from their username: `personHue(username)` in `src/utils/person.ts`. Put `data-hue={personHue(name)}` on a container and their `<Avatar>`, `.who` name, `.byline` link, `.quote` rule and `.badge--hue` all take that colour. Always use `<Avatar username size? to? />`; never a hand-made initial. A person's name is `.who`. This is where the product's colour and life come from: use it wherever a person appears.
- **Films are posters.** Show artwork generously. `.poster` (+ `--xs --sm --lg --xl`); posters gain a marquee-coloured edge on hover when they are links. A row of films is a **wall**: `<div class="wall">` of `<article class="tile">` (poster, optional avatar in the corner with `.tile__who`, then `.tile__name` / `.tile__title` / `.tile__sub`). `.poster-grid` for search results and long sets.
- **A recommendation is a note.** Anything one person recommended to another is rendered with `<RecommendationNote>` (class `.rec`), full or `compact`. Do not build another presentation of it.
- **A response** in any list is `<ResponseCard>`. Two columns of them: wrap in `<div class="columns">`.
- **Feelings** are shown only with `<Feelings entry={…} />`: words, strongest first. Never percentages, sliders, bars or averages. Feelings have no colours; colour belongs to people and artwork.
- **Colour.** The marquee yellow (`--m-color-accent`) is for the one primary action on a screen (`.btn--primary`), the current tab, selected chips and state marks (`.badge--accent`, `.rec__state`). Text in the accent colour uses `--m-color-accent-ink`. Person colours are for people only. No other colours, no gradients (the band scrim is the only one), no glows, no tinted panels.
- **Controls.** `.btn` with `--primary`, `--secondary`, `--quiet`, `--small`, `--icon`, `--caps`. `.tabs` (aria-pressed buttons or aria-current links; a count is `<span class="tabs__count">`). `.chip` (aria-pressed). `.field` > `label` + `.input` / `.textarea` / `.select`. `.search` forms. `.options` / `.option` for a choice among whole options. `.menu` + `.menu__list` for a small menu under a button. `.badge` for a state. `.stats` / `.stat` for a few counts set large.
- **Lists.** `.list` of `.row` (poster or avatar, `.row__main`, optional `.row__aside`) for dense sets. `.panel` for a bounded block. `.two-up` for two equal columns.
- **States.** `.status`, `.empty`, `.notice`, `.notice--error`, `.loading`.
- Inline `style` only for one-off spacing with `var(--m-space-*)`. A new rule goes in your area's stylesheet (named in your task), tokens only: no raw colours, no sizes outside the scale, no new fonts.
- Must work at 375px wide and in the light theme (`data-theme="light"` on `<html>`; tokens handle it, so never hard-code a colour).

## Words

The person using Moodie is the most intelligent part of the system.

- Warm and personal is welcome when it is true and specific: "hiro thought of you", "Good evening, prashant". Generic persuasion is not: no slogans, no "start your journey", no sentence explaining what a screen is for.
- Empty states are one short factual sentence and at most one action.
- Plain nouns and verbs: Recommend, Remind me, Reply, Save, Follow, Diary, Log.
- Nothing is said or shown twice on one screen.
- Keep every error message and every confirmation that protects data or privacy.

## Keep working

- Do not change data loading, services, hooks, routes or behaviour unless your task says so.
- Keep accessible names (`aria-label`, label text, button text) where they are still accurate: tests in `tests/frontend` find elements by them. Where you change UI or copy, update the affected tests in the same change so they assert the new behaviour honestly. Never delete a test just to make it pass.
- Node 22 is required: prefix commands with `export PATH="/Users/prashantshah/.local/bin:$PATH"`.
- Check your own work: `npx eslint <your files>`, `npx vitest run <your test files>`, `npx tsc -b`. Other people are editing other files at the same time; ignore errors in files that are not yours, and re-run near the end.
- A dev preview is running at http://localhost:5273 (API on 3101) with hot reload; sign in as `ios_viewer` / `native-test-password`. Look at your screens there at 1280px and 375px if you have a browser tool. Do not stop or restart those servers.
- Do not commit or run git commands that change state. Do not edit `src/styles/app.css`, `design/tokens.json`, `Layout.tsx`, `Feed.tsx`, or files outside your task. If you need a shared class that does not exist, add it to your own stylesheet and say so in your report.
