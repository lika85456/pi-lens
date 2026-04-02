# TDR (Technical Debt Ratio) Integration Fix - Implementation Plan

> **For Pi:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Wire up the orphaned `MetricsClient.updateTDR()` method so dispatch runner diagnostics flow into Technical Debt Ratio tracking.

**Architecture:** Add a conversion layer in the pipeline that transforms `Diagnostic[]` (from dispatch runners) into `TDREntry[]` (for metrics client). TDR data will then feed into session summaries showing debt trends.

**Tech Stack:** TypeScript, pi-lens dispatch system, MetricsClient

---

## Current State Analysis

**Problem:** `MetricsClient.updateTDR()` exists but is never called.

**Working:** 
- `ComplexityClient` → MI, cognitive complexity, entropy (✅)
- `MetricsClient.recordWrite()` → AI Code Ratio (✅)
- Dispatch runners → Diagnostics displayed but NOT tracked for TDR (❌)

**Files to Touch:**
- `clients/metrics-client.ts` - Add conversion helper
- `clients/pipeline.ts` - Wire up TDR update after dispatch
- `clients/dispatch/types.ts` - Add TDR category mapping to Diagnostic
- `clients/dispatch/utils/format-utils.ts` - Helper to categorize diagnostics

---

### Task 1: Add TDR Category Mapping to Diagnostic Type

**Files:**
- Modify: `clients/dispatch/types.ts:35-52`

**Step 1: Add tdrCategory field to Diagnostic interface**

Add after `fixSuggestion?: string;` on line 52:

```typescript
	/** TDR category for metrics tracking */
	tdrCategory?:
		| "type_errors"
		| "security"
		| "architecture"
		| "complexity"
		| "style"
		| "tests"
		| "dead_code"
		| "duplication";
```

**Step 2: Add TDRCategory type export**

Add after the OutputSemantic type (around line 24):

```typescript
export type TDRCategory =
	| "type_errors"
	| "security"
	| "architecture"
	| "complexity"
	| "style"
	| "tests"
	| "dead_code"
	| "duplication";
```

**Step 3: Verify type compiles**

Run: `npm run build`

Expected: Compiles successfully (no new errors)

**Step 4: Commit**

```bash
git add clients/dispatch/types.ts
git commit -m "types: add tdrCategory to Diagnostic for debt tracking"
```

**Verification:**
- [ ] `TDRCategory` type exported
- [ ] `tdrCategory` optional field added to `Diagnostic`
- [ ] Build passes
- [ ] Commit made

---

### Task 2: Add Diagnostic-to-TDR Conversion Helper

**Files:**
- Modify: `clients/metrics-client.ts:1-20`
- Modify: `clients/metrics-client.ts:89-95`

**Step 1: Import TDRCategory from dispatch types**

Add to imports (line 1-8):

```typescript
import type { Diagnostic, TDRCategory } from "./dispatch/types.js";
```

**Step 2: Add convertDiagnosticsToTDREntries function**

Add after the class definition starts (around line 54), before the constructor:

```typescript
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
function severityForCategory(category: TDRCategory): "error" | "warning" | "info" {
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
```

**Step 3: Build and verify**

Run: `npm run build`

Expected: Compiles successfully

**Step 4: Commit**

```bash
git add clients/metrics-client.ts
git commit -m "feat: add diagnostic-to-TDR conversion helper"
```

**Verification:**
- [ ] `convertDiagnosticsToTDREntries` function exported
- [ ] Helper functions `categorizeDiagnostic` and `severityForCategory` exist
- [ ] Build passes
- [ ] Commit made

---

### Task 3: Wire Up TDR Update in Pipeline

**Files:**
- Modify: `clients/pipeline.ts:1-30`
- Modify: `clients/pipeline.ts:165-175`

**Step 1: Add import for conversion helper**

Add to existing imports from metrics-client (around line 23):

```typescript
import {
	type MetricsClient,
	convertDiagnosticsToTDREntries,
} from "./metrics-client.js";
```

**Step 2: Import DispatchResult type**

Add after other type imports (around line 12):

```typescript
import type { DispatchResult } from "./dispatch/types.js";
```

**Step 3: Capture dispatch result and update TDR**

Find the dispatch lint section (around line 165) and modify:

