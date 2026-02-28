const DEFAULT_STATE = {
    enabled: true,
    blockedCount: 0,
    whitelist: [],
    logs: []
};

const AD_KEYWORDS = [
    "adservice",
    "adsystem",
    "doubleclick",
    "googlesyndication",
    "popads",
    "clickadu",
    "propellerads",
    "taboola",
    "outbrain",
    "adnxs",
    "adroll",
    "push-notification",
    "redirect",
    "banner",
    "sponsor",
    "tracking"
];

const AD_REGEX = new RegExp(AD_KEYWORDS.join("|"), "i");
const USER_GESTURE_ALLOW_MS = 4500;
const SCRIPT_POPUP_RETRY_COUNT = 6;
const SCRIPT_POPUP_RETRY_DELAY_MS = 200;
const TAB_BLOCK_CACHE_MS = 15000;
const lastUserInteractionByTab = new Map();
const blockedTabTimestamps = new Map();
const TRUSTED_SITE_ALLOWLIST = [
    "linkedin.com",
    "instagram.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "youtube.com",
    "google.com",
    "github.com",
    "reddit.com",
    "wikipedia.org",
    "microsoft.com",
    "apple.com",
    "amazon.com"
];

function getHost(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return null;
    }
}

function getRootHost(hostname) {
    if (!hostname) return null;
    const parts = hostname.split(".");
    if (parts.length < 3) return hostname;
    return parts.slice(-2).join(".");
}

function isWhitelisted(host, whitelist) {
    if (!host || !Array.isArray(whitelist)) return false;
    return whitelist.some((entry) => {
        const site = String(entry).toLowerCase().trim();
        return host === site || host.endsWith(`.${site}`);
    });
}

function isTrustedSite(host) {
    if (!host) return false;
    return TRUSTED_SITE_ALLOWLIST.some((site) => host === site || host.endsWith(`.${site}`));
}

function isLikelyAdUrl(url) {
    if (!url) return false;
    return AD_REGEX.test(url);
}

function toAbsoluteUrl(targetUrl, sourceUrl) {
    if (!targetUrl) return null;
    try {
        return new URL(targetUrl, sourceUrl || undefined).href;
    } catch {
        return null;
    }
}

function markTabAsBlocked(tabId) {
    if (typeof tabId !== "number" || tabId < 0) return false;

    const now = Date.now();
    blockedTabTimestamps.forEach((timestamp, cachedTabId) => {
        if (now - timestamp > TAB_BLOCK_CACHE_MS) {
            blockedTabTimestamps.delete(cachedTabId);
        }
    });

    if (blockedTabTimestamps.has(tabId)) return false;
    blockedTabTimestamps.set(tabId, now);
    return true;
}

function closeAndRecordBlockedTab(tabId, domain, reason) {
    if (!markTabAsBlocked(tabId)) return;
    chrome.tabs.remove(tabId);
    recordBlocked(domain, reason);
}

function shouldBlockTarget({ targetUrl, sourceUrl, whitelist, recentUserInteraction }) {
    const targetHost = getHost(targetUrl);
    if (!targetHost) return { block: false };

    const sourceHost = getHost(sourceUrl);

    if (isTrustedSite(targetHost) || isTrustedSite(sourceHost)) {
        return { block: false };
    }

    if (isWhitelisted(targetHost, whitelist) || isWhitelisted(sourceHost, whitelist)) {
        return { block: false };
    }

    const targetRoot = getRootHost(targetHost);
    const sourceRoot = getRootHost(sourceHost);
    const crossDomain = Boolean(sourceRoot && targetRoot && sourceRoot !== targetRoot);
    const adSignal = isLikelyAdUrl(targetUrl) || isLikelyAdUrl(targetHost);

    const userLikelyInitiated = Boolean(recentUserInteraction);
    const blockCrossDomain = crossDomain && !userLikelyInitiated;
    const block = adSignal || blockCrossDomain;
    return {
        block,
        targetHost,
        sourceHost,
        reason: adSignal ? "ad-signal" : blockCrossDomain ? "cross-domain-popup" : "none"
    };
}

function getIconPath(enabled) {
    return enabled
        ? {
              16: "../icons/logoOn16.png",
              32: "../icons/logoOn32.png",
              48: "../icons/logoOn48.png",
              128: "../icons/logoOn128.png"
          }
        : {
              16: "../icons/logoOff16.png",
              32: "../icons/logoOff32.png",
              48: "../icons/logoOff48.png",
              128: "../icons/logoOff128.png"
          };
}

function refreshToolbar(enabled, blockedCount) {
    chrome.action.setIcon({ path: getIconPath(enabled) });

    const badgeText = blockedCount > 0 ? String(blockedCount) : "";
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: "#ffffff" });
    chrome.action.setBadgeTextColor({ color: "#000000" });
    chrome.action.setTitle({
        title: `BadAds: ${enabled ? "Protected" : "Paused"} | Popups Closed: ${blockedCount || 0}`
    });
}

function ensureState(callback) {
    chrome.storage.local.get(
        ["enabled", "blockedCount", "whitelist", "logs"],
        (current) => {
            const merged = {
                enabled: current.enabled ?? DEFAULT_STATE.enabled,
                blockedCount: current.blockedCount ?? DEFAULT_STATE.blockedCount,
                whitelist: Array.isArray(current.whitelist) ? current.whitelist : DEFAULT_STATE.whitelist,
                logs: Array.isArray(current.logs) ? current.logs : DEFAULT_STATE.logs
            };

            chrome.storage.local.set(merged, () => callback(merged));
        }
    );
}

