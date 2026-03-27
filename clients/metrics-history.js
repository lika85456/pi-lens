/**
 * Metrics History Tracker for pi-lens
 *
 * Persists complexity metrics per commit to track trends over time.
 * Captures snapshots passively (session start) and explicitly (/lens-metrics).
 *
 * Storage: .pi-lens/metrics-history.json
 */
import * as fs from "node:fs";
import * as path from "node:path";
// --- Constants ---
const HISTORY_FILE = ".pi-lens/metrics-history.json";
const MAX_HISTORY_PER_FILE = 20;
// --- Git Helpers ---
/**
 * Get current git commit hash (short)
 */
function getCurrentCommit() {
    try {
        const { execSync } = require("node:child_process");
        return execSync("git rev-parse --short HEAD", {
            encoding: "utf-8",
            timeout: 5000,
        }).trim();
    }
    catch {
        return "unknown";
    }
}
// --- History Management ---
/**
 * Load history from disk (or return empty)
 */
export function loadHistory() {
    const historyPath = path.join(process.cwd(), HISTORY_FILE);
    if (!fs.existsSync(historyPath)) {
        return {
            version: 1,
            files: {},
            capturedAt: new Date().toISOString(),
        };
    }
    try {
        const content = fs.readFileSync(historyPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return {
            version: 1,
            files: {},
            capturedAt: new Date().toISOString(),
        };
    }
}
/**
 * Save history to disk
 */
export function saveHistory(history) {
    const historyDir = path.join(process.cwd(), ".pi-lens");
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }
    history.capturedAt = new Date().toISOString();
    const historyPath = path.join(historyDir, "metrics-history.json");
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}
/**
 * Capture a snapshot for a file's current metrics
 */
export function captureSnapshot(filePath, metrics, history) {
    const hist = history ?? loadHistory();
    const relativePath = path.relative(process.cwd(), filePath);
    const commit = getCurrentCommit();
    const snapshot = {
        commit,
        timestamp: new Date().toISOString(),
        mi: Math.round(metrics.maintainabilityIndex * 10) / 10,
        cognitive: metrics.cognitiveComplexity,
        nesting: metrics.maxNestingDepth,
        lines: metrics.linesOfCode,
    };
    const existing = hist.files[relativePath];
    if (existing) {
        // Append to history (cap at MAX_HISTORY_PER_FILE)
        existing.history.push(snapshot);
        if (existing.history.length > MAX_HISTORY_PER_FILE) {
            existing.history = existing.history.slice(-MAX_HISTORY_PER_FILE);
        }
        existing.latest = snapshot;
        existing.trend = computeTrend(existing.history);
    }
    else {
        // New file
        hist.files[relativePath] = {
            latest: snapshot,
            history: [snapshot],
            trend: "stable",
        };
    }
    return hist;
}
/**
 * Capture snapshots for multiple files
 */
export function captureSnapshots(files) {
    let history = loadHistory();
    for (const file of files) {
        history = captureSnapshot(file.filePath, file.metrics, history);
    }
    saveHistory(history);
    return history;
}
// --- Trend Analysis ---
/**
 * Compute trend direction from history snapshots
 * Uses last 3 snapshots for stability (or 2 if only 2 available)
 */
export function computeTrend(history) {
    if (history.length < 2)
        return "stable";
    const recent = history.slice(-3);
    const first = recent[0];
    const last = recent[recent.length - 1];
    // Use MI as primary indicator, cognitive as secondary
    const miDelta = last.mi - first.mi;
    const cogDelta = last.cognitive - first.cognitive;
    // Thresholds (MI changes < 2 are noise)
    if (miDelta > 2)
        return "improving";
    if (miDelta < -2)
        return "regressing";
    // If MI is stable, check cognitive
    if (cogDelta < -10)
        return "improving";
    if (cogDelta > 10)
        return "regressing";
    return "stable";
}
/**
 * Get delta between current snapshot and previous
 */
export function getDelta(history) {
    if (!history || history.history.length < 2)
        return null;
    const current = history.history[history.history.length - 1];
    const previous = history.history[history.history.length - 2];
    return {
        mi: Math.round((current.mi - previous.mi) * 10) / 10,
        cognitive: current.cognitive - previous.cognitive,
        trend: history.trend,
    };
}
/**
 * Get trend emoji for display
 */
export function getTrendEmoji(trend) {
    switch (trend) {
        case "improving":
            return "📈";
        case "regressing":
            return "📉";
        default:
            return "➡️";
    }
}
/**
 * Get trend summary across all files
 */
export function getTrendSummary(history) {
    let improving = 0;
    let regressing = 0;
    let stable = 0;
    const regressions = [];
    for (const [file, fileHistory] of Object.entries(history.files)) {
        switch (fileHistory.trend) {
            case "improving":
                improving++;
                break;
            case "regressing":
                regressing++;
                const delta = getDelta(fileHistory);
                if (delta) {
                    regressions.push({ file, miDelta: delta.mi });
                }
                break;
            default:
                stable++;
        }
    }
    // Sort regressions by MI delta (worst first)
    regressions.sort((a, b) => a.miDelta - b.miDelta);
    return {
        improving,
        regressing,
        stable,
        worstRegressions: regressions.slice(0, 5),
    };
}
/**
 * Format trend for metrics table
 */
export function formatTrendCell(filePath, history) {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileHistory = history.files[relativePath];
    if (!fileHistory || fileHistory.history.length < 2) {
        return "—"; // No history
    }
    const delta = getDelta(fileHistory);
    if (!delta)
        return "—";
    const emoji = getTrendEmoji(delta.trend);
    const miSign = delta.mi > 0 ? "+" : "";
    const miColor = delta.mi > 0 ? "🟢" : delta.mi < 0 ? "🔴" : "⚪";
    return `${emoji} ${miColor}${miSign}${delta.mi}`;
}
