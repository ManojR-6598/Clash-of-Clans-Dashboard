// Decodes a Clash of Clans Data Export into a Markdown report, optionally compared with an earlier export.
// Usage: node decoder/decode.mjs <export.json> [previous-export.json] [--out report.md]
// Names come from decoder/id-map.json (rebuild with build-id-map.mjs); levels, max levels and upgrade
// costs from js/game-data.js. Nothing is guessed: IDs missing from the map are reported as UNKNOWN.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const [curPath, prevPath] = args;
if (!curPath) { console.error("Usage: node decoder/decode.mjs <export.json> [previous.json] [--out report.md]"); process.exit(1); }

const MAP = JSON.parse(readFileSync(join(here, "id-map.json"), "utf8"));
const GAME = eval("(" + readFileSync(join(root, "js/game-data.js"), "utf8").replace(/^const GAME\s*=\s*/, "").replace(/;\s*$/, "") + ")");
const BY_ID = Object.fromEntries(GAME.items.map((i) => [i.id, i]));
// new rows from datamine reports that have no ID yet (written by import-datamine.mjs); offered as candidates only
const DM = existsSync(join(here, "datamine-new.json")) ? JSON.parse(readFileSync(join(here, "datamine-new.json"), "utf8")) : { reports: {}, tables: {} };
const candidates = (table) => (DM.tables[table] || []).filter((r) => !r.knownIds).sort((a, b) => b.report.localeCompare(a.report) || a.order - b.order);
const exp = JSON.parse(readFileSync(curPath, "utf8"));
const prev = prevPath ? JSON.parse(readFileSync(prevPath, "utf8")) : null;

// export key -> [id-map table, village]
const KEYS = {
  buildings: ["buildings", "home"], traps: ["traps", "home"], decos: ["decos", "home"], obstacles: ["obstacles", "home"],
  units: ["characters", "home"], siege_machines: ["characters", "home"], heroes: ["heroes", "home"], spells: ["spells", "home"],
  pets: ["pets", "home"], equipment: ["equipment", "home"], helpers: ["helpers", "home"],
  buildings2: ["buildings", "builder"], traps2: ["traps", "builder"], decos2: ["decos", "builder"], obstacles2: ["obstacles", "builder"],
  units2: ["characters", "builder"], heroes2: ["heroes", "builder"],
  house_parts: ["house_parts"], skins: ["skins"], skins2: ["skins"], sceneries: ["sceneries"], sceneries2: ["sceneries"], emotes: ["emotes"],
  building_variants: ["buildings"], building_variants2: ["buildings"],
};
const ID = { TH: 1000001, BH: 1000034, LAB: 1000007, HH: 1000071, BS: 1000070, PH: 1000068, SL: 1000046, HUT: 1000015, OTTO: 1000078 };

const lookup = (key, id) => {
  const [table, village] = KEYS[key] || [];
  const e = table && MAP.ids[table] && MAP.ids[table][id];
  if (!e) return { name: "UNKNOWN", status: "unknown", sources: [] };
  const out = { ...e };
  if (village && e.village && e.village !== village) out.warn = `ID belongs to ${e.village}, found in ${key}`;
  return out;
};
const label = (e) => {
  const n = e.name || (e.internal ? `UNKNOWN (internal: ${e.internal})` : "UNKNOWN");
  const tag = { verified: "", researched: " ‡", "single-source": " †", "internal-name-only": " *", conflict: " ⚠", retired: " ✕", unknown: " ?" }[e.status] ?? "";
  return n + tag + (e.warn ? ` ⚠ ${e.warn}` : "");
};

// ---------- time ----------
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const when = (s) => new Date(s * 1000).toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
const dur = (s) => { s = Math.max(0, Math.round(s)); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return [d && d + "d", (d || h) && h + "h", m + "m"].filter(Boolean).join(" "); };

