# BadAds v1.3

BadAds is a Chrome extension that blocks intrusive ad and popup tabs with a simple, modern control panel.

## Features

- Smart popup blocking using:
  - ad-related URL/domain signal matching
  - cross-domain popup detection
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
- Persistent local storage for settings, counters, whitelist, and logs

## How It Works

When a new navigation target tab is created, BadAds evaluates the source and destination domains and checks for ad-like patterns. Tabs that match blocking rules are closed unless a whitelist rule applies.

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
