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
const TRUSTED_AUTH_HOSTS = [
    "accounts.google.com",
    "login.microsoftonline.com",
    "login.live.com",
    "appleid.apple.com",
    "github.com",
    "auth0.com",
    "okta.com"
];
const TRUSTED_PAYMENT_HOSTS = [
    "checkout.stripe.com",
    "js.stripe.com",
    "paypal.com",
    "www.paypal.com",
    "pay.google.com",
    "secure.authorize.net",
    "checkout.razorpay.com",
    "checkout.shopifycs.com"
];
const TRUSTED_SUPPORT_HOSTS = [
    "widget.intercom.io",
    "intercom.com",
    "static.zdassets.com",
    "zendesk.com",
    "client.crisp.chat",
    "crisp.chat"
];
const OAUTH_HINTS = [
    "client_id",
    "redirect_uri",
    "response_type",
    "scope",
    "state",
    "code_challenge",
    "code_verifier",
    "prompt",
    "access_type"
];
const PAYMENT_HINTS = [
    "checkout",
    "payment",
    "billing",
    "pay",
    "invoice",
    "session_id"
];
const MULTI_PART_TLDS = new Set([
    "co.uk",
    "org.uk",
    "gov.uk",
    "ac.uk",
    "co.in",
    "com.au",
    "net.au",
    "co.nz",
    "com.br",
    "com.mx",
    "co.jp"
]);
const USER_GESTURE_ALLOW_MS = 4500;
const CLICK_TARGET_ALLOW_MS = 5000;
const SCRIPT_POPUP_RETRY_COUNT = 6;
const SCRIPT_POPUP_RETRY_DELAY_MS = 200;
const TAB_BLOCK_CACHE_MS = 15000;
const lastUserInteractionByTab = new Map();
const clickedTargetByTab = new Map();
const blockedTabTimestamps = new Map();

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
    const lastTwo = parts.slice(-2).join(".");
    if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
        return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
}

function isWhitelisted(host, whitelist) {
    if (!host || !Array.isArray(whitelist)) return false;
    return whitelist.some((entry) => {
        const site = String(entry).toLowerCase().trim();
        return host === site || host.endsWith(`.${site}`);
    });
}

function isLikelyAdUrl(url) {
    if (!url) return false;
    return AD_REGEX.test(url);
}

function isTrustedAuthHost(host) {
    if (!host) return false;
    return TRUSTED_AUTH_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function isTrustedPaymentHost(host) {
    if (!host) return false;
    return TRUSTED_PAYMENT_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function isTrustedSupportHost(host) {
    if (!host) return false;
    return TRUSTED_SUPPORT_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function isTrustedAuthTarget(url, host) {
    if (!host || !isTrustedAuthHost(host)) return false;

    if (host === "github.com") {
        try {
            const parsed = new URL(url);
            return parsed.pathname.startsWith("/login") || parsed.pathname.startsWith("/sessions");
        } catch {
            return false;
        }
    }

    if (host === "accounts.google.com") {
        try {
            const parsed = new URL(url);
            return (
                parsed.pathname.startsWith("/o/oauth2/") ||
                parsed.pathname.startsWith("/signin/") ||
                parsed.pathname.startsWith("/ServiceLogin")
            );
        } catch {
            return false;
        }
    }

    if (host === "login.microsoftonline.com" || host === "login.live.com" || host === "appleid.apple.com") {
        try {
            const parsed = new URL(url);
            return oauthLikePath(parsed.pathname) || isLikelyOAuthUrl(url);
        } catch {
            return false;
        }
    }

    return true;
}

function isLikelyOAuthUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return OAUTH_HINTS.some((hint) => parsed.searchParams.has(hint));
    } catch {
        return OAUTH_HINTS.some((hint) => String(url).includes(`${hint}=`));
    }
}

function isLikelyPaymentUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const haystack = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
        return PAYMENT_HINTS.some((hint) => haystack.includes(hint));
    } catch {
        const lower = String(url).toLowerCase();
        return PAYMENT_HINTS.some((hint) => lower.includes(hint));
    }
}

function oauthLikePath(pathname) {
    const lower = String(pathname || "").toLowerCase();
    return (
        lower.includes("oauth") ||
        lower.includes("authorize") ||
        lower.includes("auth") ||
        lower.includes("login") ||
        lower.includes("signin")
    );
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

function closeAndRecordBlockedTab(tabId, domain, reason, url) {
    if (!markTabAsBlocked(tabId)) return;
    chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) return;
        recordBlocked(domain, reason, url);
    });
}

function setClickedTarget(tabId, targetUrl) {
    if (typeof tabId !== "number" || tabId < 0) return;
    const targetHost = getHost(targetUrl);
    const targetRoot = getRootHost(targetHost);
    if (!targetRoot) return;

    clickedTargetByTab.set(tabId, {
        root: targetRoot,
        expiresAt: Date.now() + CLICK_TARGET_ALLOW_MS
    });
}