// ---------- max levels (same rules as js/app.js) ----------
function bldMaxAt(id, th) { const it = BY_ID[id]; if (!it) return 0; let m = 0; for (const L of it.lv) if (L[4] == null || L[4] <= th) m = Math.max(m, L[0]); return m; }
function levelOK(L, th, caps) { if (L[4] != null && L[4] > th) return false; const rq = L[5]; if (rq) for (const k in rq) if (caps[k] != null && rq[k] > caps[k]) return false; return true; }
function maxAt(id, th, caps) { const it = BY_ID[id]; if (!it) return null; let m = 0; for (const L of it.lv) if (levelOK(L, th, caps)) m = Math.max(m, L[0]); return m; }
const firstLvl = (list, id) => ((list || []).find((e) => e.data === id) || {}).lvl || 0;
const th = firstLvl(exp.buildings, ID.TH), bh = firstLvl(exp.buildings2, ID.BH);
const capsTH = { lab: bldMaxAt(ID.LAB, th), herohall: bldMaxAt(ID.HH, th), blacksmith: bldMaxAt(ID.BS, th), pethouse: bldMaxAt(ID.PH, th) };
const capsNow = { lab: firstLvl(exp.buildings, ID.LAB), herohall: firstLvl(exp.buildings, ID.HH), blacksmith: firstLvl(exp.buildings, ID.BS), pethouse: firstLvl(exp.buildings, ID.PH) };
const bbTH = { starlab: bldMaxAt(ID.SL, bh) }, bbNow = { starlab: firstLvl(exp.buildings2, ID.SL) };
const HALLS = new Set([ID.TH, ID.BH]);
const maxFor = (key, id) => {
  if (HALLS.has(id)) return null;
  const builder = (KEYS[key] || [])[1] === "builder";
  return builder ? { now: maxAt(id, bh, bbNow), hall: maxAt(id, bh, bbTH) } : { now: maxAt(id, th, capsNow), hall: maxAt(id, th, capsTH) };
};

// ---------- helpers ----------
const maxStr = (mx) => (!mx || mx.now == null ? "—" : mx.hall === 0 ? `locked at ${hallName()}` : `${mx.now} / ${mx.hall}`);
const hallName = () => `TH${th}`;
const groupById = (list) => { const m = new Map(); for (const e of list || []) { if (!m.has(e.data)) m.set(e.data, []); m.get(e.data).push(e); } return m; };
const lvlStr = (entries) => {
  const n = new Map();
  for (const e of entries) n.set(e.lvl ?? null, (n.get(e.lvl ?? null) || 0) + (e.cnt || 1));
  return [...n].sort((a, b) => a[0] - b[0]).map(([l, c]) => `${c > 1 ? c + "×" : ""}L${l ?? "-"}`).join(", ");
};
const count = (entries) => entries.reduce((s, e) => s + (e.cnt || 1), 0);
const md = [];
const p = (s = "") => md.push(s);
const table = (head, rows) => { if (!rows.length) { p("_None._"); p(); return; } p("| " + head.join(" | ") + " |"); p("|" + head.map(() => "---").join("|") + "|"); for (const r of rows) p("| " + r.join(" | ") + " |"); p(); };
const timers = [];
const noteTimer = (key, e, name) => { if (e.timer) timers.push({ key, name, from: e.lvl, end: exp.timestamp + e.timer, left: e.timer }); };
const unknowns = [];
const seen = (key, id, e) => { if (["unknown", "internal-name-only", "retired"].includes(e.status) || e.warn) unknowns.push({ key, id, e }); };

// ---------- A. overview ----------
const allTimers = [];
for (const k of Object.keys(KEYS)) for (const e of exp[k] || []) if (e && e.timer) allTimers.push(e);
const heroCount = (exp.heroes || []).length, huts = count((exp.buildings || []).filter((e) => e.data === ID.HUT));
const otto = firstLvl(exp.buildings2, ID.OTTO);
p(`# Village report · ${exp.tag}`);
p();
p(`Export taken **${when(exp.timestamp)}** (timestamp ${exp.timestamp}). Completion times below count from that moment.`);
p();
p("Legend: no mark = verified by two sources · † one source · * internal name only · ⚠ sources disagree · ‡ researched by hand · UNKNOWN = no source has this ID. Sources are listed at the end.");
p();
p("## A. Account overview");
p();
table(["Item", "Value"], [
  ["Player tag", exp.tag],
  ["Town Hall", th ? `${th}` + ((exp.buildings || []).find((e) => e.data === ID.TH && e.timer) ? ` (upgrading to ${th + 1})` : "") : "—"],
  ["Builder Hall", bh || "—"],
  ["Builders (Home Village)", `${huts} Builder's Huts` + ((exp.helpers || []).length ? ` + ${(exp.helpers || []).length} helper` : "")],
  ["Builders (Builder Base)", otto ? "2 (Master Builder + O.T.T.O)" : bh ? "1 (Master Builder)" : "—"],
  ["Heroes", `${heroCount} Home Village, ${(exp.heroes2 || []).length} Builder Base`],
  ["Hero equipment owned", `${(exp.equipment || []).length}`],
  ["Active upgrades", `${allTimers.length}`],
]);

