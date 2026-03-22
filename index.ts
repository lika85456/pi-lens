/**
 * pi-autofeedback - Real-time code feedback for pi
 *
 * Provides real-time diagnostics on every write/edit:
 * - TypeScript/JavaScript: Biome (lint+format) + TypeScript LSP (type checking)
 * - Python: Ruff (lint+format)
 * - All languages: ast-grep (63 structural rules)
 * - JavaScript/TypeScript: Dependency checker (circular deps)
 *
 * On-demand commands:
 * - /format - Apply Biome formatting
 * - /find-todos - Scan for TODO/FIXME/HACK annotations
 * - /dead-code - Find unused exports/dependencies (requires knip)
 * - /check-deps - Full circular dependency scan (requires madge)
 *
 * External dependencies:
 * - npm: @biomejs/biome, @ast-grep/cli, knip, madge
 * - pip: ruff
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

import { TypeScriptClient } from "./clients/typescript-client.js";
import { AstGrepClient } from "./clients/ast-grep-client.js";
import { RuffClient } from "./clients/ruff-client.js";
import { BiomeClient } from "./clients/biome-client.js";
import { KnipClient } from "./clients/knip-client.js";
import { TodoScanner } from "./clients/todo-scanner.js";
import { DependencyChecker } from "./clients/dependency-checker.js";
import * as path from "node:path";

// --- State ---

let verbose = false;

function log(msg: string) {
  console.log(`[autofeedback] ${msg}`);
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  log("Extension loaded");

  const tsClient = new TypeScriptClient();
  const astGrepClient = new AstGrepClient();
  const ruffClient = new RuffClient();
  const biomeClient = new BiomeClient();
  const knipClient = new KnipClient();
  const todoScanner = new TodoScanner();
  const depChecker = new DependencyChecker();

  // --- Flags ---

  pi.registerFlag("autofeedback-verbose", {
    description: "Enable verbose autofeedback logging",
    type: "boolean",
    default: false,
  });

  pi.registerFlag("no-biome", {
    description: "Disable Biome linting/formatting",
    type: "boolean",
    default: false,
  });

  pi.registerFlag("no-ast-grep", {
    description: "Disable ast-grep structural analysis",
    type: "boolean",
    default: false,
  });

  pi.registerFlag("no-ruff", {
    description: "Disable Ruff Python linting",
    type: "boolean",
    default: false,
  });

  pi.registerFlag("no-lsp", {
    description: "Disable TypeScript LSP",
    type: "boolean",
    default: false,
  });

  // --- Commands ---

  pi.registerCommand("find-todos", {
    description: "Scan for TODO/FIXME/HACK annotations. Usage: /find-todos [path]",
    handler: async (args, ctx) => {
      const targetPath = args.trim() || ctx.cwd || process.cwd();
      ctx.ui.notify("🔍 Scanning for TODOs...", "info");

      const result = todoScanner.scanDirectory(targetPath);
      const report = todoScanner.formatResult(result);

      if (report) {
        ctx.ui.notify(report, "info");
      } else {
        ctx.ui.notify("✓ No TODOs found", "info");
      }
    },
  });

  pi.registerCommand("dead-code", {
    description: "Check for unused exports, files, and dependencies",
    handler: async (args, ctx) => {
      if (!knipClient.isAvailable()) {
        ctx.ui.notify("Knip not installed. Run: npm install -D knip", "error");
        return;
      }

      ctx.ui.notify("🔍 Analyzing for dead code...", "info");
      const result = knipClient.analyze(args.trim() || ctx.cwd);
      const report = knipClient.formatResult(result);

      if (report) {
        ctx.ui.notify(report, "info");
      } else {
        ctx.ui.notify("✓ No dead code found", "info");
      }
    },
  });

  pi.registerCommand("check-deps", {
    description: "Check for circular dependencies in the project",
    handler: async (args, ctx) => {
      if (!depChecker.isAvailable()) {
        ctx.ui.notify("Madge not installed. Run: npm install -D madge", "error");
        return;
      }

      ctx.ui.notify("🔍 Scanning dependencies...", "info");
      const { circular } = depChecker.scanProject(args.trim() || ctx.cwd);
      const report = depChecker.formatScanResult(circular);

      if (report) {
        ctx.ui.notify(report, "warning");
      } else {
        ctx.ui.notify("✓ No circular dependencies found", "info");
      }
    },
  });

  pi.registerCommand("format", {
    description: "Apply Biome formatting to files. Usage: /format [file-path] or /format --all",
    handler: async (args, ctx) => {
      if (!biomeClient.isAvailable()) {
        ctx.ui.notify("Biome not installed. Run: npm install -D @biomejs/biome", "error");
        return;
      }

      const arg = args.trim();

      if (!arg || arg === "--all") {
        ctx.ui.notify("🔍 Formatting all files...", "info");

        let formatted = 0;
        let skipped = 0;

        const formatDir = (dir: string) => {
          if (!require("node:fs").existsSync(dir)) return;
          const entries = require("node:fs").readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
              formatDir(fullPath);
            } else if (/\.(ts|tsx|js|jsx|json|css)$/.test(entry.name)) {
              const result = biomeClient.formatFile(fullPath);
              if (result.changed) formatted++;
              else if (result.success) skipped++;
            }
          }
        };

        formatDir(ctx.cwd || process.cwd());
        ctx.ui.notify(`✓ Formatted ${formatted} file(s), ${skipped} already clean`, "info");
        return;
      }

      const filePath = path.resolve(arg);
      const result = biomeClient.formatFile(filePath);

      if (result.success && result.changed) {
        ctx.ui.notify(`✓ Formatted ${path.basename(filePath)}`, "info");
      } else if (result.success) {
        ctx.ui.notify(`✓ ${path.basename(filePath)} already clean`, "info");
      } else {
        ctx.ui.notify(`⚠️ Format failed: ${result.error}`, "error");
      }
    },
  });

  // --- Events ---

  pi.on("session_start", async (_event, ctx) => {
    verbose = !!pi.getFlag("autofeedback-verbose");

    // Log available tools
    const tools: string[] = [];
    tools.push("TypeScript LSP"); // Always available
    if (biomeClient.isAvailable()) tools.push("Biome");
    if (astGrepClient.isAvailable()) tools.push("ast-grep");
    if (ruffClient.isAvailable()) tools.push("Ruff");
    if (knipClient.isAvailable()) tools.push("Knip");
    if (depChecker.isAvailable()) tools.push("Madge");

    log(`Active tools: ${tools.join(", ")}`);
  });

  // Real-time feedback on file writes/edits
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const filePath = (event.input as { path?: string }).path;
    if (!filePath) return;

    let lspOutput = "";

    // TypeScript LSP diagnostics
    if (!pi.getFlag("no-lsp") && tsClient.isTypeScriptFile(filePath)) {
      const fs = require("node:fs");
      if (fs.existsSync(filePath)) {
        tsClient.updateFile(filePath, fs.readFileSync(filePath, "utf-8"));
      }

      const diags = tsClient.getDiagnostics(filePath);
      if (diags.length > 0) {
        lspOutput += `\n\n[TypeScript] ${diags.length} issue(s):\n`;
        for (const d of diags.slice(0, 10)) {
          const label = d.severity === 2 ? "Warning" : "Error";
          lspOutput += `  [${label}] L${d.range.start.line + 1}: ${d.message}\n`;
        }
      }
    }

    // Python — Ruff linting + formatting
    if (!pi.getFlag("no-ruff") && ruffClient.isPythonFile(filePath)) {
      const diags = ruffClient.checkFile(filePath);
      if (diags.length > 0) {
        lspOutput += `\n\n${ruffClient.formatDiagnostics(diags)}`;
      }
      const fmtReport = ruffClient.checkFormatting(filePath);
      if (fmtReport) {
        lspOutput += `\n\n${fmtReport}`;
      }
    }

    // ast-grep structural analysis
    if (!pi.getFlag("no-ast-grep") && astGrepClient.isAvailable()) {
      const astDiags = astGrepClient.scanFile(filePath);
      if (astDiags.length > 0) {
        lspOutput += `\n\n${astGrepClient.formatDiagnostics(astDiags)}`;
      }
    }

    // Biome: lint + format check
    if (!pi.getFlag("no-biome") && biomeClient.isSupportedFile(filePath)) {
      const biomeDiags = biomeClient.checkFile(filePath);
      if (biomeDiags.length > 0) {
        lspOutput += `\n\n${biomeClient.formatDiagnostics(biomeDiags, filePath)}`;
      }
    }

    // Circular dependency check (cached, only when imports change)
    if (!pi.getFlag("no-ast-grep") && depChecker.isAvailable() && /\.(ts|tsx|js|jsx)$/.test(filePath)) {
      const depResult = depChecker.checkFile(filePath);
      if (depResult.hasCircular && depResult.circular.length > 0) {
        const circularDeps = depResult.circular
          .map(d => d.path)
          .flat()
          .filter((p: string) => !filePath.endsWith(require("node:path").basename(p)));
        const uniqueDeps = [...new Set(circularDeps)];
        if (uniqueDeps.length > 0) {
          lspOutput += `\n\n${depChecker.formatWarning(filePath, uniqueDeps)}`;
        }
      }
    }

    if (!lspOutput) return;

    return {
      content: [...event.content, { type: "text" as const, text: lspOutput }],
    };
  });
}
