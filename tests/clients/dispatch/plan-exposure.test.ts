import { describe, expect, it } from "vitest";
import { FULL_LINT_PLANS, TOOL_PLANS } from "../../../clients/dispatch/plan.js";

function flattenRunnerIds(plan: { groups: Array<{ runnerIds: string[] }> }): string[] {
	return plan.groups.flatMap((g) => g.runnerIds);
}

describe("dispatch plan exposure", () => {
	it("keeps write-path plan blocker-focused for jsts", () => {
		const ids = flattenRunnerIds(TOOL_PLANS.jsts);

		expect(ids).toContain("lsp");
		expect(ids).toContain("tree-sitter");
		expect(ids).toContain("ast-grep-napi");
		expect(ids).not.toContain("biome-lint");
		expect(ids).not.toContain("oxlint");
	});

	it("exposes warning-heavy linters in full plan for jsts/python", () => {
		const jstsIds = flattenRunnerIds(FULL_LINT_PLANS.jsts);
		const pythonIds = flattenRunnerIds(FULL_LINT_PLANS.python);

		expect(jstsIds).toContain("biome-lint");
		expect(jstsIds).toContain("oxlint");
		expect(pythonIds).toContain("ruff-lint");
		expect(pythonIds).toContain("python-slop");
	});
});
