# Web UI rules (working brief)

Every web screen is built from the shared classes in `src/styles/app.css`, which uses only the tokens in `design/tokens.json`. Read that stylesheet first. Worked examples: `src/components/layout/Layout.tsx`, `src/pages/Feed.tsx`, `src/pages/Log.tsx`, `src/components/response/ResponseCard.tsx`, `src/components/diary/FilmPicker.tsx`, `src/components/diary/FeelingChoices.tsx`.

## Look

- White (or near-black in dark) canvas, ink text, hairline rules. No cards-in-cards, no shadows, no gradients, no tinted panels, no decorative icons, no coloured dots or bars.
- Film and show titles are serif (`h1`/`h2`/`h3`, `.row__title`, `.response__film`). Everything else is the sans face. No uppercase labels, no wide letter-spacing.
- One column where possible. `.page` (1120), `.page--narrow` (680) for reading and lists, `.page--form` (440) for sign-in style forms.
- Lists are `.list` of `.row` (poster or avatar, `.row__main`, optional `.row__aside`), separated by hairlines. Section headings are `<header class="section__head"><h2>…</h2><a>See all</a></header>`.
- Posters use `.poster` with size modifiers and no fallback icon (an empty `.poster` is the fallback). Do not use `BrandMark`.
- Buttons: `.btn` with `--primary` (ink), `--secondary` (outline), `--quiet`, `--small`, `--icon`. One primary action per screen at most. Text links are `.link`.
- Tabs are `.tabs` with `aria-pressed` buttons or `aria-current` links. Chips are `.chip` with `aria-pressed`.
- Forms: `.field` > `label` + `.input` / `.textarea` / `.select`; search forms are `<form class="search" role="search">` with an `.input` and one `.btn`.
- Feelings are shown only with `<Feelings entry={…} />` (`src/components/response/Feelings.tsx`): words, strongest first. Never percentages, sliders, colours, bars or averages.
- A response in a list is `<ResponseCard />`. Do not write a second version of it.
- Status and empty states: `.status`, `.empty`, `.notice`, `.notice--error`.
- Inline `style` only for one-off spacing with `var(--m-space-*)`. Need a new rule? Put it in your area's stylesheet (named in your task), using tokens only: no raw colours, sizes outside the scale, or new fonts.
- Must work at 375px wide and in dark mode (tokens handle colour; never hard-code one).

## Words

The person using Moodie is the most intelligent part of the system. The interface never sells, explains itself or holds a hand.

- No slogans, taglines or persuasion inside the product ("A new connection starts with a film", "Start with a film that stayed with you", "Films reach you through people").
- No sentence that explains what a screen is for. A heading, a label and the content are enough.
- Empty states are one short factual sentence and, if useful, one action. "No saved films." not "Films you keep for later will appear here."
- Labels are plain nouns and verbs: Watchlist, Diary, Search, Follow, Reply, Save, Send. Never invent feature names.
- Do not repeat what is already visible: no "Open film" link beside a title that is already a link, no heading that repeats the tab, no second icon that does what a neighbouring control does.
- Keep every error message and every confirmation that protects data or privacy. Those are information, not persuasion.

## Keep working

- Do not change data loading, services, hooks, routes or behaviour unless your task says so. This is a markup, class and copy rewrite.
- Keep accessible names (`aria-label`, label text, button text) where they are still accurate: tests in `tests/frontend` find elements by them. Where you change or remove copy, update the affected tests in the same change so they assert the new behaviour honestly (never delete a test just to make it pass; delete only assertions about UI that was deliberately removed).
- Node 22 is required: prefix commands with `export PATH="/Users/prashantshah/.local/bin:$PATH"`.
- Check only your own files: `npx eslint <your files>` and `npx vitest run <your test files>`. `npx tsc -b` may show errors in files that belong to someone else working at the same time; ignore those and fix only yours.
- Do not commit, do not run git commands that change state, do not start servers, and do not edit `src/styles/app.css`, `design/tokens.json`, `Layout.tsx`, `Feed.tsx`, `Log.tsx`, or anything outside `src/` and `tests/frontend/`.
