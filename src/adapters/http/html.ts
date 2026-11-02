/** Escapes text for safe use inside HTML. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Marks a string as already-escaped HTML. */
export interface SafeHtml {
  readonly html: string;
}

/** Tagged template that escapes every interpolated value unless it is SafeHtml. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((value, index) => {
    out += render(value) + (strings[index + 1] ?? "");
  });
  return { html: out };
}

function render(value: unknown): string {
  if (Array.isArray(value)) return value.map(render).join("");
  if (value !== null && typeof value === "object" && "html" in value) {
    return String((value as SafeHtml).html);
  }
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(String(value));
}

export interface PageOptions {
  /** Shows a "demo data" banner. */
  readonly demo?: boolean;
  /** Which navigation link to mark as the current page. */
  readonly current?: "stats" | "staff";
}

/**
 * Page shell. Colours meet WCAG 2.2 AA contrast in light and dark mode, focus is always
 * visible, nothing relies on colour alone, and the layout works from 320px wide.
 */
export function page(title: string, body: SafeHtml, options: PageOptions = {}): string {
  const link = (href: string, label: string, key: PageOptions["current"]) =>
    `<a href="${href}"${options.current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>${escapeHtml(title)} · Dada</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #f3f6f6; --surface: #ffffff; --surface-2: #eaf0f1; --text: #142126; --muted: #4a5a60;
  --line: #d3dde0; --track: #e1e9ea; --accent: #0e6170; --accent-strong: #0a4b57;
  --accent-text: #ffffff; --accent-soft: #e1eff1;
  --urgent: #a1261b; --high: #8a4b00; --moderate: #6b5900; --low: #2e5d2a;
  --urgent-bg: #fbe9e6; --high-bg: #fbeedb; --moderate-bg: #f6f0d2; --low-bg: #e7f2e4;
  --focus: #1a56db; --radius: .75rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e1618; --surface: #152124; --surface-2: #1b2a2e; --text: #e8f0f1; --muted: #a7b8bc;
    --line: #2b3d41; --track: #243438; --accent: #7cd0dc; --accent-strong: #a6e2ea;
    --accent-text: #06262b; --accent-soft: #17343a;
    --urgent: #ff9c90; --high: #ffc074; --moderate: #f1d36b; --low: #9fd996;
    --urgent-bg: #3a1d19; --high-bg: #3a2a14; --moderate-bg: #343013; --low-bg: #1d3019;
    --focus: #8ab4ff;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 1rem/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
}
a { color: var(--accent); text-underline-offset: .15em; }
a:hover { color: var(--accent-strong); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 0; padding: .5rem 1rem; background: var(--surface); z-index: 1; }
.skip:focus { left: 1rem; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}

/* Header */
.site { background: var(--surface); border-bottom: 1px solid var(--line); }
.site-inner, main, footer { max-width: 70rem; margin: 0 auto; padding: 0 1.25rem; }
.site-inner { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1.5rem; padding-block: .7rem; }
.brand { display: flex; align-items: center; gap: .7rem; margin-right: auto; }
.mark {
  width: 2rem; height: 2rem; border-radius: 50%; flex: none;
  background: radial-gradient(circle at 50% 50%, var(--surface) 0 .35rem, transparent .36rem), var(--accent);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.brand strong { font-size: 1.15rem; letter-spacing: .01em; }
.brand-text span { color: var(--muted); font-size: .85rem; }
nav ul { display: flex; gap: .25rem; list-style: none; margin: 0; padding: .25rem; background: var(--surface-2); border-radius: 2rem; }
nav a {
  display: inline-block; padding: .45rem 1rem; border-radius: 2rem;
  color: var(--text); text-decoration: none; min-height: 2.75rem; line-height: 1.85rem; font-size: .95rem;
}
nav a:hover { color: var(--text); background: var(--track); }
nav a[aria-current="page"] { font-weight: 650; background: var(--surface); box-shadow: 0 0 0 1px var(--line); }

/* Page heading */
main { padding-bottom: 1rem; }
.page-head { padding: 1.75rem 0 .25rem; }
h1 { font-size: clamp(1.6rem, 1.2rem + 1.6vw, 2.1rem); line-height: 1.15; letter-spacing: -.01em; margin: 0 0 .5rem; }
h2 { font-size: 1.1rem; line-height: 1.3; margin: 2.25rem 0 .85rem; }
h2 .h-note { display: block; color: var(--muted); font-size: .9rem; font-weight: 400; margin-top: .15rem; }
p.lead { color: var(--muted); margin: 0; max-width: 44rem; font-size: 1.02rem; }

.demo {
  margin: 1rem 0 0; padding: .6rem 1rem; border-radius: .5rem;
  background: var(--high-bg); color: var(--text); border: 1px solid var(--high);
  border-left-width: 5px; font-size: .95rem;
}

/* Headline numbers: one panel, divided, most important first */
.stat-strip {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  margin-top: 1.5rem; overflow: hidden;
}
.stat {
  padding: 1.1rem 1.25rem 1.2rem; display: flex; flex-direction: column; gap: .15rem;
  border-left: 1px solid var(--line); margin-left: -1px; border-top: 1px solid var(--line); margin-top: -1px;
}
.stat .n { font-size: 2.25rem; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.stat .n-small { font-size: 1.6rem; padding-top: .45rem; }
.stat .n-hidden { font-size: 1.15rem; font-weight: 600; color: var(--muted); padding: .7rem 0 .45rem; letter-spacing: 0; }
.stat .l { font-weight: 650; margin-top: .25rem; }
.stat .sub { color: var(--muted); font-size: .85rem; line-height: 1.4; }
.stat-alert { background: var(--urgent-bg); box-shadow: inset 0 4px 0 var(--urgent); }
.stat-alert .n { color: var(--urgent); }
.stat-lead { background: var(--accent-soft); }

/* Bars */
.two-col { display: grid; gap: 0 2.5rem; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem 1.25rem; }
.two-col > section > h2:first-child { margin-top: 2.25rem; }
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .7rem; }
.bars li { display: grid; grid-template-columns: 9rem 1fr 6.5rem; align-items: center; gap: .85rem; }
.bar-label { font-size: .95rem; }
.bar-value { font-variant-numeric: tabular-nums; text-align: right; font-weight: 650; }
.bar-value small { color: var(--muted); font-weight: 400; font-size: .85rem; }
.track { height: .7rem; background: var(--track); border-radius: 1rem; overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 1rem; min-width: .35rem; }
.fill[style="width:0%"] { min-width: 0; }
.fill-urgent { background: var(--urgent); } .fill-high { background: var(--high); }
.fill-moderate { background: var(--moderate); } .fill-low { background: var(--low); }
.fill-accent { background: var(--accent); } .fill-muted { background: var(--muted); }

/* Daily chart */
.trend { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem 1.25rem 1rem; }
.columns {
  display: flex; align-items: stretch; gap: .4rem; height: 12rem;
  border-bottom: 1px solid var(--muted);
}
.col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 0; }
.col-bar { width: 100%; max-width: 2.25rem; background: var(--accent); border-radius: .35rem .35rem 0 0; }
.col-hidden { background: repeating-linear-gradient(45deg, var(--track), var(--track) 3px, var(--line) 3px, var(--line) 6px); }
.col-value { font-size: .75rem; color: var(--muted); font-variant-numeric: tabular-nums; padding-bottom: .15rem; }
.col-day { font-size: .75rem; color: var(--muted); width: 100%; text-align: center; padding-top: .3rem; margin-bottom: -1.6rem; }
.trend figcaption { color: var(--muted); font-size: .85rem; margin-top: 2.2rem; }

/* Risk level badges: text plus colour, never colour alone */
.badge {
  display: inline-block; padding: .12rem .6rem; border-radius: 1rem; font-weight: 650;
  font-size: .85rem; border: 1px solid currentColor; white-space: nowrap;
}
.badge-urgent { color: var(--urgent); background: var(--urgent-bg); }
.badge-high { color: var(--high); background: var(--high-bg); }
.badge-moderate { color: var(--moderate); background: var(--moderate-bg); }
.badge-low { color: var(--low); background: var(--low-bg); }
.levels { display: grid; gap: 0; margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
.levels div { display: grid; grid-template-columns: 7rem 1fr; gap: .75rem; align-items: baseline; padding: .7rem 1.25rem; }
.levels div + div { border-top: 1px solid var(--line); }
.levels dd { margin: 0; }

/* Referral queue */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
table { border-collapse: collapse; width: 100%; }
.table-wrap table { min-width: 48rem; }
caption { text-align: left; padding: .8rem 1.25rem; color: var(--muted); font-size: .92rem; }
th, td { text-align: left; padding: .75rem 1rem; border-top: 1px solid var(--line); vertical-align: top; }
th:first-child, td:first-child { padding-left: 1.25rem; }
th { font-weight: 650; font-size: .85rem; color: var(--muted); background: var(--surface-2); }
.queue tbody tr:hover { background: var(--surface-2); }
td.num { font-variant-numeric: tabular-nums; }
.queue td.score { font-weight: 650; }
tr.late td:first-child { box-shadow: inset 4px 0 0 var(--urgent); }
.wait { display: block; color: var(--muted); font-size: .85rem; }
tr.late .wait strong { color: var(--urgent); }
table.compact th, table.compact td { padding: .55rem .5rem .55rem 0; background: none; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: .9rem 1.25rem; margin-bottom: 1rem; }
summary { font-weight: 650; cursor: pointer; min-height: 1.75rem; }
details ol { padding-left: 1.25rem; margin-bottom: 0; }
details li + li { margin-top: .35rem; }
.hint { color: var(--muted); font-size: .9rem; margin: .5rem 0 0; }
.note { color: var(--muted); max-width: 46rem; }
.help {
  margin: 1.5rem 0 0; padding: .9rem 1.25rem; border-radius: var(--radius);
  background: var(--accent-soft); color: var(--text); max-width: none;
}
button {
  font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: .5rem;
  padding: .55rem 1rem; min-height: 2.75rem; background: var(--accent); color: var(--accent-text);
  white-space: nowrap;
}
button:hover { background: var(--accent-strong); }
.empty { padding: 1.5rem 1.25rem; color: var(--muted); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
footer { color: var(--muted); font-size: .9rem; border-top: 1px solid var(--line); margin-top: 3rem; padding-block: 1.25rem 2rem; }
footer p { margin: 0; }
footer p + p { margin-top: .25rem; }

/* On phones each referral becomes a card, so nobody has to scroll sideways to reach the button. */
@media (max-width: 44rem) {
  .table-wrap { overflow: visible; }
  .table-wrap table.queue { min-width: 0; }
  .queue thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .queue tbody, .queue tr, .queue td { display: block; }
  .queue tr { border-top: 1px solid var(--line); padding: .9rem 1.25rem; }
  .queue tbody tr:hover { background: none; }
  .queue td, .queue td:first-child { border: 0; padding: .2rem 0; display: grid; grid-template-columns: 6.5rem 1fr; gap: .5rem; }
  .queue td::before { content: attr(data-label); color: var(--muted); font-size: .85rem; }
  .queue td .wait { grid-column: 2; }
  .queue td.score::before { font-weight: 400; }
  .queue td.action { display: block; padding-top: .7rem; }
  .queue td.action::before { content: none; }
  .queue td.action button { width: 100%; }
  tr.late td:first-child { box-shadow: none; }
  tr.late { box-shadow: inset 4px 0 0 var(--urgent); }
  .stat-strip { grid-template-columns: 1fr 1fr; }
  .stat-strip > .stat:first-child { grid-column: 1 / -1; }
}
@media (max-width: 34rem) {
  .site-inner, main, footer { padding-inline: 1rem; }
  .brand-text span { display: none; }
  .stat { padding: .9rem 1rem 1rem; }
  .stat .n { font-size: 1.9rem; }
  .bars li { grid-template-columns: 1fr auto; gap: .35rem .75rem; }
  .bars .track { grid-column: 1 / -1; grid-row: 2; }
  .columns { gap: .2rem; }
  .col-value { display: none; }
  .col:nth-child(even) .col-day { visibility: hidden; }
  .levels div { grid-template-columns: 1fr; gap: .25rem; padding-inline: 1rem; }
  .trend { padding-inline: .75rem; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="site-inner">
<div class="brand"><span class="mark" aria-hidden="true"></span><span class="brand-text"><strong>Dada</strong><span>Perinatal wellbeing screening</span></span></div>
<nav aria-label="Main"><ul><li>${link("/stats", "Live numbers", "stats")}</li><li>${link("/staff", "Staff queue", "staff")}</li></ul></nav>
</div></header>
<main id="main">${options.demo === true ? '<p class="demo"><strong>Demo data.</strong> These are fictional test records, not real screenings.</p>' : ""}${body.html}</main>
<footer><p>Emergency: 999 or 112. GBV helpline: 1195 (free, 24 hours).</p><p>Open source under the MIT licence. Built by Uwezo Link Initiative with VIPS Health Services, Nairobi.</p></footer>
</body>
</html>`;
}
