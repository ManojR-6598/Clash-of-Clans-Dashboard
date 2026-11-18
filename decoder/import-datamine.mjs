// Reads NotAmti/Clash-of-Clans-Datamine reports and lists every new row per game table in decoder/datamine-new.json.
// Usage: node decoder/import-datamine.mjs <report.md> [more reports…]
// Reports give names and file order but no IDs. Rows whose name already has an ID in id-map.json are marked as
// known; the rest become candidates that decode.mjs offers for unknown IDs in the same table. Nothing is assigned:
// only overrides.json gives an ID a name.
// Some reports also list a row's GlobalID next to its name (the Town Hall 19 report does for 449 skins). Those pairs
// come straight from the game files, so they are saved under "globalIds" and build-id-map.mjs uses them as a source.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2);
if (!files.length) { console.error("Usage: node decoder/import-datamine.mjs <report.md> [more reports…]"); process.exit(1); }

// report section -> id-map table
const SECTIONS = { "Troops": "characters", "Heroes": "heroes", "Pets": "pets", "Spells": "spells", "Equipment": "equipment",
  "Buildings": "buildings", "Skins": "skins", "Traps": "traps", "Decorations": "decos", "Obstacles": "obstacles" };

const MAP = JSON.parse(readFileSync(join(here, "id-map.json"), "utf8"));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const known = {};
for (const [t, ids] of Object.entries(MAP.ids)) for (const [id, e] of Object.entries(ids))
  for (const n of [e.name, e.internal]) if (n) ((known[t] ||= {})[norm(n)] ||= []).push(Number(id));

const outPath = join(here, "datamine-new.json");
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : { reports: {}, tables: {} };
out.globalIds ||= {};
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const report = basename(f, ".md");
  const fp = (text.match(/\*\*Fingerprint:\*\*\s*`([0-9a-f]+)`/) || [])[1] || null;
  const gen = (text.match(/\*\*Generated:\*\*\s*([^\n]+?)\s*$/m) || [])[1] || null;
  out.reports[report] = { fingerprint: fp, generated: gen, url: `https://github.com/NotAmti/Clash-of-Clans-Datamine/blob/main/reports/${report}.md` };
  // "| Name | Levels | GlobalID | (none) → 52000337 |": a name and its ID, from the game files
  for (const [, n, id] of text.matchAll(/^\| (.+?) \| [^|]* \| GlobalID \| [^|]*?→ (\d+) \|/gm)) out.globalIds[id] = { name: n, report };
  for (const sec of text.split(/^## /m).slice(1)) {
    const title = sec.split("\n")[0];
    // "Capital Buildings" and the like are other tables, so match the section name exactly
    const name = title.replace(/^\S+\s+/, "").replace(/\s*_\(.*$/, "").trim();
    const table = SECTIONS[name];
    if (!table) continue;
    const block = sec.split("**🆕 New units**")[1];
    if (!block) continue;
    const rows = [...block.split(/\n\*\*/)[0].matchAll(/^- (?:!\[[^\]]*\]\(([^)]*)\) )?\*\*(.+?)\*\*(?: — _(.+?)_)?\s*$/gm)]
      .map(([, icon, n, stats], order) => {
        const ids = (known[table] || {})[norm(n)] || [];
        const r = { name: n, order, report };
        if (icon) r.icon = basename(icon);
        if (stats) r.stats = stats;
        if (ids.length) r.knownIds = ids;
        return r;
      });
    const list = (out.tables[table] ||= []).filter((r) => r.report !== report);
    out.tables[table] = list.concat(rows);
  }
}
writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out.globalIds).length} name–ID pairs`);
for (const [t, rows] of Object.entries(out.tables))
  console.log(`${t}: ${rows.length} new rows, ${rows.filter((r) => !r.knownIds).length} without an ID yet`);
