# Export decoder

Turns a Clash of Clans **Data Export** into a readable Markdown report: every ID named with its source, levels against max levels, upgrade completion times, and what changed since the previous export.

```bash
node decoder/decode.mjs decoder/exports/new.json decoder/exports/previous.json --out decoder/reports/new.md
```

The previous export is optional. Keep exports in `decoder/exports/` and reports in `decoder/reports/`. Both folders are git-ignored because exports identify your account.

## How names are found

`decoder/id-map.json` holds every known ID, built from three independent sources:

| Source | What it gives | Version |
|---|---|---|
| [clash-of-clans-data](https://github.com/chiefpansancolt/clash-of-clans-data) (bundled as `js/game-data.js`) | Names, levels, costs for gameplay items | v0.19.1, 29 Oct 2026 |
| [coc.py](https://github.com/mathsman5133/coc.py) `coc/static/static_data.json` | Display names generated from the game's files, including cosmetics | 1 Dec 2025 |
| Game data tables, [Enjoyop2/Clash-of-Clans-data-assets](https://github.com/Enjoyop2/Clash-of-Clans-data-assets) | Internal names and the ID of every row | game v18.200.9, Mar 2026 |
| [NotAmti/Clash-of-Clans-Datamine](https://github.com/NotAmti/Clash-of-Clans-Datamine) | Names, rarity and file order of new rows in each update (no IDs); used through `overrides.json` | report of 16 Nov 2026 (Town Hall 19) |

How IDs work in the game tables: `buildings`, `characters`, `spells` and `traps` have a `GlobalID` column. In every other table an ID is the table's base plus the row number, counting retired rows. Retired rows are sometimes reused for new items (for example `90000016` was a placeholder and is now Electro Fangs), so IDs can't be guessed from their order. The game's text file only stores hashes, so the tables confirm IDs and internal names but never display names.

Each entry has a status: **verified** (two sources agree), **single-source**, **internal-name-only**, **conflict**, **researched** (from `overrides.json`), **retired** or **unknown**. The report marks them with symbols explained at its top.

## Updating the map

1. Download the sources into a scratch folder:

   ```bash
   curl -o static_data.json https://raw.githubusercontent.com/mathsman5133/coc.py/master/coc/static/static_data.json
   ```

   For the game tables, pick the newest version folder in Enjoyop2/Clash-of-Clans-data-assets and download its `logic/` files for buildings, traps, decos, obstacles, characters, heroes, spells, pets, character_items, building_parts, skins, village_backgrounds and villager_apprentices.

2. Rebuild:

   ```bash
   node decoder/build-id-map.mjs path/to/static_data.json path/to/logic-folder v18.200.9
   ```

3. For an ID no source has, check the newest datamine report first, research it (in-game screen, wiki, patch notes), add it to `decoder/overrides.json` with where the name came from, and rebuild. It then shows as **researched**.

Update `js/game-data.js` from the npm package to refresh levels and costs; the decoder and the dashboard share it.
