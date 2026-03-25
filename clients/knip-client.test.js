import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KnipClient } from "./knip-client.js";
import { setupTestEnvironment } from "./test-utils.js";
describe("KnipClient", () => {
    let client;
    let tmpDir;
    let cleanup;
    beforeEach(() => {
        client = new KnipClient();
        ({ tmpDir, cleanup } = setupTestEnvironment("pi-lens-knip-test-"));
    });
    afterEach(() => {
        cleanup();
    });
    afterEach(() => {
        cleanup();
    });
    describe("isAvailable", () => {
        it("should check knip availability", () => {
            const available = client.isAvailable();
            expect(typeof available).toBe("boolean");
        });
    });
    describe("analyze", () => {
        it("should return success=false when not available", () => {
            const mockClient = new KnipClient();
            if (mockClient.isAvailable())
                return;
            const result = mockClient.analyze(tmpDir);
            expect(result.success).toBe(false);
        });
    });
    describe("formatResult", () => {
        it("should return empty string for no issues", () => {
            const result = {
                success: true,
                issues: [],
                unusedExports: [],
                unusedFiles: [],
                unusedDeps: [],
                unlistedDeps: [],
                summary: "",
            };
            expect(client.formatResult(result)).toBe("");
        });
        it("should format unused exports", () => {
            const result = {
                success: true,
                issues: [
                    { type: "export", name: "unusedFunc", file: "utils.ts" },
                ],
                unusedExports: [
                    { type: "export", name: "unusedFunc", file: "utils.ts" },
                ],
                unusedFiles: [],
                unusedDeps: [],
                unlistedDeps: [],
                summary: "Found 1 issue",
            };
            const formatted = client.formatResult(result);
            expect(formatted).toContain("Knip");
            expect(formatted).toContain("unusedFunc");
        });
        it("should format unused dependencies", () => {
            const result = {
                success: true,
                issues: [{ type: "dependency", name: "lodash" }],
                unusedExports: [],
                unusedFiles: [],
                unusedDeps: [{ type: "dependency", name: "lodash" }],
                unlistedDeps: [],
                summary: "",
            };
            const formatted = client.formatResult(result);
            expect(formatted).toContain("lodash");
            expect(formatted).toContain("unused dep");
        });
        it("should show unlisted dependencies count", () => {
            const result = {
                success: true,
                issues: [{ type: "unlisted", name: "axios" }],
                unusedExports: [],
                unusedFiles: [],
                unusedDeps: [],
                unlistedDeps: [{ type: "unlisted", name: "axios" }],
                summary: "",
            };
            const formatted = client.formatResult(result);
            expect(formatted).toContain("unlisted dep");
        });
        it("should format multiple issue types", () => {
            const result = {
                success: true,
                issues: [
                    { type: "export", name: "func1", file: "a.ts" },
                    { type: "file", name: "old.ts" },
                ],
                unusedExports: [
                    { type: "export", name: "func1", file: "a.ts" },
                    { type: "export", name: "func2", file: "b.ts" },
                ],
                unusedFiles: [{ type: "file", name: "old.ts" }],
                unusedDeps: [],
                unlistedDeps: [],
                summary: "",
            };
            const formatted = client.formatResult(result);
            expect(formatted).toContain("2 unused export(s)");
            expect(formatted).toContain("1 unused file(s)");
        });
    });
});
