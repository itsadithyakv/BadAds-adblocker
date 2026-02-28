# BadAds-adblocker
Automatically blocks annoying cross-domain ad tabs. Includes live stats, toggle control.
It prevents annoying redirect ads while giving you full control and live statistics.

---

## Features
- Smart cross-domain tab blocking
- Automatic detection of redirect ads
- Black & orange themed popup UI
- Live blocked tab counter
- Badge counter on extension icon
- On/Off toggle
- Reset stats option
- Persistent storage (stats saved across sessions)

---

## How It Works

When a website opens a new tab:

1. The extension checks which tab opened it.
2. It compares the domain of the original tab and the new tab.
3. If the domains are different, the new tab is automatically closed.

This eliminates most redirect-based pop-up ads without needing a domain blacklist.

---

## Installation (Development Mode)

1. Clone or download this repository.
2. Open Google Chrome.
3. Go to: chrome://extensions/
4. Enable Developer Mode (top right).
5. Click "Load unpacked".
6. Select the project folder.

The extension will now be active.

---

## Project Structure

BadAds-adblocker/
│
├── manifest.json
├── background.js
├── popup.html
├── popup.css
└── popup.js

---

## Permissions Used

- tabs → Detect and close suspicious tabs
- storage → Save stats and toggle state
- host_permissions (<all_urls>) → Inspect tab URLs

---

## Future Improvements

- Whitelist system
- Domain logging panel
- Exportable stats
- Graph visualization
- Advanced heuristics detection

---

## License

MIT License