# Fix Plan — Iteration 1

📋 BOOBOO FIX PLAN — Iteration 1/3 (20 fixable items remaining)

⚡ Auto-fixed: Biome --write --unsafe, Ruff --fix + format already ran.

## 🔁 Duplicate code [16 block(s)] — fix first
→ Extract duplicated blocks into shared utilities before fixing violations in them.
  - 9 lines: `clients/typescript-client.ts:460` ↔ `clients/typescript-client.ts:356`
  - 7 lines: `clients/todo-scanner.test.ts:92` ↔ `clients/todo-scanner.test.ts:29`
  - 9 lines: `clients/todo-scanner.test.ts:106` ↔ `clients/todo-scanner.test.ts:29`
  - 6 lines: `clients/ruff-client.ts:263` ↔ `clients/rust-client.ts:185`
  - 10 lines: `clients/ruff-client.test.ts:37` ↔ `clients/rust-client.test.ts:38`
  - 7 lines: `clients/go-client.ts:186` ↔ `clients/rust-client.ts:185`
  - 8 lines: `clients/go-client.ts:192` ↔ `clients/rust-client.ts:191`
  - 7 lines: `clients/complexity-client.ts:684` ↔ `clients/complexity-client.ts:641`
  - 11 lines: `clients/biome-client.ts:141` ↔ `clients/ruff-client.ts:228`
  - 16 lines: `clients/biome-client.ts:165` ↔ `clients/ruff-client.ts:247`
  ... and 6 more

## 🤖 AI Slop indicators [4 files]
  - `clients/ruff-client.ts`: Many try/catch blocks (6)
  - `clients/subprocess-client.ts`: Excessive comments (34%), Over-abstraction (6 single-use helpers)
  - `clients/test-runner-client.ts`: Many try/catch blocks (6)
  - `index.ts`: Many try/catch blocks (19)

## ⏭️ Skip [109 items — architectural]
  - **long-method** (79): Extraction requires understanding the function's purpose.
  - **large-class** (16): Splitting a class requires architectural decisions.
  - **no-non-null-assertion** (6): Each `!` needs nullability analysis in context.
  - **long-parameter-list** (8): Redesigning the signature requires an API decision.

---
Fix the items above in order, then run `/lens-booboo-fix` again for the next iteration.
If an item is not safe to fix, skip it with one sentence why.