// ---------- generic section ----------
function itemSection(title, keys, opts = {}) {
  p(`## ${title}`);
  p();
  for (const key of keys) {
    const list = exp[key];
    if (!list || !list.length) continue;
    if (keys.length > 1) { p(`### ${opts.titles?.[key] || key}`); p(); }
    const rows = [];
    for (const [id, entries] of groupById(list)) {
      const e = lookup(key, id); seen(key, id, e);
      for (const x of entries) noteTimer(key, x, e.name || `ID ${id}`);
      const up = entries.filter((x) => x.timer);
      const mx = opts.levels ? maxFor(key, id) : null;
      const r = [label(e), lvlStr(entries), String(count(entries))];
      if (opts.levels) r.push(maxStr(mx));
      r.push(up.length ? up.map((x) => (x.lvl === 0 ? "Building" : `L${x.lvl}→L${x.lvl + 1}`) + (x.gear_up ? " (geared)" : "")).join(", ") : entries.some((x) => x.gear_up) ? "Geared up" : (entries.some((x) => x.helper_recurrent) ? "Helper assigned" : "—"));
      r.push(up.length ? up.map((x) => dur(x.timer)).join(", ") : "—");
      r.push(`\`${id}\``);
      rows.push(r);
    }
    const head = ["Name", "Level", "Qty"];
    if (opts.levels) head.push("Max now / at hall");
    head.push("Status", "Time left", "ID");
    table(head, rows);
  }
}

const DEF = new Set(["defense"]);
const homeDef = (exp.buildings || []).filter((e) => BY_ID[e.data] && (DEF.has(BY_ID[e.data].k) || BY_ID[e.data].k === "wall"));
const homeOther = (exp.buildings || []).filter((e) => !homeDef.includes(e));
exp.__homeOther = homeOther; exp.__homeDef = homeDef;
KEYS.__homeOther = ["buildings", "home"]; KEYS.__homeDef = ["buildings", "home"];
itemSection("B. Home Village buildings", ["__homeOther"], { levels: true });
itemSection("C. Defences and traps", ["__homeDef", "traps"], { levels: true, titles: { __homeDef: "Defences and walls", traps: "Traps" } });
itemSection("D. Troops, siege machines, spells and pets", ["units", "siege_machines", "spells", "pets"], { levels: true, titles: { units: "Troops", siege_machines: "Siege machines", spells: "Spells", pets: "Pets" } });
itemSection("E. Heroes", ["heroes"], { levels: true });

