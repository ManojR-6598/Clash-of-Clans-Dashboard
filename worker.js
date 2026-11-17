// Cloudflare Worker: serves the static site and one API route.
// GET /api/player?tag=%23ABC123 -> trimmed player profile from the official Clash of Clans API.
// The API key lives in the COC_API_TOKEN secret (npx wrangler secret put COC_API_TOKEN) and never
// reaches the browser. Requests go through the RoyaleAPI proxy, whose fixed IP (45.79.218.79) is the
// one registered on the key; set COC_API_BASE to call the API another way.
const DEFAULT_BASE = "https://cocproxy.royaleapi.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/player") return player(url, env);
    return env.ASSETS.fetch(request);
  },
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function player(url, env) {
  if (!env.COC_API_TOKEN) return json(501, { error: "Sync isn't set up: the COC_API_TOKEN secret is missing on the Worker." });
  const tag = (url.searchParams.get("tag") || "").trim().toUpperCase().replace(/^#/, "");
  if (!/^[0289PYLQGRJCUV]{3,12}$/.test(tag)) return json(400, { error: "That doesn't look like a player tag." });

  let res;
  try {
    res = await fetch(`${env.COC_API_BASE || DEFAULT_BASE}/v1/players/${encodeURIComponent("#" + tag)}`, {
      headers: { authorization: `Bearer ${env.COC_API_TOKEN}`, accept: "application/json" },
    });
  } catch (e) {
    return json(502, { error: "Couldn't reach the Clash of Clans API." });
  }
  if (res.status === 403) return json(502, { error: "The API rejected the key. Check the key is valid and its allowed IP list includes 45.79.218.79." });
  if (res.status === 404) return json(404, { error: `No player found with tag #${tag}.` });
  if (res.status === 429) return json(429, { error: "The API is rate limiting requests. Try again in a minute." });
  if (!res.ok) return json(502, { error: `The Clash of Clans API answered ${res.status}.` });

  const p = await res.json();
  const pick = (list) => (list || []).map(({ name, level, maxLevel, village }) => ({ name, level, maxLevel, village }));
  return json(200, {
    tag: p.tag,
    name: p.name,
    townHallLevel: p.townHallLevel,
    builderHallLevel: p.builderHallLevel,
    heroes: (p.heroes || []).map((h) => ({ name: h.name, level: h.level, village: h.village, equipment: pick(h.equipment).map((e) => e.name) })),
    heroEquipment: pick(p.heroEquipment),
    troops: pick(p.troops),
    spells: pick(p.spells),
  });
}
