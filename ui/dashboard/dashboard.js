const totalBlockedEl = document.getElementById("totalBlocked");
const topDomainEl = document.getElementById("topDomain");
const topReasonEl = document.getElementById("topReason");
const domainRowsEl = document.getElementById("domainRows");
const trendCanvas = document.getElementById("trendChart");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const LOOKBACK_DAYS = 14;

function parseLogDate(value) {
    if (!value) return null;

    const firstTry = new Date(value);
    if (!Number.isNaN(firstTry.getTime())) return firstTry;

    // Fallback for inconsistent locale parsing.
    const normalized = String(value).replace(",", "");
    const secondTry = new Date(normalized);
    if (!Number.isNaN(secondTry.getTime())) return secondTry;

    return null;
}

function buildDailyBuckets(logs, days) {
    const now = new Date();
    const labels = [];
    const counts = [];
    const indexByKey = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);

        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        indexByKey.set(key, labels.length);
        labels.push(label);
        counts.push(0);
    }

    for (const log of logs) {
        const date = parseLogDate(log?.time);
        if (!date) continue;
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().slice(0, 10);
        const idx = indexByKey.get(key);
        if (idx !== undefined) counts[idx] += 1;
    }

    return { labels, counts };
}

function topEntryByCount(mapObj) {
    let topKey = null;
    let topCount = 0;
    for (const [key, count] of Object.entries(mapObj)) {
        if (count > topCount) {
            topKey = key;
            topCount = count;
        }
    }
    return { key: topKey, count: topCount };
}

function aggregateLogs(logs) {
    const byDomain = {};
    const byReason = {};

    for (const log of logs) {
        const domain = String(log?.domain || "unknown");
        const reason = String(log?.reason || "unknown");
        byDomain[domain] = (byDomain[domain] || 0) + 1;
        byReason[reason] = (byReason[reason] || 0) + 1;
    }

    const topDomain = topEntryByCount(byDomain);
    const topReason = topEntryByCount(byReason);
    const domainRanking = Object.entries(byDomain).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return { topDomain, topReason, domainRanking };
}

function renderTrendChart(canvas, labels, counts) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssWidth = canvas.clientWidth || canvas.width;
    const cssHeight = Math.max(220, Math.floor(cssWidth * 0.33));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = cssWidth;
    const height = cssHeight;
    const pad = { top: 20, right: 16, bottom: 30, left: 34 };
    const chartW = Math.max(1, width - pad.left - pad.right);
    const chartH = Math.max(1, height - pad.top - pad.bottom);
    const maxValue = Math.max(1, ...counts);
    const steps = 4;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(166,178,212,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= steps; i += 1) {
        const y = pad.top + (chartH * i) / steps;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + chartW, y);
        ctx.stroke();
    }

    ctx.fillStyle = "#a6b2d4";
    ctx.font = "11px Segoe UI, sans-serif";
    for (let i = 0; i <= steps; i += 1) {
        const value = Math.round(maxValue - (maxValue * i) / steps);
        const y = pad.top + (chartH * i) / steps;
        ctx.fillText(String(value), 6, y + 4);
    }

    const points = counts.map((count, idx) => {
        const x = pad.left + (idx * chartW) / Math.max(1, counts.length - 1);
        const y = pad.top + chartH - (count / maxValue) * chartH;
        return { x, y, count };
    });

    if (points.length > 0) {
        const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
        gradient.addColorStop(0, "rgba(92,255,161,0.3)");
        gradient.addColorStop(1, "rgba(92,255,161,0.02)");

        ctx.beginPath();
        ctx.moveTo(points[0].x, pad.top + chartH);
        for (const p of points) ctx.lineTo(p.x, p.y);
        ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < points.length; i += 1) {
            const p = points[i];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "#47d1ff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#5cffa1";
        for (const p of points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const labelStep = counts.length > 8 ? 2 : 1;
    ctx.fillStyle = "#a6b2d4";
    for (let i = 0; i < labels.length; i += labelStep) {
        const x = pad.left + (i * chartW) / Math.max(1, labels.length - 1);
        ctx.fillText(labels[i], x - 14, height - 8);
    }
}

function renderDomainTable(domainRanking) {
    if (!domainRowsEl) return;
    domainRowsEl.innerHTML = "";

    if (!domainRanking.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = "No data available yet.";
        row.appendChild(cell);
        domainRowsEl.appendChild(row);
        return;
    }

    for (const [domain, count] of domainRanking) {
        const row = document.createElement("tr");
        const domainCell = document.createElement("td");
        const countCell = document.createElement("td");
        domainCell.textContent = domain;
        countCell.textContent = String(count);
        row.appendChild(domainCell);
        row.appendChild(countCell);
        domainRowsEl.appendChild(row);
    }
}

function downloadFile(name, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function toCsv(logs) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["time,domain,reason"];
    for (const log of logs) {
        lines.push([esc(log.time), esc(log.domain), esc(log.reason)].join(","));
    }
    return lines.join("\n");
}

function renderDashboard(data) {
    const blockedCount = Number(data?.blockedCount || 0);
    const logs = Array.isArray(data?.logs) ? data.logs : [];
    const { topDomain, topReason, domainRanking } = aggregateLogs(logs);
    const trend = buildDailyBuckets(logs, LOOKBACK_DAYS);

    if (totalBlockedEl) totalBlockedEl.textContent = String(blockedCount);
    if (topDomainEl) topDomainEl.textContent = topDomain.key || "-";
    if (topReasonEl) topReasonEl.textContent = topReason.key || "-";
    renderDomainTable(domainRanking);
    if (trendCanvas) renderTrendChart(trendCanvas, trend.labels, trend.counts);

    if (exportJsonBtn) {
        exportJsonBtn.onclick = () => {
            const payload = {
                exportedAt: new Date().toISOString(),
                blockedCount,
                logCount: logs.length,
                logs
            };
            downloadFile("badads-export.json", "application/json", JSON.stringify(payload, null, 2));
        };
    }

    if (exportCsvBtn) {
        exportCsvBtn.onclick = () => {
            downloadFile("badads-export.csv", "text/csv;charset=utf-8", toCsv(logs));
        };
    }
}

function loadAndRender() {
    chrome.storage.local.get(["blockedCount", "logs"], (data) => {
        renderDashboard(data || {});
    });
}

loadAndRender();
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.blockedCount && !changes.logs) return;
    loadAndRender();
});

window.addEventListener("resize", () => loadAndRender());
