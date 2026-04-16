# BadAds v1.4

BadAds is a Chrome extension focused on blocking abusive popup and new-tab behavior, especially cross-domain opens that are typical of ad redirects, fake buttons, and script-driven popup abuse.

It is intentionally stricter than a general-purpose popup manager: untrusted cross-domain popup targets are blocked by default, even when a user click happened first. Only a small set of trusted flows such as authentication, checkout, and support widgets are allowed through.

## What It Does

- Blocks cross-domain popups and new-tab opens from an opener page.
- Hooks `window.open()` in the page context to catch script popup attempts early.
- Tracks short-lived user interaction per tab to distinguish manual vs automated behavior.
- Allows a narrow set of trusted popup flows:
  - auth providers
  - payment / checkout providers
  - support widgets
- Supports per-site whitelisting.
- Records blocked events locally for popup counters and dashboard analytics.

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

## Runtime Pipeline

### 1. Page instrumentation

`content/injected-open-hook.js`

- Runs in the page's main world.
- Wraps `window.open`.
- Posts a `SCRIPT_POPUP_ATTEMPT` message whenever page code tries to open a popup.

`content/content.js`

- Runs as a content script.
- Forwards `SCRIPT_POPUP_ATTEMPT` messages to the extension worker.
- Reports recent user interaction (`pointerdown`, `click`, `keydown`, `touchstart`).
- Reports clicked links only when the click is likely to open a new browsing context:
  - `target="_blank"`
  - middle click
  - Ctrl/Cmd click
  - Shift click

### 2. Worker event sources

`worker/background.js`

The background service worker receives popup signals from two paths:

- `chrome.webNavigation.onCreatedNavigationTarget`
  - catches new navigation targets created from an opener tab
- `SCRIPT_POPUP_ATTEMPT`
  - catches script-driven popup attempts reported by the injected hook

These two paths converge into the same policy evaluation flow.

### 3. Decision inputs

For every candidate popup/new tab, the worker resolves:

- source URL and source host
- target URL and target host
- source root domain and target root domain
- whether source or target is whitelisted
- whether there was recent user interaction on the source tab
- whether the target matches an explicitly clicked new-context link
- whether the target looks ad-related
- whether the target matches trusted auth/payment/support flows

## Blocking Logic

The current policy is intentionally strict.

### Early allow rules

A popup is allowed only if one of these narrow conditions matches:

1. Whitelist match
- If source or target host is whitelisted, the popup is allowed.

2. Trusted auth flow
- Host must match a trusted auth provider.
- Target must also look like a real auth target, not just any page on that domain.
- Examples:
  - Google OAuth / sign-in endpoints
  - Microsoft auth endpoints
  - Apple sign-in
  - GitHub login/session endpoints
- Allowed when:
  - the popup target matched an explicitly clicked new-context link, or
  - the URL contains OAuth-style parameters

3. Trusted payment flow
- Host must match a trusted payment provider.
- URL must also look checkout/payment-related.
- Allowed when:
  - there was recent user interaction, or
  - the popup target matched an explicitly clicked new-context link

4. Trusted support flow
- Host must match a trusted support/widget provider.
- Allowed only when:
  - the popup target matched an explicitly clicked new-context link
- Script-forced support popups are not implicitly trusted.

### Scoring rules

If no early allow rule matched, the popup is scored:

- `+3` cross-domain target
- `+2` no recent user interaction
- `+2` script/automated popup path
- `+3` ad-like target URL or host

Block threshold:

- block when score `>= 3`

Practical result:

- any untrusted cross-domain popup is blocked
- automated/script popups are blocked even more aggressively
- ad-signaled targets are blocked even on same-site or borderline cases

## Domain Handling

BadAds compares root domains rather than raw hostnames.

Examples:

- `shop.example.com` and `login.example.com` are treated as same-root
- `example.com` to `accounts.google.com` is cross-domain

The worker includes a small multi-part TLD list for common cases such as:

- `co.uk`
- `com.au`
- `co.in`
- `co.jp`

This improves matching for common country-code domains, but it is not a full public suffix implementation.

## State and Storage

BadAds stores all state in `chrome.storage.local`.

Keys currently used:

- `enabled`
  - boolean protection toggle
- `blockedCount`
  - total blocked popup/tab count
- `whitelist`
  - list of allowed hostnames
- `logs`
  - recent blocked events

Log shape:

```json
{
  "domain": "example.com",
  "reason": "automated-cross-domain",
  "url": "https://example.com/path",
  "time": 1713270000000
}
```

The worker keeps the most recent 100 log entries.

## Toolbar and Popup

`ui/options/*`

- pause / resume protection
- blocked popup counter
- whitelist count
- add current site to whitelist
- manual whitelist add/remove
- open dashboard

Toolbar behavior:

- icon switches between active and paused states
- badge shows total blocked count

## Dashboard Pipeline

`ui/dashboard/*`

The dashboard does not depend on separate analytics storage tables. It derives everything from:

- `blockedCount`
- `logs`

It computes:

- total blocks
- most blocked domain
- blocked today
- 14-day trend
- recent block events

The chart is built by bucketing numeric log timestamps into daily counts.

## Known Limitations

- Root-domain parsing uses a small built-in multi-part TLD list, not a full public suffix list.
- The trusted provider lists are hand-maintained and intentionally narrow.
- Same-tab redirects are not the primary target; the extension is focused on popup/new-tab abuse.
- Some legitimate popup workflows on unknown third-party domains may still need whitelisting.

## Development Install

1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the `BadAds-adblocker` folder

## Permissions

- `tabs`
  - inspect opener relationships and close blocked tabs
- `storage`
  - persist settings, counters, whitelist, and logs
- `webNavigation`
  - detect creation of new navigation targets

## License

MIT
