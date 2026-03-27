import * as nodeFs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AstGrepClient } from "../clients/ast-grep-client.js";
import type { BiomeClient } from "../clients/biome-client.js";
import type { ComplexityClient } from "../clients/complexity-client.js";
import type { JscpdClient } from "../clients/jscpd-client.js";
import type { KnipClient } from "../clients/knip-client.js";
import type { RuffClient } from "../clients/ruff-client.js";
import { shouldIgnoreFile } from "../clients/scan-utils.js";

const getExtensionDir = () => {
	if (typeof __dirname !== "undefined") {
		return __dirname;
	}
	return ".";
};

const DEBUG_LOG = path.join(process.env.HOME || process.env.USERPROFILE || ".", "pi-lens-debug.log");
function dbg(msg: string) {
	const line = `[${new Date().toISOString()}] ${msg}\n`;
	try {
		nodeFs.appendFileSync(DEBUG_LOG, line);
	} catch (e) {
		// Ignored
	}
}

export async function handleFix(
	args: string,
	ctx: ExtensionContext,
	clients: {
		tsClient: any;
		astGrep: AstGrepClient;
		ruff: RuffClient;
		biome: BiomeClient;
		knip: KnipClient;
		jscpd: JscpdClient;
		complexity: ComplexityClient;
	},
	pi: ExtensionAPI,
	ruleActions: Record<string, { type: string; note: string }>,
) {
	const resetRequested = args.includes("--reset");
	const targetPath = args.replace("--reset", "").trim() || ctx.cwd || process.cwd();

	const sessionFile = path.join(process.cwd(), ".pi-lens", "fix-session.json");
	const configPath = path.join(getExtensionDir(), "..", "rules", "ast-grep-rules", ".sgconfig.yml");

	if (resetRequested) {
		try {
			nodeFs.unlinkSync(sessionFile);
		} catch {
			void 0;
		}
		ctx.ui.notify("🔄 Fix session reset.", "info");
	}

	ctx.ui.notify("🔧 Running booboo fix loop...", "info");

	const MAX_ITERATIONS = 10;
	const isTsProject = nodeFs.existsSync(path.join(targetPath, "tsconfig.json"));
	dbg(`booboo-fix: isTsProject=${isTsProject}`);

	let session: { iteration: number; counts: Record<string, number> } = {
		iteration: 0,
		counts: {},
	};
	try {
		session = JSON.parse(nodeFs.readFileSync(sessionFile, "utf-8"));
	} catch (e) {
		dbg(`fix-session load failed: ${e}`);
	}
	session.iteration++;

	const prevCounts = { ...session.counts };

	// --- Step 1: Auto-fix with Biome + Ruff ---
	let biomeRan = false;
	if (!pi.getFlag("no-biome") && clients.biome.isAvailable()) {
		childProcess.spawnSync("npx", ["@biomejs/biome", "check", "--write", "--unsafe", targetPath], {
			encoding: "utf-8",
			timeout: 30000,
			shell: true,
		});
		biomeRan = true;
	}
	let ruffRan = false;
	if (!pi.getFlag("no-ruff") && clients.ruff.isAvailable()) {
		childProcess.spawnSync("ruff", ["check", "--fix", targetPath], {
			encoding: "utf-8",
			timeout: 15000,
			shell: true,
		});
		childProcess.spawnSync("ruff", ["format", targetPath], {
			encoding: "utf-8",
			timeout: 15000,
			shell: true,
		});
		ruffRan = true;
	}

	// --- Step 2: Duplicate code (jscpd) ---
	const dupClones: any[] = [];
	if (clients.jscpd.isAvailable()) {
		const jscpdResult = clients.jscpd.scan(targetPath);
		const clones = jscpdResult.clones.filter((c) => {
			if (isTsProject && (c.fileA.endsWith(".js") || c.fileB.endsWith(".js"))) return false;
			return path.resolve(c.fileA) === path.resolve(c.fileB);
		});
		dupClones.push(...clones);
	}

	// --- Step 3: Dead code (knip) ---
	const deadCodeIssues: any[] = [];
	if (clients.knip.isAvailable()) {
		const knipResult = clients.knip.analyze(targetPath);
		const filtered = knipResult.issues.filter((i) => {
			if (!i.file) return true;
			return !shouldIgnoreFile(i.file, isTsProject);
		});
		deadCodeIssues.push(...filtered);
	}

	// --- Step 4: ast-grep scan ---
	const astIssues: any[] = [];
	if (clients.astGrep.isAvailable()) {
		const result = childProcess.spawnSync(
			"npx",
			[
				"sg",
				"scan",
				"--config",
				configPath,
				"--json",
				"--globs",
				"!**/*.test.ts",
				"--globs",
				"!**/*.spec.ts",
				"--globs",
				"!**/test-utils.ts",
				"--globs",
				"!**/.pi-lens/**",
				...(isTsProject ? ["--globs", "!**/*.js"] : []),
				targetPath,
			],
			{
				encoding: "utf-8",
				timeout: 30000,
				shell: true,
				maxBuffer: 32 * 1024 * 1024,
			},
		);

		const raw = result.stdout?.trim() ?? "";
		const items: any[] = raw.startsWith("[")
			? (() => {
					try {
						return JSON.parse(raw);
					} catch (e) {
						return [];
					}
				})()
			: raw.split("\n").flatMap((l: string) => {
					try {
						return [JSON.parse(l)];
					} catch (err) {
						return [];
					}
				});

		for (const item of items) {
			const rule = item.ruleId || item.rule?.title || item.name || "unknown";
			const line = (item.labels?.[0]?.range?.start?.line ?? item.range?.start?.line ?? 0) + 1;
			const relFile = path.relative(targetPath, item.file ?? "").replace(/\\/g, "/");

			if (shouldIgnoreFile(relFile, isTsProject)) continue;

			astIssues.push({ rule, file: relFile, line, message: item.message ?? rule });
		}
	}

	// --- Step 5: AI slop ---
	const slopFiles: Array<{ file: string; warnings: string[] }> = [];
	const slopScanDir = (dir: string) => {
		if (!nodeFs.existsSync(dir)) return;
		for (const entry of nodeFs.readdirSync(dir, { withFileTypes: true })) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (["node_modules", ".git", "dist", "build", ".next", ".pi-lens"].includes(entry.name)) continue;
				slopScanDir(fullPath);
			} else if (clients.complexity.isSupportedFile(fullPath)) {
				const metrics = clients.complexity.analyzeFile(fullPath);
				if (metrics) {
					const warnings = clients.complexity
						.checkThresholds(metrics)
						.filter(
							(w) =>
								w.includes("AI-style") ||
								w.includes("try/catch") ||
								w.includes("single-use") ||
								w.includes("Excessive comments"),
						);
					const relFile = path.relative(targetPath, fullPath).replace(/\\/g, "/");
					if (shouldIgnoreFile(relFile, isTsProject)) continue;
					if (warnings.length >= 2) {
						slopFiles.push({ file: relFile, warnings });
					}
				}
			}
		}
	};
	slopScanDir(targetPath);

	// --- Step 6: Remaining Biome lint ---
	const remainingBiome: any[] = [];
	if (!pi.getFlag("no-biome") && clients.biome.isAvailable()) {
		const checkResult = childProcess.spawnSync(
			"npx",
			["@biomejs/biome", "check", "--reporter=json", "--max-diagnostics=50", targetPath],
			{ encoding: "utf-8", timeout: 20000, shell: true },
		);
		try {
			const data = JSON.parse(checkResult.stdout ?? "{}");
			for (const diag of (data.diagnostics ?? []).slice(0, 20)) {
				if (!diag.category?.startsWith("lint/")) continue;
				const filePath = diag.location?.path?.file ?? "";
				const line = diag.location?.span?.start?.line ?? 0;
				const rule = diag.category ?? "lint";
				remainingBiome.push({
					file: path.relative(targetPath, filePath).replace(/\\/g, "/"),
					line: line + 1,
					rule,
					message: diag.message ?? rule,
				});
			}
		} catch (e) {
			dbg(`biome lint parse failed: ${e}`);
		}
	}

	const agentTasks: any[] = [];
	const skipRules = new Map<string, { note: string; count: number }>();
	const byRule = new Map<string, any[]>();
	for (const issue of astIssues) {
		const list = byRule.get(issue.rule) ?? [];
		list.push(issue);
		byRule.set(issue.rule, list);
	}
	for (const [rule, issues] of byRule) {
		const action = ruleActions[rule];
		if (!action || action.type === "agent" || action.type === "biome") {
			agentTasks.push(...issues);
		} else if (action.type === "skip") {
			skipRules.set(rule, { note: action.note, count: issues.length });
		}
	}

	const currentCounts = {
		duplicates: dupClones.length,
		dead_code: deadCodeIssues.length,
		agent_ast: agentTasks.length,
		biome_lint: remainingBiome.length,
		slop_files: slopFiles.length,
	};
	session.counts = currentCounts;
	nodeFs.mkdirSync(path.dirname(sessionFile), { recursive: true });
	nodeFs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), "utf-8");

	const totalFixable =
		dupClones.length + deadCodeIssues.length + agentTasks.length + remainingBiome.length + slopFiles.length;
	if (totalFixable === 0) {
		const msg = `✅ BOOBOO FIX LOOP COMPLETE — No more fixable issues found after ${session.iteration} iteration(s).\n\nRemaining skipped items are architectural — see /lens-booboo for full report.`;
		ctx.ui.notify(msg, "info");
		try {
			nodeFs.unlinkSync(sessionFile);
		} catch {
			void 0;
		}
		return;
	}

	if (session.iteration > MAX_ITERATIONS) {
		try {
			nodeFs.unlinkSync(sessionFile);
		} catch {
			void 0;
		}
		ctx.ui.notify(
			`⛔ Max iterations (${MAX_ITERATIONS}) reached. Session reset — run /lens-booboo-fix again for a fresh loop, or /lens-booboo for a full report.`,
			"warning",
		);
		return;
	}

	let deltaLine = "";
	if (session.iteration > 1 && Object.keys(prevCounts).length > 0) {
		const prevTotal = Object.values(prevCounts).reduce((a, b) => a + b, 0);
		const fixed = prevTotal - totalFixable;
		deltaLine =
			fixed > 0
				? `✅ Fixed ${fixed} issues since last iteration.`
				: `⚠️ No change since last iteration — check if fixes were applied.`;
	}

	const lines: string[] = [];
	lines.push(`📋 BOOBOO FIX PLAN — Iteration ${session.iteration}/${MAX_ITERATIONS} (${totalFixable} fixable items remaining)`);
	if (deltaLine) lines.push(deltaLine);
	lines.push("");

	if (biomeRan || ruffRan) {
		lines.push(
			`⚡ Auto-fixed: ${[biomeRan && "Biome --write --unsafe", ruffRan && "Ruff --fix + format"].filter(Boolean).join(", ")} already ran.`,
		);
		lines.push("");
	}

	if (dupClones.length > 0) {
		lines.push(`## 🔁 Duplicate code [${dupClones.length} block(s)] — fix first`);
		lines.push("→ Extract duplicated blocks into shared utilities before fixing violations in them.");
		for (const clone of dupClones.slice(0, 10)) {
			const relA = path.relative(targetPath, clone.fileA).replace(/\\/g, "/");
			const relB = path.relative(targetPath, clone.fileB).replace(/\\/g, "/");
			lines.push(`  - ${clone.lines} lines: \`${relA}:${clone.startA}\` ↔ \`${relB}:${clone.startB}\``);
		}
		if (dupClones.length > 10) lines.push(`  ... and ${dupClones.length - 10} more`);
		lines.push("");
	}

	if (deadCodeIssues.length > 0) {
		lines.push(`## 🗑️ Dead code [${deadCodeIssues.length} item(s)] — delete before fixing violations`);
		lines.push("→ Remove unused exports/files — no point fixing violations in code you're about to delete.");
		for (const issue of deadCodeIssues.slice(0, 10)) {
			lines.push(`  - [${issue.type}] \`${issue.name}\`${issue.file ? ` in ${issue.file}` : ""}`);
		}
		if (deadCodeIssues.length > 10) lines.push(`  ... and ${deadCodeIssues.length - 10} more`);
		lines.push("");
	}

	if (agentTasks.length > 0) {
		lines.push(`## 🔨 Fix these [${agentTasks.length} items]`);
		lines.push("");
		const groupedAgent = new Map<string, any[]>();
		for (const t of agentTasks) {
			const g = groupedAgent.get(t.rule) ?? [];
			g.push(t);
			groupedAgent.set(t.rule, g);
		}
		for (const [rule, issues] of groupedAgent) {
			const action = ruleActions[rule];
			const note = action?.note ?? "Fix this violation";
			lines.push(`### ${rule} (${issues.length})`);
			lines.push(`→ ${note}`);
			for (const issue of issues.slice(0, 15)) {
				lines.push(`  - \`${issue.file}:${issue.line}\``);
			}
			if (issues.length > 15) lines.push(`  ... and ${issues.length - 15} more`);
			lines.push("");
		}
	}

	if (remainingBiome.length > 0) {
		lines.push(`## 🟠 Remaining Biome lint [${remainingBiome.length} items]`);
		lines.push("→ These couldn't be auto-fixed by Biome --unsafe. Fix each one manually:");
		for (const d of remainingBiome.slice(0, 10)) {
			lines.push(`  - \`${d.file}:${d.line}\` [${d.rule}] ${d.message}`);
		}
		if (remainingBiome.length > 10) lines.push(`  ... and ${remainingBiome.length - 10} more`);
		lines.push("");
	}

	if (slopFiles.length > 0) {
		lines.push(`## 🤖 AI Slop indicators [${slopFiles.length} files]`);
		for (const { file, warnings } of slopFiles.slice(0, 10)) {
			lines.push(`  - \`${file}\`: ${warnings.map((w) => w.split(" — ")[0]).join(", ")}`);
		}
		if (slopFiles.length > 10) lines.push(`  ... and ${slopFiles.length - 10} more`);
		lines.push("");
	}

	if (skipRules.size > 0) {
		lines.push(`## ⏭️ Skip [${[...skipRules.values()].reduce((a, b) => a + b.count, 0)} items — architectural]`);
		for (const [rule, { note, count }] of skipRules) {
			lines.push(`  - **${rule}** (${count}): ${note}`);
		}
		lines.push("");
	}

	lines.push("---");
	lines.push(
		"**ACTION REQUIRED**: Fix the items above in order using your available tools. Once all fixable items are resolved, you MUST run `/lens-booboo-fix` again to verify and proceed to the next iteration.",
	);
	lines.push("If an item is not safe to fix, skip it with a one-sentence explanation of the risk.");

	const fixPlan = lines.join("\n");
	const planPath = path.join(process.cwd(), ".pi-lens", "fix-plan.md");
	nodeFs.writeFileSync(planPath, `# Fix Plan — Iteration ${session.iteration}\n\n${fixPlan}`, "utf-8");
	ctx.ui.notify(`📄 Fix plan saved: ${planPath}`, "info");

	pi.sendUserMessage(fixPlan, { deliverAs: "followUp" });
}
