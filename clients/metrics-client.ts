/**
 * Silent Metrics Client for pi-lens
 *
 * Tracks code quality metrics silently during the session.
 * Metrics are aggregated and shown in session summary only.
 *
 * Tracks:
 * - TDR (Technical Debt Ratio): composite score from existing signals
 * - AI Code Ratio: % of file written by agent this session vs pre-existing
 * - Code Entropy: Shannon entropy delta per file
 *
 * These are observational metrics — they inform the human in session summary,
 * they don't gate or interrupt the agent mid-task.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Diagnostic, TDRCategory } from "./dispatch/types.js";

// --- Types ---

export interface FileMetrics {
	filePath: string;
	totalLines: number;
	entropyStart: number; // Shannon entropy at first touch
	entropyCurrent: number; // Current Shannon entropy
	entropyDelta: number; // Change in entropy
	tdrStart: number; // New field
	tdrCurrent: number; // New field
	tdrContributors: TDREntry[];
}

export interface TDREntry {
	category: string;
	count: number;
	severity: "error" | "warning" | "info";
}

export interface SessionMetrics {
	filesModified: number;
	avgEntropyDelta: number; // average across files
	tdrScore: number; // 0-100, lower is better
	tdrByCategory: Map<string, number>;
	fileDetails: Map<string, FileMetrics>;
}

// --- TDR Conversion Helper ---

/**
 * Convert dispatch diagnostics to TDR entries for metrics tracking
 */
export function convertDiagnosticsToTDREntries(
	diagnostics: Diagnostic[],
): TDREntry[] {
	const categoryCounts = new Map<TDRCategory, number>();

	for (const d of diagnostics) {
		const category = d.tdrCategory ?? categorizeDiagnostic(d);
		categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
	}

	const entries: TDREntry[] = [];
	for (const [category, count] of categoryCounts) {
		entries.push({
			category,
			count,
			severity: severityForCategory(category),
		});
	}

	return entries;
}

/** Categorize a diagnostic based on its properties */
function categorizeDiagnostic(d: Diagnostic): TDRCategory {
	// Type errors from ts-lsp, pyright
	if (d.tool === "ts-lsp" || d.tool === "pyright") {
		return "type_errors";
	}

	// Security rules from ast-grep-napi, tree-sitter
	if (
		d.rule?.includes("eval") ||
		d.rule?.includes("secret") ||
		d.rule?.includes("jwt") ||
		d.rule?.includes("dangerous") ||
		d.message.toLowerCase().includes("security")
	) {
		return "security";
	}

	// Architecture violations
	if (
		d.rule?.includes("architect") ||
		d.message.toLowerCase().includes("architecture") ||
		d.rule?.includes("cross-layer")
	) {
		return "architecture";
	}

	// Complexity issues
	if (
		d.rule?.includes("complex") ||
		d.rule?.includes("nesting") ||
		d.rule?.includes("cognitive")
	) {
		return "complexity";
	}

	// Test-related
	if (d.tool === "test-runner" || d.rule?.includes("test")) {
		return "tests";
	}

	// Dead code
	if (
		d.rule?.includes("unused") ||
		d.rule?.includes("dead") ||
		d.message.toLowerCase().includes("unused")
	) {
		return "dead_code";
	}

	// Duplication
	if (
		d.rule?.includes("duplicate") ||
		d.rule?.includes("clone") ||
		d.message.toLowerCase().includes("duplicate")
	) {
		return "duplication";
	}

	// Default to style (linting issues)
	return "style";
}

/** Determine severity based on category */
function severityForCategory(
	category: TDRCategory,
): "error" | "warning" | "info" {
	switch (category) {
		case "type_errors":
		case "security":
			return "error";
		case "architecture":
		case "complexity":
		case "tests":
			return "warning";
		default:
			return "info";
	}
}

// --- Client ---

export class MetricsClient {
	private log: (msg: string) => void;
	private fileBaselines: Map<
		string,
		{ content: string; entropy: number; tdr: number }
	> = new Map();
	private tdrFindings: Map<string, TDREntry[]> = new Map();

