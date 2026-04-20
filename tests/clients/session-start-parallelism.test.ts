import { describe, expect, it } from "vitest";

/**
 * Tests that verify ensureAvailable() uses async patterns (non-blocking).
 * 
 * Before the fix: ensureAvailable() used sync spawnSync, blocking the event loop.
 * After the fix: ensureAvailable() uses async safeSpawnAsync, non-blocking.
 */
describe("tool availability async patterns", () => {
	it("ruff-client ensureAvailable should return a Promise", async () => {
		const { RuffClient } = await import("../../clients/ruff-client.js");
		const client = new RuffClient();
		
		const result = client.ensureAvailable();
		expect(result).toBeInstanceOf(Promise);
		// Should resolve to boolean (true if installed, false if not)
		const resolved = await result;
		expect(typeof resolved).toBe("boolean");
	});

	it("biome-client ensureAvailable should return a Promise", async () => {
		const { BiomeClient } = await import("../../clients/biome-client.js");
		const client = new BiomeClient();
		
		const result = client.ensureAvailable();
		expect(result).toBeInstanceOf(Promise);
		const resolved = await result;
		expect(typeof resolved).toBe("boolean");
	});

	it("knip-client ensureAvailable should return a Promise", async () => {
		const { KnipClient } = await import("../../clients/knip-client.js");
		const client = new KnipClient();
		
		const result = client.ensureAvailable();
		expect(result).toBeInstanceOf(Promise);
		const resolved = await result;
		expect(typeof resolved).toBe("boolean");
	});

	it("jscpd-client ensureAvailable should return a Promise", async () => {
		const { JscpdClient } = await import("../../clients/jscpd-client.js");
		const client = new JscpdClient();
		
		const result = client.ensureAvailable();
		expect(result).toBeInstanceOf(Promise);
		const resolved = await result;
		expect(typeof resolved).toBe("boolean");
	});

	it("dependency-checker ensureAvailable should return a Promise", async () => {
		const { DependencyChecker } = await import("../../clients/dependency-checker.js");
		const client = new DependencyChecker();
		
		const result = client.ensureAvailable();
		expect(result).toBeInstanceOf(Promise);
		const resolved = await result;
		expect(typeof resolved).toBe("boolean");
	});

	it("sg-runner ensureAvailable should return a Promise", async () => {
		const { SgRunner } = await import("../../clients/sg-runner.js");
		const client = new SgRunner();
		
		const result = client.ensureAvailable();
		expect(result).toBeInstanceOf(Promise);
		const resolved = await result;
		expect(typeof resolved).toBe("boolean");
	});
});
