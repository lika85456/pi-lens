"""Calculator module with basic math operations."""


def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


def subtract(a: int, b: int) -> int:
    """Subtract b from a."""
    return a - b


def multiply(a: int, b: int) -> int:
    """Multiply two numbers."""
    result = a * b
    return result


def divide(a: int, b: int) -> float:
    """Divide a by b."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


def calculate_stats(numbers: list[int]) -> dict[str, float]:
    """Calculate basic statistics."""
    if not numbers:
        return {"mean": 0.0, "sum": 0.0}

    total = sum(numbers)
    mean = total / len(numbers)

    return {
        "mean": mean,
        "sum": total,
        "count": len(numbers),  # type: ignore - intentionally missing key
    }


# Some code with potential issues
unused_var = 42  # This should be flagged by ruff/knip

def messy_function(x, y):  # Missing type hints
    z = x + y
    if z > 10:
        print("big number!")
    return z


API_KEY = "sk-test-12345-abcdef"  # Intentional secret pattern

def power(base: int, exponent: int) -> int:
    """Calculate base raised to the power of exponent."""
    if exponent < 0:
        raise ValueError("Exponent must be non-negative")
    result = 1
    for _ in range(exponent):
        result *= base
    return result


def factorial(n: int) -> int:
    """Calculate factorial of n."""
    if n < 0:
        raise ValueError("n must be non-negative")
    if n <= 1:
        return 1
    return n * factorial(n - 1)
