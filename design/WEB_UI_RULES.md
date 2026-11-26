# Web UI rules (working brief)

Moodie's identity is **Screening Room**: a dark room with the lights down. A screen is one continuous, flat surface. Nothing on it is boxed off: no rules between sections, no outlined cards, no hard bars, no gradients, no glows. The interface is one tone of ink on one tone of canvas; colour comes only from film posters and people's avatars. Space and type do the separating. See DESIGN.md.

Every screen is built from the shared classes in `src/styles/app.css`, which uses only the tokens in `design/tokens.json`. **Read that stylesheet in full first.** Worked examples of the look: `src/pages/Feed.tsx` (home), `src/components/suggestions/RecommendationNote.tsx` (the signature object), `src/components/response/ResponseCard.tsx`, `src/components/layout/Layout.tsx`, `src/components/common/Avatar.tsx`.

## The system

- **Canvas and columns.** Pages sit on the canvas inside a fixed box (`.page`, 1040px; `.page--narrow` 720; `.page--form` 420). A stream of words (Home, Recommendations, a recommendation, a response, Diary, Activity) is always the 720 column, so it has one left edge from top to bottom. A page with a subject opens with a **band**: `<section class="band"><div class="box">…</div></section>` (add `box--narrow` on a 720 page), placed before the `.page`. A band is the same flat surface as the page, with more room; it never carries artwork, a wash or a colour. One band per page.
- **Type has three voices.**
  - Serif, heavy (`h1`–`h3`, `.row__title`, `.rec__title`, `.response__film`, `.tile__title`): film titles and page titles. A year beside a title is `<span class="year">`.
  - Serif, regular: people's words. `.note` for what someone wrote about a film; `.quote` (italic, larger) for what someone said *to you*, such as the reason on a recommendation or a reply.
  - Sans: everything the interface says. Section headings are a few words in the serif, in sentence case, with no rule under them: `<header class="section__head"><h2>New from friends</h2><a>See all</a></header>`. Never set navigation, tabs, headings or badges in capitals.
- **People have colours.** Every person has a muted tone from their username: `personHue(username)` in `src/utils/person.ts`. It fills their `<Avatar>` and nothing else. Always use `<Avatar username size? to? />`; never a hand-made initial. A person's name is `.who`, in ink.
- **Films are posters.** Show artwork generously. `.poster` (+ `--xs --sm --lg --xl`); posters have no outline and lift a little on hover when they are links. A film's wide artwork (backdrop) is not used. A row of films is a **wall**: `<div class="wall">` (`wall--fit` in a reading column) of `<article class="tile">` (poster, optional avatar in the corner with `.tile__who`, then `.tile__name` / `.tile__title` / `.tile__sub`). `.poster-grid` for search results and long sets.
- **A recommendation is a note.** Anything one person recommended to another is rendered with `<RecommendationNote>` (class `.rec`), full or `compact`. Do not build another presentation of it.
- **A response** in any list is `<ResponseCard>`. In a reading column: wrap in `<div class="responses">`. On a wide page (a film, a person), two columns: `<div class="columns">`.
- **Feelings** are shown only with `<Feelings entry={…} />`: words, strongest first. Never percentages, sliders, bars or averages. Feelings have no colours; colour belongs to people and artwork.
- **Colour.** There is no brand hue. `--m-color-accent` is the ink colour used as a fill: the one primary action on a screen (`.btn--primary`), selected chips and `.badge--accent`. Person tones fill avatars only. No other colours, no gradients, no glows, no blur, no tinted panels, and never a coloured rule down the side of a quote or a panel. A link or title under the pointer is underlined; it does not change colour. Never divide content with a rule or put it in an outlined or filled box: use space.
- **Controls.** `.btn` with `--primary`, `--secondary`, `--quiet`, `--small`, `--icon`, `--caps`. `.tabs` (aria-pressed buttons or aria-current links; a count is `<span class="tabs__count">`; two sets on one line go in `.switches`). `.chip` (aria-pressed). `.field` > `label` + `.input` / `.textarea` / `.select`. `.search` forms. `.options` / `.option` for a choice among whole options. `.menu` + `.menu__list` for a small menu under a button. `.badge` for a state. `.stats` / `.stat` for a few counts as a line of plain words.
- **Lists.** `.list` of `.row` (poster or avatar, `.row__main`, optional `.row__aside`) for dense sets, separated by space. `.panel` only for something that sits over the page for a moment. `.two-up` for two equal columns.
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

## A person keeps their place

These hold on every screen. A new screen follows them from the start.

- **Every page names itself.** Call `usePageTitle('Diary')` (`src/hooks/usePageTitle.ts`). It sets the tab title and is read aloud to a screen reader when the page opens. Use the film, person or recommendation once it has loaded.
- **What a list is showing lives in the address.** A tab, a filter or a search goes in the query string with `useSearchParams` (see `People.tsx`, `Search.tsx`, `Diary.tsx`), so Back from a film or a person returns to the same results, and a reload keeps them.
- **A list never goes blank because something else changed.** Identity (account, route, query) goes in the `key` of `usePagedResource`; anything that only means "read it again", such as the diary `revision`, goes in its third argument, `version`. A new key hides the old list at once; a new version reloads it in place.
- **An action answers where it was taken.** Follow, like and Save for later change the control in place. They do not move the person to another page or reload the list under them.
- **A disabled primary button says what it is waiting for**, in a `.hint` beside it.
- **Nothing is asked about nothing.** No "keep this draft?" for a response nobody started writing.
- **Before something that cannot be taken back, Moodie asks in the page.** `const confirm = useConfirm()` (`src/hooks/useConfirm.ts`), then `if (!(await confirm({ title: 'Delete this viewing?', body: '…', action: 'Delete' }))) return;`. Never `window.confirm`.
- **A failed change is said once.** Show it beside the control when the screen has a place for it. Otherwise say nothing: the banner in `Layout.tsx` speaks for any failed write whose message is not already in view.
- **A film with no artwork is still a film.** `.poster` draws its own placeholder mark when it has no image; do not hide the poster.
- **Missing is said plainly.** A removed or private thing gets a heading that says so and one way onward, not an error with a Retry that cannot work.
- **Touch targets are 44px.** The rules are in the "Touch" block at the end of `app.css`; a new kind of small control is added there.
- The layout has no sideways scroll from 320px up. The top bar tightens between 821px and 960px.

## Keep working

- Do not change data loading, services, hooks, routes or behaviour unless your task says so.
- Keep accessible names (`aria-label`, label text, button text) where they are still accurate: tests in `tests/frontend` find elements by them. Where you change UI or copy, update the affected tests in the same change so they assert the new behaviour honestly. Never delete a test just to make it pass.
- Node 22 is required: prefix commands with `export PATH="/Users/prashantshah/.local/bin:$PATH"`.
- Check your own work: `npx eslint <your files>`, `npx vitest run <your test files>`, `npx tsc -b`. Other people are editing other files at the same time; ignore errors in files that are not yours, and re-run near the end.
- A dev preview is running at http://localhost:5273 (API on 3101) with hot reload; sign in as `ios_viewer` / `native-test-password`. Look at your screens there at 1280px and 375px if you have a browser tool. Do not stop or restart those servers.
- Do not commit or run git commands that change state. Do not edit `src/styles/app.css`, `design/tokens.json`, `Layout.tsx`, `Feed.tsx`, or files outside your task. If you need a shared class that does not exist, add it to your own stylesheet and say so in your report.
