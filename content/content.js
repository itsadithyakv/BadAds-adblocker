const INTERACTION_PING_INTERVAL_MS = 400;
let lastInteractionPing = 0;

function sendMessage(type, payload) {
    try {
        chrome.runtime.sendMessage({ type, ...payload });
    } catch {
        // Ignore pages where extension messaging is unavailable.
    }
}

function reportInteraction() {
    const now = Date.now();
    if (now - lastInteractionPing < INTERACTION_PING_INTERVAL_MS) return;
    lastInteractionPing = now;
    sendMessage("USER_INTERACTION", { time: now });
}

window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.__badads !== true || data.type !== "SCRIPT_POPUP_ATTEMPT") return;

    sendMessage("SCRIPT_POPUP_ATTEMPT", {
        time: Number(data.time) || Date.now(),
        targetUrl: data.targetUrl || null,
        sourceUrl: data.sourceUrl || location.href
    });
});

["pointerdown", "click", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, reportInteraction, { capture: true, passive: true });
});
