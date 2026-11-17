# Clash of Clans Dashboard and Planner

A browser dashboard for tracking Clash of Clans village progress. Paste the game's **Data Export** JSON and the dashboard turns it into dated snapshots you can compare over time.

## Features

- **Overview** with a Home Village / Builder Base switch: overall progress, builder and lab time left, resources to max, progress by category, and a live *Finishing next* list of every running upgrade and cooldown.
- **Village tables** for Home Village, Heroes & Gear, Lab and Builder Base, with click-to-sort columns and expandable rows for items you own several of (e.g. X-Bow ×3 shows each building).
- **Events & Effects**: discount events you can switch on per account and month, plus Gold Pass tracking.
- **Planner** with a calibration step so estimates match in-game numbers.
- **Two styles**: *Clean analytics* and *Town Hall theme*, which recolours the page for your Town Hall level (TH10 gets a full lava look).

## Getting started

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To import a village: in Clash of Clans open **Settings → More Settings → Data Export → Copy**, then paste the JSON into the dashboard's import dialog.

### Hosting on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`.
3. Your dashboard will be live at `https://<your-username>.github.io/<repo-name>/`.

## Project structure

```
index.html              Page markup
css/styles.css          All styles and themes
js/game-data.js         Item, level, cost and time data
js/app.js               App logic
assets/townhalls/       Town Hall pictures, th1.webp to th18.webp
scripts/build-single.mjs Builds the single-file version
worker.js               Cloudflare Worker: serves the site and /api/player for API sync
wrangler.jsonc          Cloudflare Worker config
dist/                   Single-file build output (git-ignored)
```

`dist/clash-of-clans-dashboard-and-planner.html` is the same app as one self-contained file, handy for sharing or opening offline. Regenerate it after changing the sources (needs Node.js, no packages):

```bash
node scripts/build-single.mjs
```

## Data and storage

Snapshots, accounts, events and settings are saved in the browser's `localStorage`, so they stay on the device and browser you use. Clearing site data removes them.

## Updating game data

Game balance changes over time. Item levels, costs and times live in `js/game-data.js`. If numbers drift from the game, update that file or use the Planner's calibration.

## Sync from the Clash of Clans API (optional)

When your export contains equipment newer than `js/game-data.js`, the Heroes & Gear tab lists it with a **Fetch names from Clash of Clans API** button (other unknown items still show a banner on the Overview). It asks the official API for your player profile, matches the new equipment names to the unknown IDs, and saves them in your browser with the standard upgrade costs for their rarity. Only equipment is matched for now.

This only works on the Cloudflare deployment, because the API key has to stay on a server. The Worker in `worker.js` calls the API through the RoyaleAPI proxy (`cocproxy.royaleapi.dev`), which has a fixed IP address you can register on your key.

One-time setup:

1. Sign in at [developer.clashofclans.com](https://developer.clashofclans.com) with your Supercell ID and create a key with the allowed IP address `45.79.218.79`.
2. In the Cloudflare dashboard open the Worker, go to **Settings → Variables and Secrets**, and add a secret named `COC_API_TOKEN` with the key as its value. Or run:

   ```bash
   npx wrangler secret put COC_API_TOKEN
   ```

3. To test locally, put `COC_API_TOKEN=your-key` in a `.dev.vars` file (git-ignored) and run `npx wrangler dev`.

Anyone who can open your site can call `/api/player` and use your key's rate limit. Names learned this way stay in the browser where you synced; remove `coc-ledger-learned` from the site's storage to forget them.

## Disclaimer

This is an unofficial fan project. This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: <https://www.supercell.com/fan-content-policy>.

Clash of Clans and its artwork, including the Town Hall images in `assets/townhalls/`, belong to Supercell. Review that policy before publishing them in a public repository.

## License

No license is included yet. Add one (for example MIT) if you want others to reuse the code. The license would cover the code only, not Supercell's artwork.
