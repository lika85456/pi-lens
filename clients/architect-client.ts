/**
 * Architect Client for pi-lens
 *
 * Loads path-based architectural rules from .pi-lens/architect.yaml
 * and checks file paths against them.
 *
 * Provides:
 * - Pre-write hints: what rules apply before the agent edits
 * - Post-write validation: check for violations after edits
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { minimatch } from "minimatch";

// --- Types ---

export interface ArchitectViolation {
	pattern: string;
	message: string;
}

export interface ArchitectRule {
	pattern: string;
	must_not?: Array<{ pattern: string; message: string }>;
	must?: string[];
	max_lines?: number;
}

export interface ArchitectConfig {
	version?: string;
	inherits?: string[];
	rules: ArchitectRule[];
}

export interface FileArchitectResult {
	filePath: string;
	matchedRules: ArchitectRule[];
	violations: ArchitectViolation[];
}

// --- Client ---

export class ArchitectClient {
	private config: ArchitectConfig | null = null;
	private configPath: string | null = null;
	private log: (msg: string) => void;

	constructor(verbose = false) {
		this.log = verbose
			? (msg: string) => console.error(`[architect] ${msg}`)
			: () => {};
	}

	/**
	 * Load architect config from project root
	 */
	loadConfig(projectRoot: string): boolean {
		// Try common locations
		const candidates = [
			path.join(projectRoot, ".pi-lens", "architect.yaml"),
			path.join(projectRoot, "architect.yaml"),
			path.join(projectRoot, ".pi-lens", "architect.yml"),
		];

		for (const configPath of candidates) {
			try {
				const content = fs.readFileSync(configPath, "utf-8");
				this.config = this.parseYaml(content);
				this.configPath = configPath;
				this.log(`Loaded architect config from ${configPath}`);
				return true;
			} catch (error) {
				this.log(`Could not read ${configPath}: ${error}`);
				continue;
			}
		}

		this.log("No architect.yaml found");
		return false;
	}

	/**
	 * Check if config is loaded
	 */
	hasConfig(): boolean {
		return this.config !== null;
	}

	/**
	 * Get rules that apply to a file path
	 */
	getRulesForFile(filePath: string): ArchitectRule[] {
		if (!this.config) return [];

		const matched: ArchitectRule[] = [];
		for (const rule of this.config.rules) {
			if (minimatch(filePath, rule.pattern, { matchBase: true })) {
				matched.push(rule);
			}
		}
		return matched;
	}

	/**
	 * Check code content against rules for a file path
	 * Returns violations found
	 */
	checkFile(filePath: string, content: string): ArchitectViolation[] {
		const rules = this.getRulesForFile(filePath);
		const violations: ArchitectViolation[] = [];

		for (const rule of rules) {
			if (!rule.must_not) continue;

			for (const check of rule.must_not) {
				const regex = new RegExp(check.pattern, "i");
				if (regex.test(content)) {
					violations.push({
						pattern: rule.pattern,
						message: check.message,
					});
				}
			}
		}

		return violations;
	}

	/**
	 * Check file size against max_lines rule
	 * Returns violation if file exceeds the limit
	 */
	checkFileSize(filePath: string, lineCount: number): ArchitectViolation | null {
		const rules = this.getRulesForFile(filePath);

		for (const rule of rules) {
			if (rule.max_lines && lineCount > rule.max_lines) {
				return {
					pattern: rule.pattern,
					message: `File is ${lineCount} lines — exceeds ${rule.max_lines} line limit. Split into smaller modules.`,
				};
			}
		}
		return null;
	}

	/**
	 * Get pre-write hints for a file path
	 * Returns rules that will apply to the file being written
	 */
	getHints(filePath: string): string[] {
		const rules = this.getRulesForFile(filePath);
		const hints: string[] = [];

		for (const rule of rules) {
			if (rule.must_not) {
				for (const check of rule.must_not) {
					hints.push(check.message);
				}
			}
			if (rule.must) {
				for (const req of rule.must) {
					hints.push(`Must: ${req}`);
				}
			}
		}

		return hints;
	}

	/**
	 * Simple YAML parser for architect.yaml format
	 * Handles the specific structure we need
	 */
	private parseYaml(content: string): ArchitectConfig {
		const config: ArchitectConfig = { rules: [] };

		// Split into top-level rule blocks (4-space indent "- pattern:")
		const ruleBlocks = content.split(/(?=^  - pattern:)/m);

		for (const block of ruleBlocks) {
			const lines = block.split("\n");
			let rule: ArchitectRule | null = null;
			let section: "must_not" | "must" | null = null;
			let violation: { pattern: string; message: string } | null = null;

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith("#") || !trimmed) continue;

				// Version (top-level)
				if (trimmed.startsWith("version:") && !rule) {
					config.version = trimmed.split(":")[1]?.trim().replace(/['"]/g, "");
					continue;
				}

				// Rule pattern
				const ruleMatch = trimmed.match(/^-?\s*pattern:\s*["'](.+?)["']/);
				if (ruleMatch && trimmed.startsWith("-") && !section) {
					rule = { pattern: ruleMatch[1], must_not: [], must: [] };
					continue;
				}
				// Nested pattern inside must_not (may start with "- ")
				if ((trimmed.startsWith("pattern:") || trimmed.startsWith("- pattern:")) && section === "must_not") {
					// Extract everything after "pattern:" and unquote
					const raw = trimmed.replace(/^-?\s*pattern:\s*/, "").trim();
					const unquoted = raw.replace(/^["']|["']$/g, "");
					if (unquoted) {
						violation = { pattern: unquoted, message: "" };
					}
					continue;
				}

				// Section headers
				if (trimmed === "must_not:" || trimmed.startsWith("must_not:")) {
					section = "must_not";
					continue;
				}
				if (trimmed === "must:") {
					section = "must";
					continue;
				}

				// Message for current violation
				if (trimmed.startsWith("message:") && violation) {
					const match = trimmed.match(/message:\s*["'](.+?)["']/);
					if (match) {
						violation.message = match[1];
						if (rule) {
							rule.must_not = rule.must_not ?? [];
							rule.must_not.push(violation);
						}
						violation = null;
					}
					continue;
				}

				// Must items (simple strings)
				if (section === "must" && trimmed.startsWith("- ") && rule) {
					const item = trimmed.slice(2).replace(/^["']|["']$/g, "");
					rule.must = rule.must ?? [];
					rule.must.push(item);
				}

				// max_lines setting
				if (trimmed.startsWith("max_lines:") && rule) {
					const num = parseInt(trimmed.split(":")[1]?.trim(), 10);
					if (!Number.isNaN(num)) {
						rule.max_lines = num;
					}
				}
			}

			if (rule) {
				config.rules.push(rule);
			}
		}

		return config;
	}
}

// --- Singleton ---

let instance: ArchitectClient | null = null;

export function getArchitectClient(verbose = false): ArchitectClient {
	if (!instance) {
		instance = new ArchitectClient(verbose);
	}
	return instance;
}