```typescript
	// --- 5. Dispatch lint ---
	phase.start("dispatch_lint");
	dbg(`dispatch: running lint tools for ${filePath}`);

	const piApi: PiAgentAPI = {
		getFlag: getFlag as (flag: string) => boolean | string | undefined,
	};
	
	// Store result to extract diagnostics for TDR
	const dispatchResult: DispatchResult = await dispatchLint(filePath, cwd, piApi);
	const dispatchOutput = dispatchResult.output;

	if (dispatchOutput) {
		output += `\n\n${dispatchOutput}`;
	}

	// Update TDR metrics with diagnostics from dispatch
	if (dispatchResult.diagnostics.length > 0) {
		const tdrEntries = convertDiagnosticsToTDREntries(
			dispatchResult.diagnostics,
		);
		metricsClient.updateTDR(filePath, tdrEntries);
		dbg(
			`tdr: recorded ${tdrEntries.length} categories for ${path.basename(filePath)}`,
		);
	}
```

**Step 4: Fix import for DispatchResult**

The dispatchLint function currently returns `string`. We need to modify the return type. First, check what dispatchLint returns.

Actually, looking at the dispatcher code, `dispatchLint` returns `Promise<string>`. We need a version that returns the full result.

Let's add a new helper function in `clients/dispatch/integration.ts`.

**Modify: `clients/dispatch/integration.ts:75-95`**

Add after the existing `dispatchLint` function:

```typescript
/**
 * Run linting and return full result (including diagnostics for TDR)
 */
export async function dispatchLintWithResult(
	filePath: string,
	cwd: string,
	pi: PiAgentAPI,
): Promise<DispatchResult> {
	const ctx = createDispatchContext(filePath, cwd, pi, sessionBaselines, true);

	const { dispatchForFile } = await import("./dispatcher.js");
	const { getRunnersForKind } = await import("./dispatcher.js");
	const { TOOL_PLANS } = await import("./plan.js");

	const kind = ctx.kind;
	if (!kind) {
		return {
			diagnostics: [],
			blockers: [],
			warnings: [],
			fixed: [],
			output: "",
			hasBlockers: false,
		};
	}

	const plan = TOOL_PLANS[kind];
	if (!plan) {
		return {
			diagnostics: [],
			blockers: [],
			warnings: [],
			fixed: [],
			output: "",
			hasBlockers: false,
		};
	}

	return await dispatchForFile(ctx, plan.groups);
}
```

Also add import for `DispatchResult` at the top of `integration.ts`:

```typescript
import type { DispatchResult } from "./types.js";
```

And export it:

```typescript
export { dispatchLintWithResult };
```

**Step 5: Update pipeline to use dispatchLintWithResult**

Modify the pipeline imports (line 12 in pipeline.ts):

```typescript
import {
	dispatchLint,
	dispatchLintWithResult,
} from "./dispatch/integration.js";
```

Then update the dispatch section to use the new function:

```typescript
	// --- 5. Dispatch lint ---
	phase.start("dispatch_lint");
	dbg(`dispatch: running lint tools for ${filePath}`);

	const piApi: PiAgentAPI = {
		getFlag: getFlag as (flag: string) => boolean | string | undefined,
	};
	
	// Get full dispatch result for TDR tracking
	const dispatchResult = await dispatchLintWithResult(filePath, cwd, piApi);

	if (dispatchResult.output) {
		output += `\n\n${dispatchResult.output}`;
	}

	// Update TDR metrics with diagnostics from dispatch
	if (dispatchResult.diagnostics.length > 0) {
		const tdrEntries = convertDiagnosticsToTDREntries(
			dispatchResult.diagnostics,
		);
		metricsClient.updateTDR(filePath, tdrEntries);
		dbg(
			`tdr: recorded ${tdrEntries.length} categories for ${path.basename(filePath)}`,
		);
	}

	phase.end("dispatch_lint", {
		hasOutput: !!dispatchResult.output,
		diagnosticCount: dispatchResult.diagnostics.length,
	});
```

**Step 6: Build and verify**

Run: `npm run build`

Expected: Compiles successfully

**Step 7: Commit**

```bash
git add clients/pipeline.ts clients/dispatch/integration.ts
git commit -m "feat: wire up TDR tracking in pipeline"
```

**Verification:**
- [ ] `dispatchLintWithResult` exported from integration.ts
- [ ] Pipeline imports and uses new function
- [ ] TDR entries converted and passed to `metricsClient.updateTDR()`
- [ ] Build passes
- [ ] Commit made

---

### Task 4: Add tdrCategory to Existing Runners

**Files:**
- Modify: `clients/dispatch/runners/biome.ts`
- Modify: `clients/dispatch/runners/ruff.ts`
- Modify: `clients/dispatch/runners/ts-lsp.ts`
- Modify: `clients/dispatch/runners/ast-grep-napi.ts`

**Step 1: Update biome runner**

