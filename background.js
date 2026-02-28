function getHostname(url) {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return null;
    }
}

// Initialize default state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        enabled: true,
        blockedCount: 0
    });
});

// Update badge
function updateBadge(count) {
    chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff6600" });
}

chrome.tabs.onCreated.addListener((newTab) => {
    chrome.storage.local.get(["enabled", "blockedCount"], (data) => {
        if (!data.enabled) return;
        if (!newTab.openerTabId) return;

        setTimeout(() => {
            chrome.tabs.get(newTab.id, (createdTab) => {
                if (!createdTab || !createdTab.url) return;

                chrome.tabs.get(newTab.openerTabId, (openerTab) => {
                    if (!openerTab || !openerTab.url) return;

                    const newHost = getHostname(createdTab.url);
                    const openerHost = getHostname(openerTab.url);

                    if (!newHost || !openerHost) return;

                    if (newHost !== openerHost) {
                        chrome.tabs.remove(createdTab.id);

                        let newCount = (data.blockedCount || 0) + 1;
                        chrome.storage.local.set({ blockedCount: newCount });
                        updateBadge(newCount);
                    }
                });
            });
        }, 800);
    });
});