/**
 * authStore.test.ts
 * Unit tests for the Zustand useAuthStore.
 * 
 * Covers:
 *  - Initial state shape
 *  - login() happy path and error path
 *  - logout() state reset
 *  - useIsAuthenticated() derived selector
 *  - clearError()
 */

import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the auth API module before store is imported
vi.mock("../../api/auth", () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("../../api/client", () => ({
  getApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Unknown error",
  default: {},
}));

import { useAuthStore, useIsAuthenticated } from "../../stores/authStore";
import { authApi } from "../../api/auth";

const mockLogin = authApi.login as ReturnType<typeof vi.fn>;
const mockLogout = authApi.logout as ReturnType<typeof vi.fn>;

const MOCK_TOKEN = "eyJhbGciOiJIUzI1NiJ9.test.sig";
const MOCK_USER = {
  id: "user-001",
  username: "admin",
  role: "IT_ADMIN" as const,
  firstLogin: false,
  profile: null,
};

function resetStore() {
  useAuthStore.setState({ token: null, user: null, isLoading: false, error: null });
}

describe("useAuthStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Initial state", () => {
    it("should start with null token and user", () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("login()", () => {
    it("should set token and user on successful login", async () => {
      mockLogin.mockResolvedValueOnce({ token: MOCK_TOKEN, user: MOCK_USER });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: "admin", password: "Admin@sspu123" });
      });

      expect(result.current.token).toBe(MOCK_TOKEN);
      expect(result.current.user).toEqual(MOCK_USER);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(localStorage.getItem("auth_token")).toBe(MOCK_TOKEN);
    });

    it("should set error and reset loading on failed login", async () => {
      mockLogin.mockRejectedValueOnce(new Error("Username or password is incorrect."));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login({ username: "bad", password: "wrong" });
        } catch {
          // expected
        }
      });

      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Username or password is incorrect.");
    });

    it("should set isLoading=true while login is in flight", async () => {
      let resolve!: (v: unknown) => void;
      mockLogin.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.login({ username: "admin", password: "pass" }).catch(() => {});
      });

      expect(result.current.isLoading).toBe(true);
      await act(async () => { resolve({ token: MOCK_TOKEN, user: MOCK_USER }); });
    });
  });

  describe("logout()", () => {
    it("should clear token, user, and localStorage on logout", async () => {
      mockLogout.mockResolvedValueOnce({});
      useAuthStore.setState({ token: MOCK_TOKEN, user: MOCK_USER });
      localStorage.setItem("auth_token", MOCK_TOKEN);

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.logout(); });

      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });

    it("should still clear state even if logout API call fails", async () => {
      mockLogout.mockRejectedValueOnce(new Error("Network error"));
      useAuthStore.setState({ token: MOCK_TOKEN, user: MOCK_USER });
      localStorage.setItem("auth_token", MOCK_TOKEN);

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.logout(); });

      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
    });
  });

  describe("clearError()", () => {
    it("should reset error to null", () => {
      useAuthStore.setState({ error: "Some previous error" });
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.clearError(); });
      expect(result.current.error).toBeNull();
    });
  });

  describe("useIsAuthenticated()", () => {
    it("should return false when no token in store or localStorage", () => {
      const { result } = renderHook(() => useIsAuthenticated());
      expect(result.current).toBe(false);
    });

    it("should return false when token is in store but not localStorage", () => {
      useAuthStore.setState({ token: MOCK_TOKEN });
      // localStorage is NOT set
      const { result } = renderHook(() => useIsAuthenticated());
      expect(result.current).toBe(false);
    });

    it("should return true when token is in both store and localStorage", () => {
      useAuthStore.setState({ token: MOCK_TOKEN });
      localStorage.setItem("auth_token", MOCK_TOKEN);
      const { result } = renderHook(() => useIsAuthenticated());
      expect(result.current).toBe(true);
    });
  });
});
