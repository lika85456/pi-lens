# Enhance TDI with Max Cyclomatic and Entropy - Implementation Plan

> **For Pi:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two missing complexity metrics to TDI calculation for more complete code health assessment: Max Cyclomatic (worst function) and Code Entropy (unpredictability).

**Architecture:** Extend MetricSnapshot to capture max cyclomatic and entropy, add debt calculations for each, rebalance weights across all 5 categories.

**Tech Stack:** TypeScript, pi-lens metrics-history system

---

## Current vs Proposed TDI

**Current (3 factors):**
- MI debt: 50%
- Cognitive: 35%
- Nesting: 15%

**Proposed (5 factors):**
- MI debt: 45% (reduced from 50%)
- Cognitive: 30% (reduced from 35%)
- Nesting: 10% (reduced from 15%)
- **Max Cyclomatic: 10%** (NEW)
- **Entropy: 5%** (NEW)

**Why these weights:**
- Max Cyclomatic (10%): Catches "worst offender" functions that average cyclomatic hides
- Entropy (5%): Measures unpredictability/vocabulary richness - important but less critical than structural complexity

---

### Task 1: Extend MetricSnapshot Type

**Files:**
- Modify: `clients/metrics-history.ts:15-25`

**Step 1: Add maxCyclomatic and entropy to MetricSnapshot**

Change from:
```typescript
export interface MetricSnapshot {
	commit: string;
	timestamp: string;
	mi: number;
	cognitive: number;
	nesting: number;
	lines: number;
}
```

To:
```typescript
export interface MetricSnapshot {
	commit: string;
	timestamp: string;
	mi: number;
	cognitive: number;
	nesting: number;
	lines: number;
	maxCyclomatic: number; // NEW: worst function complexity
	entropy: number; // NEW: code unpredictability in bits
}
```

**Step 2: Build and verify**

Run: `npx tsc`

Expected: Errors from captureSnapshot() not passing new fields (will fix next)

**Step 3: Commit**

```bash
git add clients/metrics-history.ts
git commit -m "types: add maxCyclomatic and entropy to MetricSnapshot"
```

**Verification:**
- [ ] `maxCyclomatic` field added
- [ ] `entropy` field added
- [ ] Commit made

---

### Task 2: Capture New Metrics in index.ts

**Files:**
- Modify: `index.ts:1095-1115` (captureSnapshot call)

**Step 1: Find captureSnapshot call**

Locate where `captureSnapshot()` is called in the `tool_call` handler:

```typescript
// Around line 1097
captureSnapshot(filePath, {
	maintainabilityIndex: baseline.maintainabilityIndex,
	cognitiveComplexity: baseline.cognitiveComplexity,
	maxNestingDepth: baseline.maxNestingDepth,
	linesOfCode: baseline.linesOfCode,
});
```

**Step 2: Add new fields**

Change to:
```typescript
captureSnapshot(filePath, {
	maintainabilityIndex: baseline.maintainabilityIndex,
	cognitiveComplexity: baseline.cognitiveComplexity,
	maxNestingDepth: baseline.maxNestingDepth,
	linesOfCode: baseline.linesOfCode,
	maxCyclomatic: baseline.maxCyclomaticComplexity,
	entropy: baseline.codeEntropy,
});
```

**Step 3: Verify ComplexityClient has these fields**

Check `baseline.maxCyclomaticComplexity` and `baseline.codeEntropy` exist on `FileComplexity` interface in `complexity-client.ts`.

They should already exist from previous implementation.

**Step 4: Build and verify**

Run: `npx tsc`

Expected: Compiles successfully

**Step 5: Commit**

```bash
git add index.ts
git commit -m "feat: capture maxCyclomatic and entropy in complexity snapshots"
```

**Verification:**
- [ ] `captureSnapshot()` updated with new fields
- [ ] Build passes
- [ ] Commit made

---

### Task 3: Update captureSnapshot Function

**Files:**
- Modify: `clients/metrics-history.ts:111-130`

**Step 1: Update captureSnapshot to accept and store new fields**

Change the function signature and implementation:

From:
```typescript
export function captureSnapshot(
	filePath: string,
	metrics: {
		maintainabilityIndex: number;
		cognitiveComplexity: number;
		maxNestingDepth: number;
		linesOfCode: number;
	},
): void
```

To:
```typescript
export function captureSnapshot(
	filePath: string,
	metrics: {
		maintainabilityIndex: number;
		cognitiveComplexity: number;
		maxNestingDepth: number;
		linesOfCode: number;
		maxCyclomatic: number;
		entropy: number;
	},
): void
```

And update the snapshot creation inside the function:

From:
```typescript
const snapshot: MetricSnapshot = {
	commit,
	timestamp: new Date().toISOString(),
	mi: Math.round(metrics.maintainabilityIndex * 10) / 10,
	cognitive: metrics.cognitiveComplexity,
	nesting: metrics.maxNestingDepth,
	lines: metrics.linesOfCode,
};
```

