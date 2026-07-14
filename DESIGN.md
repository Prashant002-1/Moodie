---
name: EmotionFlix
description: Emotion-based social film discovery.
direction: "Matinee Archive"
colors:
  mineral: "#D8D6D1"
  mist: "#B9C4C0"
  ink: "#1D2B33"
  chalk: "#F4EFE9"
  oxide: "#D76358"
  fig: "#713B42"
  blue: "#557890"
  teal: "#477B78"
typography:
  family: "Oxygen, sans-serif"
  root: "17px"
  weights: [300, 400, 700]
layout:
  contentWidth: "1380px"
  readingWidth: "68ch"
  controlHeight: "50px"
  navHeight: "68px"
  footerHeight: "88px"
rounded:
  control: "8px"
  surface: "14px"
---

# Design system: EmotionFlix

## Creative direction

**Matinee Archive**

EmotionFlix should feel like leaving a repertory screening in the afternoon while the film is still present. It is warm, tactile, culturally literate, and alive with other people. Daylight and quiet neutral surfaces make room for film art; saturated color marks shifts in feeling and social connection.

The public page is expressive and narrative. The signed-in product is calmer, but the feed still feels inhabited: human writing, film artwork, emotional traces, and occasional expression photos establish the atmosphere. It must never resemble a streaming catalog, a film-review scorecard, a generic SaaS dashboard, or a facial-analysis demo.

The visual story follows the product:

1. A person watches a film.
2. They say what it meant and how it felt.
3. Someone who felt something similar becomes visible.
4. What that person watched next becomes a recommendation.

## Logo slot

The logo is intentionally unresolved.

- Keep a stable `.brand-lockup` container and replaceable `.brand-slot`.
- Treat `BrandMark` as a placeholder only.
- Do not derive patterns, icons, motion, or layout motifs from the placeholder.
- Replacing the mark must not require restructuring navigation.

## Typography

Oxygen remains the only family. The design changes its scale and rhythm, not the font itself.

- Weight 300 carries expressive display lines.
- Weight 700 creates selective emphasis and functional headings.
- Weight 400 carries body copy, posts, metadata, and controls.
- Landing display text uses `clamp()` up to 6rem with a line height near 0.96.
- Product titles remain practical, with a ceiling near 4.5rem.
- Body copy stays between 65 and 72 characters per line with generous line height.
- Metadata is compact but never faint.
- Avoid repeated uppercase eyebrows as section scaffolding.

Desktop uses a 17px root. Mobile uses 16px. Controls remain at least 50px high and touch targets at least 44px.

## Palette

### Light fields

- **Mineral `#D8D6D1`:** public canvas and secondary product field.
- **Mist `#B9C4C0`:** connective social surface and selected state.
- **Chalk `#F4EFE9`:** reading, forms, posts, and high-clarity content.

### Depth fields

- **Ink `#1D2B33`:** primary text, cinematic depth, and footer.
- **Teal `#477B78`:** film atmosphere and meaningful transitions.
- **Blue `#557890`:** melancholy, distance, and cool counterweight.

### Human accents

- **Oxide `#D76358`:** primary action and a major emotional field.
- **Fig `#713B42`:** resonance, intimacy, and reaction state.

Default text is Ink on Mineral, Mist, or Chalk. Small text on Teal uses `#FAF8F4`. Chalk on Fig and Ink is approved. Muted copy uses an Ink-derived color such as `#435258`. Oxide and Fig are not decorative confetti.

## Grain and material

Texture behaves like photographic grain, never a visible pattern.

- Use the deterministic monochrome raster tile exposed through `--grain-image`.
- Do not use CSS dots, stripes, paper speckles, fake distress, or animated noise.
- Blend light fields at roughly 8 to 10 percent and saturated fields at 14 to 20 percent.
- Grain sits below content and never reduces text clarity.
- Keep it static.

Section transitions may use large soft radial shapes that overlap their edges like diluted ink spreading into adjacent paper. These edges should be irregular, layered, and quiet. They are not sharp waves, geometric dividers, or decorative blobs floating behind every section.

## Public overview

The logged-out home is a product overview, not a browse surface.

- The opening composition pairs a clear statement with one convincing social response.
- A real poster, first-person note, feelings, and optional expression photo prove the product in the first viewport.
- The next section shows that writing and direct feeling controls are enough.
- The social section keeps the line: “The social layer has a purpose.”
- Do not repeat the same film in multiple examples.
- The final invitation contains Enter demo and a quieter sign-in action without explaining what the demo does.
- Public navigation contains overview anchors, Sign in, and a quiet Enter demo action.