	constructor(verbose = false) {
		this.log = verbose
			? (msg: string) => console.error(`[metrics] ${msg}`)
			: () => {};
	}

	/**
	 * Record initial state of a file when first touched this session
	 */
	recordBaseline(filePath: string, initialTdr = 0): void {
		const absolutePath = path.resolve(filePath);
		if (!fs.existsSync(absolutePath)) return;
		if (this.fileBaselines.has(absolutePath)) return; // Already recorded

		const content = fs.readFileSync(absolutePath, "utf-8");
		const entropy = this.calculateEntropy(content);
		this.fileBaselines.set(absolutePath, { content, entropy, tdr: initialTdr });

		this.log(
			`Baseline recorded: ${path.basename(filePath)} (entropy: ${entropy.toFixed(2)}, tdr: ${initialTdr})`,
		);
	}

	/**
	 * Update TDR findings for a file
	 */
	updateTDR(filePath: string, entries: TDREntry[]): void {
		const absolutePath = path.resolve(filePath);
		this.tdrFindings.set(absolutePath, entries);
	}

	/**
	 * Get overall TDR score for the session
	 * 0-100, where 100 is high debt.
	 */
	getTDRScore(): number {
		let totalScore = 0;
		for (const entries of this.tdrFindings.values()) {
			for (const entry of entries) {
				// Each entry adds to the debt index based on its Grade (count as the Grade value)
				totalScore += entry.count;
			}
		}
		// Normalize to 0-100? Or just return the raw Index.
		// SCA.md says "Technical Debt Index"
		return totalScore;
	}

	/**
	 * Get metrics for a specific file
	 */
	getFileMetrics(filePath: string): FileMetrics | null {
		const absolutePath = path.resolve(filePath);
		const baseline = this.fileBaselines.get(absolutePath);
		if (!baseline) return null;

		if (!fs.existsSync(absolutePath)) return null;

		const currentContent = fs.readFileSync(absolutePath, "utf-8");
		const totalLines = currentContent.split("\n").length;

		const entropyCurrent = this.calculateEntropy(currentContent);
		const entropyDelta = entropyCurrent - baseline.entropy;

		const currentTdrFindings = this.tdrFindings.get(absolutePath) || [];
		const tdrCurrent = currentTdrFindings.reduce((a, b) => a + b.count, 0);

		return {
			filePath: path.relative(process.cwd(), absolutePath),
			totalLines,
			entropyStart: baseline.entropy,
			entropyCurrent,
			entropyDelta,
			tdrStart: baseline.tdr,
			tdrCurrent,
			tdrContributors: currentTdrFindings,
		};
	}

	/**
	 * Get entropy delta for all touched files
	 */
	getEntropyDeltas(): Array<{
		file: string;
		start: number;
		current: number;
		delta: number;
	}> {
		const results: Array<{
			file: string;
			start: number;
			current: number;
			delta: number;
		}> = [];

		for (const [filePath, baseline] of this.fileBaselines) {
			if (!fs.existsSync(filePath)) continue;

			const content = fs.readFileSync(filePath, "utf-8");
			const current = this.calculateEntropy(content);
			const delta = current - baseline.entropy;

			results.push({
				file: path.relative(process.cwd(), filePath),
				start: baseline.entropy,
				current,
				delta,
			});
		}

		return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
	}

	/**
	 * Calculate Shannon entropy of a string
	 * Returns bits per character
	 */
	calculateEntropy(text: string): number {
		if (text.length === 0) return 0;

		const freq = new Map<string, number>();
		for (const char of text) {
			freq.set(char, (freq.get(char) || 0) + 1);
		}

		let entropy = 0;
		const len = text.length;
		for (const count of freq.values()) {
			const p = count / len;
			if (p > 0) {
				entropy -= p * Math.log2(p);
			}
		}

		return entropy;
	}

	/**
	 * Reset session state (for new session)
	 */
	reset(): void {
		this.fileBaselines.clear();
		this.log("Session metrics reset");
	}
}
