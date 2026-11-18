// Builds decoder/id-map.json: every known export ID with its name and where the name came from.
// Usage: node decoder/build-id-map.mjs <coc.py static_data.json> <game CSV folder> [csv version label]
// Sources (see decoder/README.md for download commands):
//   A. js/game-data.js        - clash-of-clans-data (npm), names + levels for gameplay items
//   B. coc.py static_data.json - generated from the game's own files, display names incl. cosmetics
//   C. game CSV tables         - logic/*.csv from Enjoyop2/Clash-of-Clans-data-assets; internal names only
// Tables with a GlobalID column (buildings, characters, spells, traps) give each row's ID directly; the
// others are (base + row number), counting retired rows, which is also how coc.py numbers them. C confirms
// the row exists and its internal name, but the texts file is hashed, so C never supplies a display name.
// IDs are unique across villages (Home and Builder Base Cannons have different IDs), so there is one
// table per ID range and each entry records its village.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const [cocpyPath, csvDir, csvVersion = "unknown"] = process.argv.slice(2);
if (!cocpyPath || !csvDir) {
  console.error("Usage: node decoder/build-id-map.mjs <static_data.json> <csv folder> [csv version]");
  process.exit(1);
}

// table -> sources; export keys that use each table are listed in decode.mjs
const TABLES = {
  buildings: { base: 1000000, csv: "buildings.csv", cocpy: ["buildings"] },
  traps: { base: 12000000, csv: "traps.csv", cocpy: ["traps"] },
  decos: { base: 18000000, csv: "decos.csv", cocpy: ["decorations"] },
  obstacles: { base: 8000000, csv: "obstacles.csv", cocpy: ["obstacles"] },
  characters: { base: 4000000, csv: "characters.csv", cocpy: ["troops"] },
  heroes: { base: 28000000, csv: "heroes.csv", cocpy: ["heroes"] },
  spells: { base: 26000000, csv: "spells.csv", cocpy: ["spells"] },
  pets: { base: 73000000, csv: "pets.csv", cocpy: ["pets"] },
  equipment: { base: 90000000, csv: "character_items.csv", cocpy: ["equipment"] },
  house_parts: { base: 82000000, csv: "building_parts.csv", cocpy: ["capital_house_parts"] },
  skins: { base: 52000000, csv: "skins.csv", cocpy: ["skins"] },
  sceneries: { base: 60000000, csv: "village_backgrounds.csv", cocpy: ["sceneries"] },
  helpers: { base: 93000000, csv: "villager_apprentices.csv", cocpy: ["helpers"] },
  emotes: { base: 126000000, cocpy: [] }, // no public source found
};

// minimal CSV parser (quoted fields, commas, newlines inside quotes)
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
// { id: row } for a table
function csvRows(file, base) {
  const p = join(csvDir, file);
  if (!file || !existsSync(p)) return null;
  const [head, , ...body] = parseCsv(readFileSync(p, "utf8"));
  const out = {};
  let n = 0;
  for (const r of body) {
    if (!r[0]) continue;
    const row = Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]));
    out[row.GlobalID ? Number(row.GlobalID) : base + n] = row;
    n++;
  }
  return out;
}

const GAME = eval("(" + readFileSync(join(root, "js/game-data.js"), "utf8").replace(/^const GAME\s*=\s*/, "").replace(/;\s*$/, "") + ")");
const gameById = Object.fromEntries(GAME.items.map((i) => [i.id, i]));
const cocpy = JSON.parse(readFileSync(cocpyPath, "utf8"));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const overridesPath = join(here, "overrides.json");
const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, "utf8")).ids || {} : {};

const map = {};
for (const [table, t] of Object.entries(TABLES)) {
  const cp = {};
  for (const k of t.cocpy) for (const e of cocpy[k] || []) cp[e._id] = e;
  const rows = t.csv ? csvRows(t.csv, t.base) : null;
  const ids = new Set([...Object.keys(cp), ...Object.keys(rows || {})].map(Number));
  for (const it of GAME.items) if (it.id >= t.base && it.id < t.base + 1000000) ids.add(it.id);
  for (const k of Object.keys(overrides)) if (k.startsWith(table + ":")) ids.add(Number(k.split(":")[1])); // IDs only an override knows

  for (const id of [...ids].sort((a, b) => a - b)) {
    const g = gameById[id], c = cp[id], row = rows ? rows[id] : null;
    const internal = row ? row.Name : null;
    const retired = row ? String(row.Deprecated).toUpperCase() === "TRUE" : false;
    const sources = [];
    if (g) sources.push("clash-of-clans-data");
    if (c) sources.push("coc.py");
    if (row) sources.push(`game-csv ${csvVersion}`);

    let name = g?.n || c?.name || null, status, note;
    if (g && c) {
      status = norm(g.n) === norm(c.name) ? "verified" : "conflict";
      if (status === "conflict") note = `clash-of-clans-data says "${g.n}", coc.py says "${c.name}"`;
    } else if (name && internal && !retired && norm(name) === norm(internal)) {
      status = "verified";
    } else if (name) {
      status = "single-source";
      if (retired) note = `row was a retired placeholder (${internal}) in ${csvVersion} and was reused later`;
    } else if (internal && !retired) {
      status = "internal-name-only";
      note = "display name not in any source; internal name from the game table";
    } else status = retired ? "retired" : "unknown";

    const village = g ? (g.b === "b" ? "builder" : "home")
      : c?.village ? (/builder/i.test(c.village) ? "builder" : "home")
      : internal && /^(BB[ _]|BB2_)/.test(internal) ? "builder" : undefined;
    const e = { name, internal, status, sources };
    if (village) e.village = village;
    if (note) e.note = note;
    if (table === "equipment" && (g?.x || c)) {
      e.hero = c?.hero || g?.x?.hero; e.rarity = c?.rarity || g?.x?.rarity;
      if (c?.info) e.info = c.info;
    }
    if (table === "skins" && c?.character) e.character = c.character;
    if (overrides[`${table}:${id}`]) { Object.assign(e, overrides[`${table}:${id}`], { status: "researched" }); e.sources = [...e.sources, "overrides.json"]; if (table === "equipment" && !e.village) e.village = "home"; }
    (map[table] ||= {})[id] = e;
  }
}

const out = {
  generated: new Date().toISOString(),
  sources: {
    "clash-of-clans-data": "npm clash-of-clans-data v0.19.1 (29 Oct 2026), bundled as js/game-data.js — https://github.com/chiefpansancolt/clash-of-clans-data",
    "coc.py": "coc/static/static_data.json, last updated 1 Dec 2025, generated from the game's files — https://github.com/mathsman5133/coc.py",
    [`game-csv ${csvVersion}`]: `logic/*.csv from game version ${csvVersion} — https://github.com/Enjoyop2/Clash-of-Clans-data-assets/tree/main/${csvVersion}/logic`,
  },
  statuses: {
    verified: "two independent sources give the same name",
    "single-source": "one source names it; the game table may confirm the row exists",
    "internal-name-only": "only the game table's internal name is known",
    conflict: "sources disagree; both names are in the note",
    researched: "named from decoder/overrides.json",
    retired: "a retired placeholder row in the game table",
    unknown: "no source has this ID",
  },
  ids: map,
};
writeFileSync(join(here, "id-map.json"), JSON.stringify(out, null, 1));
const counts = {};
for (const tb of Object.values(map)) for (const e of Object.values(tb)) counts[e.status] = (counts[e.status] || 0) + 1;
console.log("Wrote decoder/id-map.json", counts);
