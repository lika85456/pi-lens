# Tree-Sitter Rules Reference

pi-lens uses **tree-sitter** for deep structural analysis via WebAssembly grammars. This document describes all 45 rules across 7 languages.

## Overview

**What tree-sitter catches:**
- **Security vulnerabilities** — SQL injection, unsafe regex, hardcoded secrets, eval
- **Language-specific bugs** — Empty catch blocks, defer-in-loop, mutable default args
- **Code quality** — Deep nesting, long parameter lists, console in production
- **Test hygiene** — Console statements in tests, debugger left in code

**How it works:**
1. Parses source files into AST using WASM grammars
2. Runs tree queries (S-expressions) against the AST
3. Post-filters for context-aware analysis (test blocks, try-catch)
4. Supports 7 languages: TypeScript, TSX, JavaScript, Python, Go, Rust, Ruby

**Architecture:**
- **TreeCache:** SHA-256 content-based AST caching (50-file LRU)
- **TreeSitterNavigator:** Scope detection (test blocks, loops, try-catch)
- **Post-filters:** Context-aware filtering (`in_test_block`, `not_in_try_catch`, etc.)

---

## Languages & Rule Counts

| Language | Rules | Grammar |
|----------|-------|---------|
| **TypeScript** | 17 | Built-in |
| **TSX** | 2 | Built-in |
| **Python** | 11 | Built-in |
| **Go** | 3 | Downloaded |
| **Rust** | 2 | Downloaded |
| **Ruby** | 8 | Downloaded |
| **Total** | **45** | 3 built-in + 4 downloaded |

Grammars are auto-downloaded at install time via `npm run download-grammars`.

---

## TypeScript/JavaScript Rules (17)

### 🔴 Security Errors

| Rule | What it catches | Example |
|------|-----------------|---------|
| **sql-injection** | Template literal interpolation in SQL queries | `` db.query(`SELECT * FROM users WHERE id = ${userId}`) `` |
| **unsafe-regex** | Regex constructed from variables (ReDoS risk) | `new RegExp(userInput)` |
| **hardcoded-secrets** | Hardcoded API keys, passwords | `const apiKey = "sk-live-1234567890"` |
| **eval** | `eval()` and `new Function()` (code injection) | `eval(userInput)` |
| **empty-catch** | Empty catch blocks silently swallowing errors | `catch (e) { }` |

### 🟡 Quality Warnings

| Rule | What it catches | Post-filter |
|------|-----------------|-------------|
| **console-statement** | `console.log` in production | `not_in_test_block` |
| **no-console-in-tests** | Console in test files only | `in_test_block` |
| **debugger** | `debugger` statements left in code | - |
| **await-in-loop** | Sequential await in loops | - |
| **deep-promise-chain** | Promise chains > 3 levels | - |
| **mixed-async-styles** | Mixing callbacks, promises, async/await | - |
| **deep-nesting** | Block nesting > 4 levels | - |
| **nested-ternary** | Ternary nesting > 2 levels | - |
| **long-parameter-list** | Functions with > 5 parameters | - |
| **constructor-super** | Missing super() in constructors | - |
| **no-dupe-class-members** | Duplicate class members | - |
| **variable-shadowing** | Variable name shadows outer scope | `name_matches_param` |

---

## TSX Rules (2)

| Rule | Severity | What it catches |
|------|----------|---------------|
| **dangerously-set-inner-html** | 🔴 error | `dangerouslySetInnerHTML` XSS risk |
| **no-nested-links** | 🟡 warning | `<a>` tags inside other `<a>` tags |

---

## Python Rules (11)

### 🔴 Errors

| Rule | What it catches | Example |
|------|-----------------|---------|
| **bare-except** | `except:` catching all exceptions | `except:` |
| **python-empty-except** | `except:` with only `pass` | `except: pass` |
| **mutable-default-arg** | Mutable default arguments | `def f(x=[])` |
| **python-mutable-class-attr** | Mutable class attributes | `class C: items = []` |
| **eval-exec** | `eval()` and `exec()` calls | `eval(user_input)` |
| **unreachable-except** | `except` after catch-all | `except Exception:` followed by `except ValueError:` |
| **python-hardcoded-secrets** | Hardcoded credentials | `API_KEY = "secret"` |
| **python-unsafe-regex** | `re.compile(variable)` | `re.compile(user_input)` |
| **python-raise-string** | `raise "string"` (TypeError in Python 3) | `raise "error"` |

### 🟡 Warnings

| Rule | What it catches |
|------|-----------------|
| **wildcard-import** | `from module import *` |
| **is-vs-equals** | `==` for None/singleton comparison |
| **python-debugger** | `breakpoint()`, `pdb.set_trace()` |
| **python-print-statement** | `print()` debug output |

---

## Go Rules (3)

| Rule | Severity | What it catches | Example |
|------|----------|-----------------|---------|
| **go-hardcoded-secrets** | 🔴 error | Hardcoded credentials in vars | `var apiKey = "secret"` |
| **go-defer-in-loop** | 🔴 error | `defer` inside loops (runs at function end, not loop end) | `for { defer cleanup() }` |
| **go-bare-error** | 🟡 warning | Error returned but not checked | `doSomething()` returns `error` |

---

## Rust Rules (2)

| Rule | Severity | What it catches | Example |
|------|----------|-----------------|---------|
| **rust-unwrap** | 🔴 error | `.unwrap()` that panics on None/Err | `vec.first().unwrap()` |
| **rust-clone-in-loop** | 🟡 info | Cloning in loops (performance hint) | `for x in items { x.clone() }` |

---

## Ruby Rules (8)

### 🔴 Errors

