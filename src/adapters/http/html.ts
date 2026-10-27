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

/**
 * Page shell. Colours meet WCAG 2.2 AA contrast in light and dark mode, focus is always
 * visible, motion is minimal, and the layout works from 320px wide.
 */
export function page(title: string, body: SafeHtml, demo = false): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Dada</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #fbfaf7; --surface: #ffffff; --text: #1c1b19; --muted: #55524c;
  --line: #d9d5cc; --accent: #0f5c4c; --accent-text: #ffffff;
  --urgent: #a1261b; --high: #8a4b00; --moderate: #5b4a00; --low: #2e5d2a;
  --focus: #1a56db;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161513; --surface: #1f1e1b; --text: #f2efe8; --muted: #b9b4a9;
    --line: #3a3833; --accent: #6fd3bd; --accent-text: #0b1f1a;
    --urgent: #ff9c90; --high: #ffc074; --moderate: #f1d36b; --low: #9fd996;
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
header, main, footer { max-width: 64rem; margin: 0 auto; padding: 1rem; }
header { display: flex; align-items: baseline; gap: 1rem; border-bottom: 1px solid var(--line); }
header strong { font-size: 1.25rem; letter-spacing: .01em; }
header span { color: var(--muted); }
h1 { font-size: 1.6rem; line-height: 1.25; margin: 1.25rem 0 .5rem; }
h2 { font-size: 1.15rem; margin: 1.75rem 0 .5rem; }
p.lead { color: var(--muted); margin-top: 0; max-width: 42rem; }
.grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: .5rem; padding: .9rem 1rem; }
.card .n { display: block; font-size: 1.75rem; font-weight: 650; font-variant-numeric: tabular-nums; }
.card .n-hidden { font-size: 1.15rem; font-weight: 600; color: var(--muted); padding: .4rem 0 .25rem; }
.card .l { color: var(--muted); font-size: .9rem; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: .5rem; background: var(--surface); }
table { border-collapse: collapse; width: 100%; min-width: 40rem; }
caption { text-align: left; padding: .75rem 1rem; color: var(--muted); }
th, td { text-align: left; padding: .65rem 1rem; border-top: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; font-size: .9rem; }
td.num { font-variant-numeric: tabular-nums; }
.tier { font-weight: 650; text-transform: capitalize; }
.tier-urgent { color: var(--urgent); } .tier-high { color: var(--high); }
.tier-moderate { color: var(--moderate); } .tier-low { color: var(--low); }
button {
  font: inherit; cursor: pointer; border: 0; border-radius: .4rem;
  padding: .55rem .9rem; min-height: 2.75rem; background: var(--accent); color: var(--accent-text);
}
.demo {
  margin: 1rem 0 0; padding: .75rem 1rem; border-radius: .5rem;
  background: var(--surface); border: 2px dashed var(--high); color: var(--text);
}
.empty { padding: 1.5rem 1rem; color: var(--muted); }
footer { color: var(--muted); font-size: .9rem; border-top: 1px solid var(--line); margin-top: 2rem; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header><strong>Dada</strong><span>Perinatal wellbeing screening</span></header>
<main id="main">${demo ? '<p class="demo"><strong>Demo data.</strong> These are fictional test records, not real screenings.</p>' : ""}${body.html}</main>
<footer>Open source under the MIT licence. Emergency: 999 or 112. GBV helpline: 1195 (free).</footer>
</body>
</html>`;
}