function recordBlocked(domain, reason) {
    chrome.storage.local.get(["blockedCount", "logs", "enabled"], (data) => {
        const newCount = (data.blockedCount || 0) + 1;
        const newLogs = [
            {
                domain,
                reason,
                time: new Date().toLocaleString()
            },
            ...(data.logs || [])
        ].slice(0, 100);

        chrome.storage.local.set(
            {
                blockedCount: newCount,
                logs: newLogs
            },
            () => refreshToolbar(data.enabled ?? true, newCount)
        );
    });
}

function evaluateAndBlock(details, urlFromEvent) {
    chrome.storage.local.get(["enabled", "whitelist"], (state) => {
        if (!state.enabled) return;

        const targetUrl = urlFromEvent;
        if (!targetUrl) return;

        if (details.sourceTabId < 0) {
            const result = shouldBlockTarget({
                targetUrl,
                sourceUrl: null,
                whitelist: state.whitelist || [],
                recentUserInteraction: false
            });
            if (result.block) {
                closeAndRecordBlockedTab(details.tabId, result.targetHost || "unknown", result.reason);
            }
            return;
        }

        chrome.tabs.get(details.sourceTabId, (sourceTab) => {
            if (chrome.runtime.lastError) return;
            const lastInteraction = lastUserInteractionByTab.get(details.sourceTabId) || 0;
            const recentUserInteraction = Date.now() - lastInteraction <= USER_GESTURE_ALLOW_MS;

            const result = shouldBlockTarget({
                targetUrl,
                sourceUrl: sourceTab?.url || sourceTab?.pendingUrl || null,
                whitelist: state.whitelist || [],
                recentUserInteraction
            });

            if (result.block) {
                closeAndRecordBlockedTab(details.tabId, result.targetHost || "unknown", result.reason);
            }
        });
    });
}

function tryBlockScriptPopupTabs({
    sourceTabId,
    sourceUrl,
    targetUrl,
    whitelist,
    recentUserInteraction,
    attempt
}) {
    chrome.tabs.query({ openerTabId: sourceTabId }, (tabs) => {
        if (chrome.runtime.lastError) return;

        let blockedAny = false;
        for (const popupTab of tabs || []) {
            if (typeof popupTab?.id !== "number" || popupTab.id < 0) continue;

            const candidateUrl = popupTab.pendingUrl || popupTab.url || targetUrl;
            if (!candidateUrl) continue;

            const result = shouldBlockTarget({
                targetUrl: candidateUrl,
                sourceUrl,
                whitelist,
                recentUserInteraction
            });

            if (!result.block) continue;
            blockedAny = true;
            closeAndRecordBlockedTab(
                popupTab.id,
                result.targetHost || getHost(candidateUrl) || "unknown",
                `script-${result.reason}`
            );
        }

        if (blockedAny || attempt >= SCRIPT_POPUP_RETRY_COUNT) return;

        setTimeout(() => {
            tryBlockScriptPopupTabs({
                sourceTabId,
                sourceUrl,
                targetUrl,
                whitelist,
                recentUserInteraction,
                attempt: attempt + 1
            });
        }, SCRIPT_POPUP_RETRY_DELAY_MS);
    });
}

function handleScriptPopupAttempt(message, sender) {
    const sourceTabId = sender?.tab?.id;
    if (typeof sourceTabId !== "number" || sourceTabId < 0) return;

    chrome.storage.local.get(["enabled", "whitelist"], (state) => {
        if (!state.enabled) return;

        const sourceUrl = message.sourceUrl || sender.tab?.url || sender.tab?.pendingUrl || null;
        const targetUrl = toAbsoluteUrl(message.targetUrl, sourceUrl) || message.targetUrl || null;
        const lastInteraction = lastUserInteractionByTab.get(sourceTabId) || 0;
        const recentUserInteraction = Date.now() - lastInteraction <= USER_GESTURE_ALLOW_MS;

        tryBlockScriptPopupTabs({
            sourceTabId,
            sourceUrl,
            targetUrl,
            whitelist: state.whitelist || [],
            recentUserInteraction,
            attempt: 0
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "USER_INTERACTION") {
        if (!sender?.tab?.id) return;
        lastUserInteractionByTab.set(sender.tab.id, Number(message.time) || Date.now());
        return;
    }

    if (message?.type === "SCRIPT_POPUP_ATTEMPT") {
        handleScriptPopupAttempt(message, sender);
    }
});

chrome.runtime.onInstalled.addListener(() => {
    ensureState((state) => refreshToolbar(state.enabled, state.blockedCount));
});

chrome.runtime.onStartup.addListener(() => {
    ensureState((state) => refreshToolbar(state.enabled, state.blockedCount));
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes.enabled && !changes.blockedCount) return;

    chrome.storage.local.get(["enabled", "blockedCount"], (data) => {
        refreshToolbar(data.enabled ?? true, data.blockedCount || 0);
    });
});

chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    evaluateAndBlock(details, details.url || null);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    lastUserInteractionByTab.delete(tabId);
    blockedTabTimestamps.delete(tabId);
});

ensureState((state) => refreshToolbar(state.enabled, state.blockedCount));
