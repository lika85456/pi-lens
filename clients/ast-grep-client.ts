/**
 * AstGrep Client for pi-autofeedback
 *
 * Structural code analysis using ast-grep CLI.
 * Scans files against YAML rule definitions.
 *
 * Requires: npm install -D @ast-grep/cli
 * Rules: ./rules/ directory
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

// --- Types ---

export interface AstGrepDiagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  rule: string;
  file: string;
  fix?: string;
}

interface AstGrepJsonDiagnostic {
  Message: {
    text: string;
  };
  Severity: string;
  spans: Array<{
    context: string;
    range: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    file: string;
  }>;
  name: string;
  severity: string;
}

// --- Client ---

export class AstGrepClient {
  private available: boolean | null = null;
  private ruleDir: string;
  private log: (msg: string) => void;

  constructor(ruleDir?: string, verbose = false) {
    this.ruleDir = ruleDir || path.join(__dirname, "..", "rules");
    this.log = verbose
      ? (msg: string) => console.log(`[ast-grep] ${msg}`)
      : () => {};
  }

  /**
   * Check if ast-grep CLI is available
   */
  isAvailable(): boolean {
    if (this.available !== null) return this.available;

    const result = spawnSync("npx", ["sg", "--version"], {
      encoding: "utf-8",
      timeout: 10000,
      shell: true,
    });

    this.available = !result.error && result.status === 0;
    if (this.available) {
      this.log("ast-grep available");
    }

    return this.available;
  }

  /**
   * Scan a file against all rules
   */
  scanFile(filePath: string): AstGrepDiagnostic[] {
    if (!this.isAvailable()) return [];

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) return [];

    const configPath = path.join(this.ruleDir, ".sgconfig.yml");

    try {
      const result = spawnSync("npx", [
        "sg",
        "scan",
        "--config", configPath,
        "--json",
        absolutePath,
      ], {
        encoding: "utf-8",
        timeout: 15000,
        shell: true,
      });

      // ast-grep exits 1 when it finds issues
      const output = result.stdout || result.stderr || "";
      if (!output.trim()) return [];

      return this.parseOutput(output, absolutePath);
    } catch (err: any) {
      this.log(`Scan error: ${err.message}`);
      return [];
    }
  }

  /**
   * Format diagnostics for LLM consumption
   */
  formatDiagnostics(diags: AstGrepDiagnostic[]): string {
    if (diags.length === 0) return "";

    const errors = diags.filter(d => d.severity === "error");
    const warnings = diags.filter(d => d.severity === "warning");

    let output = `[ast-grep] ${diags.length} structural issue(s)`;
    if (errors.length) output += ` — ${errors.length} error(s)`;
    if (warnings.length) output += ` — ${warnings.length} warning(s)`;
    output += ":\n";

    for (const d of diags.slice(0, 15)) {
      const loc = d.line === d.endLine
        ? `L${d.line}`
        : `L${d.line}-${d.endLine}`;
      const fix = d.fix ? " [fixable]" : "";
      output += `  [${d.rule}] ${loc} ${d.message}${fix}\n`;
    }

    if (diags.length > 15) {
      output += `  ... and ${diags.length - 15} more\n`;
    }

    return output;
  }

  // --- Internal ---

  private parseOutput(output: string, filterFile: string): AstGrepDiagnostic[] {
    const diagnostics: AstGrepDiagnostic[] = [];

    // Parse ndjson (one JSON object per line)
    const lines = output.split("\n").filter(l => l.trim());

    for (const line of lines) {
      try {
        const item: AstGrepJsonDiagnostic = JSON.parse(line);
        if (!item.spans || item.spans.length === 0) continue;

        const span = item.spans[0];
        const filePath = path.resolve(span.file || filterFile);

        // Filter to our file
        if (filePath !== path.resolve(filterFile)) continue;

        const start = span.range?.start || { line: 0, column: 0 };
        const end = span.range?.end || start;

        diagnostics.push({
          line: start.line,
          column: start.column,
          endLine: end.line,
          endColumn: end.column,
          severity: this.mapSeverity(item.severity || item.Severity),
          message: item.Message?.text || "Unknown issue",
          rule: item.name || "unknown",
          file: filePath,
        });
      } catch {
        // Skip unparseable lines
      }
    }

    return diagnostics;
  }

  private mapSeverity(severity: string): AstGrepDiagnostic["severity"] {
    const lower = severity.toLowerCase();
    if (lower === "error") return "error";
    if (lower === "warning") return "warning";
    if (lower === "info") return "info";
    return "hint";
  }
}
