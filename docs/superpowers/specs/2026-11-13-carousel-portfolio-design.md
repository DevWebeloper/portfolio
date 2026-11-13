# Portfolio remake: curved card carousel

Date: 2026-11-13. Reference for feel and mechanics: aengel.io/lite (own implementation; none of its code, images, text or fonts).

## Intent

A job-hunting portfolio that shows front-end skill in the first five seconds. Visitors should see who Ghaith is, flick through his work, and open a project without reading much.

## Goals

- Intro screen first, then projects as cards on a curved wall.
- Cards move with motion blur on scroll/drag and ripple under the mouse.
- A project opens into a panel; partway down, a phone pins and the mobile site scrolls inside it.
- Very little text.
- Works on phones and without WebGL.
- Still deploys to GitHub Pages at `/portfolio` (static export).

## Non-goals

- Experience and Skills sections (the CV PDF covers them).
- The reference's WebGPU version, sound toggle, lab page.
- A CMS; content stays in `src/data/site.ts`.

## Anti-goals

- Cyber/terminal/HUD decoration: no barcodes, grids, fake telemetry.
- Client branding as the portfolio's identity. Client imagery only inside its own card/panel, labelled with the role ("Web developer at XonBoard", "Freelance").
- Long paragraphs.

## Approaches considered

1. **Plain three.js canvas for the carousel, DOM for everything else (chosen).** One full-screen canvas draws the cards with a bend in the vertex shader, velocity blur and a mouse ripple in the fragment shader. Intro, chrome and the project panel are normal HTML/CSS on top. `three` has no peer dependencies, so it is safe with React 19.3 / Next 16.4.
2. **CSS 3D transforms only.** No dependency, but cards can only tilt, not bend, and there is no real blur smear or ripple. Loses the effects the user named.
3. **React Three Fiber + drei.** Nicer authoring, but adds peer-dependency risk with this Next/React version and more bundle for a scene this small.

## Structure

Single route (`/`), client state for which view is showing. The open project is mirrored in the URL hash (`#hrf`) so links and back/forward work and the canvas never unmounts. No extra static routes.

### Views

1. **Intro**: dark screen. Name large, "Software developer", the one-line headline, an "Enter" link. Scroll, click or Enter key moves to the carousel.
2. **Carousel**: five cards on a curved wall, horizontal. Wheel, drag, touch swipe and arrow keys move it, with inertia. Each card shows a cover image and the project name. Order: HRF & Oslo Freedom Forum, GT-AI, CRCDC, Cider, Aura Glass. (AWCC for Linux and Syncplay Tunnel were removed by Ghaith on 2026-11-13.)
3. **Project panel**: the clicked card grows into a large rounded panel with its own scroll. Close / Previous / Next. Escape closes.

### Fixed chrome (all views after intro)

Name + role bottom-left, "Available for remote roles" top-right, email (click to copy), GitHub and CV download bottom-right.

### Effects

- **Bend**: cards sit on a cylinder; the wall curves toward the viewer at the edges.
- **Velocity blur**: horizontal smear proportional to scroll speed, settling to sharp at rest.
- **Mouse ripple**: a trail texture following the pointer displaces the card image like liquid; fades in about a second.
- **Open transition**: card flattens and scales up into the panel (about 0.6s).
- `prefers-reduced-motion`: no blur, no ripple, cross-fade instead of the grow.

### Project panel content

Top: project name, role label, one cover image, live link.

Pinned section (the panel's scroll is held while this plays):

- **Client sites**: a phone frame in the centre. Scrolling moves a tall mobile capture inside the phone from top to bottom. Left of the phone: role and year range, one sentence on what he did. Right: stack list and the live link. Each side fades in at a different point of the scroll.
- **Aura Glass (the one open-source card)**: same pinned section with a desktop window frame instead of the phone, showing app screenshots; left/right text is summary, stack, stars/downloads where they exist, GitHub link.

After the pin: Previous / Next.

Text budget per project: one sentence plus short labels. Taken from `src/data/site.ts`.

### Narrow screens and fallback

- Under ~768px: phone frame full width, the left/right notes stack above and below it.
- No WebGL or it fails to start: the carousel becomes a CSS scroll-snap row of flat cards; panel and phone section still work (they are DOM).

## Assets

- New full-page mobile captures (390px wide) of hrf.org, gt-ai.io, depistagecancers.fr, cider.fr, with cookie banners dismissed, saved as webp under `public/work/mobile/`. All four sites respond today.
- Existing desktop webps in `public/work/` are the card covers for client sites.
- Aura Glass: screenshots from its repo (`screenshots/overview.webp` etc.).

## Constraints

- Next 16.4 with breaking changes: read `node_modules/next/dist/docs` before writing code (AGENTS.md).
- `next dev` serves stale CSS after `globals.css` edits; restart the dev server.
- Static export with `basePath` `/portfolio`; asset paths use `NEXT_PUBLIC_BASE_PATH`.
- Work on a new branch `carousel-redesign`. The current master design is not preserved at a URL unless asked (`/portfolio/old` keeps serving the `old-design` branch).

## Left to the builder

Typeface (one grotesque for display, system or one sans for text), exact colours within "near-black with off-white text and one quiet accent", easing curves, shader details, card sizes, file layout under `src/components/`.
