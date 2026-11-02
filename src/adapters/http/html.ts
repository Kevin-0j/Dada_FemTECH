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
  --bg: #f7f5f0; --surface: #ffffff; --text: #1c1b19; --muted: #55524c;
  --line: #dcd7cc; --track: #ebe7de; --accent: #0f5c4c; --accent-text: #ffffff;
  --urgent: #a1261b; --high: #8a4b00; --moderate: #6b5900; --low: #2e5d2a;
  --urgent-bg: #fbe9e6; --high-bg: #fbeedb; --moderate-bg: #f6f0d2; --low-bg: #e7f2e4;
  --focus: #1a56db;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #141311; --surface: #1e1d1a; --text: #f2efe8; --muted: #b9b4a9;
    --line: #3a3833; --track: #2c2a26; --accent: #6fd3bd; --accent-text: #0b1f1a;
    --urgent: #ff9c90; --high: #ffc074; --moderate: #f1d36b; --low: #9fd996;
    --urgent-bg: #3a1d19; --high-bg: #3a2a14; --moderate-bg: #343013; --low-bg: #1d3019;
    --focus: #8ab4ff;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 1rem/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
}
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 0; padding: .5rem 1rem; background: var(--surface); }
.skip:focus { left: 1rem; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
.site { background: var(--surface); border-bottom: 1px solid var(--line); }
.site-inner, main, footer { max-width: 68rem; margin: 0 auto; padding: 0 1rem; }
.site-inner { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem 1.5rem; padding-block: .75rem; }
.brand { display: flex; align-items: baseline; gap: .6rem; margin-right: auto; }
.brand strong { font-size: 1.3rem; letter-spacing: .01em; }
.brand span { color: var(--muted); font-size: .95rem; }
nav ul { display: flex; gap: .25rem; list-style: none; margin: 0; padding: 0; }
nav a {
  display: inline-block; padding: .5rem .75rem; border-radius: .4rem;
  color: var(--text); text-decoration: none; min-height: 2.75rem; line-height: 1.75rem;
}
nav a:hover { background: var(--track); }
nav a[aria-current="page"] { font-weight: 650; box-shadow: inset 0 -3px 0 var(--accent); }
main { padding-bottom: 1rem; }
h1 { font-size: 1.75rem; line-height: 1.2; margin: 1.5rem 0 .5rem; }
h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; }
p.lead { color: var(--muted); margin-top: 0; max-width: 46rem; }
.grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
.card {
  background: var(--surface); border: 1px solid var(--line); border-radius: .6rem;
  padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: .1rem;
}
.card .n { font-size: 2rem; font-weight: 650; line-height: 1.15; font-variant-numeric: tabular-nums; }
.card .n-small { font-size: 1.4rem; padding-top: .35rem; }
.card .n-hidden { font-size: 1.15rem; font-weight: 600; color: var(--muted); padding: .55rem 0 .3rem; }
.card .l { font-weight: 600; }
.card .sub { color: var(--muted); font-size: .85rem; }
.card-alert { border-color: var(--urgent); box-shadow: inset 4px 0 0 var(--urgent); }
.two-col { display: grid; gap: 0 2rem; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); }
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
.bars li { display: grid; grid-template-columns: 9rem 1fr 6.5rem; align-items: center; gap: .75rem; }
.bar-label { font-size: .95rem; }
.bar-value { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
.bar-value small { color: var(--muted); font-weight: 400; }
.track { height: .9rem; background: var(--track); border-radius: 1rem; overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 1rem; }
.fill-urgent { background: var(--urgent); } .fill-high { background: var(--high); }
.fill-moderate { background: var(--moderate); } .fill-low { background: var(--low); }
.fill-accent { background: var(--accent); } .fill-muted { background: var(--muted); }
.trend { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: .6rem; padding: 1rem; }
.columns { display: flex; align-items: stretch; gap: .35rem; height: 11rem; }
.col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 0; }
.col-bar { width: 100%; max-width: 2.25rem; background: var(--accent); border-radius: .3rem .3rem 0 0; }
.col-hidden { background: repeating-linear-gradient(45deg, var(--track), var(--track) 3px, var(--line) 3px, var(--line) 6px); }
.col-value { font-size: .75rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.col-day { font-size: .75rem; color: var(--muted); border-top: 1px solid var(--line); width: 100%; text-align: center; padding-top: .2rem; }
.trend figcaption { color: var(--muted); font-size: .85rem; margin-top: .75rem; }
.badge {
  display: inline-block; padding: .1rem .55rem; border-radius: 1rem; font-weight: 650;
  font-size: .85rem; border: 1px solid currentColor; white-space: nowrap;
}
.badge-urgent { color: var(--urgent); background: var(--urgent-bg); }
.badge-high { color: var(--high); background: var(--high-bg); }
.badge-moderate { color: var(--moderate); background: var(--moderate-bg); }
.badge-low { color: var(--low); background: var(--low-bg); }
.levels { display: grid; gap: .5rem; margin: 0; }
.levels div { display: grid; grid-template-columns: 7rem 1fr; gap: .75rem; align-items: baseline; }
.levels dd { margin: 0; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: .6rem; background: var(--surface); }
table { border-collapse: collapse; width: 100%; }
.table-wrap table { min-width: 48rem; }
caption { text-align: left; padding: .75rem 1rem; color: var(--muted); }
th, td { text-align: left; padding: .65rem 1rem; border-top: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; font-size: .9rem; }
td.num { font-variant-numeric: tabular-nums; }
tr.late td:first-child { box-shadow: inset 4px 0 0 var(--urgent); }
.wait { display: block; color: var(--muted); font-size: .85rem; }
tr.late .wait strong { color: var(--urgent); }
table.compact th, table.compact td { padding: .5rem .5rem .5rem 0; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: .6rem; padding: .75rem 1rem; margin-bottom: 1rem; }
summary { font-weight: 650; cursor: pointer; min-height: 1.75rem; }
details ol { padding-left: 1.25rem; margin-bottom: 0; }
.hint { color: var(--muted); font-size: .9rem; margin: .5rem 0 0; }
.note { color: var(--muted); max-width: 46rem; }
button {
  font: inherit; cursor: pointer; border: 0; border-radius: .4rem;
  padding: .55rem .9rem; min-height: 2.75rem; background: var(--accent); color: var(--accent-text);
  white-space: nowrap;
}
.demo {
  margin: 1rem 0 0; padding: .75rem 1rem; border-radius: .5rem;
  background: var(--surface); border: 2px dashed var(--high); color: var(--text);
}
.empty { padding: 1.5rem 1rem; color: var(--muted); background: var(--surface); border: 1px solid var(--line); border-radius: .6rem; }
footer { color: var(--muted); font-size: .9rem; border-top: 1px solid var(--line); margin-top: 2.5rem; padding-block: 1rem; }
/* On phones each referral becomes a card, so nobody has to scroll sideways to reach the button. */
@media (max-width: 44rem) {
  .table-wrap { overflow: visible; }
  .table-wrap table.queue { min-width: 0; }
  .queue thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .queue tbody, .queue tr, .queue td { display: block; }
  .queue tr { border-top: 1px solid var(--line); padding: .75rem 1rem; }
  .queue td { border: 0; padding: .2rem 0; display: grid; grid-template-columns: 6.5rem 1fr; gap: .5rem; }
  .queue td::before { content: attr(data-label); color: var(--muted); font-size: .85rem; }
  .queue td.action { display: block; padding-top: .6rem; }
  .queue td.action::before { content: none; }
  .queue td.action button { width: 100%; }
  tr.late td:first-child { box-shadow: none; }
  tr.late { box-shadow: inset 4px 0 0 var(--urgent); }
}
@media (max-width: 34rem) {
  .bars li { grid-template-columns: 1fr auto; }
  .bars .track { grid-column: 1 / -1; grid-row: 2; }
  .col-value { display: none; }
  .col:nth-child(even) .col-day { visibility: hidden; }
  .levels div { grid-template-columns: 1fr; gap: .25rem; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="site-inner">
<div class="brand"><strong>Dada</strong><span>Perinatal wellbeing screening</span></div>
<nav aria-label="Main"><ul><li>${link("/stats", "Live numbers", "stats")}</li><li>${link("/staff", "Staff queue", "staff")}</li></ul></nav>
</div></header>
<main id="main">${options.demo === true ? '<p class="demo"><strong>Demo data.</strong> These are fictional test records, not real screenings.</p>' : ""}${body.html}</main>
<footer>Open source under the MIT licence. Built by Uwezo Link Initiative with VIPS Health Services, Nairobi. Emergency: 999 or 112. GBV helpline: 1195 (free).</footer>
</body>
</html>`;
}
