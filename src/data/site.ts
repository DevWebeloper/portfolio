const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const PERSON = {
  name: "Ghaith Alkawadri",
  role: "Software developer",
  headline: "Developer building for the web and the Linux desktop.",
  base: "Remote, based in Egypt",
  email: "gheith.sy@gmail.com",
  github: "https://github.com/DevWebeloper",
  githubLabel: "github.com/DevWebeloper",
  cv: `${BASE}/Ghaith-Alkawadri-CV.pdf`,
};

export interface Card {
  /** Hash slug: hrf, gtai, crcdc, cider, aura-glass */
  id: string;
  kind: "site" | "app";
  name: string;
  /** Label drawn on the card, e.g. "HRF" */
  short: string;
  role: string;
  years?: string;
  /** One sentence */
  summary: string;
  stack: string[];
  url: string;
  /** Domain or "GitHub" */
  linkLabel: string;
  /** Card image, base path included; undefined => typographic cover */
  cover?: string;
  /** Site: [tall mobile capture]; app: screenshots (may be empty). Base path included. */
  device: string[];
  /** e.g. "★ 120+ · ~2k downloads" */
  meta?: string;
}

export const CARDS: Card[] = [
  {
    id: "hrf",
    kind: "site",
    name: "Human Rights Foundation & Oslo Freedom Forum",
    short: "HRF",
    role: "Web developer at XonBoard",
    summary:
      "Worked on both WordPress sites as part of XonBoard's remote team: theme templates, custom features and the Forum's event pages.",
    stack: ["WordPress", "PHP", "JavaScript", "CSS"],
    url: "https://hrf.org",
    linkLabel: "hrf.org",
    cover: `${BASE}/work/hrf.webp`,
    device: [`${BASE}/work/mobile/hrf.webp`],
  },
  {
    id: "gtai",
    kind: "site",
    name: "GT-AI",
    short: "GT-AI",
    role: "Front-end developer at XonBoard",
    summary: "Built the Angular front-end for an AI voice platform on the ElevenLabs API.",
    stack: ["Angular", "TypeScript", "REST APIs"],
    url: "https://gt-ai.io",
    linkLabel: "gt-ai.io",
    cover: `${BASE}/work/gtai.webp`,
    device: [`${BASE}/work/mobile/gtai.webp`],
  },
  {
    id: "crcdc",
    kind: "site",
    name: "CRCDC Pays de la Loire",
    short: "CRCDC",
    role: "Freelance",
    summary:
      "WordPress site for a French regional cancer-screening centre, serving both the public and health professionals.",
    stack: ["WordPress", "PHP", "JavaScript", "CSS"],
    url: "https://depistagecancers.fr",
    linkLabel: "depistagecancers.fr",
    cover: `${BASE}/work/crcdc.webp`,
    device: [`${BASE}/work/mobile/crcdc.webp`],
  },
  {
    id: "cider",
    kind: "site",
    name: "Cider",
    short: "Cider",
    role: "Freelance",
    summary: "WordPress site for a Paris office-furniture company, with image-heavy project and product pages.",
    stack: ["WordPress", "PHP", "CSS"],
    url: "https://www.cider.fr",
    linkLabel: "cider.fr",
    cover: `${BASE}/work/cider.webp`,
    device: [`${BASE}/work/mobile/cider.webp`],
  },
  {
    id: "aura-glass",
    kind: "app",
    name: "Aura Glass",
    short: "Aura Glass",
    role: "Open source",
    summary:
      "Frosted-glass theme for GNOME Shell 48–51, with an interactive installer, a settings app and an adaptive mode that turns blur off on battery or under heavy GPU load.",
    stack: ["GTK4", "libadwaita", "CSS", "Bash"],
    url: "https://github.com/DevWebeloper/aura-glass",
    linkLabel: "GitHub",
    cover: `${BASE}/work/apps/aura-glass-1.webp`,
    device: [1, 2, 3].map((n) => `${BASE}/work/apps/aura-glass-${n}.webp`),
    meta: "★ 120+ · ~2k downloads",
  },
];
