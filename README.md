# pi-lens

Real-time code quality feedback for [pi](https://github.com/mariozechner/pi-coding-agent). Every write and edit is automatically analysed — diagnostics are injected directly into the tool result so the agent sees them without any extra steps.

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

### On every write / edit

Every file write/edit triggers the **dispatcher-runner system** in delta mode:

**Execution flow:**
1. **Secrets scan** (pre-flight) — Hardcoded secrets block immediately
2. **Dispatch system** — Routes file to appropriate runners by `FileKind`
3. **Runners execute** by priority (5 → 50):
   - TypeScript type-checking (`ts-lsp`)
   - Python type-checking (`pyright`)
   - Linting (`biome`, `ruff`)
   - Structural analysis (`ast-grep-napi`, `ast-grep`)
   - Type safety (`type-safety`)
   - AI slop detection (`python-slop`)
   - Architecture rules (`architect`)
   - Go/Rust analysis (`go-vet`, `rust-clippy`)

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

### At Session Start

When pi starts a new session, pi-lens performs initialization scans to establish baselines and surface existing technical debt:

**Initialization sequence:**
1. **Reset session state** — Clear metrics and complexity baselines
2. **Detect available tools** — Biome, ast-grep, Ruff, Knip, jscpd, Madge, type-coverage, Go, Rust
3. **Load architect rules** — If `architect.yml` or `.architect.yml` present
4. **Detect test runner** — Jest, Vitest, Pytest, etc.
5. **Error ownership reminder** — "Fix errors even if you didn't cause them"
6. **Scan project rules** — `.claude/rules/`, `.agents/rules/`, `CLAUDE.md`, `AGENTS.md`

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

### Automated Fixes

```
/lens-booboo-fix
```

Sequential automated fixing:
1. Biome/Ruff auto-fixes (mechanical issues)
2. jscpd duplicate resolution
3. knip dead code removal
4. AST-grep structural fixes
5. AI-guided slop cleanup

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

### Interactive Refactoring

```
/lens-booboo-refactor
```

Interactive architectural refactoring session. Scans for worst offenders by debt score, opens browser interview with AI-generated options, and implements changes with user confirmation.

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

### Delta-mode feedback

All runners operate in **delta mode**:
- **First write/edit:** Full scan, all issues tracked
- **Subsequent edits:** Only **NEW** issues shown (pre-existing issues filtered out)
- **Goal:** Reduce noise — don't spam agent with issues they didn't cause

---

## Architecture

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
                                                      │
    ┌─────────────────────────┼───────────────────────┘
    │                         │
    ▼                         ▼
┌──────────┐           ┌──────────────┐
│ ruff     │           │ ast-grep-napi│
│ (prio 10)│           │ (prio 15)    │
│ Py lint  │           │ TS/JS struct │
└──────────┘           └──────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌──────────┐           ┌──────────┐           ┌──────────┐
│type-safe │           │py-slop   │           │ast-grep  │
│(prio 20) │           │(prio 25) │           │(prio 30) │
│TS switch │           │Py slop   │           │Other lang│
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

### Available Runners

| Runner | Language | Priority | Output | Description |
|--------|----------|----------|--------|-------------|
| **ts-lsp** | TypeScript | 5 | Blocking | TypeScript errors (hard stops) |
| **pyright** | Python | 5 | Blocking | Python type errors (hard stops) |
| **biome** | TS/JS | 10 | Warning | Linting issues (delta-tracked) |
| **ruff** | Python | 10 | Warning | Python linting (delta-tracked) |
| **ast-grep-napi** | TS/JS | 15 | Warning | **100x faster** structural analysis |
| **type-safety** | TS | 20 | Mixed | Switch exhaustiveness (blocking), other (warning) |
| **python-slop** | Python | 25 | Warning | AI slop detection (~40 patterns) |
| **ast-grep** | Go, Rust, Python, etc. | 30 | Warning | Structural analysis via CLI (fallback for non-TS/JS) |
| **similarity** | TS | 35 | Silent | Semantic duplicate detection (metrics only) |
| **architect** | All | 40 | Warning | Architectural rule violations |
| **go-vet** | Go | 50 | Warning | Go static analysis |
| **rust-clippy** | Rust | 50 | Warning | Rust linting |

**Disabled runners:** `ts-slop` (merged into `ast-grep-napi`)

**Non-runner checks** (handled separately in `tool_result` hook):
- **Secrets scanning** — Blocks on hardcoded secrets in ANY file type

### Runner Output Semantics

- **Blocking:** Hard stop — agent must fix before continuing (🔴 STOP)
- **Warning:** Tracked in delta mode, surfaced via `/lens-booboo` (not inline to reduce noise)
- **Delta mode:** Only NEW issues since turn start are tracked (pre-existing issues don't spam)

---

## Language Support

### JavaScript / TypeScript

Fully supported with multiple runners:
- TypeScript language server (type checking)
- Biome (linting + formatting)
- @ast-grep/napi (structural analysis, 100x faster than CLI)
- Knip (dead code)
- jscpd (duplicates)
- type-coverage (`any` detection)

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

---

## Dependent Tools

pi-lens works out of the box for TypeScript/JavaScript. For full language support, install these tools — **all are optional and gracefully skip if not installed**:

### JavaScript / TypeScript

| Tool | Install | What it does |
|------|---------|--------------|
| `@biomejs/biome` | `npm i -D @biomejs/biome` | Linting + formatting |
| `knip` | `npm i -D knip` | Dead code / unused exports |
| `jscpd` | `npm i -D jscpd` | Copy-paste detection |
| `type-coverage` | `npm i -D type-coverage` | TypeScript `any` coverage % |
| `@ast-grep/napi` | `npm i -D @ast-grep/napi` | Fast structural analysis (TS/JS) |
| `@ast-grep/cli` | `npm i -D @ast-grep/cli` | Structural pattern matching (all languages) |

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

---

## Commands

| Command | Status | Description |
|---------|--------|-------------|
| `/lens-booboo` | ✅ Active | Full codebase review (8-part analysis) |
| `/lens-booboo-fix` | ✅ Active | Automated mechanical fixes |
| `/lens-booboo-refactor` | ✅ Active | Interactive architectural refactoring |
| `/lens-format` | ✅ Active | Apply Biome formatting |
| `/lens-tdi` | ✅ Active | Technical Debt Index and trends |
| `/lens-rate` | ⚠️ Deprecated | ~~Code quality score~~ — use `/lens-booboo` |
| `/lens-metrics` | ⚠️ Deprecated | ~~Complexity metrics~~ — use `/lens-booboo` |

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

**Design Smells** (architectural — handled by `/lens-booboo-refactor`)
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

## Flags

| Flag | Description |
|------|-------------|
| `--lens-verbose` | Enable console logging |
| `--autofix-biome` | Auto-fix lint issues with Biome |
| `--autofix-ruff` | Auto-fix lint issues with Ruff (Python) |
| `--no-tests` | Disable test runner on write |
| `--no-madge` | Skip circular dependency checks |
| `--no-ast-grep` | Skip ast-grep structural analysis |
| `--no-biome` | Skip Biome linting |
| `--no-lsp` | Skip TypeScript/Python LSP type checking |
| `--error-debt` | Track test regressions across sessions |

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
│   ├── dispatch/         # Dispatcher and runners
│   │   ├── dispatcher.ts
│   │   └── runners/      # Individual runners
│   │       ├── ast-grep-napi.ts      # Fast TS/JS runner
│   │       ├── python-slop.ts        # Python slop detection
│   │       ├── ts-slop.ts            # TS slop (CLI fallback)
│   │       ├── biome.ts
│   │       ├── ruff.ts
│   │       ├── pyright.ts
│   │       ├── go-vet.ts
│   │       └── rust-clippy.ts
│   ├── complexity-client.ts
│   ├── type-safety-client.ts
│   └── secrets-scanner.ts
├── commands/             # pi commands
│   ├── booboo.ts
│   ├── fix-simplified.ts
│   └── lens-booboo.ts
├── rules/                # AST-grep rules
│   ├── ast-grep-rules/   # General structural rules
│   ├── ts-slop-rules/    # TypeScript slop patterns
│   └── python-slop-rules/# Python slop patterns
├── index.ts              # Main entry point
└── package.json
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full history.

### Latest Highlights

- **NAPI Runner:** 100x faster TypeScript/JavaScript analysis (~9ms vs ~1200ms)
- **Slop Detection:** 30+ TypeScript and 40+ Python patterns for AI-generated code quality issues
- **Deprecated Commands:** `/lens-rate` and `/lens-metrics` deprecated in favor of `/lens-booboo`

---

## License

MIT
