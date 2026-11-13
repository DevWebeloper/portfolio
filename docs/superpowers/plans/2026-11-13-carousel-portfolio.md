# Carousel Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current single-page portfolio with an intro screen, a curved WebGL card carousel and a project panel with a pinned phone/window section.

**Architecture:** One route. A client root component owns view state (`intro | carousel | project`) and mirrors the open project in the URL hash. A plain three.js canvas draws the cards; everything else is DOM layered on top. Styles live in CSS modules next to each component; `globals.css` holds only tokens and resets.

**Tech Stack:** Next 16.4 (static export on Pages), React 19.3, three.js (no R3F), CSS modules.

**Spec:** `docs/superpowers/specs/2026-11-13-carousel-portfolio-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).
- `next dev` serves stale CSS after `globals.css` edits: restart the dev server. After any `GITHUB_PAGES=true npm run build`, stop dev, `rm -rf .next`, restart.
- Only one `next dev` / build at a time in this directory.
- Static asset URLs are prefixed with `process.env.NEXT_PUBLIC_BASE_PATH ?? ""`.
- Only new dependency: `three` (+ `@types/three`). No R3F, no GSAP, no scroll libraries.
- No aengel.io code, images, text or fonts. No barcodes, grids, HUD or terminal decoration.
- Client imagery appears only inside that client's card and panel, with its role label.
- Copy comes from `src/data/site.ts`; one sentence per project plus short labels.
- Branch `carousel-redesign`. Do not commit or push; leave changes in the working tree.
- Must pass: `npm run lint`, `npx tsc --noEmit`, `GITHUB_PAGES=true npm run build`.

## Review Focus

- WebGL context creation fails or is lost: the flat scroll-snap row shows and cards still open.
- `prefers-reduced-motion: reduce`: no blur, no ripple, cross-fade open.
- Page loaded directly at `#gtai`: opens that project, skipping the intro; unknown hash falls back to intro.
- 390px-wide viewport: nothing overflows horizontally; phone section stacks.
- Browser back from an open project returns to the carousel, not off-site.

---

### Task 1: Assets

**Files:** Create `public/work/mobile/{hrf,gtai,crcdc,cider}.webp`, `public/work/apps/aura-glass-{1,2,3}.webp`.

- [ ] Capture each client site with headless `google-chrome-stable` at 390px wide, device scale 2, mobile user agent, full page, cookie/consent banners hidden; cap height at 6000 CSS px; convert to webp (quality ~78, output 780px wide).
- [ ] Download Aura Glass `screenshots/overview.webp`, `notifications-calendar.webp` and one more static screenshot from `github.com/DevWebeloper/aura-glass`, resize to max 1600px wide.
- [ ] Verify: view every output image; none shows a consent banner, error page or blank render; each file under 600 KB.

### Task 2: Data model, shell, intro, chrome, carousel

**Files:**
- Modify: `src/data/site.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`
- Create: `src/components/Experience.tsx`, `Intro.tsx`, `Chrome.tsx` (+ `.module.css` each), `src/components/carousel/CarouselCanvas.tsx`, `shaders.ts`, `FallbackRow.tsx`, `src/components/panel/ProjectPanel.tsx` (stub only)
- Delete: `src/components/MotionLayer.tsx`, `SiteHeader.tsx` if unused

**Interfaces (produces):**

```ts
// src/data/site.ts
export interface Card {
  id: string;            // hash slug: hrf, gtai, crcdc, cider, aura-glass
  kind: "site" | "app";
  name: string;
  short: string;         // label drawn on the card, e.g. "HRF"
  role: string;
  years?: string;
  summary: string;       // one sentence
  stack: string[];
  url: string;
  linkLabel: string;     // domain or "GitHub"
  cover?: string;        // card image; undefined => typographic cover
  device: string[];      // site: [tall mobile capture]; app: screenshots (may be empty)
  meta?: string;         // e.g. "★ 120+ · ~2k downloads"
}
export const CARDS: Card[];

// src/components/panel/ProjectPanel.tsx
export default function ProjectPanel(props: {
  card: Card; index: number; total: number;
  onClose(): void; onPrev(): void; onNext(): void;
}): JSX.Element;
```

- [ ] `git switch -c carousel-redesign`; `npm i three && npm i -D @types/three`.
- [ ] Add `Card`/`CARDS` (five cards) in the order given in the spec; keep `PERSON`; remove exports nothing uses any more. `device` paths: `/work/mobile/<id>.webp`, `/work/apps/aura-glass-N.webp`.
- [ ] `Experience`: view state, hash sync (`#<id>` open, empty = carousel once entered), keyboard (Enter to enter, arrows move, Escape closes), renders `Intro`, `Chrome`, `CarouselCanvas` or `FallbackRow`, and `ProjectPanel` when open.
- [ ] `CarouselCanvas`: cards on a cylinder (vertex bend), wheel/drag/touch with inertia, velocity blur and pointer-trail ripple in the fragment shader, typographic covers drawn to a 2D canvas texture, raycast click (ignore clicks that were drags), open transition scaling the card toward the viewport over ~0.6s, DPR capped at 2, render loop paused when the panel is open or the tab is hidden.
- [ ] `FallbackRow`: scroll-snap row used when WebGL is unavailable or the viewport is under 768px wide.
- [ ] `ProjectPanel` stub: name + close/prev/next, enough to test open/close.
- [ ] Verify in the dev preview: each Review Focus line; lint, tsc and Pages build pass.

### Task 3: Project panel with pinned device

**Files:** `src/components/panel/ProjectPanel.tsx`, `PinnedDevice.tsx`, `DeviceFrame.tsx` (+ `.module.css`). Nothing outside `src/components/panel/`.

**Interfaces:** consumes `Card` and the `ProjectPanel` props from Task 2.

- [ ] Panel: rounded sheet over the darkened carousel with its own scroll container; header (name, role, live link, close/prev/next), cover image.
- [ ] `PinnedDevice`: a tall section (about 300vh of panel scroll) with a sticky 100%-height stage. Progress 0→1 through the section translates the device content from top to bottom; left note fades in at ~0.1, right note at ~0.4. `kind: "site"` uses a phone frame with the tall capture; `kind: "app"` uses a desktop window frame cross-fading through `device` screenshots, or the summary alone when `device` is empty.
- [ ] Under 768px: notes stack above and below a full-width device. Reduced motion: no pin; device content scrolls normally inside the frame.
- [ ] Focus moves into the panel on open and returns to the page on close; scroll resets when prev/next changes the card.
- [ ] Verify in the dev preview on a site card, and Aura Glass at desktop and 390px; lint, tsc and Pages build pass.