## Signed-in product

### Feed

The feed is the primary home. It follows the familiar rhythm of a social timeline while keeping film responses distinct from lifestyle content.

Each post keeps together:

- person and follow state;
- first-person response;
- reviewed feelings;
- film poster and title;
- optional expression photo;
- reaction state.

The optional photo should feel candid and human. It is attached media, never presented as analysis or proof. Posts without photos must remain equally complete.

### Discover

Lead with films found through people who felt something similar about a shared film. Keep the person and shared film visible in the reason. Do not show ratings, genres, match percentages, or mechanical scoring explanations.

Search and catalog browsing appear below people-led recommendations. Poster rails are allowed there because the hierarchy has already established the social source.

### Diary

Show chronological responses and a restrained summary of feelings, public responses, and saved films. Notes, visibility, date, and emotional trace remain visible. Do not show average ratings, genre taste, or scoring controls.

### Member page

Show a person's public responses, recurring feelings, and films. It should feel like a social diary, not a generic profile or compatibility report.

### Film page

The film is the visual anchor. “How people felt” follows the synopsis. Related catalog films remain secondary.

### Composer

Film selection comes first. The next prompts are “How did it make you feel?” and “What did it mean to you?” Direct sliders and writing are primary. Camera and photo estimates live in a secondary disclosure. An expression photo can be attached through a separate explicit choice.

### Account

Account state, bio, password, and diary counts are task-focused. This page uses the quietest expression of the system.

## Navigation and footer

- Navigation is 68px on desktop and visually lighter on mobile.
- Logged-out: logo slot, overview anchors, Sign in, quiet Enter demo.
- Logged-in: logo slot, Feed, Discover, Diary, Add film, account.
- Enter demo signs in directly; never display credentials.
- Protected routes return signed-out visitors to the public overview.
- The footer is one compact 88px field with the TMDB mark and the required non-commercial attribution only.

## Motion

Motion should make the page feel continuous and responsive, not staged.

- Lenis supplies restrained smooth scrolling and anchor movement.
- Large visual layers may move at subtly different scroll rates.
- Content reveals once as it enters the viewport with short, low-distance motion.
- Ink-spill edges may drift slowly, but grain never moves.
- Hover motion is limited to a small lift, scale, or color change.
- No scroll locking, autoplay carousels, particles, looping decoration, or long entrance sequences.
- Respect `prefers-reduced-motion` globally; content must appear immediately when reduction is requested.

## Feeling language and colors

The current seven keys remain a temporary implementation constraint:

- Stillness: Mineral and Ink
- Joy: Oxide
- Melancholy: Blue
- Friction: deep Oxide
- Tension: Fig
- Unease: Teal
- Wonder: light Teal and Mist

Do not encode emotion-to-genre rules. Do not use scanning graphics, camera frames, confidence scores, or temporary labels as brand motifs.

## Components

- **Primary button:** Oxide, dark action text, 8px radius, 50px minimum height.
- **Secondary button:** Ink or Mist according to the field.
- **Quiet button:** transparent at rest with a local-surface hover.
- **Surface:** 14px maximum radius for grouped state; posters use 2 to 6px.
- **Input:** Chalk or Mineral, visible Ink-derived border, readable placeholder.
- **Focus:** 3px Fig outline with 3px offset on light fields; Chalk on dark fields.
- **Poster:** 2:3 crop, flat at rest, small lift on hover or focus.
- **Loading:** content-shaped skeletons for lists; a compact spinner only for short isolated transitions.
- **Empty state:** one useful next action.
- **Errors:** a specific message and recovery action where possible.

## Copy rules

Use film, response, feelings, note, person, feed, diary, public, private, saved, follow, reaction, and recommendation literally.

Avoid invented feature names, technical architecture copy, privacy theater, marketing buzzwords, and mechanical explanations. Never claim that EmotionFlix understands, reads, detects, or diagnoses how a person feels.

Use `expression estimate` for the optional analysis adapter. Use `attach photo` for post media. These are different actions.

## Do not

- Reintroduce a dark streaming shell or catalog-first home.
- Add ratings, stars, genre profiles, compatibility percentages, or popularity-first recommendations.
- Use glassmorphism, gradient text, repeated feature-card grids, oversized radii, purple fog, or neon blobs.
- Use visible dot patterns, paper speckles, faux aging, film strips, clapperboards, or decorative camera imagery.
- Put facial analysis, confidence, or privacy proof in the opening screen.
- Hide first-person notes, feelings, recommendation sources, or visibility behind hover.
