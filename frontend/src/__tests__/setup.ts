/**
 * Global test setup for Vitest + React Testing Library.
 * Runs before every test file.
 */
import "@testing-library/jest-dom";

// Clear localStorage between tests to prevent auth state bleed
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
