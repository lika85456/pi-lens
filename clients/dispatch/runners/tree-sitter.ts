/**
 * Tree-sitter Structural Analysis Runner
 *
 * Executes all loaded tree-sitter query files from rules/tree-sitter-queries/
 * for fast AST-based pattern matching.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RuleCache } from "../../cache/rule-cache.js";
import { TreeSitterClient } from "../../tree-sitter-client.js";
import { logTreeSitter } from "../../tree-sitter-logger.js";
import { classifyDefect } from "../diagnostic-taxonomy.js";
import {
	queryLoader,
	type TreeSitterQuery,
} from "../../tree-sitter-query-loader.js";
import type {
	Diagnostic,
	DispatchContext,
	RunnerDefinition,
	RunnerResult,
} from "../types.js";

// Module-level singleton: web-tree-sitter WASM must only be initialized once per process.
// Creating a new TreeSitterClient() on every write resets TRANSFER_BUFFER (a module-level
// WASM pointer) — concurrent writes race on _ts_init() and corrupt shared WASM state → crash.
let _sharedClient: TreeSitterClient | null = null;

const SILENT_ERROR_QUERY_IDS = new Set([
	"empty-catch",
	"python-empty-except",
	"ruby-empty-rescue",
	"go-bare-error",
	"no-discarded-error",
]);

function defaultFixSuggestion(defectClass: string, ruleId: string): string {
	if (defectClass === "silent-error") {
		return "Handle the error path explicitly: add logging/telemetry and rethrow or return a typed error result.";
	}
	if (defectClass === "secrets") {
		return "Move secret material to environment/secret manager and read it at runtime.";
	}
	if (defectClass === "injection") {
		return "Replace dynamic execution/string interpolation with parameterized or allowlisted operations.";
	}
	if (defectClass === "async-misuse") {
		return "Restructure async flow to handle errors and sequencing deterministically (await/try-catch or explicit concurrency control).";
	}
	if (ruleId.includes("unwrap")) {
		return "Replace unwrap() with explicit error handling (match/if-let) or propagate with ?.";
	}
	return "Refactor this pattern to a safer, explicit form matching project conventions.";
}

function isLineInModifiedRanges(
	line: number,
	ranges: ReadonlyArray<{ start: number; end: number }> | undefined,
): boolean {
	if (!ranges || ranges.length === 0) return true;
	return ranges.some((r) => line >= r.start && line <= r.end);
}

function getSharedClient(): TreeSitterClient {
	if (!_sharedClient) {
		_sharedClient = new TreeSitterClient();
	}
	return _sharedClient;
}

const treeSitterRunner: RunnerDefinition = {
	id: "tree-sitter",
	appliesTo: ["jsts", "python", "go", "rust", "ruby"],
	priority: 14, // Between oxlint (12) and ast-grep-napi (15)
	enabledByDefault: true,
	skipTestFiles: false, // Run on test files too (structural issues matter there)

	async run(ctx: DispatchContext): Promise<RunnerResult> {
		// Use singleton client — WASM must never be re-initialized after first call
		const client = getSharedClient();
		logTreeSitter({ phase: "runner_start", filePath: ctx.filePath });
		if (!client.isAvailable()) {
			logTreeSitter({
				phase: "runner_skip",
				filePath: ctx.filePath,
				reason: "client_unavailable",
				status: "skipped",
			});
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		const initialized = await client.init();
		if (!initialized) {
			logTreeSitter({
				phase: "runner_skip",
				filePath: ctx.filePath,
				reason: "client_init_failed",
				status: "skipped",
			});
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		// Determine language from file extension
		const filePath = ctx.filePath;
		const ext = filePath.slice(filePath.lastIndexOf("."));
		const EXT_TO_LANG: Record<string, string> = {
			".ts": "typescript",
			".mts": "typescript",
			".cts": "typescript",
			".tsx": "tsx",
			".js": "javascript",
			".mjs": "javascript",
			".cjs": "javascript",
			".jsx": "javascript",
			".py": "python",
			".go": "go",
			".rs": "rust",
			".rb": "ruby",
		};
		const languageId = EXT_TO_LANG[ext];
		if (!languageId) {
			logTreeSitter({
				phase: "runner_skip",
				filePath: ctx.filePath,
				reason: `unsupported_extension:${ext}`,
				status: "skipped",
			});
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		// Try cache first, fall back to loading from disk
		let languageQueries: TreeSitterQuery[] = [];
		const cache = new RuleCache(languageId, ctx.cwd);

		// Get all rule files for this language (use ctx.cwd for project root)
		const rulesDir = path.join(
			ctx.cwd,
			"rules",
			"tree-sitter-queries",
			languageId,
		);
		const ruleFiles: string[] = [];
		if (fs.existsSync(rulesDir)) {
			ruleFiles.push(
				...fs
					.readdirSync(rulesDir)
					.filter((f) => f.endsWith(".yml"))
					.map((f) => path.join(rulesDir, f)),
			);
		}

		// Try cache
		const cached = cache.get(ruleFiles);
		let cacheHit = false;
		if (cached) {
			// Use cached queries
			cacheHit = true;
			languageQueries = cached.queries.map(
				(q) =>
					({
						...q,
						has_fix: false,
						filePath: "",
					}) as TreeSitterQuery,
			);
		} else {
			// Load from disk
			await queryLoader.loadQueries(ctx.cwd);

			const allQueries = queryLoader.getAllQueries();
			languageQueries = allQueries.filter(
				(q) =>
					q.language === languageId ||
					(languageId === "javascript" && q.language === "typescript"),
			);

			// Save to cache
			cache.set(
				ruleFiles,
				languageQueries.map((q) => ({
					id: q.id,
					name: q.name,
					severity: q.severity,
					language: q.language,
					message: q.message,
					query: q.query,
					metavars: q.metavars,
					post_filter: q.post_filter,
					post_filter_params: q.post_filter_params,
					defect_class: q.defect_class,
					inline_tier: q.inline_tier,
				})),
			);
		}

		if (languageQueries.length === 0) {
			logTreeSitter({
				phase: "runner_complete",
				filePath,
				languageId,
				status: "succeeded",
				diagnostics: 0,
				blocking: 0,
				queryCount: 0,
				effectiveQueryCount: 0,
			});
			return { status: "succeeded", diagnostics: [], semantic: "none" };
		}

		const effectiveQueries = ctx.blockingOnly
			? languageQueries.filter(
					(q) =>
						q.inline_tier !== "review" &&
						(q.severity === "error" ||
							q.inline_tier === "blocking" ||
							SILENT_ERROR_QUERY_IDS.has(q.id)),
				)
			: languageQueries;

		logTreeSitter({
			phase: "queries_loaded",
			filePath,
			languageId,
			queryCount: languageQueries.length,
			effectiveQueryCount: effectiveQueries.length,
			cacheHit,
			metadata: { blockingOnly: !!ctx.blockingOnly },
		});

		const diagnostics: Diagnostic[] = [];

		// Run each query against the file
		for (const query of effectiveQueries) {
			try {
				const matches = await client.runQueryOnFile(query, filePath, languageId, {
					maxResults: 10,
				});

				for (const match of matches) {
					// Get line/column from match (already 0-indexed from tree-sitter)
					const line = match.line;
					const column = match.column;

					if (
						ctx.blockingOnly &&
						!isLineInModifiedRanges(line + 1, ctx.modifiedRanges)
					) {
						continue;
					}

					// Map severity to semantic
					const semantic =
						query.severity === "error"
							? "blocking"
							: query.severity === "warning"
								? "warning"
								: "none";
					const defectClass =
						(query.defect_class as any) ??
						classifyDefect(query.id, "tree-sitter", query.message);
					const suggestion =
						query.has_fix && query.fix_action
							? `${query.fix_action} this statement`
							: semantic === "blocking"
								? defaultFixSuggestion(defectClass, query.id)
								: undefined;

					diagnostics.push({
						id: `tree-sitter:${query.id}:${line}`,
						message: query.message,
						filePath,
						line: line + 1, // 1-indexed
						column: column + 1, // 1-indexed
						severity: query.severity,
						semantic,
						tool: "tree-sitter",
						rule: query.id,
						defectClass,
						// Surface fix intent to agent — tree-sitter never auto-applies;
						// linters (biome/ruff/eslint) own the autofix phase.
						fixable: query.has_fix,
						fixSuggestion: suggestion,
					});
				}
			} catch (err) {
				// Individual query failure shouldn't stop other queries
				console.error(`[tree-sitter] Query ${query.id} failed:`, err);
				logTreeSitter({
					phase: "query_error",
					filePath,
					languageId,
					queryId: query.id,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		if (diagnostics.length === 0) {
			logTreeSitter({
				phase: "runner_complete",
				filePath,
				languageId,
				status: "succeeded",
				diagnostics: 0,
				blocking: 0,
				queryCount: languageQueries.length,
				effectiveQueryCount: effectiveQueries.length,
			});
			return { status: "succeeded", diagnostics: [], semantic: "none" };
		}

		// Check if any blocking issues
		const hasBlocking = diagnostics.some((d) => d.semantic === "blocking");
		const blockingCount = diagnostics.filter(
			(d) => d.semantic === "blocking",
		).length;
		logTreeSitter({
			phase: "runner_complete",
			filePath,
			languageId,
			status: hasBlocking ? "failed" : "succeeded",
			diagnostics: diagnostics.length,
			blocking: blockingCount,
			queryCount: languageQueries.length,
			effectiveQueryCount: effectiveQueries.length,
		});

		return {
			status: hasBlocking ? "failed" : "succeeded",
			diagnostics,
			semantic: hasBlocking ? "blocking" : "warning",
		};
	},
};

export default treeSitterRunner;
