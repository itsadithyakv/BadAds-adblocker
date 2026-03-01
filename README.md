# BadAds v1.3

BadAds is a Chrome extension that blocks intrusive popup/new-tab behavior while allowing normal manual browsing.

## Features

- Blocks new tabs opened to unrelated domains from a parent page.
- Differentiates automated popup behavior from manual user actions.
- Whitelist support:
  - add/remove allowed domains
  - allow current site in one click
- Pause/Resume protection toggle.
- Toolbar icon + badge status with blocked count.
- Dashboard with:
  - total blocked count
  - top blocked domain
  - top blocking reason
  - 14-day trend chart
  - JSON/CSV export
- Persistent local storage for settings and analytics logs.

## How Everything Works

### 1) Scripts and responsibilities

- `worker/background.js`: central policy engine (decision + blocking + logging + toolbar state).
- `content/injected-open-hook.js`: wraps `window.open` in page context and reports script popup attempts.
- `content/content.js`: forwards page events to the background worker and tracks user interaction pings.
- `ui/options/*`: popup UI for pause/resume, whitelist management, counters, and dashboard open action.
- `ui/dashboard/*`: analytics page that reads storage logs and renders KPIs, trend chart, top domains, and exports.

### 2) Detection pipeline

1. User/script triggers a new tab or popup.
2. BadAds receives signals from:
   - `chrome.webNavigation.onCreatedNavigationTarget` (new tab targets)
   - `SCRIPT_POPUP_ATTEMPT` messages from the injected `window.open` hook
3. Background logic resolves:
   - source host (parent tab)
   - target host (new tab URL)
   - recent user interaction window (manual-likelihood signal)

### 3) Blocking policy

- If extension is paused (`enabled: false`): no blocking.
- If source or target matches whitelist: allow.
- If target root domain differs from source root domain (cross-domain child tab): block and close tab.
- Same-site ad-signal URLs are blocked when classified as automated/script-driven.
- Direct manual navigation without opener tab is allowed (for example: user opens a blank/new tab and types a URL).

### 4) Manual vs automated differentiation

- `content.js` reports user interactions (`pointerdown`, `click`, `keydown`, `touchstart`) to background.
- Background keeps a short-lived interaction timestamp per tab.
- Script popup attempts are force-labeled as automated.
- Block logs record reason labels that include action context (for example `manual-cross-domain`, `automated-cross-domain`, `automated-ad-signal`).

### 5) Storage model

`chrome.storage.local` keys used by BadAds:

- `enabled` (`boolean`): protection on/off
- `blockedCount` (`number`): total blocked tabs
- `whitelist` (`string[]`): allowed domains
- `logs` (`Array<{domain, reason, time}>`): latest blocking records (up to 100)

### 6) Dashboard data flow

- Dashboard reads `blockedCount` + `logs` from storage.
- Aggregates logs by domain/reason for KPIs and table.
- Builds a 14-day daily bucket series for chart rendering.
- Export buttons serialize logs into JSON or CSV files.

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `BadAds-adblocker` folder.

## Project Structure

```text
BadAds-adblocker/
  manifest.json
  worker/
    background.js
  content/
    content.js
    injected-open-hook.js
  ui/
    options/
      options.html
      options.css
      options.js
    dashboard/
      dashboard.html
      dashboard.css
      dashboard.js
  icons/
```

## Permissions

- `tabs`: inspect tab metadata and close blocked tabs
- `webNavigation`: detect creation of new navigation targets
- `storage`: persist settings, counters, whitelist, and logs

## License

MIT
