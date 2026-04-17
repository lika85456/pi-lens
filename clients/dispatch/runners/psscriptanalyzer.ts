import * as path from "node:path";
import { safeSpawnAsync } from "../../safe-spawn.js";
import type {
	Diagnostic,
	DispatchContext,
	RunnerDefinition,
	RunnerResult,
} from "../types.js";
import { PRIORITY } from "../priorities.js";

interface PSAnalyzerResult {
	RuleName?: string;
	Severity?: string;
	Line?: number;
	Column?: number;
	Message?: string;
	ScriptName?: string;
}

// Cache powershell binary and PSScriptAnalyzer availability per process lifetime
let psCmd: string | null | undefined = undefined; // undefined = not yet resolved
let psAnalyzerAvailable: boolean | undefined = undefined;

async function resolvePowerShellCmd(): Promise<string | null> {
	if (psCmd !== undefined) return psCmd;
	for (const candidate of ["pwsh", "powershell"]) {
		const result = await safeSpawnAsync(candidate, ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], {
			timeout: 5000,
		});
		if (!result.error) {
			psCmd = candidate;
			return psCmd;
		}
	}
	psCmd = null;
	return null;
}

async function isPSScriptAnalyzerAvailable(cmd: string): Promise<boolean> {
	if (psAnalyzerAvailable !== undefined) return psAnalyzerAvailable;
	const result = await safeSpawnAsync(
		cmd,
		[
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"if (Get-Module -ListAvailable PSScriptAnalyzer) { exit 0 } else { exit 1 }",
		],
		{ timeout: 10000 },
	);
	psAnalyzerAvailable = result.status === 0;
	return psAnalyzerAvailable;
}

function parsePSAnalyzerOutput(raw: string, filePath: string): Diagnostic[] {
	if (!raw.trim()) return [];

	let parsed: PSAnalyzerResult | PSAnalyzerResult[];
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	const items = Array.isArray(parsed) ? parsed : [parsed];

	return items
		.filter((item) => item.Message && item.Line)
		.map((item) => {
			const sev = (item.Severity ?? "Warning").toLowerCase();
			const severity: "error" | "warning" | "info" =
				sev === "error" || sev === "parseerror" ? "error" : sev === "information" ? "info" : "warning";
			const rule = item.RuleName ?? "PSScriptAnalyzer";
			return {
				id: `psscriptanalyzer-${rule}-${item.Line}`,
				message: `[${rule}] ${item.Message}`,
				filePath,
				line: item.Line!,
				column: item.Column ?? 1,
				severity,
				semantic: severity === "error" ? "blocking" : "warning",
				tool: "psscriptanalyzer",
				rule,
				fixable: false,
			};
		});
}

const psScriptAnalyzerRunner: RunnerDefinition = {
	id: "psscriptanalyzer",
	appliesTo: ["powershell"],
	priority: PRIORITY.GENERAL_ANALYSIS,
	enabledByDefault: true,
	skipTestFiles: false,

	async run(ctx: DispatchContext): Promise<RunnerResult> {
		const cmd = await resolvePowerShellCmd();
		if (!cmd) return { status: "skipped", diagnostics: [], semantic: "none" };

		if (!(await isPSScriptAnalyzerAvailable(cmd))) {
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		const cwd = ctx.cwd || process.cwd();
		const absPath = path.resolve(cwd, ctx.filePath).replace(/\\/g, "\\\\");

		// Run Invoke-ScriptAnalyzer and emit JSON.
		// @(...) forces array output in PS 5.1 (no -AsArray flag).
		// Severity.ToString() converts the enum integer to a string name.
		const psCommand = `Import-Module PSScriptAnalyzer; @(Invoke-ScriptAnalyzer -Path '${absPath}' | Select-Object RuleName,@{N='Severity';E={$_.Severity.ToString()}},Line,Column,Message) | ConvertTo-Json -Depth 3`;

		const result = await safeSpawnAsync(
			cmd,
			["-NoProfile", "-NonInteractive", "-Command", psCommand],
			{ cwd, timeout: 30000 },
		);

		// Any spawn-level failure (pwsh not on PATH, etc.)
		if (result.error && !result.stdout && !result.stderr) {
			return { status: "skipped", diagnostics: [], semantic: "none" };
		}

		const output = result.stdout || "";
		const diagnostics = parsePSAnalyzerOutput(output, ctx.filePath);

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

export default psScriptAnalyzerRunner;
