# BadAds

BadAds is a Chrome extension that detects and blocks intrusive popup ads, including script-triggered popups, with a lightweight control panel and analytics dashboard.

## Highlights

- Smart popup blocking based on:
  - ad-related URL/domain signal matching
  - cross-domain popup detection
  - script-based `window.open` detection
- User-friendly controls:
  - pause/resume protection
  - domain whitelist (add, remove, allow current site)
  - reset blocked counter
- Live extension status:
  - toolbar icon reflects protection state
  - badge shows blocked popup count
- Analytics dashboard:
  - total blocked popups
  - most blocked domain
  - most common block reason
  - 14-day blocked trend chart
  - top blocked domains table
  - data export (`JSON`, `CSV`)

## How It Works

BadAds uses a background service worker to evaluate popup events and close suspicious targets before they can interrupt browsing.

Detection sources:
- Browser-level popup target creation (`webNavigation.onCreatedNavigationTarget`)
- Script-driven popup attempts (`window.open`) via injected/page bridge scripts

Blocking is skipped when:
- protection is paused
- source or target is trusted
- source or target matches a user whitelist rule
- user interaction indicates a likely intentional popup

## Project Structure

```text
BadAds-adblocker/
  manifest.json
  background.js
  content.js
  injected-open-hook.js
  dashboard.html
  dashboard.css
  dashboard.js
  options.html
  options.css
  options.js
  icons/
```

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `BadAds-adblocker` directory.

## Usage

1. Click the BadAds extension icon to open the control panel.
2. Use **Pause/Resume** to toggle protection.
3. Manage whitelist entries from the popup.
4. Open **Dashboard** for analytics and exports.

## Permissions

- `tabs`: inspect and close popup tabs, open dashboard page
- `webNavigation`: detect newly created popup navigation targets
- `storage`: persist settings, counters, whitelist, and logs

## Data Storage

BadAds stores data locally using `chrome.storage.local`:
- `enabled`
- `blockedCount`
- `whitelist`
- `logs` (domain, reason, display time, timestamp)

No external backend is required.

## License

MIT
