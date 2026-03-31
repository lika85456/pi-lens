# pi-lens

Real-time code feedback for [pi](https://github.com/mariozechner/pi-coding-agent) — LSP, linters, formatters, type-checking, structural analysis (ast-grep), TODO scanner, dead code detection, duplicate detection, type coverage, complexity metrics, and AI slop detection.

## What pi-lens Does

**For every file you edit:**
1. **Auto-formats** — Detects and runs formatters (Biome, Prettier, Ruff, gofmt, rustfmt, etc.)
2. **Type-checks** TypeScript, Python, Go, Rust (and 27 more languages with `--lens-lsp`)
3. **Scans for secrets** — blocks on hardcoded API keys, tokens, passwords
4. **Runs linters** — Biome (TS/JS), Ruff (Python), plus structural analysis
5. **Detects code smells** — empty catch blocks, debuggers, nested ternaries, etc.
6. **Only shows NEW issues** — delta-mode tracks baselines and filters pre-existing problems (reduces noise)

**Blocking issues** (type errors, secrets) appear inline and stop the agent until fixed. **Warnings** are tracked but hidden inline — run `/lens-booboo` to see them all.

## Quick Start

```bash
# Install
pi install npm:pi-lens

# Standard mode (auto-formatting, type-checking, linting enabled by default)
pi

# Disable auto-formatting if needed
pi --no-autoformat

# Full LSP mode (31 language servers)
pi --lens-lsp

# Fastest mode (LSP + concurrent execution) (Experimental)
pi --lens-lsp --lens-effect
```

## Install

```bash
pi install npm:pi-lens
```

Or directly from git:

```bash
pi install git:github.com/apmantza/pi-lens
```

---

## Features

### Auto-Formatting (Default Enabled)

pi-lens **automatically formats** every file you write or edit. Formatters are auto-detected based on your project configuration.

**Priority:** **Biome** is the default. **Prettier** runs only if Biome is not configured. This prevents race conditions and ensures consistent formatting.

| Formatter | Languages | Detection | Installation | Role |
|-----------|-----------|-----------|--------------|------|
| **Biome** ⭐ | TS/JS/JSON/CSS | `biome.json` or `@biomejs/biome` in devDependencies | ✅ Automatic | **Default** |
| **Prettier** | TS/JS/JSON/CSS/Markdown | `.prettierrc` or `prettier` in devDependencies | Manual (`npm install -g prettier`) | Fallback |
| **Ruff** ⭐ | Python | `[tool.ruff]` in `pyproject.toml` | ✅ Automatic | **Default** |
| **Black** | Python | `[tool.black]` in `pyproject.toml` | Manual (`pip install black`) | Fallback |
| **gofmt** | Go | `go` binary available | Manual (included with Go SDK) | Default |
| **rustfmt** | Rust | `rustfmt` binary available | Manual (included with Rust toolchain) | Default |
| **zig fmt** | Zig | `zig` binary available | Manual (included with Zig SDK) | Default |
| **dart format** | Dart | `dart` binary available | Manual (included with Dart SDK) | Default |
| **shfmt** | Shell | `shfmt` binary available | Manual (download binary) | Default |
| **mix format** | Elixir | `mix` binary available | Manual (included with Elixir) | Default |

⭐ = Auto-installed (no manual setup required)

**How it works:**
1. Agent writes a file
2. pi-lens detects formatters based on config files/dependencies
3. Biome takes priority; Prettier runs only if Biome is not configured
4. FileTime tracking ensures safety (agents re-read if file changes externally)

**Safety:** If a formatter changes the file, the agent is notified and must re-read before next edit — preventing stale content overwrites.

**Disable:**
```bash
pi --no-autoformat    # Skip automatic formatting
```

---

### Auto-Linting (Default Enabled)

pi-lens **automatically lints** every file you write or edit. Linters are auto-detected based on your project configuration.

| Linter | Languages | Installation | Role | Priority |
|--------|-----------|--------------|------|----------|
| **Biome** ⭐ | TS/JS/JSON/CSS | ✅ Automatic | **Default** | 10 |
| **Ruff** ⭐ | Python | ✅ Automatic | **Default** | 10 |
| **oxlint** | TS/JS | Manual (`npm i -g oxlint`) | Fast alternative | 12 |
| **ESLint** | JS/Vue/Svelte | `npx` via `--lens-lsp` | LSP only | - |
| **shellcheck** | Bash/sh/zsh/fish | Manual (`apt install shellcheck`) | Shell scripts | 20 |

⭐ = Auto-installed (no manual setup required)

**Priority:** Lower numbers = run earlier. Biome/Ruff run first, followed by specialized linters.

**How it works:**
1. Agent writes a file
2. pi-lens detects linters based on config files and file type
3. Biome takes priority for TS/JS; Ruff takes priority for Python
4. Multiple linters can run on the same file (e.g., Biome + oxlint)
5. Issues are delta-tracked (only new issues shown after first write)

**Notes:**
- Biome and Ruff are **dual-purpose** (lint + format)
- oxlint is a faster Rust-based alternative to ESLint
- ESLint only runs when `--lens-lsp` is enabled
- shellcheck requires manual installation on most systems

---

### LSP Support (NEW) — 31 Language Servers

Enable full Language Server Protocol support with `--lens-lsp`:

| Category | Languages |
|----------|-----------|
| **Core** | TypeScript, Python, Go, Rust, Ruby, PHP, C#, F#, Java, Kotlin |
| **Native** | C/C++, Zig, Swift, Haskell, OCaml, Lua, Dart |
| **Functional** | Elixir, Gleam, Clojure, Haskell |
| **DevOps** | Terraform, Nix, Docker, Bash |
| **Config** | YAML, JSON, Prisma |
| **Web** | Vue, Svelte, CSS/SCSS/Sass/Less |

**Auto-installation (4 core tools):** TypeScript, Python, and formatting tools auto-install on first use to `.pi-lens/tools/`. Other LSP servers are launched via `npx` when available or require manual installation.

**Usage:**
```bash
pi --lens-lsp                    # Enable LSP
pi --lens-lsp --lens-effect      # LSP + concurrent execution
```

### `pi` vs `pi --lens-lsp`

| Feature | `pi` (Default) | `pi --lens-lsp` |
|---------|----------------|-----------------|
| **Type Checking** | Built-in TypeScriptClient | Full LSP (31 language servers) |
| **Auto-format** | ✅ Biome, Prettier, Ruff, etc. | ✅ Same |
| **Auto-fix** | ✅ Enabled by default | ✅ Same |
| **Secrets scan** | ✅ Blocks on hardcoded secrets | ✅ Same |
| **Languages** | TypeScript, Python (built-in) | 31 languages via LSP |
| **Python** | Ruff/pyright (built-in) | Pyright LSP |
| **Go, Rust, etc.** | Basic linting | Full LSP support |

**Recommendation:** Use `pi` for TypeScript/Python projects. Use `pi --lens-lsp` for multi-language projects or when you need full language server features.

See [docs/LSP_CONFIG.md](docs/LSP_CONFIG.md) for configuration options.

---

### Execution Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Sequential** | (default) | Runners execute one at a time |
| **Concurrent** | `--lens-effect` | All runners in parallel via Effect-TS (Experimental) |

---

### On every write / edit

Every file write/edit triggers multiple analysis phases:

**Execution flow:**
1. **Secrets scan** (pre-flight) — Hardcoded secrets block immediately (non-runner check)
2. **LSP integration** (Phase 3, with `--lens-lsp`) — Real-time type errors from language servers
3. **Dispatch system** — Routes file to appropriate runners by `FileKind`
4. **Runners execute** by priority (lower = earlier). See [Runners](#runners) section for full list.
5. **Tree-sitter structural patterns** (post-write) — Fast AST-based checks for patterns ast-grep misses
6. **Test runner detection** (post-write) — Detects Jest/Vitest/Pytest and runs relevant tests

**With `--lens-effect`:** Dispatch runners execute concurrently via Effect-TS (steps 3-4). Tree-sitter and test runner remain sequential (steps 5-6).

**Delta mode behavior:**
- **First write:** All issues tracked and stored in baseline
- **Subsequent edits:** Only **NEW** issues shown (pre-existing issues filtered out)
- **Goal:** Don't spam agent with issues they didn't cause

**Output shown inline:**
```
🔴 STOP — 1 issue(s) must be fixed:
  L23: var total = sum(items); — use 'let' or 'const'
```

> **Note:** Only **blocking** issues (`ts-lsp`, `pyright` errors, `type-safety` switch errors, secrets) appear inline. Warnings are tracked but not shown inline (noise reduction) — run `/lens-booboo` to see all warnings.

---

### Runners

pi-lens uses a **dispatcher-runner architecture** for extensible multi-language support. Runners are executed by priority (lower = earlier).

| Runner | Language | Priority | Output | Description |
|--------|----------|----------|--------|-------------|
| **ts-lsp** | TypeScript | 5 | Blocking | TypeScript errors (hard stops) |
| **pyright** | Python | 5 | Blocking | Python type errors (hard stops) |
| **biome** | TS/JS | 10 | Warning | Linting issues (delta-tracked) |
| **ruff** | Python | 10 | Warning | Python linting (delta-tracked) |
| **oxlint** | TS/JS | 12 | Warning | Fast Rust-based JS/TS linter |
| **ast-grep-napi** | TS/JS | 15 | Warning | **100x faster** structural analysis |
| **type-safety** | TS | 20 | Mixed | Switch exhaustiveness (blocking), other (warning) |
| **shellcheck** | Shell | 20 | Warning | Bash/sh/zsh/fish linting |
| **python-slop** | Python | 25 | Warning | AI slop detection (~40 patterns) |
| **spellcheck** | Markdown | 30 | Warning | Typo detection in docs |
| **ast-grep** | Go, Rust, Python, etc. | 30 | Warning | Structural analysis via CLI (fallback for non-TS/JS) |
| **similarity** | TS | 35 | Silent | Semantic duplicate detection (metrics only) |
| **architect** | All | 40 | Warning | Architectural rule violations |
| **go-vet** | Go | 50 | Warning | Go static analysis |
| **rust-clippy** | Rust | 50 | Warning | Rust linting |

**Priority legend:**
- **5** — Type checkers (blocking errors)
- **10-15** — Linters and structural analysis
- **20-30** — Specialized checks (safety, slop, spellcheck)
- **35** — Metrics only (silent)
- **40-50** — Language-specific and architectural

**Output semantics:**
- **Blocking** — Hard stop, must fix (type errors, secrets)
- **Warning** — Shown in `/lens-booboo`, not inline (noise reduction)
- **Silent** — Tracked in metrics only, never shown

**Disabled runners:** `ts-slop` (merged into `ast-grep-napi`)

---

### Structural Patterns (Tree-sitter)

Tree-sitter performs **fast AST-based analysis** in two phases:

**Phase 1 (Pre-dispatch):** Fast patterns checked before runners execute (50-100ms)
**Phase 2 (Post-write):** Additional structural checks after runners complete

#### TypeScript/JavaScript Patterns (Phase 1 + 2)

| Pattern | Severity | Phase | What it finds |
|---------|----------|-------|---------------|
| **Empty catch** | 🔴 Error | 1 | `catch (err) {}` — swallowing errors silently |
| **Debugger** | 🟡 Warning | 1 | `debugger;` — debug leftover |
| **Await in loop** | 🟡 Warning | 1 | `for (...) { await ... }` — sequential execution |
| **Hardcoded secrets** | 🔴 Error | 1 | `const api_key = "..."` — security risk |
| **DangerouslySetInnerHTML** | 🔴 Error | 1 | XSS risk in JSX |
| **Nested ternary** | 🟡 Warning | 1 | `a ? b ? c : d : e` — unreadable code |
| **Eval** | 🔴 Error | 1 | `eval(userInput)` — code injection |
| **Console statement** | 🟡 Warning | 1 | `console.log` — debug leftover |
| **Long parameter list** | 🟡 Warning | 1 | 6+ parameters — use object pattern |
| **Deep promise chain** | 🟡 Warning | 2 | `.then().catch().then()` — 3+ levels, use async/await |
| **Mixed async styles** | 🟡 Warning | 2 | `await` + `.then()` in same function — be consistent |
| **Deep nesting** | 🟡 Warning | 2 | `if { if { if { } } }` — 3+ levels, extract functions |

#### Python Patterns (Phase 1)

| Pattern | Severity | What it finds |
|---------|----------|---------------|
| **Bare except** | 🔴 Error | `except:` — catches SystemExit/KeyboardInterrupt |
| **Mutable default arg** | 🔴 Error | `def f(x=[])` — shared mutable state |
| **Wildcard import** | 🟡 Warning | `from module import *` — namespace pollution |
| **Eval/exec** | 🔴 Error | `eval(user_input)` — code injection |
| **Is vs equals** | 🟡 Warning | `is "literal"` should be `==` |
| **Unreachable except** | 🔴 Error | Specific except after bare except (unreachable) |

**Why tree-sitter is separate:**
- **Speed:** 50ms vs 500ms for full type-checking
- **Simplicity:** AST-only, no project-wide analysis
- **Coverage:** Catches issues before expensive semantic analysis runs
- **Multi-language:** Supports TypeScript, TSX, and Python

**Status:** Shows inline in tool results (non-blocking warnings). Also included in `/lens-booboo` reports.

#### Custom ast-grep Rules

Create your own structural rules in `.pi-lens/rules/`:

```yaml
# .pi-lens/rules/no-console-prod.yml
id: no-console-prod
language: javascript
rule:
  pattern: console.$METHOD($$$ARGS)
message: "Remove console statements before production"
severity: warning
```

See [docs/ast-grep-rules.md](docs/ast-grep-rules.md) for full guide.

---

### At Session Start

When pi starts a new session, pi-lens performs initialization scans to establish baselines and surface existing technical debt:

**Initialization sequence:**
1. **Reset session state** — Clear metrics and complexity baselines
2. **Initialize LSP** (with `--lens-lsp`) — Detect and auto-install language servers
3. **Pre-install TypeScript LSP** (with `--lens-lsp`) — Warm up cache for instant response
4. **Detect available tools** — Biome, ast-grep, Ruff, Knip, jscpd, Madge, type-coverage, Go, Rust
5. **Load architect rules** — If `architect.yml` or `.architect.yml` present
6. **Detect test runner** — Jest, Vitest, Pytest, etc.

**Cached scans** (with 5-min TTL):
| Scan | Tool | Cached | Purpose |
|------|------|--------|---------|
| **TODOs** | Internal | No | Tech debt markers |
| **Dead code** | Knip | Yes | Unused exports/files/deps |
| **Duplicates** | jscpd | Yes | Copy-paste detection |
| **Exports** | ast-grep | No | Function index for similarity |

**Error debt tracking** (with `--error-debt` flag):
- If tests passed at end of previous session but fail now → **regression detected**
- Blocks agent until tests pass again

**Output:** Scan results appear in session startup notification

---

### Code Review

```
/lens-booboo [path]
```

Full codebase analysis with **10 tracked runners** producing a comprehensive report:

| # | Runner | What it finds |
|---|--------|---------------|
| 1 | **ast-grep (design smells)** | Structural issues (empty catch, no-debugger, etc.) |
| 2 | **ast-grep (similar functions)** | Duplicate function patterns across files |
| 3 | **semantic similarity (Amain)** | 57×72 matrix semantic clones (>75% similarity) |
| 4 | **complexity metrics** | Low MI, high cognitive complexity, AI slop indicators |
| 5 | **TODO scanner** | TODO/FIXME annotations and tech debt markers |
| 6 | **dead code (Knip)** | Unused exports, files, dependencies |
| 7 | **duplicate code (jscpd)** | Copy-paste blocks with line/token counts |
| 8 | **type coverage** | Percentage typed vs `any`, low-coverage files |
| 9 | **circular deps (Madge)** | Import cycles and dependency chains |
| 10 | **architectural rules** | Layer violations, file size limits, path rules |

**Output:**
- **Terminal:** Progress `[1/10] runner...` with timing, summary with findings per runner
- **JSON:** `.pi-lens/reviews/booboo-{timestamp}.json` (structured data for AI processing)
- **Markdown:** `.pi-lens/reviews/booboo-{timestamp}.md` (human-readable report)

**Usage:**
```bash
/lens-booboo              # Scan current directory
/lens-booboo ./src        # Scan specific path
```

---

### Test Runner

**Auto-detected test runners:**
| Runner | Config Files | Languages |
|--------|--------------|-----------|
| **Vitest** | `vitest.config.ts`, `vitest.config.js` | TypeScript, JavaScript |
| **Jest** | `jest.config.js`, `jest.config.ts`, `package.json` (jest field) | TypeScript, JavaScript |
| **Pytest** | `pytest.ini`, `setup.cfg`, `pyproject.toml` | Python |

**Behavior:**
- **On file write:** Detects corresponding test file and runs it
- **Pattern matching:** `file.ts` → `file.test.ts` or `__tests__/file.test.ts`
- **Output:** Inline pass/fail with failure details (shown with lint results)
- **Flag:** Use `--no-tests` to disable automatic test running

**Execution flow:**
1. Agent writes `src/utils.ts`
2. pi-lens finds `src/utils.test.ts` (or `__tests__/utils.test.ts`)
3. Runs only that test file (not full suite)
4. Results appear inline:
```
[tests] 3 passed, 1 failed (42ms)
  ✓ should calculate total
  ✗ should handle empty array (expected 0, got undefined)
```

**Why only corresponding tests?**
Running the full suite on every edit would be too slow. Targeted testing gives immediate feedback for the code being edited.

---

### Complexity Metrics

pi-lens calculates comprehensive code quality metrics for every source file:

| Metric | Range | Description | Thresholds |
|--------|-------|-------------|------------|
| **Maintainability Index (MI)** | 0-100 | Composite score combining complexity, size, and structure | <20: 🔴 Unmaintainable, 20-40: 🟡 Poor, >60: ✅ Good |
| **Cognitive Complexity** | 0+ | Human mental effort to understand code (nesting penalties) | >20: 🟡 Hard to understand, >50: 🔴 Very complex |
| **Cyclomatic Complexity** | 1+ | Independent code paths (branch points + 1) | >10: 🟡 Complex function, >20: 🔴 Highly complex |
| **Max Cyclomatic** | 1+ | Worst function in file | >10 flagged |
| **Nesting Depth** | 0+ | Maximum block nesting level | >4: 🟡 Deep nesting, >6: 🔴 Excessive |
| **Code Entropy** | 0-8+ bits | Shannon entropy — unpredictability of code patterns | >3.5: 🟡 Risky AI-induced complexity |
| **Halstead Volume** | 0+ | Vocabulary × length — unique ops/operands | High = many different operations |

**AI Slop Indicators:**
- Low MI + high cognitive complexity + high entropy = potential AI-generated spaghetti code
- Excessive comments (>40%) + low MI = hand-holding anti-patterns
- Single-use helpers with high entropy = over-abstraction

**Usage:**
- `/lens-booboo` — Shows complexity table for all files
- `tool_result` — Complexity tracked per file, AI slop warnings inline

---

### Delta-mode feedback

All runners operate in **delta mode**:
- **First write/edit:** Full scan, all issues tracked
- **Subsequent edits:** Only **NEW** issues shown (pre-existing issues filtered out)
- **Goal:** Reduce noise — don't spam agent with issues they didn't cause

---

## Architecture

### Two-Phase System

```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1: EXECUTION                       │
│                                                              │
│  Sequential (default):                                        │
│    • Runners execute one at a time                          │
│                                                              │
│  Concurrent (--lens-effect):                                │
│    • All runners via Effect.all                             │
│    • 30s timeout per runner                                 │
│    • Graceful error recovery                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 2: LSP                           │
│  • 31 Language Server Protocol clients                       │
│  • Auto-installation on first use (TypeScript/Python)         │
│  • Interactive install prompt for Go/Rust/YAML/JSON/Bash      │
│  • Debounced diagnostics (150ms)                           │
│  Flag: --lens-lsp                                            │
└─────────────────────────────────────────────────────────────┘
```

### LSP Architecture (Phase 3)

```
┌─────────────────────────────────────────────────────────────┐
│                   GENERIC LSP CLIENT                        │
│  (clients/lsp/client.ts)                                    │
│                                                             │
│  • JSON-RPC message handling                                │
│  • Debounced diagnostics (150ms)                           │
│  • Bus-based wait (no polling)                              │
│  • Windows path normalization                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ spawns
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   LSP SERVER DEFINITIONS                      │
│  (clients/lsp/server.ts)                                      │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ TypeScript  │  │   Python    │  │     Go      │  + 28 more │
│  │  Server     │  │   Server    │  │   Server    │           │
│  │             │  │             │  │             │           │
│  │ • Find      │  │ • npx       │  │ • gopls     │           │
│  │   local tss │  │   pyright   │  │   binary    │           │
│  │ • Set       │  │ • Detect    │  │ • Default   │           │
│  │   tsserver  │  │   venv      │  │   spawn     │           │
│  │   path      │  │ • pythonPath│  │             │           │
│  │             │  │   in init   │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                               │
│  Each server: spawn() → returns {process, initialization}     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ publishes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   EVENT BUS (DiagnosticFound)                 │
│                                                             │
│  LSP publishes → Bus routes → Aggregator builds report     │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ LSP Server  │───▶│    BUS      │───▶│  waitFor    │     │
│  │ publishDiags│    │  subscribe  │    │ Diagnostics│     │
│  │             │    │             │    │  (no poll)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **One generic client** — Language-agnostic JSON-RPC handler shared by all LSP servers
- **Server-specific spawn** — Each language handles its own quirks (npx, local binary, venv detection)
- **Bus-based waiting** — `waitForDiagnostics()` uses event subscription instead of polling
- **No artificial delays** — Pyright's 3s indexing happens server-side; client waits via bus

### Runner System

pi-lens uses a **dispatcher-runner architecture** for extensible multi-language support. Runners are executed by priority (lower = earlier).

```
┌─────────────────────────────────────────────────────────────┐
│                     DISPATCHER                              │
│  Routes files to appropriate runners based on file kind     │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌──────────┐           ┌──────────┐           ┌──────────────┐
│ ts-lsp   │           │ pyright  │           │ biome        │
│ (prio 5) │           │ (prio 5) │           │ (prio 10)    │
│ TS type  │           │ Py type  │           │ TS/JS lint   │
└──────────┘           └──────────┘           └──────────────┘
    │                         │                    │
    │                         │                    │
    ▼                         ▼                    ▼
┌──────────┐           ┌──────────────┐    ┌──────────────┐
│ ruff     │           │ oxlint       │    │ ast-grep-napi│
│ (prio 10)│           │ (prio 12)    │    │ (prio 15)    │
│ Py lint  │           │ Fast JS lint │    │ TS/JS struct │
└──────────┘           └──────────────┘    └──────────────┘
    │                         │
    │                         │
    ▼                         ▼
┌──────────────┐      ┌──────────┐
│ shellcheck   │      │type-safe │
│ (prio 20)    │      │(prio 20) │
│ Shell lint   │      │TS switch │
└──────────────┘      └──────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌──────────┐           ┌──────────┐           ┌──────────┐
│py-slop   │           │spellcheck│           │ast-grep  │
│(prio 25) │           │(prio 30) │           │(prio 30) │
│Py slop   │           │Markdown  │           │Other lang│
└──────────┘           └──────────┘           └──────────┘
                                                      │
    ┌─────────────────────────┼─────────────────────────┘
    │                         │
    ▼                         ▼
┌──────────┐           ┌──────────┐
│similarity│           │ architect│
│(prio 35) │           │ (prio 40)│
│Dup det  │           │ Arch rules│
└──────────┘           └──────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌──────────┐           ┌──────────┐           ┌──────────┐
│ go-vet   │           │rust-clipy│           │ [more...]│
│ (prio 50)│           │(prio 50) │           │          │
│ Go vet   │           │ Rust lint│           │          │
└──────────┘           └──────────┘           └──────────┘
```

### Runner Output Semantics

- **Blocking:** Hard stop — agent must fix before continuing (🔴 STOP)
- **Warning:** Tracked in delta mode, surfaced via `/lens-booboo` (not inline to reduce noise)
- **Delta mode:** Only NEW issues since turn start are tracked (pre-existing issues don't spam)

---

## Language Support

### JavaScript / TypeScript

Fully supported with multiple runners:
- TypeScript language server (type checking) — **with `--lens-lsp`: typescript-language-server**
- Biome (linting + formatting)
- @ast-grep/napi (structural analysis, 100x faster than CLI)
- Knip (dead code)
- jscpd (duplicates)
- type-coverage (`any` detection)
- **LSP extras (with `--lens-lsp`):** ESLint, Vue, Svelte, CSS/SCSS

### Python

- Pyright (type checking)
- Ruff (linting)
- Python slop detection (40+ AI patterns)

### Go

- `go vet` (static analysis)
- Full support via go-vet runner

### Rust

- `cargo clippy` (linting)
- Full support via rust-clippy runner

### LSP Servers (with `--lens-lsp`)

| Language | LSP Server | Installation |
|----------|------------|--------------|
| **TypeScript** | typescript-language-server | ✅ **Auto-installed** |
| **Python** | pyright | ✅ **Auto-installed** |
| Ruby | ruby-lsp / solargraph | Manual |
| PHP | intelephense | `npx` (if available) |
| C# | csharp-ls | Manual |
| F# | fsautocomplete | Manual |
| Java | JDTLS | Manual |
| Kotlin | kotlin-language-server | Manual |
| Swift | sourcekit-lsp | Xcode required |
| Dart | dart | SDK required |
| Go | gopls | Manual |
| Rust | rust-analyzer | Manual |
| Lua | lua-language-server | Manual |
| C/C++ | clangd | Manual |
| Zig | zls | Manual |
| Haskell | haskell-language-server | Manual |
| Elixir | elixir-ls | Manual |
| Gleam | gleam | Manual |
| OCaml | ocamllsp | Manual |
| Clojure | clojure-lsp | Manual |
| Terraform | terraform-ls | Manual |
| Nix | nixd | Manual |
| Bash | bash-language-server | `npx` (if available) |
| Docker | dockerfile-language-server | `npx` (if available) |
| YAML | yaml-language-server | `npx` (if available) |
| JSON | vscode-json-languageserver | `npx` (if available) |
| Prisma | @prisma/language-server | `npx` (if available) |
| Vue | @vue/language-server | `npx` (if available) |
| Svelte | svelte-language-server | `npx` (if available) |
| ESLint | vscode-eslint | `npx` (if available) |
| CSS/SCSS | vscode-css-languageserver | `npx` (if available) |

**Legend:**
- ✅ **Auto-installed** — Downloaded to `.pi-lens/tools/` on first use (4 tools: TypeScript, Python, Biome, Ruff)
- **`npx`** — Runs via `npx -y <package>` if Node.js/npm available (prompts to install if missing)
- **Manual** — Requires manual installation (SDK, compiler, or platform-specific binary)

---

## Dependent Tools

pi-lens works out of the box for TypeScript/JavaScript. For full language support, install these tools — **all are optional and gracefully skip if not installed**:

### JavaScript / TypeScript

| Tool | Install | What it does |
|------|---------|--------------|
| `@biomejs/biome` | `npm i -D @biomejs/biome` | Linting + formatting |
| `oxlint` | `npm i -D oxlint` | Fast Rust-based JS/TS linting |
| `knip` | `npm i -D knip` | Dead code / unused exports |
| `jscpd` | `npm i -D jscpd` | Copy-paste detection |
| `type-coverage` | `npm i -D type-coverage` | TypeScript `any` coverage % |
| `@ast-grep/napi` | `npm i -D @ast-grep/napi` | Fast structural analysis (TS/JS) |
| `@ast-grep/cli` | `npm i -D @ast-grep/cli` | Structural pattern matching (all languages) |
| `typos-cli` | `cargo install typos-cli` | Spellcheck for Markdown |

### Python

| Tool | Install | What it does |
|------|---------|--------------|
| `ruff` | `pip install ruff` | Linting + formatting |
| `pyright` | `pip install pyright` | Type-checking (catches type errors) |

### Go

| Tool | Install | What it does |
|------|---------|--------------|
| `go` | [golang.org](https://golang.org) | Built-in `go vet` for static analysis |

### Rust

| Tool | Install | What it does |
|------|---------|--------------|
| `rust` + `clippy` | [rustup.rs](https://rustup.rs) | Linting via `cargo clippy` |

### Shell

| Tool | Install | What it does |
|------|---------|--------------|
| `shellcheck` | `apt install shellcheck` / `brew install shellcheck` | Shell script linting (bash/sh/zsh/fish) |

---

## Commands

| Command | Description |
|---------|-------------|
| `/lens-booboo` | Full codebase review (10 analysis runners) |
| `/lens-format` | Apply Biome formatting |
| `/lens-tdi` | Technical Debt Index and trends |

---

## Execution Modes

| Mode | Command | What happens |
|------|---------|--------------|
| **Standard** (default) | `pi` | Auto-formatting, TS/Python type-checking, sequential execution |
| **Full LSP** | `pi --lens-lsp` | Real LSP servers (31 languages), sequential execution |
| **Fastest** | `pi --lens-lsp --lens-effect` | Real LSP + concurrent execution (all runners in parallel) |


### Flag Reference

| Flag | Description |
|------|-------------|
| `--lens-lsp` | Use real Language Server Protocol servers instead of built-in type-checking |
| `--lens-effect` | Run all runners **concurrently** (faster) instead of sequentially (Experimental) |
| `--lens-verbose` | Enable detailed console logging |
| `--no-autoformat` | Disable automatic formatting (formatting is **enabled by default**) |
| `--no-autofix` | Disable all auto-fixing (Biome + Ruff autofix is **enabled by default**) |
| `--no-autofix-biome` | Disable Biome auto-fix only |
| `--no-autofix-ruff` | Disable Ruff auto-fix only |
| `--no-oxlint` | Skip Oxlint linting |
| `--no-shellcheck` | Skip shellcheck for shell scripts |
| `--no-tests` | Disable automatic test running on file write |
| `--no-madge` | Skip circular dependency checks |
| `--no-ast-grep` | Skip ast-grep structural analysis |
| `--no-biome` | Skip Biome linting |
| `--no-lsp` | Skip TypeScript/Python type checking |
| `--error-debt` | Track test regressions across sessions |

**Recommended combinations:**
```bash
pi                               # Default: auto-format, auto-fix, built-in type-checking
pi --lens-lsp                    # LSP type-checking (31 languages)
pi --lens-lsp --lens-effect      # LSP + concurrent execution (fastest)
```

---

## Slop Detection

pi-lens detects "AI slop" — low-quality patterns common in AI-generated code:

### TypeScript/JavaScript Slop Rules (30+)

| Rule | Description |
|------|-------------|
| `ts-for-index-length` | `for (let i=0; i<arr.length; i++)` → prefer `for...of` |
| `ts-empty-array-check` | `arr.length === 0` → prefer `!arr.length` |
| `ts-unnecessary-array-isarray` | Redundant `Array.isArray()` checks |
| `ts-redundant-filter-map` | `.filter().map()` chains → use `flatMap` |
| `ts-double-negation` | `!!value` → prefer `Boolean(value)` |
| `ts-unnecessary-array-from` | `Array.from(iterable)` in for-of |
| `no-default-export` | Prefer named exports |

### Python Slop Rules (40+)

| Rule | Description |
|------|-------------|
| `py-chained-comparison` | `a < b and b < c` → `a < b < c` |
| `py-manual-min-max` | Manual min/max loops → `min()`/`max()` |
| `py-redundant-if-else` | Unnecessary if/else blocks |
| `py-list-comprehension` | Filter/map loops → list comprehensions |
| `py-unnecessary-else` | Else after return/raise |

*Note: Some rules disabled due to false positives (e.g., `ts-for-index-length`, `ts-unnecessary-array-isarray`)*

---

## Rules

### AST-grep Rules (80+)

Rules live in `rules/ast-grep-rules/rules/`. All rules are YAML files you can edit or extend.

**Security**
`no-eval`, `no-implied-eval`, `no-hardcoded-secrets`, `no-insecure-randomness`, `no-open-redirect`, `no-sql-in-code`, `no-inner-html`, `no-dangerously-set-inner-html`, `no-javascript-url`

**TypeScript**
`no-any-type`, `no-as-any`, `no-non-null-assertion`

**Style** (Biome handles `no-var`, `prefer-const`, `prefer-template`, `no-useless-concat` natively)
`prefer-nullish-coalescing`, `prefer-optional-chain`, `nested-ternary`

**Correctness**
`no-debugger`, `no-throw-string`, `no-return-await`, `no-await-in-loop`, `no-await-in-promise-all`, `require-await`, `empty-catch`, `strict-equality`, `strict-inequality`

**Patterns**
`no-console-log`, `no-alert`, `no-delete-operator`, `no-shadow`, `no-star-imports`, `switch-needs-default`, `switch-without-default`

**Type Safety** (type-aware checks via `type-safety-client.ts`)
`switch-exhaustiveness` — detects missing cases in union type switches (inline blocker)

**Design Smells** (architectural — handled by `/lens-booboo`)
`long-method`, `long-parameter-list`, `large-class`

**AI Slop Detection**
`no-param-reassign`, `no-single-char-var`, `no-process-env`, `no-architecture-violation`

---

## TypeScript LSP — tsconfig detection

The LSP walks up from the edited file's directory until it finds a `tsconfig.json`. If found, it uses that project's exact `compilerOptions` (paths, strict settings, lib, etc.). If not found, it falls back to sensible defaults:

- `target: ES2020`
- `lib: ["es2020", "dom", "dom.iterable"]`
- `moduleResolution: bundler`
- `strict: true`

The compiler options are refreshed automatically when you switch between projects within a session.

---

## Additional Safeguards

Beyond the runner system, pi-lens includes safeguards that run **before** the dispatch system:

### Secrets Scanning (Pre-flight Security)

**Not a runner** — runs on every file write/edit **before** any other checks.

Scans file content for potential secrets using regex patterns:
- Stripe/OpenAI keys (`sk-*`)
- GitHub tokens (`ghp_*`, `github_pat_*`)
- AWS keys (`AKIA*`)
- Slack tokens (`xoxb-*`, `xoxp-*`)
- Private keys (`BEGIN PRIVATE KEY`)
- Hardcoded passwords and API keys

**Behavior:** Always blocking, always runs on all file types. Cannot be disabled or bypassed — security takes precedence over all other checks.

### Agent Behavior Warnings

**Not runners** — these are inline heuristics shown to the agent to catch anti-patterns in real-time.

**Blind Write Detection**
- **Triggers:** Agent edits a file without reading it in the last 5 tool calls
- **Warning:** `⚠ BLIND WRITE — editing 'file.ts' without reading in the last 5 tool calls. Read the file first to avoid assumptions.`
- **Why:** Prevents edits based on stale assumptions or hallucinated file contents

**Thrashing Detection**
- **Triggers:** 3+ consecutive identical tool calls (e.g., `edit`, `edit`, `edit`) within 30 seconds
- **Warning:** `🔴 THRASHING — 3 consecutive 'edit' calls with no other action. Consider fixing the root cause instead of re-running.`
- **Why:** Catches stuck loops where the agent repeats the same failed action

**Edit Count Tracking**
- Tracks how many times each file has been edited in the current session
- Used for metrics and detecting "hot" files with churn

**Behavior:** These warnings appear inline with lint results but do **not** block execution. They are guidance for the agent to self-correct.

---

## Exclusion Criteria

pi-lens automatically excludes certain files from analysis to reduce noise and focus on production code.

### Test Files

All runners respect test file exclusions — both in the dispatch system (`skipTestFiles: true`) and the `/lens-booboo` command.

**Excluded patterns:**
```
**/*.test.ts      **/*.test.tsx      **/*.test.js      **/*.test.jsx
**/*.spec.ts      **/*.spec.tsx      **/*.spec.js      **/*.spec.jsx
**/*.poc.test.ts  **/*.poc.test.tsx
**/test-utils.ts  **/test-*.ts
**/__tests__/**  **/tests/**  **/test/**
```

**Why:** Test files intentionally duplicate patterns (test fixtures, mock setups) and have different complexity standards. Including them creates false positives.

### Build Artifacts (TypeScript Projects)

In TypeScript projects (detected by `tsconfig.json` presence), compiled `.js` files are excluded:

```
**/*.js   **/*.jsx   (when corresponding .ts/.tsx exists)
```

**Why:** In TS projects, `.js` files are build artifacts. Analyzing them duplicates every issue (once in source `.ts`, once in compiled `.js`).

**Note:** In pure JavaScript projects (no `tsconfig.json`), `.js` files are **included** as they are the source files.

### Excluded Directories

| Directory | Reason |
|-----------|--------|
| `node_modules/` | Third-party dependencies |
| `.git/` | Version control metadata |
| `dist/`, `build/` | Build outputs |
| `.pi-lens/`, `.pi/` | pi agent internal files |
| `.next/`, `.ruff_cache/` | Framework/build caches |
| `coverage/` | Test coverage reports |

### Per-Runner Exclusion Summary

| Runner | Test Files | Build Artifacts | Directories |
|--------|-----------|-----------------|-------------|
| **dispatch runners** | ✅ `skipTestFiles` | ✅ `.js` excluded in TS | ✅ `EXCLUDED_DIRS` |
| **booboo /lens-booboo** | ✅ `shouldIncludeFile()` | ✅ `isTsProject` check | ✅ `EXCLUDED_DIRS` |
| **Secrets scan** | ❌ No exclusion (security) | ❌ No exclusion | ✅ Dirs excluded |

---

## Caching Architecture

pi-lens uses a multi-layer caching strategy to avoid redundant work:

### 1. Tool Availability Cache

**Location:** `clients/tool-availability.ts`

```
┌─────────────────────────────────────────┐
│         TOOL AVAILABILITY CACHE          │
│  Map<toolName, {available, version}>     │
│  • Persisted for session lifetime         │
│  • Refreshed on extension restart        │
└─────────────────────────────────────────┘
```

Avoids repeated `which`/`where` calls to check if `biome`, `ruff`, `pyright`, etc. are installed.

### 2. Dispatch Baselines (Delta Mode)

**Location:** `clients/dispatch/dispatcher.ts`

```
┌─────────────────────────────────────────┐
│         DISPATCH BASELINES              │
│  Map<filePath, Diagnostic[]>            │
│  • Cleared at turn start                 │
│  • Updated after each runner execution   │
│  • Filters: only NEW issues shown        │
└─────────────────────────────────────────┘
```

Delta mode tracking: first edit shows all issues, subsequent edits only show issues that weren't there before.

### 3. Client-Level Caches

| Client | Cache | TTL | Purpose |
|--------|-------|-----|---------|
| **Knip** | `clients/cache-manager.ts` | 5 min | Dead code analysis (slow) |
| **jscpd** | `clients/cache-manager.ts` | 5 min | Duplicate detection (slow) |
| **Type Coverage** | In-memory | Session | `any` type percentage |
| **Complexity** | In-memory | File-level | MI, cognitive complexity per file |

### 4. Session Turn State

**Location:** `clients/cache-manager.ts`

```
┌─────────────────────────────────────────┐
│         TURN STATE TRACKING               │
│  • Modified files this turn              │
│  • Modified line ranges per file         │
│  • Import changes detected               │
│  • Turn cycle counter (max 10)           │
└─────────────────────────────────────────┘
```

Tracks which files were edited in the current agent turn for:
- jscpd: Only re-scan modified files
- Madge: Only check deps if imports changed
- Cycle detection: Prevents infinite fix loops

### 5. Runner Internal Caches

| Runner | Cache | Notes |
|--------|-------|-------|
| `ast-grep-napi` | Rule descriptions | Loaded once per session |
| `biome` | Tool availability | Checked once, cached |
| `pyright` | Command path | Venv lookup cached |
| `ruff` | Command path | Venv lookup cached |

---

## Project Structure

```
pi-lens/
├── clients/              # Lint tool wrappers and utilities
│   ├── bus/              # Event bus system (Phase 1)
│   │   ├── bus.ts
│   │   ├── events.ts
│   │   └── integration.ts
│   ├── dispatch/         # Dispatcher and runners
│   │   ├── dispatcher.ts
│   │   └── runners/      # Individual runners
│   │       ├── ast-grep-napi.ts      # Fast TS/JS runner
│   │       ├── python-slop.ts        # Python slop detection
│   │       ├── ts-lsp.ts             # TS type checking
│   │       ├── biome.ts
│   │       ├── ruff.ts
│   │       ├── pyright.ts
│   │       ├── go-vet.ts
│   │       └── rust-clippy.ts
│   ├── lsp/              # LSP client system (Phase 3)
│   │   ├── client.ts
│   │   ├── server.ts     # 31 LSP server definitions
│   │   ├── language.ts
│   │   ├── launch.ts
│   │   └── config.ts     # Custom LSP configuration
│   ├── installer/          # Auto-installation (Phase 4)
│   │   └── index.ts
│   ├── services/           # Effect-TS services (Phase 2)
│   │   ├── runner-service.ts
│   │   └── effect-integration.ts
│   ├── complexity-client.ts
│   ├── type-safety-client.ts
│   └── secrets-scanner.ts
├── commands/             # pi commands
│   ├── booboo.ts
│   └── fix-simplified.ts
├── docs/                 # Documentation
│   └── LSP_CONFIG.md     # LSP configuration guide
├── rules/                # AST-grep rules
│   └── ast-grep-rules/   # General structural rules
├── index.ts              # Main entry point
└── package.json
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full history.

### Latest Highlights

- **LSP Support:** 31 Language Server Protocol clients (4 core auto-installed, others via npx or manual)
- **Concurrent Execution:** Effect-TS-based parallel runner execution with `--lens-effect`
- **NAPI Runner:** 100x faster TypeScript/JavaScript structural analysis (~9ms vs ~1200ms)
- **Slop Detection:** 30+ TypeScript and 40+ Python patterns for AI-generated code quality issues

---

## License

MIT
