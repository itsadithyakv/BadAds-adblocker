const toggleBtn = document.getElementById("toggleBtn");
const statusText = document.getElementById("statusText");
const blockedCountEl = document.getElementById("blockedCount");
const whitelistCountEl = document.getElementById("whitelistCount");
const whitelistInput = document.getElementById("whitelistInput");
const addWhitelistBtn = document.getElementById("addWhitelist");
const allowCurrentSiteBtn = document.getElementById("allowCurrentSite");
const resetCounterBtn = document.getElementById("resetCounterBtn");
const openDashboardBtn = document.getElementById("openDashboardBtn");
const whitelistList = document.getElementById("whitelistList");
let previousBlockedCount = null;

function normalizeSite(value) {
    let site = String(value || "").trim().toLowerCase();
    if (!site) return "";
    site = site.replace(/^https?:\/\//, "");
    site = site.replace(/^www\./, "");
    site = site.split("/")[0];
    return site;
}

function getActiveTabHost(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (!tab?.url) {
            callback(null);
            return;
        }

        try {
            const host = new URL(tab.url).hostname.toLowerCase().replace(/^www\./, "");
            callback(host || null);
        } catch {
            callback(null);
        }
    });
}

function renderState(data) {
    const enabled = data.enabled ?? true;
    const blocked = data.blockedCount || 0;
    const whitelist = data.whitelist || [];

    statusText.textContent = enabled ? "Protection is active" : "Protection is paused";
    toggleBtn.textContent = enabled ? "Pause" : "Resume";
    blockedCountEl.textContent = String(blocked);
    if (previousBlockedCount !== null && blocked !== previousBlockedCount) {
        blockedCountEl.classList.remove("bump");
        void blockedCountEl.offsetWidth;
        blockedCountEl.classList.add("bump");
    }
    previousBlockedCount = blocked;
    whitelistCountEl.textContent = String(whitelist.length);
    renderWhitelist(whitelist);
}

function renderWhitelist(list) {
    whitelistList.innerHTML = "";

    if (!list.length) {
        const li = document.createElement("li");
        li.className = "list-item";
        li.innerHTML = '<span class="site">No sites whitelisted</span>';
        whitelistList.appendChild(li);
        return;
    }

    list.forEach((site) => {
        const li = document.createElement("li");
        li.className = "list-item";

        const text = document.createElement("span");
        text.className = "site";
        text.textContent = site;

        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => removeFromWhitelist(site));

        li.appendChild(text);
        li.appendChild(removeBtn);
        whitelistList.appendChild(li);
    });
}

function addToWhitelist(site) {
    const normalized = normalizeSite(site);
    if (!normalized) return;

    chrome.storage.local.get(["whitelist"], (data) => {
        const list = (data.whitelist || []).map(normalizeSite).filter(Boolean);
        if (!list.includes(normalized)) {
            list.push(normalized);
            chrome.storage.local.set({ whitelist: list }, () => {
                whitelistInput.value = "";
                renderState({ ...data, whitelist: list });
            });
        }
    });
}

function removeFromWhitelist(site) {
    chrome.storage.local.get(["whitelist"], (data) => {
        const list = (data.whitelist || []).filter((entry) => entry !== site);
        chrome.storage.local.set({ whitelist: list }, () => {
            renderState({ ...data, whitelist: list });
        });
    });
}

chrome.storage.local.get(["enabled", "blockedCount", "whitelist"], renderState);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes.enabled && !changes.blockedCount && !changes.whitelist) return;
    chrome.storage.local.get(["enabled", "blockedCount", "whitelist"], renderState);
});

toggleBtn.addEventListener("click", () => {
    chrome.storage.local.get(["enabled"], (data) => {
        chrome.storage.local.set({ enabled: !(data.enabled ?? true) });
    });
});

addWhitelistBtn.addEventListener("click", () => addToWhitelist(whitelistInput.value));

whitelistInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        addToWhitelist(whitelistInput.value);
    }
});

allowCurrentSiteBtn.addEventListener("click", () => {
    getActiveTabHost((host) => {
        if (host) addToWhitelist(host);
    });
});

resetCounterBtn.addEventListener("click", () => {
    chrome.storage.local.set({ blockedCount: 0 });
});

if (openDashboardBtn) {
    openDashboardBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("ui/dashboard/dashboard.html") });
    });
}
