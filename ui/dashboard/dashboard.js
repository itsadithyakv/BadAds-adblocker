const metricTotalEl = document.getElementById("metricTotal");
const metricDomainEl = document.getElementById("metricDomain");
const metricTodayEl = document.getElementById("metricToday");
const metricTrendEl = document.getElementById("metricTrend");
const activityChartEl = document.getElementById("activityChart");
const logsContainerEl = document.getElementById("logsContainer");

const LOOKBACK_DAYS = 14;
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric"
});

loadAndRender();
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes.blockedCount && !changes.logs) return;
  loadAndRender();
});

window.addEventListener("resize", () => loadAndRender());

function loadAndRender() {
  chrome.storage.local.get(["blockedCount", "logs"], (data) => renderDashboard(data || {}));
}

function renderDashboard(data) {
  const totalBlocks = Number(data.blockedCount || 0);
  const logs = Array.isArray(data.logs) ? data.logs : [];
  const blockedDomains = aggregateCounts(logs, "domain");
  const blockedByDay = buildDailyCounts(logs, LOOKBACK_DAYS);

  const topDomain = topEntry(blockedDomains);
  const trend = computeTrend(blockedByDay);
  const chartPoints = getRecentPoints(blockedByDay);
  const todayCount = getTodayCount(blockedByDay);

  if (metricTotalEl) metricTotalEl.textContent = String(totalBlocks);
  if (metricDomainEl) metricDomainEl.textContent = topDomain ? topDomain.key : "-";
  if (metricTodayEl) metricTodayEl.textContent = String(todayCount);
  if (metricTrendEl) metricTrendEl.textContent = trend;

  renderChart(chartPoints);
  renderLogs(logs);
}

function topEntry(mapObj) {
  const entries = Object.entries(mapObj || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { key: entries[0][0], value: entries[0][1] };
}

function aggregateCounts(logs, field) {
  const counts = {};
  for (const log of logs) {
    const raw = typeof log?.[field] === "string" ? log[field].trim() : "";
    const value = raw || "unknown";
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function buildDailyCounts(logs, days) {
  const counts = {};

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    counts[toDayKey(date)] = 0;
  }

  for (const log of logs) {
    const timestamp = parseLogTime(log?.time);
    if (!timestamp) continue;
    timestamp.setHours(0, 0, 0, 0);
    const key = toDayKey(timestamp);
    if (key in counts) {
      counts[key] += 1;
    }
  }

  return counts;
}

function getRecentPoints(blockedByDay) {
  return Object.keys(blockedByDay).map((key) => ({
    key,
    label: DATE_LABEL_FORMATTER.format(new Date(`${key}T00:00:00`)),
    count: Number(blockedByDay[key] || 0)
  }));
}

function computeTrend(blockedByDay) {
  const points = getRecentPoints(blockedByDay);
  const firstHalf = points.slice(0, 7).reduce((sum, point) => sum + point.count, 0);
  const secondHalf = points.slice(7).reduce((sum, point) => sum + point.count, 0);

  if (firstHalf === 0 && secondHalf === 0) return "Quiet";
  if (firstHalf === secondHalf) return "Stable";
  return secondHalf > firstHalf ? "Rising" : "Cooling";
}

function getTodayCount(blockedByDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const key = toDayKey(today);
  return Number(blockedByDay[key] || 0);
}

function renderChart(points) {
  if (!activityChartEl) return;
  const ctx = activityChartEl.getContext("2d");
  if (!ctx) return;

  const cssWidth = activityChartEl.clientWidth || activityChartEl.width;
  const cssHeight = Math.max(260, Math.floor(cssWidth * 0.34));
  const dpr = window.devicePixelRatio || 1;
  activityChartEl.width = Math.floor(cssWidth * dpr);
  activityChartEl.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = cssWidth;
  const height = cssHeight;
  const pad = { top: 20, right: 16, bottom: 48, left: 44 };
  const chartW = Math.max(1, width - pad.left - pad.right);
  const chartH = Math.max(1, height - pad.top - pad.bottom);
  const maxValue = Math.max(4, ...points.map((point) => point.count));

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(162,163,173,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#a2a3ad";
  ctx.font = "12px Segoe UI, sans-serif";
  for (let i = 0; i <= 4; i += 1) {
    const value = Math.round(maxValue - (maxValue * i) / 4);
    const y = pad.top + (chartH * i) / 4;
    ctx.fillText(String(value), 8, y + 4);
  }

  const bars = [];
  const barGap = 8;
  const rawBarWidth = (chartW - barGap * (points.length - 1)) / points.length;
  const barWidth = Math.max(8, rawBarWidth);

  points.forEach((point, index) => {
    const x = pad.left + index * (barWidth + barGap);
    const heightValue = (point.count / maxValue) * chartH;
    const y = pad.top + chartH - heightValue;
    bars.push({ x, y, h: heightValue, label: point.label });
  });

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  gradient.addColorStop(0, "#f0f1f5");
  gradient.addColorStop(1, "#9fa3af");
  ctx.fillStyle = gradient;
  for (const bar of bars) {
    const radius = Math.min(6, barWidth / 2, bar.h / 2);
    fillRoundedRect(ctx, bar.x, bar.y, barWidth, Math.max(bar.h, 2), radius);
  }

  ctx.fillStyle = "#8f919d";
  ctx.font = "11px Segoe UI, sans-serif";
  const labelStep = bars.length > 10 ? 3 : 2;
  for (let i = 0; i < bars.length; i += labelStep) {
    const bar = bars[i];
    const textWidth = ctx.measureText(bar.label).width;
    ctx.fillText(bar.label, bar.x + barWidth / 2 - textWidth / 2, height - 14);
  }

  const lastBar = bars[bars.length - 1];
  if (lastBar && (bars.length - 1) % labelStep !== 0) {
    const textWidth = ctx.measureText(lastBar.label).width;
    ctx.fillText(lastBar.label, lastBar.x + barWidth / 2 - textWidth / 2, height - 14);
  }
}

function renderLogs(logs) {
  if (!logsContainerEl) return;
  logsContainerEl.innerHTML = "";

  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "log-item";
    empty.textContent = "No blocked events yet.";
    logsContainerEl.appendChild(empty);
    return;
  }

  logs.slice(0, 30).forEach((log) => {
    const item = document.createElement("div");
    item.className = "log-item";

    const title = document.createElement("strong");
    title.textContent = log.domain || "unknown";

    const reason = document.createElement("div");
    reason.className = "log-item__meta";
    reason.textContent = log.reason || "unknown reason";

    const url = document.createElement("div");
    url.className = "log-item__meta";
    url.textContent = log.url || "";

    const time = document.createElement("div");
    time.className = "log-item__meta";
    time.textContent = formatTimestamp(log.time);

    item.append(title, reason, url, time);
    logsContainerEl.appendChild(item);
  });
}

function formatTimestamp(value) {
  if (!value) return "Unknown time";
  const date = parseLogTime(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function parseLogTime(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = String(value).replace(",", "");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return null;
}

function toDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function fillRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}
