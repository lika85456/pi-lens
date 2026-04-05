# AST-Grep Rules Reference

pi-lens uses **ast-grep** for fast structural pattern matching across multiple languages. This document describes all 112 rules (56 unique patterns × 2 languages: TypeScript and JavaScript).

## Overview

**What ast-grep catches:**
- **Security vulnerabilities** — Hardcoded secrets, SQL injection, unsafe regex, JWT without verification
- **Runtime errors** — NaN comparison, discarded errors, unchecked throwing calls, TOCTOU
- **Code quality** — Empty catch blocks, missing returns, long methods, deep nesting
- **Best practices** — Strict equality, proper error handling, no debugger statements

**How it works:**
1. Patterns are written in YAML with AST matchers
2. Runs via `@ast-grep/napi` (fast Rust core) or CLI ast-grep
3. Severity determines blocking vs warning behavior
4. Auto-fix available for some rules (applied by Biome/Ruff/ESLint, not ast-grep directly)

---

## Rule Categories

### 🔴 Security (Blocking Errors)

Rules that detect vulnerabilities exploitable by attackers or guaranteed runtime crashes.

| Rule | Languages | What it catches | Severity |
|------|-----------|-----------------|----------|
| **no-hardcoded-secrets** | TS, JS | API keys, passwords, tokens hardcoded in source | 🔴 error |
| **no-sql-in-code** | TS, JS | SQL queries built with string concatenation | 🔴 error |
| **jwt-no-verify** | TS, JS | JWT verification without secret/key (accepts any token) | 🔴 error |
| **weak-rsa-key** | TS, JS | RSA keys < 2048 bits (cryptographically weak) | 🔴 error |
| **no-insecure-randomness** | TS, JS | `Math.random()` for security (predictable) | 🔴 error |
| **no-inner-html** | TS, JS | `innerHTML` assignment (XSS risk) | 🔴 error |
| **unchecked-sync-fs** | TS, JS | `fs.statSync/readFileSync` without try/catch | 🔴 error |
| **unchecked-throwing-call** | TS, JS | `JSON.parse`, `new URL()`, `execSync` without try/catch | 🔴 error |
| **unchecked-throwing-call-python** | Python | `open()`, `json.loads()` without try/except | 🔴 error |
| **unchecked-throwing-call-ruby** | Ruby | `File.read`, `JSON.parse` without begin/rescue | 🔴 error |
| **no-nan-comparison** | TS, JS | `x === NaN` (always false, use `Number.isNaN()`) | 🔴 error |
| **no-discarded-error** | TS, JS | `new Error()` as standalone statement (forgot throw) | 🔴 error |
| **toctou** | TS, JS | Time-of-check-time-of-use race conditions | 🔴 error |
| **no-throw-string** | TS, JS | `throw "string"` (loses stack trace) | 🔴 error |
| **no-prototype-builtins** | TS, JS | Calling prototype methods directly on objects | 🔴 error |

### 🔴 Structural Safety (Blocking Errors)