| Rule | What it catches | Example |
|------|-----------------|---------|
| **ruby-rescue-exception** | `rescue Exception` catching signals | `rescue Exception => e` |
| **ruby-empty-rescue** | Empty rescue block | `rescue => e; end` |
| **ruby-hardcoded-secrets** | Hardcoded credentials | `API_KEY = "secret"` |
| **ruby-unsafe-regex** | `Regexp.new(variable)` | `Regexp.new(user_input)` |
| **ruby-debugger** | `binding.pry`, `binding.irb` | `binding.pry` |

### 🟡 Warnings

| Rule | What it catches |
|------|-----------------|
| **ruby-puts-statement** | `puts`, `p`, `pp` debug output |
| **ruby-eval** | `eval()` calls |
| **ruby-open-struct** | `OpenStruct` usage (performance, typo-risk) |

---

## Post-Filter System

Tree-sitter rules support context-aware filtering via post-filters:

| Filter | Purpose | Used By |
|--------|---------|---------|
| `in_test_block` | Keep only matches inside test functions | `no-console-in-tests` |
| `not_in_test_block` | Keep only matches outside test functions | `console-statement` |
| `not_in_function` | Keep only class-level statements | `python-mutable-class-attr` |
| `not_in_try_catch` | Flag unguarded throwing calls | `unchecked-*` rules (ast-grep) |
| `in_try_catch` | Keep only matches inside try/catch | - |
| `check_secret_pattern` | Variable name matches credential patterns | `hardcoded-secrets` (all) |
| `python_empty_except` | Block contains only pass/comment | `python-empty-except` |
| `ruby_empty_rescue` | Block contains only nil/comment | `ruby-empty-rescue` |
| `name_matches_param` | Shadowing detection (NAME === PARAM) | `variable-shadowing` |

---

## Rule Details

### sql-injection (TypeScript, Error)

**Query:** Matches `query()`, `execute()`, `exec()`, `run()` calls with template string containing interpolations.

```scheme
(call_expression
  function: [
    (identifier) @SQL_FUNC
    (member_expression property: (property_identifier) @SQL_FUNC)
  ]
  arguments: (arguments
    (template_string (template_substitution) @INTERPOLATION))
  (#match? @SQL_FUNC "^(query|execute|exec|run)$"))
```

**Fix:** Use parameterized queries:
```typescript
// ❌ BAD
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// ✅ GOOD
db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

---

### go-defer-in-loop (Go, Error)

**Why it matters:** `defer` runs when the **function** returns, not when the loop iteration ends. Resource leaks and logic errors.

```go
// ❌ BAD
for _, file := range files {
    f := os.Open(file)
    defer f.Close()  // All defers run at function end, not loop end!
}

// ✅ GOOD
for _, file := range files {
    f := os.Open(file)
    f.Close()  // Close immediately
}
```

---

### rust-unwrap (Rust, Error)

**Why it matters:** `.unwrap()` panics on `None` or `Err`. Use `?` or `match` for proper error handling.

```rust
// ❌ BAD
let first = vec.first().unwrap();

// ✅ GOOD
let first = vec.first()?;
// or
let first = match vec.first() {
    Some(v) => v,
    None => return Err("Empty".into()),
};
```

---

### ruby-rescue-exception (Ruby, Error)

**Why it matters:** `rescue Exception` catches everything including `SystemExit`, `SignalException`, `NoMemoryError`. Usually wrong.

```ruby
# ❌ BAD
begin
  do_work
rescue Exception => e  # Catches Ctrl-C, kill signals!
  log_error(e)
end

# ✅ GOOD
begin
  do_work
rescue StandardError => e  # Only catch application errors
  log_error(e)
end
```

---

### python-mutable-class-attr (Python, Error)

**Why it matters:** Mutable class attributes are shared across all instances.

```python
# ❌ BAD
class User:
    items = []  # Shared by ALL instances!

u1 = User()
u1.items.append("a")

u2 = User()
print(u2.items)  # ["a"] - surprise!

# ✅ GOOD
class User:
    def __init__(self):
        self.items = []  # Per-instance
```

---

### variable-shadowing (TypeScript, Warning)

**Why it matters:** Inner variable with same name as outer variable causes confusion.

```typescript
function process(data) {        // outer 'data'
  const items = data.map(data => {  // inner 'data' shadows!
    return data.name;
  });
}
```

**Post-filter:** `name_matches_param` only flags when shadow name === outer param name.

---

## Query Syntax

Tree-sitter queries use S-expressions matching AST nodes:

```yaml
query: |
  (call_expression
    function: (identifier) @FUNC
    arguments: (arguments (string) @STR))
```

**Key features:**
- **Node types:** `(identifier)`, `(call_expression)`, `(function_declaration)`
- **Field names:** `function:`, `arguments:`, `body:`
- **Captures:** `@FUNC`, `@STR` (named metavariables)
- **Predicates:** `(#match? @FUNC "^query$")` regex matching
- **Anchors:** `(#eq? @A @B)` equality test

---

## Custom Rules

Add custom tree-sitter queries to `.pi-lens/rules/tree-sitter-queries/{lang}/`:

```yaml
# .pi-lens/rules/tree-sitter-queries/typescript/no-settimeout.yml
id: no-settimeout
name: Avoid setTimeout
severity: warning
language: typescript
message: "Use scheduler/task queue instead of setTimeout"
query: |
  (call_expression
    function: (identifier) @FUNC
    (#eq? @FUNC "setTimeout"))
```

---

## References

- [Tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/)
- [Query syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)
- WebAssembly grammars: Downloaded from [tree-sitter releases](https://github.com/tree-sitter/tree-sitter/releases)
- Source: `rules/tree-sitter-queries/*/*.yml`
