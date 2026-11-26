/**
 * ProtectedRoute.test.tsx
 * Tests for the ProtectedRoute and PublicRoute guard components.
 *
 * Covers:
 *  - Unauthenticated users are redirected to /login
 *  - firstLogin=true redirects to /change-password
 *  - Wrong role redirects to own dashboard
 *  - Correct role renders children
 *  - PublicRoute: authenticated users redirected away from /login
 *  - PublicRoute: unauthenticated users see the login page
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProtectedRoute, PublicRoute } from "../../components/layout/ProtectedRoute";
import { useAuthStore } from "../../stores/authStore";

// Mock auth store selectors at the module level
vi.mock("../../stores/authStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../stores/authStore")>();
  return {
    ...actual,
    useIsAuthenticated: vi.fn(),
  };
});

import { useIsAuthenticated } from "../../stores/authStore";
const mockUseIsAuthenticated = useIsAuthenticated as ReturnType<typeof vi.fn>;

function resetStore(overrides: Partial<Parameters<typeof useAuthStore.setState>[0]> = {}) {
  useAuthStore.setState({
    token: null, user: null, isLoading: false, error: null,
    ...overrides,
  });
}

function renderWithRouter(
  ui: React.ReactElement,
  { initialPath = "/" }: { initialPath?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {ui}
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should redirect to /login when user is unauthenticated", () => {
    mockUseIsAuthenticated.mockReturnValue(false);
    resetStore({ user: null, token: null });

    renderWithRouter(
      <Routes>
        <Route path="/" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("should redirect firstLogin users to /change-password", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "1", username: "prof", role: "FACULTY", firstLogin: true, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={
          <ProtectedRoute><div>Faculty Dashboard</div></ProtectedRoute>
        } />
        <Route path="/change-password" element={<div>Change Password Page</div>} />
      </Routes>
    );

    expect(screen.getByText("Change Password Page")).toBeInTheDocument();
    expect(screen.queryByText("Faculty Dashboard")).not.toBeInTheDocument();
  });

  it("should render children for the correct authenticated role", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "1", username: "admin", role: "IT_ADMIN", firstLogin: false, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={
          <ProtectedRoute allowedRoles={["IT_ADMIN"]}>
            <div>Admin Dashboard</div>
          </ProtectedRoute>
        } />
      </Routes>
    );

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("should redirect STUDENT trying to access IT_ADMIN route to /student", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "2", username: "stu", role: "STUDENT", firstLogin: false, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={
          <ProtectedRoute allowedRoles={["IT_ADMIN"]}>
            <div>Admin Only</div>
          </ProtectedRoute>
        } />
        <Route path="/student" element={<div>Student Dashboard</div>} />
      </Routes>
    );

    expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Admin Only")).not.toBeInTheDocument();
  });

  it("should redirect FACULTY trying to access STUDENT route to /faculty", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "3", username: "fac", role: "FACULTY", firstLogin: false, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <div>Student Only</div>
          </ProtectedRoute>
        } />
        <Route path="/faculty" element={<div>Faculty Dashboard</div>} />
      </Routes>
    );

    expect(screen.getByText("Faculty Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Student Only")).not.toBeInTheDocument();
  });

  it("should render children with no allowedRoles restriction for any authenticated user", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "4", username: "stu2", role: "STUDENT", firstLogin: false, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <div>Shared Protected Content</div>
          </ProtectedRoute>
        } />
      </Routes>
    );

    expect(screen.getByText("Shared Protected Content")).toBeInTheDocument();
  });
});

describe("PublicRoute", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should render children (login form) when user is unauthenticated", () => {
    mockUseIsAuthenticated.mockReturnValue(false);
    resetStore({ user: null, token: null });

    renderWithRouter(
      <Routes>
        <Route path="/" element={<PublicRoute><div>Login Form</div></PublicRoute>} />
      </Routes>
    );

    expect(screen.getByText("Login Form")).toBeInTheDocument();
  });

  it("should redirect authenticated non-firstLogin admin away from login to /admin", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "1", username: "admin", role: "IT_ADMIN", firstLogin: false, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={<PublicRoute><div>Login Form</div></PublicRoute>} />
        <Route path="/admin" element={<div>Admin Dashboard</div>} />
      </Routes>
    );

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Login Form")).not.toBeInTheDocument();
  });

  it("should redirect authenticated firstLogin user to /change-password", () => {
    mockUseIsAuthenticated.mockReturnValue(true);
    resetStore({
      token: "tok",
      user: { id: "2", username: "new.fac", role: "FACULTY", firstLogin: true, profile: null },
    });
    localStorage.setItem("auth_token", "tok");

    renderWithRouter(
      <Routes>
        <Route path="/" element={<PublicRoute><div>Login Form</div></PublicRoute>} />
        <Route path="/change-password" element={<div>Change Password Page</div>} />
      </Routes>
    );

    expect(screen.getByText("Change Password Page")).toBeInTheDocument();
  });
});