function consumeClickedTargetMatch(tabId, targetHost) {
    if (typeof tabId !== "number" || tabId < 0 || !targetHost) return false;
    const entry = clickedTargetByTab.get(tabId);
    if (!entry) return false;

    if (entry.expiresAt < Date.now()) {
        clickedTargetByTab.delete(tabId);
        return false;
    }

    if (entry.root !== getRootHost(targetHost)) {
        return false;
    }

    clickedTargetByTab.delete(tabId);
    return true;
}

function shouldBlockTarget({
    sourceTabId,
    targetUrl,
    sourceUrl,
    whitelist,
    recentUserInteraction,
    forceAutomated
}) {
    const targetHost = getHost(targetUrl);
    if (!targetHost) return { block: false };

    const sourceHost = getHost(sourceUrl);

    if (isWhitelisted(targetHost, whitelist) || isWhitelisted(sourceHost, whitelist)) {
        return { block: false };
    }

    const targetRoot = getRootHost(targetHost);
    const sourceRoot = getRootHost(sourceHost);
    const crossDomain = Boolean(sourceRoot && targetRoot && sourceRoot !== targetRoot);
    const adSignal = isLikelyAdUrl(targetUrl) || isLikelyAdUrl(targetHost);
    const trustedAuth = isTrustedAuthTarget(targetUrl, targetHost);
    const oauthSignal = isLikelyOAuthUrl(targetUrl);
    const trustedPayment = isTrustedPaymentHost(targetHost) && isLikelyPaymentUrl(targetUrl);
    const trustedSupport = isTrustedSupportHost(targetHost);
    const actionType = forceAutomated || !recentUserInteraction ? "automated" : "manual";
    const matchedClickedTarget = consumeClickedTargetMatch(sourceTabId, targetHost);

    if (trustedAuth && (matchedClickedTarget || oauthSignal)) {
        return {
            block: false,
            targetHost,
            sourceHost,
            reason: "trusted-auth-allowed",
            actionType
        };
    }

    if (trustedPayment && (recentUserInteraction || matchedClickedTarget)) {
        return {
            block: false,
            targetHost,
            sourceHost,
            reason: "trusted-payment-allowed",
            actionType
        };
    }

    if (trustedSupport && matchedClickedTarget && !forceAutomated) {
        return {
            block: false,
            targetHost,
            sourceHost,
            reason: "trusted-support-allowed",
            actionType
        };
    }

    let score = 0;
    if (crossDomain) score += 3;
    if (!recentUserInteraction) score += 2;
    if (forceAutomated) score += 2;
    if (adSignal) score += 3;

    const block = score >= 3;
    const reason = block
        ? adSignal
            ? `${actionType}-ad-signal`
            : `${actionType}-cross-domain`
        : "allowed";

    return {
        block,
        targetHost,
        sourceHost,
        reason,
        actionType,
        score
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

function recordBlocked(domain, reason, url) {
    chrome.storage.local.get(["blockedCount", "logs", "enabled"], (data) => {
        const newCount = (data.blockedCount || 0) + 1;
        const newLogs = [
            {
                domain,
                reason,
                url: url || "",
                time: Date.now()
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
            // No opener tab: treat as a direct/manual browser navigation.
            return;
        }

        chrome.tabs.get(details.sourceTabId, (sourceTab) => {
            if (chrome.runtime.lastError) return;
            const lastInteraction = lastUserInteractionByTab.get(details.sourceTabId) || 0;
            const recentUserInteraction = Date.now() - lastInteraction <= USER_GESTURE_ALLOW_MS;

            const result = shouldBlockTarget({
                sourceTabId: details.sourceTabId,
                targetUrl,
                sourceUrl: sourceTab?.url || sourceTab?.pendingUrl || null,
                whitelist: state.whitelist || [],
                recentUserInteraction,
                forceAutomated: false
            });

            if (result.block) {
                closeAndRecordBlockedTab(details.tabId, result.targetHost || "unknown", result.reason, targetUrl);
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
                sourceTabId,
                targetUrl: candidateUrl,
                sourceUrl,
                whitelist,
                recentUserInteraction,
                forceAutomated: true
            });

            if (!result.block) continue;
            blockedAny = true;
            closeAndRecordBlockedTab(
                popupTab.id,
                result.targetHost || getHost(candidateUrl) || "unknown",
                `script-${result.reason}`,
                candidateUrl
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
        if (typeof sender?.tab?.id !== "number") return;
        lastUserInteractionByTab.set(sender.tab.id, Number(message.time) || Date.now());
        return;
    }

    if (message?.type === "LINK_CLICK") {
        if (typeof sender?.tab?.id !== "number") return;
        setClickedTarget(sender.tab.id, message.targetUrl);
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
    clickedTargetByTab.delete(tabId);
    blockedTabTimestamps.delete(tabId);
});

ensureState((state) => refreshToolbar(state.enabled, state.blockedCount));
