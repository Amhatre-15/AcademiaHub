/**
 * AdminComponents.test.tsx
 * Unit tests for shared UI components: PageHeader, StatCard, EmptyState,
 * StatusBadge, FormField, LoadingSpinner, LoadingPage.
 *
 * These are pure presentational components — tests verify render correctness
 * and prop-driven conditional rendering.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  PageHeader,
  StatCard,
  EmptyState,
  StatusBadge,
  FormField,
  LoadingSpinner,
  LoadingPage,
} from "../../components/ui/AdminComponents";

describe("PageHeader", () => {
  it("should render the title", () => {
    render(<PageHeader title="Branch Management" />);
    expect(screen.getByRole("heading", { name: "Branch Management" })).toBeInTheDocument();
  });

  it("should render subtitle when provided", () => {
    render(<PageHeader title="Branches" subtitle="Manage institution branches" />);
    expect(screen.getByText("Manage institution branches")).toBeInTheDocument();
  });

  it("should not render subtitle when omitted", () => {
    render(<PageHeader title="Branches" />);
    expect(screen.queryByText(/subtitle/i)).not.toBeInTheDocument();
  });

  it("should render action element when provided", () => {
    render(<PageHeader title="Branches" action={<button>Add Branch</button>} />);
    expect(screen.getByRole("button", { name: "Add Branch" })).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("should render the label and numeric value", () => {
    render(<StatCard label="Total Students" value={320} icon={<span>👥</span>} />);
    expect(screen.getByText("Total Students")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("should render a string value", () => {
    render(<StatCard label="Active Year" value="2024-25" icon={<span>📅</span>} />);
    expect(screen.getByText("2024-25")).toBeInTheDocument();
  });

  it("should render the icon", () => {
    render(<StatCard label="Faculty" value={12} icon={<span data-testid="icon">🧑‍🏫</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("should render title and message", () => {
    render(<EmptyState title="No Students" message="No students enrolled yet." />);
    expect(screen.getByText("No Students")).toBeInTheDocument();
    expect(screen.getByText("No students enrolled yet.")).toBeInTheDocument();
  });

  it("should render action element when provided", () => {
    render(
      <EmptyState
        title="Empty"
        message="Nothing here."
        action={<button>Add First Item</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Add First Item" })).toBeInTheDocument();
  });

  it("should not render action when omitted", () => {
    render(<EmptyState title="Empty" message="Nothing here." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("should render 'Active' for ACTIVE status", () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("should render 'Inactive' for INACTIVE status", () => {
    render(<StatusBadge status="INACTIVE" />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});

describe("FormField", () => {
  it("should render the label", () => {
    render(<FormField label="Branch Name"><input /></FormField>);
    expect(screen.getByText("Branch Name")).toBeInTheDocument();
  });

  it("should show required asterisk when required prop is true", () => {
    render(<FormField label="Email" required><input /></FormField>);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("should not show required asterisk when required is false", () => {
    render(<FormField label="Optional Field"><input /></FormField>);
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("should display error message when error prop is provided", () => {
    render(<FormField label="Username" error="Username is required."><input /></FormField>);
    expect(screen.getByText("Username is required.")).toBeInTheDocument();
  });

  it("should display hint when provided and no error", () => {
    render(<FormField label="PRN" hint="6-digit number"><input /></FormField>);
    expect(screen.getByText("6-digit number")).toBeInTheDocument();
  });

  it("should not show hint when error is present (error takes priority)", () => {
    render(
      <FormField label="PRN" hint="6-digit number" error="Invalid PRN"><input /></FormField>
    );
    expect(screen.queryByText("6-digit number")).not.toBeInTheDocument();
    expect(screen.getByText("Invalid PRN")).toBeInTheDocument();
  });

  it("should render children (input element)", () => {
    render(
      <FormField label="Name">
        <input data-testid="name-input" />
      </FormField>
    );
    expect(screen.getByTestId("name-input")).toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("should render without crashing", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("should apply the animate-spin class", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toHaveClass("animate-spin");
  });
});

describe("LoadingPage", () => {
  it("should render the loading spinner inside a centered container", () => {
    const { container } = render(<LoadingPage />);
    expect(container.firstChild).toBeInTheDocument();
    // Confirm spinner is present inside
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
