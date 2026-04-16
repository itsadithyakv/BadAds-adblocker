# Privacy Policy for BadAds

Last updated: April 16, 2026

## Overview

BadAds is a Chrome extension that blocks abusive popups, unwanted new tabs, and deceptive cross-domain redirects.

This privacy policy explains what data BadAds handles, how that data is used, and what is not collected.

## What BadAds Does

BadAds monitors popup and new-tab behavior in order to detect and block suspicious cross-domain openings. It also provides a local dashboard, a blocked counter, and a whitelist that lets users allow trusted sites.

## Data BadAds Processes

BadAds processes limited browsing-related data only for its core blocking function.

This may include:

- the URL or hostname of a page that attempted to open a popup or new tab
- the URL or hostname of the popup or new tab target
- whether a recent user interaction occurred on the source tab
- a local list of user-whitelisted sites
- a local counter of blocked popups
- a local log of recent blocked events

## How Data Is Used

BadAds uses this information only to:

- determine whether a popup or new tab should be blocked
- avoid blocking trusted flows such as sign-in, payment, or support popups
- let users whitelist sites they trust
- show local statistics and recent blocked events in the extension dashboard

## Data Storage

BadAds stores its settings and logs locally in your browser using `chrome.storage.local`.

This local data may include:

- protection on/off state
- blocked popup count
- whitelist entries
- recent blocked event logs

Blocked event logs may contain:

- domain
- reason for blocking
- target URL
- timestamp

This data stays on your device unless you choose to export or share it yourself.

## What BadAds Does Not Do

BadAds does not:

- sell user data
- send browsing data to remote servers controlled by the developer
- collect personal information for advertising or profiling
- use remote code to change extension behavior at runtime
- sync extension data to external databases or analytics services

## Third-Party Services

BadAds does not use third-party analytics, advertising SDKs, or remote tracking services inside the extension.

## Permissions

BadAds uses the following Chrome permissions only for its stated purpose:

- `tabs`
  Used to identify popup opener relationships, inspect the active tab for whitelist actions, and close blocked tabs.

- `storage`
  Used to store local settings, counters, whitelist entries, and recent block logs.

- `webNavigation`
  Used to detect new navigation targets created by pages so the extension can evaluate popup and new-tab behavior.

Host access is used only so the extension can detect popup and redirect behavior consistently across websites.

## User Control

You control the data BadAds stores locally.

You can:

- pause or resume protection
- add or remove sites from the whitelist
- reset the blocked counter
- remove the extension at any time, which also removes its local storage from Chrome

## Children’s Privacy

BadAds is not directed to children and does not knowingly collect personal information from children.

## Changes to This Policy

This privacy policy may be updated if the extension’s behavior changes. Any updates will be reflected by revising the date at the top of this page.

## Contact

If you publish BadAds and want users to contact you about privacy questions, add your preferred contact email or support page here before linking this policy publicly.
