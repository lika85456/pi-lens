# Fix Plan — Iteration 1

📋 BOOBOO FIX PLAN — Iteration 1/10 (4 fixable items remaining)

⚡ Auto-fixed: Biome --write --unsafe, Ruff --fix + format already ran.

## 🗑️ Dead code [2 item(s)] — delete before fixing violations
→ Remove unused exports/files — no point fixing violations in code you're about to delete.
  - [unlisted] `minimatch` in clients/architect-client.js
  - [export] `TypeScriptService` in clients/ts-service.js

## 🔨 Fix these [1 items]

### no-console-log (1)
→ Remove or replace with class logger method
  - `test-complexity.ts:11`

## 🤖 AI Slop indicators [1 files]
  - `index.ts`: Excessive comments (33%), Many try/catch blocks (14)

## ⏭️ Skip [144 items — architectural]
  - **long-method** (91): Extraction requires understanding the function's purpose.
  - **large-class** (19): Splitting a class requires architectural decisions.
  - **long-parameter-list** (13): Redesigning the signature requires an API decision.
  - **no-single-char-var** (12): Renaming requires understanding the variable's purpose.
  - **no-process-env** (2): Using process.env directly makes code untestable. Use DI or a config module.
  - **no-non-null-assertion** (6): Each `!` needs nullability analysis in context.
  - **no-as-any** (1): Replacing `as any` requires knowing the correct type.

---
**ACTION REQUIRED**: Fix the items above in order using your available tools. Once all fixable items are resolved, you MUST run `/lens-booboo-fix` again to verify and proceed to the next iteration.
If an item is not safe to fix, skip it with a one-sentence explanation of the risk.