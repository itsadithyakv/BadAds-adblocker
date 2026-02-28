# BadAds v1.3

BadAds is a Chrome extension that blocks intrusive ad and popup tabs with a simple, modern control panel.

## Features

- Smart popup blocking using:
  - ad-related URL/domain signal matching
  - cross-domain popup detection
  - script-based `window.open` detection with opener-tab follow-up checks
- Whitelist support:
  - manually add allowed domains
  - quick add current site
  - remove whitelisted entries
- Toolbar status behavior:
  - icon changes by protection state (`logoOn` active, `logoOff` paused)
  - badge shows only the number of blocked popups (no ON/OFF text)
- Modern black-and-white popup UI with:
  - centered `logoBar` header
  - protection status text
  - pause/resume toggle
  - live counters for blocked popups and whitelist size
- Dashboard analytics page with:
  - 14-day blocked ads trend graph
  - most blocked domain and top block reason
  - top blocked domains table
  - export as JSON or CSV
- Persistent local storage for settings, counters, whitelist, and logs

## How It Works

BadAds listens for both browser-level popup tab creation and page script popup attempts (`window.open`). It evaluates source and destination domains, checks ad-like patterns, and closes tabs that match blocking rules unless a whitelist rule applies.

The popup includes a Dashboard section that opens a full analytics page built from stored block logs.

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `BadAds-adblocker` folder.

## Project Structure

```text
BadAds-adblocker/
  manifest.json
  background.js
  content.js
  dashboard.html
  dashboard.css
  dashboard.js
  injected-open-hook.js
  options.html
  options.css
  options.js
  icons/
```

## Permissions

- `tabs`: inspect and close unwanted tabs
- `webNavigation`: detect newly created navigation targets
- `storage`: persist extension state and stats

## Icon Assets

Use PNG files for extension icons:

- `icons/logoOn.png` (colored/active)
- `icons/logoOff.png` (grayscale/paused)
- `icons/logoBar.png` (popup header banner)

## License

MIT