To:
```typescript
const snapshot: MetricSnapshot = {
	commit,
	timestamp: new Date().toISOString(),
	mi: Math.round(metrics.maintainabilityIndex * 10) / 10,
	cognitive: metrics.cognitiveComplexity,
	nesting: metrics.maxNestingDepth,
	lines: metrics.linesOfCode,
	maxCyclomatic: metrics.maxCyclomatic,
	entropy: Math.round(metrics.entropy * 100) / 100,
};
```

**Step 2: Build and verify**

Run: `npx tsc`

Expected: Compiles successfully

**Step 3: Commit**

```bash
git add clients/metrics-history.ts
git commit -m "feat: captureSnapshot accepts and stores maxCyclomatic and entropy"
```

**Verification:**
- [ ] Function signature updated
- [ ] Snapshot creation includes new fields
- [ ] Build passes
- [ ] Commit made

---

### Task 4: Update ProjectTDI Interface

**Files:**
- Modify: `clients/metrics-history.ts:370-385`

**Step 1: Add new categories to ProjectTDI**

Change from:
```typescript
export interface ProjectTDI {
	score: number; // 0-100, higher = more debt
	grade: string; // A-F
	avgMI: number;
	totalCognitive: number;
	filesAnalyzed: number;
	filesWithDebt: number;
	byCategory: {
		complexity: number;
		maintainability: number;
		nesting: number;
	};
}
```

To:
```typescript
export interface ProjectTDI {
	score: number; // 0-100, higher = more debt
	grade: string; // A-F
	avgMI: number;
	totalCognitive: number;
	filesAnalyzed: number;
	filesWithDebt: number;
	byCategory: {
		maintainability: number; // 45% - MI-based
		cognitive: number; // 30%
		nesting: number; // 10%
		maxCyclomatic: number; // 10% - NEW
		entropy: number; // 5% - NEW
	};
}
```

**Step 2: Build and verify**

Run: `npx tsc`

Expected: Errors from computeTDI not returning new fields (will fix next)

**Step 3: Commit**

```bash
git add clients/metrics-history.ts
git commit -m "types: add maxCyclomatic and entropy to ProjectTDI breakdown"
```

**Verification:**
- [ ] Interface updated with new categories
- [ ] Comments show new weights
- [ ] Commit made

---

### Task 5: Update computeTDI Calculation

**Files:**
- Modify: `clients/metrics-history.ts:390-470`

**Step 1: Add tracking variables for new metrics**

Find the accumulation section and add:

```typescript
let debtFromMaxCyclomatic = 0; // NEW
let debtFromEntropy = 0; // NEW
```

**Step 2: Calculate debt for each file**

In the file loop, add after nesting debt calculation:

```typescript
// Max Cyclomatic debt: 0 at max<=10, 1 at max>=30
const maxCycDebt = Math.min(1, Math.max(0, snap.maxCyclomatic - 10) / 20);
debtFromMaxCyclomatic += maxCycDebt;

// Entropy debt: 0 at entropy<=4.0, 1 at entropy>=7.0
const entropyDebt = Math.min(1, Math.max(0, snap.entropy - 4.0) / 3.0);
debtFromEntropy += entropyDebt;
```

**Step 3: Update fileDebt threshold check**

Change from:
```typescript
fileDebt = miDebt + cogDebt + nestDebt;
if (fileDebt > 1) filesWithDebt++;
```

To:
```typescript
fileDebt = miDebt + cogDebt + nestDebt + maxCycDebt + entropyDebt;
if (fileDebt > 0.5) filesWithDebt++; // Lowered threshold since we have more factors
```

**Step 4: Update normalization section**

Add after existing debt normalizations:

```typescript
const avgMaxCycDebt = debtFromMaxCyclomatic / files.length;
const avgEntropyDebt = debtFromEntropy / files.length;
```

**Step 5: Update TDI score calculation with new weights**

Change from:
```typescript
// Weighted: MI matters most (50%), cognitive (35%), nesting (15%)
const rawScore = avgMIDebt * 50 + avgCogDebt * 35 + avgNestDebt * 15;
```

To:
```typescript
// Weighted: MI (45%), cognitive (30%), nesting (10%), maxCyc (10%), entropy (5%)
const rawScore =
	avgMIDebt * 45 +
	avgCogDebt * 30 +
	avgNestDebt * 10 +
	avgMaxCycDebt * 10 +
	avgEntropyDebt * 5;
```

**Step 6: Update return statement with new categories**

Change from:
```typescript
byCategory: {
	complexity: Math.round(avgCogDebt * 100),
	maintainability: Math.round(avgMIDebt * 100),
	nesting: Math.round(avgNestDebt * 100),
},
```

