// Builds the carousel card covers in public/work/thumbs/ from the captures in
// public/work/. Run: node scripts/make-thumbs.mjs   (needs Playwright + Python/Pillow)
//
// Covers are 1280x800 to match the engine's texture (TEX_W x TEX_H). The wall
// only shows the top ~71% of a card (its cards are 2.24:1) and draws the name
// and role bottom-left itself, so the composition keeps to the top 570px and
// leaves the lower-left corner dark.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = (p) => pathToFileURL(resolve(root, "public/work", p)).href;
const out = resolve(root, "public/work/thumbs");
mkdirSync(out, { recursive: true });

const site = (id, accent, eyebrow, tags) => ({
  id,
  accent,
  body: `
    <div class="eyebrow">${eyebrow}</div>
    <div class="tags">${tags.map((t) => `<span>${t}</span>`).join("")}</div>
    <div class="browser"><div class="bar"><i></i><i></i><i></i><b></b></div>
      <img src="${work(`${id}.webp`)}"></div>
    <div class="phone"><img src="${work(`mobile/${id}.webp`)}"><u></u></div>`,
});

const covers = [
  {
    id: "about",
    accent: "#a8d5a2",
    body: `
    <div class="hello">Hi, I'm<br>Ghaith.</div>
    <div class="sub">Web developer &nbsp;·&nbsp; <em>8+ years</em>, remote</div>
    <div class="tags low"><span>Angular</span><span>React / Next.js</span><span>TypeScript</span><span>WordPress</span><span>PHP</span></div>
    <div class="code"><div class="bar"><i></i><i></i><i></i><b>ghaith.ts</b></div><pre>
<k>const</k> <v>ghaith</v> = {
  role: <em class="s">"Web developer"</em>,
  stack: [<em class="s">"Angular"</em>, <em class="s">"React"</em>],
  cms: <em class="s">"WordPress"</em>,
  experience: <n>8</n>, <c>// years, remote</c>
  clients: [<em class="s">"US"</em>, <em class="s">"CH"</em>, <em class="s">"FR"</em>],
  available: <k>true</k>,
};</pre></div>`,
  },
  site("hrf", "#e8336d", "Client website · XonBoard", ["WordPress", "PHP", "JavaScript"]),
  site("gtai", "#8b5cf6", "Client web app · XonBoard", ["Angular", "TypeScript", "REST"]),
  site("crcdc", "#e2b714", "Client website · Freelance", ["WordPress", "PHP", "CSS"]),
  site("cider", "#c49a6c", "Client website · Freelance", ["WordPress", "PHP", "CSS"]),
  {
    id: "aura-glass",
    accent: "#7dd3fc",
    body: `
    <div class="eyebrow">Open-source app · ★ 120+</div>
    <div class="tags"><span>GTK4</span><span>libadwaita</span><span>Bash</span></div>
    <div class="win back"><div class="bar"><i></i><i></i><i></i></div><img src="${work("apps/aura-glass-2.webp")}"></div>
    <div class="win front"><div class="bar"><i></i><i></i><i></i></div><img src="${work("apps/aura-glass-1.webp")}"></div>`,
  },
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;800&family=Geist:wght@400;500;600&display=block');
*{box-sizing:border-box;margin:0}
html,body{width:1280px;height:800px;overflow:hidden;background:#0d0d0e}
body{position:relative;font-family:Geist,system-ui,sans-serif;color:#ecebe6;
  /* accent glow from the upper right, behind the devices */
  background:radial-gradient(900px 520px at 78% 30%, color-mix(in srgb,var(--a) 34%,transparent), transparent 70%),
             radial-gradient(600px 400px at 10% 0%, color-mix(in srgb,var(--a) 10%,transparent), transparent 70%), #0d0d0e}
body::after{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:22px 22px;
  -webkit-mask:linear-gradient(#000,transparent 75%)}
.eyebrow{position:absolute;left:56px;top:52px;font:600 20px Geist;letter-spacing:.12em;text-transform:uppercase;color:var(--a)}
.tags{position:absolute;left:56px;top:92px;display:flex;gap:10px}
.tags span{font:500 19px Geist;padding:7px 15px;border-radius:99px;border:1.5px solid rgba(255,255,255,.16);color:rgba(236,235,230,.85);background:rgba(0,0,0,.25)}
.tags.low{top:360px}
.bar{height:34px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#1d1d20;border-bottom:1px solid #2a2a2c}
.bar i{width:11px;height:11px;border-radius:50%;background:#3a3a3e}
.bar b{margin-left:14px;height:18px;flex:0 0 46%;border-radius:9px;background:#2a2a2e;font:500 13px Geist;color:#8f8e89;display:flex;align-items:center;padding-left:10px}
.browser,.win,.code{position:absolute;border-radius:14px;overflow:hidden;background:#151517;border:1px solid #2e2e31;
  box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.03)}
.browser{left:600px;top:70px;width:760px;transform:perspective(1600px) rotateY(-16deg) rotateX(4deg);transform-origin:left center}
.browser img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;object-position:top}
.phone{position:absolute;left:470px;top:150px;width:196px;height:410px;border-radius:34px;background:#0f0f10;padding:9px;
  border:1px solid #333;box-shadow:0 40px 80px rgba(0,0,0,.7),-20px 0 60px rgba(0,0,0,.4);transform:rotate(-4deg)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:26px;display:block}
.phone u{position:absolute;left:50%;top:17px;width:58px;height:17px;margin-left:-29px;border-radius:9px;background:#000}
.win{width:700px}
.win img{display:block;width:100%}
.win.back{left:560px;top:40px;opacity:.55;transform:scale(.92)}
.win.front{left:470px;top:150px}
.hello{position:absolute;left:56px;top:46px;font:800 128px/0.92 'Schibsted Grotesk';letter-spacing:-.03em}
.sub{position:absolute;left:60px;top:300px;font:500 28px Geist;color:rgba(236,235,230,.75)}
.sub em{font-style:normal;color:var(--a);font-weight:600}
.code{left:700px;top:64px;width:520px;transform:perspective(1600px) rotateY(-12deg);transform-origin:right center}
.code .bar b{flex:none;background:none;padding:0;font-size:14px}
pre{padding:22px 24px;font:500 21px/1.6 ui-monospace,'JetBrains Mono',Menlo,monospace;color:#d6d5cf}
k{color:#c4a7ff} v{color:#ecebe6} pre .s{color:#a8d5a2;font-style:normal} n{color:#f5c27a} c{color:#6e6d69}
/* the lower-left stays dark for the caption the wall draws there */
.shade{position:absolute;left:0;right:0;top:420px;bottom:0;background:linear-gradient(transparent,rgba(13,13,14,.85) 55%)}
`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
for (const c of covers) {
  // A file page (not setContent's about:blank) so the file:// captures may load.
  const html = resolve(out, `${c.id}.html`);
  writeFileSync(
    html,
    `<!doctype html><html><head><style>${css}</style></head><body style="--a:${c.accent}">${c.body}<div class="shade"></div></body></html>`,
  );
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const png = resolve(out, `${c.id}.png`);
  await page.screenshot({ path: png });
  execFileSync("python3", ["-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[2],quality=86,method=6)", png, resolve(out, `${c.id}.webp`)]);
  rmSync(png);
  rmSync(html);
  console.log("wrote", c.id);
}
await browser.close();