Find where diagnostics are created (around line 100-120) and add tdrCategory:

```typescript
return {
	status: "succeeded",
	diagnostics: findings.map((f) => ({
		id: `biome:${f.ruleId}:${f.line}`,
		message: f.message,
		filePath: ctx.filePath,
		line: f.line,
		column: f.column,
		severity: f.severity,
		semantic: f.severity === "error" ? "blocking" : "warning",
		tool: "biome",
		rule: f.ruleId,
		fixable: f.fixable,
		tdrCategory: f.severity === "error" ? "architecture" : "style",
	})),
	semantic: "warning",
};
```

**Step 2: Update ruff runner**

Similar pattern - add tdrCategory based on rule type:

```typescript
return {
	status: "succeeded",
	diagnostics: violations.map((v) => ({
		id: `ruff:${v.code}:${v.location.row}`,
		message: v.message,
		filePath: ctx.filePath,
		line: v.location.row,
		column: v.location.column,
		severity: "warning",
		semantic: "warning",
		tool: "ruff",
		rule: v.code,
		fixable: v.fix,
		tdrCategory: v.code.startsWith("E") ? "type_errors" : "style",
	})),
	semantic: "warning",
};
```

**Step 3: Update ts-lsp runner**

For type errors, set tdrCategory to "type_errors":

```typescript
return {
	status: "succeeded",
	diagnostics: errors.map((e) => ({
		id: `ts-lsp:${e.code}:${e.line}`,
		message: e.message,
		filePath: ctx.filePath,
		line: e.line,
		column: e.column,
		severity: "error",
		semantic: "blocking",
		tool: "ts-lsp",
		rule: e.code,
		tdrCategory: "type_errors",
	})),
	semantic: "blocking",
};
```

**Step 4: Update ast-grep-napi runner**

For security rules, set tdrCategory to "security":

```typescript
return {
	status: "succeeded",
	diagnostics: securityMatches.map((m) => ({
		id: `ast-grep-napi:${m.ruleId}:${m.line}`,
		message: m.message,
		filePath: ctx.filePath,
		line: m.line,
		column: m.column,
		severity: "error",
		semantic: "blocking",
		tool: "ast-grep-napi",
		rule: m.ruleId,
		tdrCategory: "security",
	})),
	semantic: "blocking",
};
```

**Step 5: Build and verify**

Run: `npm run build`

Expected: Compiles successfully

**Step 6: Commit**

```bash
git add clients/dispatch/runners/
git commit -m "feat: add tdrCategory to runner diagnostics"
```

**Verification:**
- [ ] All 4 runners updated with tdrCategory
- [ ] Build passes
- [ ] Commit made

---

### Task 5: Test TDR Integration

**Files:**
- Create: `clients/metrics-client.tdr.test.ts`

**Step 1: Write failing test for TDR conversion**

```typescript
import { describe, expect, test } from "vitest";
import {
	convertDiagnosticsToTDREntries,
	type TDREntry,
} from "./metrics-client.js";
import type { Diagnostic } from "./dispatch/types.js";

describe("TDR conversion", () => {
	test("converts type errors to TDR entries", () => {
		const diagnostics: Diagnostic[] = [
			{
				id: "ts-lsp:TS2345:10",
				message: "Argument of type 'string' is not assignable",
				filePath: "/test/file.ts",
				line: 10,
				column: 5,
				severity: "error",
				semantic: "blocking",
				tool: "ts-lsp",
				rule: "TS2345",
				tdrCategory: "type_errors",
			},
		];

		const entries = convertDiagnosticsToTDREntries(diagnostics);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual({
			category: "type_errors",
			count: 1,
			severity: "error",
		});
	});

	test("groups multiple diagnostics by category", () => {
		const diagnostics: Diagnostic[] = [
			{
				id: "1",
				message: "Type error 1",
				filePath: "/test.ts",
				severity: "error",
				semantic: "blocking",
				tool: "ts-lsp",
				tdrCategory: "type_errors",
			},
			{
				id: "2",
				message: "Type error 2",
				filePath: "/test.ts",
				severity: "error",
				semantic: "blocking",
				tool: "ts-lsp",
				tdrCategory: "type_errors",
			},
			{
				id: "3",
				message: "Security issue",
				filePath: "/test.ts",
				severity: "error",
				semantic: "blocking",
				tool: "ast-grep-napi",
				tdrCategory: "security",
			},
		];

		const entries = convertDiagnosticsToTDREntries(diagnostics);

		expect(entries).toHaveLength(2);
		expect(entries.find((e) => e.category === "type_errors")?.count).toBe(2);
		expect(entries.find((e) => e.category === "security")?.count).toBe(1);
	});

	test("auto-categorizes diagnostics without tdrCategory", () => {
		const diagnostics: Diagnostic[] = [
			{
				id: "1",
				message: "Unused variable",
				filePath: "/test.ts",
				severity: "warning",
				semantic: "warning",
				tool: "biome",
				rule: "no-unused",
			},
		];

		const entries = convertDiagnosticsToTDREntries(diagnostics);

		expect(entries).toHaveLength(1);
		expect(entries[0].category).toBe("dead_code");
	});
});
```

