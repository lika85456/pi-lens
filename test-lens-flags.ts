// Test file for pi-lens --lens-effect and --lens-lsp flags
// This file has intentional issues for testing

interface User {
  name: string;
  age: number;
  email: string;
}

// Unused variable - should trigger lint warning
const unusedVar = "hello";

// Function with complexity issues
function processUser(user: User): string {
  if (user.age > 0) {
    if (user.name) {
      if (user.email) {
        return `${user.name} (${user.email})`;
      }
    }
  }
  return "invalid";
}

// Promise chain that could use async/await
function fetchData(): Promise<string> {
  return fetch("/api")
    .then((res) => res.json())
    .then((data) => data.value)
    .catch((err) => {
      console.error(err);
      return "error";
    });
}

// Export for module
export { processUser, fetchData };
