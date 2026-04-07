import { describe, expect, it } from "vitest";
import { getDispatchGroupsForKind } from "../../../clients/dispatch/integration.js";

	describe("dispatch integration groups", () => {
	it("prepends lsp group when lens-lsp is enabled and plan lacks lsp", () => {
		const groups = getDispatchGroupsForKind("cxx", {
			getFlag: (name: string) => name === "lens-lsp",
		});

		expect(groups.length).toBeGreaterThan(0);
		expect(groups[0].runnerIds).toEqual(["lsp"]);
		expect(groups[0].filterKinds).toEqual(["cxx"]);
	});

	it("does not duplicate lsp group when plan already includes lsp", () => {
		const groups = getDispatchGroupsForKind("python", {
			getFlag: (name: string) => name === "lens-lsp",
		});

		const lspGroups = groups.filter((g) => g.runnerIds.includes("lsp"));
		expect(lspGroups).toHaveLength(1);
	});

	it("keeps original groups when lens-lsp is disabled", () => {
		const groups = getDispatchGroupsForKind("cxx", {
			getFlag: () => false,
		});

		expect(groups).toEqual([]);
	});
});