**Step 2: Run test to verify it fails (TDD)**

Run: `npm test metrics-client.tdr.test.ts`

Expected: Tests fail because implementation not complete yet

**Step 3: Run test to verify it passes**

Run: `npm test metrics-client.tdr.test.ts`

Expected: 3 tests passing

**Step 4: Commit**

```bash
git add clients/metrics-client.tdr.test.ts
git commit -m "test: add TDR conversion tests"
```

**Verification:**
- [ ] Test file created
- [ ] Tests fail first (TDD), then pass
- [ ] All 3 test cases covered
- [ ] Commit made

---

### Task 6: Update Session Summary to Show TDR

**Files:**
- Modify: `clients/metrics-client.ts:240-290`

**Step 1: Enhance formatSessionSummary to include TDR breakdown**

Modify the TDR section in `formatSessionSummary()` (around line 240):

```typescript
		// Technical Debt Index with breakdown
		if (totalTdrCurrent > 0 || totalTdrStart > 0) {
			const delta = totalTdrCurrent - totalTdrStart;
			const deltaStr =
				delta !== 0
					? ` (${delta > 0 ? "📈 +" : "📉 "}${delta.toFixed(1)} this session)`
					: "";
			parts.push(
				`[TDR Index] Total Debt: ${totalTdrCurrent.toFixed(1)}${deltaStr}`,
			);

			// Show breakdown by category
			const categoryTotals = new Map<string, number>();
			for (const [filePath, entries] of this.tdrFindings) {
				if (this.fileSessionWrites.has(filePath)) {
					for (const entry of entries) {
						categoryTotals.set(
							entry.category,
							(categoryTotals.get(entry.category) ?? 0) + entry.count,
						);
					}
				}
			}

			if (categoryTotals.size > 0) {
				const sortedCategories = Array.from(categoryTotals.entries()).sort(
					(a, b) => b[1] - a[1],
				);
				for (const [category, count] of sortedCategories.slice(0, 5)) {
					const emoji =
						{
							type_errors: "🔴",
							security: "🔒",
							architecture: "🏗️",
							complexity: "🧠",
							style: "🎨",
							tests: "🧪",
							dead_code: "🗑️",
							duplication: "📋",
						}[category] || "📊";
					parts.push(`  ${emoji} ${category}: ${count}`);
				}
			}
		}
```

**Step 2: Build and verify**

Run: `npm run build`

Expected: Compiles successfully

**Step 3: Commit**

```bash
git add clients/metrics-client.ts
git commit -m "feat: enhance session summary with TDR breakdown"
```

**Verification:**
- [ ] TDR breakdown shows by category with emojis
- [ ] Top 5 categories displayed
- [ ] Build passes
- [ ] Commit made

---

### Task 7: Final Integration Test

**Files:**
- Test: Run full pipeline test

**Step 1: Build everything**

Run: `npm run build`

Expected: Compiles successfully with no errors

**Step 2: Run all tests**

Run: `npm test`

Expected: All tests pass (including new TDR tests)

**Step 3: Manual verification**

Create a test file with issues:

```bash
echo "const x: string = 123;" > /tmp/test-tdr.ts
```

Run pi-lens and check that TDR is recorded in the session summary.

**Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat: complete TDR integration - diagnostics now track technical debt"
```

**Verification:**
- [ ] Full build passes
- [ ] All tests pass
- [ ] TDR appears in session summary
- [ ] Final commit made

---

## Summary

**Changes Made:**
1. Added `tdrCategory` field to `Diagnostic` type
2. Created `convertDiagnosticsToTDREntries()` helper
3. Added `dispatchLintWithResult()` for full result access
4. Wired up TDR tracking in pipeline
5. Updated 4 runners with tdrCategory
6. Added TDR tests
7. Enhanced session summary with TDR breakdown

**Result:** Dispatch runner diagnostics now flow into Technical Debt Ratio tracking. Session summaries show debt trends by category.

---

**Execution:** Use superpowers:subagent-driven-development
