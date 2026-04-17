import * as path from "node:path";
import { safeSpawnAsync } from "../../safe-spawn.js";
import { createAvailabilityChecker } from "./utils/runner-helpers.js";
import type {
	Diagnostic,
	DispatchContext,
	RunnerDefinition,
	RunnerResult,
} from "../types.js";
import { PRIORITY } from "../priorities.js";

const dart = createAvailabilityChecker("dart", ".exe");

// dart analyze --format=machine output:
// severity|type|code|file|line|col|length|message
function parseDartMachineOutput(raw: string, filePath: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const line of raw.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const parts = line.split("|");
		if (parts.length < 8) continue;

		const [severityStr, , code, file, lineStr, colStr, , ...messageParts] = parts;
		const message = messageParts.join("|").trim();
		const lineNum = parseInt(lineStr, 10);
		const colNum = parseInt(colStr, 10);

		// Only include diagnostics for the target file
		if (file && !path.resolve(file).endsWith(path.resolve(filePath).replace(/\\/g, "/"))) {
			const resolvedFile = path.resolve(file.trim());
			const resolvedTarget = path.resolve(filePath);
			if (resolvedFile !== resolvedTarget) continue;
		}

		const severity = severityStr?.trim().toLowerCase() === "error" ? "error" : "warning";
		diagnostics.push({
			id: `dart-${code?.trim()}-${lineNum}-${colNum}`,
			message: `[${code?.trim()}] ${message}`,
			filePath,
			line: lineNum || 1,
			column: colNum || 1,
			severity,
			semantic: severity === "error" ? "blocking" : "warning",
			tool: "dart",
			rule: code?.trim() ?? "dart",
			fixable: false,
		});
	}
	return diagnostics;
}

const dartAnalyzeRunner: RunnerDefinition = {
	id: "dart-analyze",
	appliesTo: ["dart"],
	priority: PRIORITY.GENERAL_ANALYSIS,
	enabledByDefault: true,
	skipTestFiles: false,

	async run(ctx: DispatchContext): Promise<RunnerResult> {
		const cwd = ctx.cwd || process.cwd();

		if (!dart.isAvailable(cwd)) {
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		const cmd = dart.getCommand(cwd)!;
		const absPath = path.resolve(cwd, ctx.filePath);

		const result = await safeSpawnAsync(
			cmd,
			["analyze", "--format=machine", absPath],
			{ cwd, timeout: 30000 },
		);

		if (result.error && !result.stdout && !result.stderr) {
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		// dart analyze writes diagnostics to stderr in machine format
		const raw = (result.stderr || "") + (result.stdout || "");
		const diagnostics = parseDartMachineOutput(raw, ctx.filePath);

		if (diagnostics.length === 0) {
			return { status: "succeeded", diagnostics: [], semantic: "none" };
		}

		const hasErrors = diagnostics.some((d) => d.severity === "error");
		return {
			status: hasErrors ? "failed" : "succeeded",
			diagnostics,
			semantic: hasErrors ? "blocking" : "warning",
		};
	},
};

export default dartAnalyzeRunner;