| Rule | Languages | What it catches | Severity |
|------|-----------|-----------------|----------|
| **empty-catch** | TS, JS | `catch {}` silently swallowing errors | 🔴 error |
| **no-bare-except** | Python | `except:` catching all exceptions including SystemExit | 🔴 error |
| **no-cond-assign** | TS, JS | `if (x = y)` assignment in condition | 🔴 error |
| **no-constant-condition** | TS, JS | `if (true)` or always-true/false conditions | 🔴 error |
| **no-constructor-return** | TS, JS | `return` statement in constructor | 🔴 error |
| **no-async-promise-executor** | TS, JS | `new Promise(async () => {})` (error swallowing) | 🔴 error |
| **no-await-in-promise-all** | TS, JS | `await` inside `Promise.all()` (sequentializes parallel work) | 🔴 error |
| **no-compare-neg-zero** | TS, JS | `x === -0` (doesn't work as expected) | 🔴 error |
| **no-comparison-to-none** | Python | `== None` instead of `is None` | 🔴 error |

### 🟡 Code Quality (Warnings)

| Rule | Languages | What it catches | Severity |
|------|-----------|-----------------|----------|
| **no-console** | TS, JS | `console.log` in production code | 🟡 warning |
| **no-debugger** | TS, JS | `debugger` statements left in code | 🟡 warning |
| **no-alert** | TS, JS | `alert()`, `confirm()`, `prompt()` (poor UX) | 🟡 warning |
| **strict-equality** | TS, JS | `==` instead of `===` | 🟡 warning |
| **no-await-in-loop** | TS, JS | Sequential await in loops (slow) | 🟡 warning |
| **missed-concurrency** | TS, JS | Sequential awaits that could be parallel | 🟡 warning |
| **no-as-any** | TS, JS | `as any` type assertions (unsafe) | 🟡 warning |
| **no-any-type** | TS | `any` type usage (loses type safety) | 🟡 warning |
| **long-method** | TS, JS | Functions > 50 lines | 🟡 warning |
| **long-parameter-list** | TS, JS | Functions with > 5 parameters | 🟡 warning |
| **nested-ternary** | TS, JS | Ternary nesting > 2 levels | 🟡 warning |
| **large-class** | TS, JS | Classes > 300 lines | 🟡 warning |
| **array-callback-return** | TS, JS | Missing return in array callbacks | 🔴 error |
| **getter-return** | TS, JS | Getter without return statement | 🔴 error |
| **no-case-declarations** | TS, JS | Variables declared in switch cases | 🟡 warning |
| **no-array-constructor** | TS, JS | `new Array()` (inconsistent behavior) | 🟡 warning |
| **jsx-boolean-short-circuit** | TS, JS | `{condition && <Component />}` (0 renders as 0) | 🔴 error |
| **no-unsafe-optional-chaining** | TS, JS | `a?.b.c` where `a?.b` could be undefined | 🔴 error |
| **no-unsafe-finally** | TS, JS | `return/throw/break/continue` in finally | 🔴 error |

### 🟡 Python-Specific

| Rule | What it catches | Severity |
|------|-----------------|----------|
| **no-bare-except** | `except:` without exception type | 🔴 error |
| **no-comparison-to-none** | `== None` instead of `is None` | 🔴 error |

---

## Severity Philosophy

| Level | Signal | Examples |
|-------|--------|----------|
| **error** | 🔴 STOP | Security bugs, runtime crashes, NaN comparison, unguarded throwing calls |
| **warning** | 🟡 | Style issues, readability, performance hints, console/debugger statements |

**Why severity matters:**
- **Errors block the agent** — Must be fixed before proceeding
- **Warnings accumulate** — Shown in `/lens-booboo` but don't block
- **Delta tracking** — Only NEW issues shown after first write

---

## Rule Details

### unchecked-throwing-call (Error)

**Catches:** `JSON.parse()`, `new URL()`, `execSync()`, `spawnSync()` without try/catch

**Why it matters:** These calls throw on invalid input. Without try/catch, they crash the process.

**Pattern:**
```yaml
rule:
  any:
    - pattern: JSON.parse($INPUT)
    - pattern: new URL($URL)
    - pattern: execSync($CMD)
  not:
    inside:
      kind: try_statement
      stopBy: end  # Check all ancestors, not just immediate parent
```

**Fix:** Wrap in try/catch with proper error handling.

---

### no-hardcoded-secrets (Error)

**Catches:** Hardcoded credentials in variable assignments

**Matches:** Variable names matching credential patterns:
- `password`, `passwd`, `pwd`
- `secret`, `token`, `apiKey`, `api_secret`
- `accessKey`, `privateKey`, `clientSecret`
- `credentials`, `bearer`, `auth`

**Pattern:**
```yaml
rule:
  any:
    - pattern: const $VAR = "$_"
    - pattern: const $VAR = '$_'
constraints:
  VAR:
    regex: "(password|secret|token|apiKey|...)"
```

**Fix:** Use environment variables: `const apiKey = process.env.API_KEY`

---

### no-nan-comparison (Error)

**Catches:** `x === NaN` or `x == NaN`

**Why it matters:** `NaN === NaN` is always `false`. Use `Number.isNaN(x)` instead.

---

### no-discarded-error (Error)

**Catches:** `new Error("...")` as a standalone statement

**Why it matters:** Creates an Error object but doesn't throw it. Usually means `throw` was forgotten.

**Fix:** Change to `throw new Error("...")`

---

### toctou (Error)

**Catches:** Time-of-check-time-of-use race conditions in file operations

**Pattern:** `fs.existsSync(path)` followed by `fs.readFileSync(path)` — file could be modified between check and use.

---

### empty-catch (Error)

**Catches:** `catch (e) { }` with empty body

**Why it matters:** Swallows errors silently. Makes debugging impossible.

**Fix:** Handle the error or remove try/catch if truly don't care.

---

### strict-equality (Warning)

**Catches:** `==` and `!=` (loose equality)

**Why it matters:** `0 == "0"` is true, `0 == []` is true, `"" == false` is true. Type coercion causes bugs.

**Fix:** Use `===` and `!==` always.

---

### no-await-in-loop (Warning)

**Catches:** `await` inside `for` loops

**Why it matters:** Sequentializes operations that could run in parallel. Slow.

**Fix:** Use `Promise.all(array.map(async item => ...))`

---

### missed-concurrency (Warning)

**Catches:** Sequential independent awaits

**Pattern:**
```typescript
const a = await fetchA();  // Sequential
const b = await fetchB();  // Doesn't need a's result
```

**Fix:** `const [a, b] = await Promise.all([fetchA(), fetchB()])`

---

## JavaScript Coverage

Most TypeScript rules have JavaScript equivalents (`-js.yml` suffix) because:
1. Different AST node types (TypeScript has `type_annotation`, `interface`, etc.)
2. JavaScript projects need the same protections
3. TS and JS run in separate passes

**Total rules:** 112 (56 unique patterns × 2 languages)

---

## Custom Rules

Add your own rules to `.pi-lens/rules/`:

```yaml
# .pi-lens/rules/no-fetch-without-timeout.yml
id: no-fetch-without-timeout
language: typescript
severity: warning
message: "fetch() without timeout can hang indefinitely"
rule:
  pattern: fetch($URL)
  not:
    inside:
      pattern: Promise.race([fetch($URL), $TIMEOUT])
```

**Tips:**
- Use `$VAR` for single node capture
- Use `$$$VAR` for multi-node capture  
- Use `not: inside:` for negative context
- Test with `ast-grep scan --rule your-rule.yml`

---

## References

- [ast-grep documentation](https://ast-grep.github.io/)
- [AST patterns guide](https://ast-grep.github.io/guide/rule-syntax.html)
- Source: `rules/ast-grep-rules/rules/*.yml`
