(() => {
    if (window.__badAdsOpenHookInstalled) return;
    window.__badAdsOpenHookInstalled = true;

    const nativeOpen = window.open;
    if (typeof nativeOpen !== "function") return;

    function notifyAttempt(targetUrl) {
        try {
            window.postMessage(
                {
                    __badads: true,
                    type: "SCRIPT_POPUP_ATTEMPT",
                    targetUrl: targetUrl == null ? "" : String(targetUrl),
                    sourceUrl: location.href,
                    time: Date.now()
                },
                "*"
            );
        } catch {
            // Ignore cross-origin message edge-cases.
        }
    }

    const wrappedOpen = function (...args) {
        notifyAttempt(args[0]);
        return nativeOpen.apply(this, args);
    };

    Object.defineProperty(wrappedOpen, "name", {
        value: "open",
        configurable: true
    });

    window.open = wrappedOpen;
})();