To:
```typescript
byCategory: {
	maintainability: Math.round(avgMIDebt * 100),
	cognitive: Math.round(avgCogDebt * 100),
	nesting: Math.round(avgNestDebt * 100),
	maxCyclomatic: Math.round(avgMaxCycDebt * 100),
	entropy: Math.round(avgEntropyDebt * 100),
},
```

**Step 7: Build and verify**

Run: `npx tsc`

Expected: Compiles successfully

**Step 8: Commit**

```bash
git add clients/metrics-history.ts
git commit -m "feat: add maxCyclomatic and entropy to TDI calculation with weights"
```

**Verification:**
- [ ] Debt calculation added for both new metrics
- [ ] Weights updated (45/30/10/10/5)
- [ ] Return includes new categories
- [ ] Build passes
- [ ] Commit made

---

### Task 6: Update /lens-tdi Display

**Files:**
- Modify: `index.ts:340-380` (/lens-tdi command)

**Step 1: Update the display to show new categories**

Find the `/lens-tdi` command handler and update the output:

Change from:
```typescript
const lines = [
	`📊 TECHNICAL DEBT INDEX: ${tdi.score}/100 (${tdi.grade})`,
	``,
	`Files analyzed: ${tdi.filesAnalyzed}`,
	`Files with debt: ${tdi.filesWithDebt}`,
	`Avg MI: ${tdi.avgMI}`,
	`Total cognitive complexity: ${tdi.totalCognitive}`,
	``,
	`Debt breakdown:`,
	`  Maintainability: ${tdi.byCategory.maintainability}%`,
	`  Complexity: ${tdi.byCategory.complexity}%`,
	`  Nesting: ${tdi.byCategory.nesting}%`,
	``,
	// ... grade message
];
```

To:
```typescript
const lines = [
	`📊 TECHNICAL DEBT INDEX: ${tdi.score}/100 (${tdi.grade})`,
	``,
	`Files analyzed: ${tdi.filesAnalyzed}`,
	`Files with debt: ${tdi.filesWithDebt}`,
	`Avg MI: ${tdi.avgMI}`,
	`Total cognitive complexity: ${tdi.totalCognitive}`,
	``,
	`Debt breakdown:`,
	`  Maintainability: ${tdi.byCategory.maintainability}% (MI-based)`,
	`  Cognitive: ${tdi.byCategory.cognitive}%`,
	`  Nesting: ${tdi.byCategory.nesting}%`,
	`  Max Cyclomatic: ${tdi.byCategory.maxCyclomatic}% (worst function)`,
	`  Entropy: ${tdi.byCategory.entropy}% (code unpredictability)`,
	``,
	// ... grade message
];
```

**Step 2: Build and verify**

Run: `npx tsc`

Expected: Compiles successfully

**Step 3: Commit**

```bash
git add index.ts
git commit -m "feat: update /lens-tdi display to show maxCyclomatic and entropy breakdown"
```

**Verification:**
- [ ] Display shows 5 categories
- [ ] Descriptions explain what each means
- [ ] Build passes
- [ ] Commit made

---

### Task 7: Final Verification

**Step 1: Full build**

Run: `npx tsc && echo "✅ Build successful"`

**Step 2: Run all tests**

Run: `npm test 2>&1 | tail -10`

Expected: Tests pass (or pre-existing failures only)

**Step 3: Verify calculation logic**

Double-check thresholds:
- Max Cyclomatic: 0 debt at ≤10, max at ≥30 ✓
- Entropy: 0 debt at ≤4.0 bits, max at ≥7.0 bits ✓
- Weights sum to 100%: 45+30+10+10+5 = 100 ✓

**Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat: enhance TDI with max cyclomatic and entropy metrics"
git push
```

**Verification:**
- [ ] Full build passes
- [ ] Tests pass
- [ ] Weights verified
- [ ] Final commit made
- [ ] Pushed to origin

---

## Summary of Changes

**New TDI Formula:**
```
TDI = MI-debt(45%) + cognitive(30%) + nesting(10%) + max-cyc(10%) + entropy(5%)

Where:
- MI-debt = (100 - MI) / 100
- cognitive = cognitive / 200 (capped)
- nesting = max(0, nesting - 3) / 7
- max-cyc = max(0, maxCyclomatic - 10) / 20  [NEW]
- entropy = max(0, entropy - 4.0) / 3.0      [NEW]
```

**Thresholds:**
- Max Cyclomatic: Good ≤10, Bad ≥30
- Entropy: Good ≤4.0 bits, Bad ≥7.0 bits

**Result:** TDI now catches:
1. Files with one terrible function (high max cyclomatic)
2. Files with unpredictable/unusual code (high entropy)
3. Overall structural complexity (existing metrics)

---

**Execution:** Use superpowers:executing-plans