// ---------- F. equipment ----------
p("## F. Hero equipment");
p();
p(`Max levels use your Blacksmith (L${capsNow.blacksmith}) and, after the slash, the Blacksmith max at TH${th} (L${capsTH.blacksmith}). Epic pieces go to 27 and Common to 18 once the Blacksmith allows it.`);
p();
{
  const heroTitle = (h) => (h ? String(h).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
  const rows = (exp.equipment || []).map((x) => {
    const e = lookup("equipment", x.data); seen("equipment", x.data, e);
    const mx = maxFor("equipment", x.data);
    const it = BY_ID[x.data];
    return [label(e), heroTitle(e.hero), e.rarity ? String(e.rarity).replace(/^\w/, (c) => c.toUpperCase()) : "—", `L${x.lvl}`, maxStr(mx), it ? String(it.lv.length) : "—", e.info || (e.status === "unknown" ? "Not in any source" : "—"), `\`${x.data}\``];
  }).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  table(["Equipment", "Hero", "Rarity", "Level", "Max now / at TH", "Levels in game", "Ability (coc.py)", "ID"], rows);
}

// ---------- G. builder base ----------
itemSection("G. Builder Base", ["buildings2", "traps2", "units2", "heroes2"], { levels: true, titles: { buildings2: "Buildings", traps2: "Traps", units2: "Troops", heroes2: "Heroes" } });

// ---------- H. cosmetics ----------
p("## H. Cosmetics, decorations and obstacles");
p();
for (const [key, title] of [["skins", "Hero skins"], ["sceneries", "Sceneries"], ["emotes", "Emotes"], ["house_parts", "Clan House parts"], ["decos", "Decorations (Home)"], ["decos2", "Decorations (Builder Base)"], ["obstacles", "Obstacles (Home)"], ["obstacles2", "Obstacles (Builder Base)"]]) {
  const list = (exp[key] || []).map((x) => (typeof x === "number" ? { data: x } : x));
  if (!list.length) continue;
  p(`### ${title}`);
  p();
  table(["Name", "Qty", "Detail", "ID"], [...groupById(list)].map(([id, entries]) => {
    const e = lookup(key, id); seen(key, id, e);
    return [label(e), String(count(entries)), e.character || e.note || "", `\`${id}\``];
  }));
}
p("### Helpers");
p();
table(["Helper", "Level", "Cooldown left", "Ready at", "ID"], (exp.helpers || []).map((x) => {
  const e = lookup("helpers", x.data); seen("helpers", x.data, e);
  return [label(e), `L${x.lvl}`, x.helper_cooldown ? dur(x.helper_cooldown) : "Ready", x.helper_cooldown ? when(exp.timestamp + x.helper_cooldown) : "—", `\`${x.data}\``];
}));
const assigned = [];
for (const k of Object.keys(KEYS)) for (const x of exp[k] || []) if (x && x.helper_recurrent) assigned.push(`${lookup(k, x.data).name} (${k})`);
if (assigned.length) { p(`Recurring helper assignment: ${assigned.join(", ")}.`); p(); }

// ---------- I. timelines ----------
p("## I. Upgrade timelines");
p();
if (exp.boosts && exp.boosts.clocktower_cooldown) timers.push({ key: "boosts", name: "Clock Tower boost available again", from: null, end: exp.timestamp + exp.boosts.clocktower_cooldown, left: exp.boosts.clocktower_cooldown });
for (const x of exp.helpers || []) if (x.helper_cooldown) timers.push({ key: "helpers", name: `${lookup("helpers", x.data).name} ready again`, from: null, end: exp.timestamp + x.helper_cooldown, left: x.helper_cooldown });
const where = (k) => ({ __homeOther: "Home · builder", __homeDef: "Home · builder", traps: "Home · builder", heroes: "Home · hero", units: "Home · lab", spells: "Home · lab", siege_machines: "Home · lab", pets: "Home · pet house", equipment: "Home · blacksmith", buildings2: "Builder Base · builder", traps2: "Builder Base · builder", heroes2: "Builder Base · hero", units2: "Builder Base · star lab", boosts: "Builder Base", helpers: "Home · helper" }[k] || k);
table(["Finishes", "What", "Where", "Time left at export"], timers.sort((a, b) => a.end - b.end).map((t) => [when(t.end), t.from == null ? t.name : t.from === 0 ? `${t.name} (new, building)` : `${t.name} L${t.from}→L${t.from + 1}`, where(t.key), dur(t.left)]));

// ---------- J. planning signals ----------
p("## J. Planning signals");
p();
p("Facts computed from the export and the game data. Interpretation and advice are in the written report, not here.");
p();
{
  const rushed = [];
  const prevCaps = { lab: bldMaxAt(ID.LAB, th - 1), herohall: bldMaxAt(ID.HH, th - 1), blacksmith: bldMaxAt(ID.BS, th - 1), pethouse: bldMaxAt(ID.PH, th - 1) };
  for (const key of ["buildings", "traps", "units", "spells", "heroes"]) for (const [id, entries] of groupById(exp[key])) {
    const it = BY_ID[id]; if (!it || it.k === "wall" || HALLS.has(id)) continue;
    const pm = maxAt(id, th - 1, prevCaps); if (!pm) continue;
    const low = entries.filter((x) => x.lvl < pm).reduce((s, x) => s + (x.cnt || 1), 0);
    if (low) rushed.push([lookup(key, id).name, lvlStr(entries), `L${pm}`, `${low}`]);
  }
  p(`### Below the TH${th - 1} max (rushed)`);
  p();
  table(["Item", "Your levels", `TH${th - 1} max`, "Copies below"], rushed);
  const builders = huts, busy = [...(exp.buildings || []), ...(exp.traps || []), ...(exp.heroes || [])].filter((x) => x.timer).length;
  p(`Home Village builders busy at export: **${busy} of ${builders}**. Builder Base builders busy: **${[...(exp.buildings2 || []), ...(exp.traps2 || []), ...(exp.heroes2 || [])].filter((x) => x.timer).length} of ${otto ? 2 : 1}**.`);
  p();
}

// ---------- unknowns ----------
p("## Unidentified IDs");
p();
table(["Category", "ID", "Status", "What is known"], unknowns.map(({ key, id, e }) => [key.replace(/^__home\w+/, "buildings"), `\`${id}\``, e.warn ? "village mismatch" : e.status, e.warn || e.note || (e.internal ? `internal name ${e.internal}` : "no source has this ID")]));
{
  // candidate names: new rows in the same table that no ID has yet, newest update first
  const tables = [...new Set(unknowns.filter(({ e }) => e.status === "unknown").map(({ key }) => (KEYS[key] || [])[0]).filter(Boolean))]; // an ID with an internal name is an older row
  const lines = tables.map((t) => [t, candidates(t)]).filter(([, c]) => c.length);
  if (lines.length) {
    p("**Possible names** from datamine reports: rows added in recent updates that don't have a known ID yet. These are candidates, not matches; confirm in game before adding one to overrides.json.");
    p();
    for (const [t, c] of lines) {
      const by = {};
      for (const r of c) (by[r.report.slice(0, 10)] ||= []).push(r.name);
      p(`- **${t}**: ${Object.entries(by).map(([d, n]) => `${n.join(", ")} (${d})`).join("; ")}`);
    }
    p();
  }
}

// ---------- diff ----------
if (prev) {
  p(`## Changes since ${when(prev.timestamp)}`);
  p();
  const expand = (list) => { const out = []; for (const e of list || []) for (let i = 0; i < (e.cnt || 1); i++) out.push(e.lvl ?? null); return out.sort((a, b) => a - b); };
  const rows = [], started = [], finished = [];
  for (const key of Object.keys(KEYS).filter((k) => !k.startsWith("__"))) {
    const a = groupById((prev[key] || []).map((x) => (typeof x === "number" ? { data: x } : x)));
    const b = groupById((exp[key] || []).map((x) => (typeof x === "number" ? { data: x } : x)));
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const ea = a.get(id) || [], eb = b.get(id) || [];
      const la = JSON.stringify(expand(ea)), lb = JSON.stringify(expand(eb));
      const name = lookup(key, id).name;
      const show = (es) => (es.some((x) => x.lvl != null) ? lvlStr(es) : `${count(es)}×`);
      if (la !== lb) rows.push([name, key, ea.length ? show(ea) : "not owned", eb.length ? show(eb) : "gone"]);
      const ta = ea.filter((x) => x.timer).map((x) => x.lvl), tb = eb.filter((x) => x.timer).map((x) => x.lvl);
      for (const l of tb) if (!ta.includes(l)) started.push(`${name} L${l}→L${l + 1}`);
      for (const l of ta) if (!tb.includes(l)) finished.push(`${name} L${l}→L${l + 1}`);
    }
  }
  p("### Level or count changes");
  p();
  table(["Item", "Category", "Before", "Now"], rows);
  p(`**Timers that ended:** ${finished.join(", ") || "none"} (an item can rise more than one level between exports; the table above is the full change)`);
  p();
  p(`**Upgrades started:** ${started.join(", ") || "none"}`);
  p();
}

// ---------- sources ----------
p("## Sources");
p();
for (const [k, v] of Object.entries(MAP.sources)) p(`- **${k}**: ${v}`);
p(`- **Max levels and upgrade data**: js/game-data.js (clash-of-clans-data v0.19.1)`);
for (const [k, r] of Object.entries(DM.reports)) p(`- **Datamine report ${k}**: ${r.url}`);
p(`- ID map built ${MAP.generated}`);
p();

delete exp.__homeOther; delete exp.__homeDef;
const text = md.join("\n");
if (outPath) { writeFileSync(outPath, text); console.log(`Wrote ${outPath} (${unknowns.length} unidentified IDs)`); }
else process.stdout.write(text);
