# pi-lens LSP Server Status Summary

## Overview

pi-lens supports multiple Language Servers for different programming languages. The LSP integration provides real-time diagnostics (errors, warnings, hints) directly from the language's official tooling.

## LSP Server Status Table

| Language | Server ID | Server Name | Extensions | Status | Notes |
|----------|-----------|-------------|------------|--------|-------|
| **TypeScript/JavaScript** | `typescript` | TypeScript Language Server | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts` | ✅ **Working** | Uses local `typescript-language-server` with tsserver path. Fixed Windows path normalization. |
| **Python** | `python` | Pyright Language Server | `.py`, `.pyi` | ⚠️ **Needs Fix** | Spawns via npx, but diagnostics not yet verified. Needs project root marker (requirements.txt, pyproject.toml, etc.). |
| **Go** | `go` | gopls | `.go` | ⚠️ **Not Tested** | Uses `gopls` command. Needs Go toolchain. |
| **Rust** | `rust` | rust-analyzer | `.rs` | ⚠️ **Not Tested** | Uses `rust-analyzer` command. Needs Rust toolchain. |
| **Ruby** | `ruby` | Ruby LSP | `.rb`, `.rake`, `.gemspec`, `.ru` | ⚠️ **Not Tested** | Uses `ruby-lsp` or `solargraph` command. |
| **PHP** | `php` | Intelephense | `.php` | ⚠️ **Not Tested** | Uses `intelephense` command. |
| **C#** | `csharp` | csharp-ls | `.cs` | ⚠️ **Not Tested** | Uses `csharp-ls` command. |
| **F#** | `fsharp` | FSAutocomplete | `.fs`, `.fsi`, `.fsx` | ⚠️ **Not Tested** | Uses `fsautocomplete` command. |
| **Java** | `java` | JDT Language Server | `.java` | ⚠️ **Not Tested** | Uses bundled JDT or Eclipse JDT. |
| **Kotlin** | `kotlin` | Kotlin Language Server | `.kt`, `.kts` | ⚠️ **Not Tested** | Uses `kotlin-language-server` command. |
| **Swift** | `swift` | SourceKit-LSP | `.swift` | ⚠️ **Not Tested** | Uses `sourcekit-lsp` command. macOS/Linux only. |
| **Dart** | `dart` | Dart Analysis Server | `.dart` | ⚠️ **Not Tested** | Uses `dart` CLI with language-server option. |
| **Lua** | `lua` | Lua Language Server | `.lua` | ⚠️ **Not Tested** | Uses `lua-language-server` command. |
| **ESLint** | `eslint` | ESLint Language Server | `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte` | ✅ **Working** | Uses `vscode-eslint` via npx. Detects unused vars, console logs, etc. |

## Verified Working

### ESLint LSP ✅

**Implementation:** `clients/lsp/server.ts` - `ESLintServer`

**Features:**
- Runs `vscode-eslint` language server via npx
- Detects ESLint rule violations (unused vars, console logs, etc.)
- Supports flat config (`eslint.config.js`) and legacy configs (`.eslintrc`)
- Works with `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`

**Test Results:**
- ✅ Detects `no-unused-vars` errors
- ✅ Detects `no-console` warnings
- ✅ Respects flat config format (eslint.config.js)

**Root Detection:**
- `eslint.config.js`, `eslint.config.mjs`
- `.eslintrc`, `.eslintrc.json`, `.eslintrc.js`
- `package.json` (for eslintConfig field)

---

### TypeScript/JavaScript LSP ✅

**Implementation:** `clients/lsp/server.ts` - `TypeScriptServer`

**Features:**
- Detects local `typescript-language-server` in `node_modules/.bin/`
- Falls back to auto-installed version via `npx`
- Configures tsserver path for proper TypeScript analysis
- Windows path normalization (lowercase for case-insensitive lookup)

**Test Results:**
- ✅ Detects type errors (string → number)
- ✅ Detects unused variables
- ✅ Returns 2-5 diagnostics per file with intentional errors
- ✅ Windows case-insensitive path lookup working

**Root Detection:**
- `tsconfig.json`
- `package.json`
- `.git/` directory

---

## Implementation Details

### Key Fixes for Windows

1. **Path Normalization** (`clients/lsp/path-utils.ts`):
   - `normalizeMapKey()` - lowercase paths for Map keys
   - `uriToPath()` - converts LSP URIs to normalized paths

2. **Client Caching** (`clients/lsp/index.ts`):
   - Normalized root path for cache keys
   - Prevents duplicate clients for same project

3. **LSP Spawn** (`clients/lsp/launch.ts`):
   - Uses `shell: true` for `.cmd` files on Windows
   - Absolute paths for shell mode
   - `launchViaPackageManager()` for npx/bun

### Server Spawn Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| Local binary | TypeScript | Check `node_modules/.bin/` first |
| `launchLSP()` | Go, Rust, etc. | Direct command spawn |
| `launchViaPackageManager()` | Python, ESLint | Uses npx/bun to run package |

---

## Recommendations

### High Priority
1. **Python LSP** - Fix diagnostics retrieval (spawn works, verify notification handling)
2. **ESLint LSP** - Test with ESLint config files

### Medium Priority
3. **Go LSP** - Test with Go module
4. **Rust LSP** - Test with Cargo project

### Low Priority
5. Other LSP servers (Ruby, PHP, Java, etc.) - Test as needed

---

## Architecture

```
File Open
    ↓
Detect Language → Find LSP Server
    ↓
Get/Create LSP Client (cached by root+server)
    ↓
Send textDocument/didOpen
    ↓
LSP Server analyzes file
    ↓
Receive textDocument/publishDiagnostics
    ↓
Store with normalized path → Display to user
```

## Files

- `clients/lsp/server.ts` - LSP server definitions
- `clients/lsp/client.ts` - JSON-RPC client implementation
- `clients/lsp/launch.ts` - Process spawning utilities
- `clients/lsp/path-utils.ts` - Cross-platform path normalization
- `clients/lsp/index.ts` - Service layer and client caching
