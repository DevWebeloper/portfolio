const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const PERSON = {
  name: "Ghaith Alkawadri",
  role: "Web developer",
  headline: "Web developer building for the web and the Linux desktop.",
  base: "Remote, based in Egypt",
  email: "gheith.sy@gmail.com",
  github: "https://github.com/DevWebeloper",
  githubLabel: "github.com/DevWebeloper",
  cv: `${BASE}/Ghaith-Alkawadri-CV.pdf`,
  languages: "Arabic (native) · English (fluent)",
};

/** The About card's panel. Content from CV_Ghaith_Alkawadri.md (the accurate CV). */
export const ABOUT = {
  greeting: "Hi, I'm Ghaith.",
  lead:
    "I'm a web developer with 8+ years of remote work for clients in the US, Switzerland and France.",
  body:
    "On the web I build Angular and React front-ends and WordPress sites with PHP, JavaScript and CSS. I also write open-source Linux desktop software in Python and GTK4.",
  services: [
    {
      title: "Front-end apps",
      text: "Angular and React / Next.js interfaces in TypeScript, wired to REST APIs.",
    },
    {
      title: "WordPress & PHP sites",
      text: "Custom themes and features in large existing codebases, built to stay up under traffic spikes.",
    },
    {
      title: "Linux & open source",
      text: "GTK4 and Python desktop apps; my GNOME theme Aura Glass has 120+ stars on GitHub.",
    },
  ],
  experience: [
    { years: "2026 – now", title: "Founder", org: "OmiTech", text: "Tech & AI solutions." },
    {
      years: "2019 – now",
      title: "Freelance web developer",
      org: "Remote",
      text: "WordPress sites for clients including JAR Capital (Geneva), CRCDC Pays de la Loire and Cider (Paris).",
    },
    {
      years: "2018 – 2025",
      title: "Web developer",
      org: "XonBoard",
      text: "hrf.org and the Oslo Freedom Forum in WordPress/PHP; the Angular front-end of GT-AI.",
    },
    {
      years: "2016 – 2018",
      title: "Android ROM developer",
      org: "NovaOS (XDA)",
      text: "Firmware ports with 200k+ downloads across 12 devices; ran a 15k-member community.",
    },
  ],
  skills: [
    {
      group: "Web",
      items: ["TypeScript", "JavaScript", "Angular", "React", "Next.js", "PHP", "WordPress", "HTML", "CSS / Sass", "Tailwind CSS", "MySQL", "REST APIs"],
    },
    { group: "Linux & desktop", items: ["Python", "GTK4 / libadwaita", "Bash", "systemd", "Git"] },
  ],
};

export interface Card {
  /** Hash slug: about, hrf, gtai, crcdc, cider, aura-glass */
  id: string;
  /** "about" is the first card; its panel shows ABOUT instead of a project. */
  kind: "about" | "site" | "app";
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
  /** What I did, 2–4 short lines (from the CV). */
}

export const CARDS: Card[] = [
  {
    id: "about",
    kind: "about",
    name: "About me",
    short: "About me",
    // The cover already says "Web developer · 8+ years, remote"; the caption says what's inside.
    role: "Who I am and what I do",
    summary: ABOUT.lead,
    stack: [],
    url: PERSON.github,
    linkLabel: "GitHub",
    cover: `${BASE}/work/thumbs/about.webp`,
    device: [],
  },
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
    cover: `${BASE}/work/thumbs/hrf.webp`,
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
    cover: `${BASE}/work/thumbs/gtai.webp`,
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
    cover: `${BASE}/work/thumbs/crcdc.webp`,
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
    cover: `${BASE}/work/thumbs/cider.webp`,
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
    cover: `${BASE}/work/thumbs/aura-glass.webp`,
    device: [1, 2, 3].map((n) => `${BASE}/work/apps/aura-glass-${n}.webp`),
    meta: "★ 120+ · ~2k downloads",
  },
];
