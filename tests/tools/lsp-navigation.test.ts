import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
	service: null as unknown,
}));

vi.mock("../../clients/lsp/index.js", () => ({
	getLSPService: () => mocked.service,
}));

import { createLspNavigationTool } from "../../tools/lsp-navigation.js";

describe("lsp_navigation tool", () => {
	beforeEach(() => {
		mocked.service = {
			hasLSP: vi.fn().mockResolvedValue(true),
			openFile: vi.fn().mockResolvedValue(undefined),
			getOperationSupport: vi.fn().mockResolvedValue(null),
			workspaceSymbol: vi.fn().mockResolvedValue([]),
			incomingCalls: vi.fn().mockResolvedValue([]),
			outgoingCalls: vi.fn().mockResolvedValue([]),
			getAllDiagnostics: vi.fn().mockResolvedValue(new Map()),
			getWorkspaceDiagnosticsSupport: vi
				.fn()
				.mockResolvedValue({ mode: "push-only" }),
		};
	});

	it("allows incomingCalls without filePath when callHierarchyItem exists", async () => {
		const tool = createLspNavigationTool((flag) => flag === "lens-lsp");
		const callHierarchyItem = {
			name: "foo",
			kind: 12,
			uri: "file:///tmp/a.py",
			range: {
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 },
			},
			selectionRange: {
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 },
			},
		};

		const result = await tool.execute(
			"1",
			{ operation: "incomingCalls", callHierarchyItem },
			new AbortController().signal,
			null,
			{ cwd: "." },
		);

		expect(result.isError).toBeUndefined();
		expect((mocked.service as { incomingCalls: ReturnType<typeof vi.fn> }).incomingCalls).toHaveBeenCalledOnce();
		expect(result.details?.operation).toBe("incomingCalls");
	});

	it("adds workspaceSymbol hint when filePath is omitted and empty", async () => {
		const tool = createLspNavigationTool((flag) => flag === "lens-lsp");

		const result = await tool.execute(
			"2",
			{ operation: "workspaceSymbol", query: "ReportProcessor" },
			new AbortController().signal,
			null,
			{ cwd: "." },
		);

		expect(result.isError).toBeUndefined();
		expect(String(result.content[0]?.text)).toContain(
			"Hint: provide filePath to scope workspaceSymbol",
		);
		expect((mocked.service as { workspaceSymbol: ReturnType<typeof vi.fn> }).workspaceSymbol).toHaveBeenCalledWith(
			"ReportProcessor",
			undefined,
		);
	});
});
