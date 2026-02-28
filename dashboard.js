const totalBlockedEl = document.getElementById("totalBlocked");
const topDomainEl = document.getElementById("topDomain");
const topReasonEl = document.getElementById("topReason");
const domainRowsEl = document.getElementById("domainRows");
const trendChartEl = document.getElementById("trendChart");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const TREND_DAYS = 14;
let latestSnapshot = null;

function getLogTimestamp(log) {
    if (typeof log?.ts === "number" && Number.isFinite(log.ts)) return log.ts;
    if (typeof log?.time === "string") {
        const parsed = Date.parse(log.time);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function toDateKey(ms) {
    const date = new Date(ms);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildTrendBuckets(logs, days) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const dateKeys = [];
    const counts = [];
    const indexByDate = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = toDateKey(d.getTime());
        indexByDate.set(key, dateKeys.length);
        dateKeys.push(key);
        counts.push(0);
    }

    for (const log of logs) {
        const ts = getLogTimestamp(log);
        if (!ts) continue;
        const key = toDateKey(ts);
        const idx = indexByDate.get(key);
        if (idx !== undefined) counts[idx] += 1;
    }

    return { labels: dateKeys, values: counts };
}

function countByKey(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
}

function sortMapDesc(map) {
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderTopDomains(domainCounts) {
    const top = sortMapDesc(domainCounts).slice(0, 8);
    if (!top.length) {
        domainRowsEl.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = "No data available yet.";
        row.appendChild(cell);
        domainRowsEl.appendChild(row);
        return;
    }

    domainRowsEl.innerHTML = "";
    for (const [domain, count] of top) {
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

function renderTrendChart(labels, values) {
    const canvas = trendChartEl;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const left = 44;
    const right = 14;
    const top = 16;
    const bottom = 34;
    const chartW = width - left - right;
    const chartH = height - top - bottom;
    const max = Math.max(1, ...values);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(166, 178, 212, 0.35)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i += 1) {
        const y = top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        const tickValue = Math.round(max - (max / 4) * i);
        ctx.fillStyle = "#a6b2d4";
        ctx.font = "12px Segoe UI";
        ctx.fillText(String(tickValue), 8, y + 4);
    }

    ctx.strokeStyle = "#47d1ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((value, idx) => {
        const x = left + (chartW * idx) / Math.max(1, values.length - 1);
        const y = top + chartH - (value / max) * chartH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#5cffa1";
    values.forEach((value, idx) => {
        const x = left + (chartW * idx) / Math.max(1, values.length - 1);
        const y = top + chartH - (value / max) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = "#a6b2d4";
    ctx.font = "11px Segoe UI";
    const firstLabel = labels[0] ? labels[0].slice(5) : "";
    const midLabel = labels[Math.floor(labels.length / 2)]?.slice(5) || "";
    const lastLabel = labels[labels.length - 1] ? labels[labels.length - 1].slice(5) : "";
    ctx.fillText(firstLabel, left, height - 10);
    ctx.fillText(midLabel, left + chartW / 2 - 16, height - 10);
    ctx.fillText(lastLabel, width - right - 34, height - 10);
}

function formatSnapshot(data) {
    const logs = Array.isArray(data.logs) ? data.logs : [];
    const blockedCount = Number(data.blockedCount || 0);
    const domainCounts = countByKey(logs, (log) => String(log.domain || "").trim().toLowerCase());
    const reasonCounts = countByKey(logs, (log) => String(log.reason || "").trim().toLowerCase());
    const trend = buildTrendBuckets(logs, TREND_DAYS);
    const topDomainEntry = sortMapDesc(domainCounts)[0] || null;
    const topReasonEntry = sortMapDesc(reasonCounts)[0] || null;

    return {
        blockedCount,
        logs,
        trend,
        domainCounts: Object.fromEntries(domainCounts),
        reasonCounts: Object.fromEntries(reasonCounts),
        topDomain: topDomainEntry ? topDomainEntry[0] : "-",
        topReason: topReasonEntry ? topReasonEntry[0] : "-"
    };
}

function renderSnapshot(snapshot) {
    totalBlockedEl.textContent = String(snapshot.blockedCount);
    topDomainEl.textContent = snapshot.topDomain;
    topReasonEl.textContent = snapshot.topReason;
    renderTopDomains(new Map(Object.entries(snapshot.domainCounts)));
    renderTrendChart(snapshot.trend.labels, snapshot.trend.values);
}

function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function exportJson() {
    if (!latestSnapshot) return;
    const payload = {
        exportedAt: new Date().toISOString(),
        ...latestSnapshot
    };
    downloadTextFile("badads-analytics.json", JSON.stringify(payload, null, 2), "application/json");
}

function escapeCsvCell(value) {
    const str = String(value ?? "");
    if (!/[",\n]/.test(str)) return str;
    return `"${str.replace(/"/g, "\"\"")}"`;
}

function exportCsv() {
    if (!latestSnapshot) return;
    const header = ["domain", "reason", "time", "timestamp"];
    const rows = latestSnapshot.logs.map((log) => [
        escapeCsvCell(log.domain || ""),
        escapeCsvCell(log.reason || ""),
        escapeCsvCell(log.time || ""),
        escapeCsvCell(getLogTimestamp(log) || "")
    ]);

    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadTextFile("badads-logs.csv", csv, "text/csv;charset=utf-8");
}

function loadAnalytics() {
    chrome.storage.local.get(["blockedCount", "logs"], (data) => {
        latestSnapshot = formatSnapshot(data);
        renderSnapshot(latestSnapshot);
    });
}

exportJsonBtn.addEventListener("click", exportJson);
exportCsvBtn.addEventListener("click", exportCsv);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes.blockedCount && !changes.logs) return;
    loadAnalytics();
});

loadAnalytics();
