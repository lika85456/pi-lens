package calculator

import "testing"

func TestAdd(t *testing.T) {
	result := Add(2, 3)
	if result != 5 {
		t.Errorf("Add(2, 3) = %d; want 5", result)
	}
}

func TestSubtract(t *testing.T) {
	result := Subtract(5, 3)
	if result != 2 {
		t.Errorf("Subtract(5, 3) = %d; want 2", result)
	}
}

func TestMultiply(t *testing.T) {
	result := Multiply(4, 5)
	if result != 20 {
		t.Errorf("Multiply(4, 5) = %d; want 20", result)
	}
}
