const countEl = document.getElementById("count");
const toggleBtn = document.getElementById("toggleBtn");
const resetBtn = document.getElementById("resetBtn");

// Load current state
chrome.storage.local.get(["enabled", "blockedCount"], (data) => {
    countEl.textContent = data.blockedCount || 0;
    updateToggle(data.enabled);
});

function updateToggle(enabled) {
    toggleBtn.textContent = enabled ? "Turn OFF" : "Turn ON";
    toggleBtn.style.background = enabled ? "#ff6600" : "#555";
}

toggleBtn.addEventListener("click", () => {
    chrome.storage.local.get(["enabled"], (data) => {
        let newState = !data.enabled;
        chrome.storage.local.set({ enabled: newState });
        updateToggle(newState);
    });
});

resetBtn.addEventListener("click", () => {
    chrome.storage.local.set({ blockedCount: 0 });
    countEl.textContent = 0;
    chrome.action.setBadgeText({ text: "" });
});