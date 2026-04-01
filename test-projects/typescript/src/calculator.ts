// Calculator module with basic math operations

export function add(a: number, b: number): number {
	return a + b;
}

export function subtract(a: number, b: number): number {
	return a - b;
}

export function multiply(a: number, b: number): number {
	const result = a * b;
	return result;
}

export function divide(a: number, b: number): number {
	if (b === 0) {
		throw new Error("Cannot divide by zero");
	}
	return a / b;
}

// Intentional issues for testing:
// 1. Missing return type
export function messyAdd(x: number, y: number) {
	return x + y;
}

// 2. Unused variable
const unusedVariable = "I am not used";

// 3. Any type
export function processData(data: any): any {
	return data.map((x: any) => x * 2);
}

// 4. Hardcoded secret
const API_KEY = "sk-test-12345-abcdef";

// 5. Console log
console.log("Calculator module loaded");

// More type issues
export function calculateStats(numbers: number[]) {
	if (numbers.length === 0) {
		return null;
	}

	const sum = numbers.reduce((a, b) => a + b, 0);
	const mean = sum / numbers.length;

	// Type issue: returning object with inconsistent shape
	return {
		mean,
		sum,
		count: numbers.length,
	};
}
