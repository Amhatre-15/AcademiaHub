/**
 * Pagination.test.tsx
 * Unit tests for the shared Pagination UI component.
 *
 * Covers:
 *  - Returns null when totalPages <= 1 (single page)
 *  - Shows correct "Showing X-Y of Z items" summary text
 *  - Previous button disabled on first page
 *  - Next button disabled on last page
 *  - Clicking page buttons fires onPageChange
 *  - Ellipsis shown for large page sets
 *  - Custom itemLabel rendered
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "../../components/ui/Pagination";

describe("Pagination", () => {
  const defaults = {
    page: 1,
    totalPages: 5,
    total: 50,
    limit: 10,
    onPageChange: vi.fn(),
  };

  it("should return null when totalPages is 1 (nothing to paginate)", () => {
    const { container } = render(
      <Pagination {...defaults} totalPages={1} total={8} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should return null when totalPages is 0", () => {
    const { container } = render(
      <Pagination {...defaults} totalPages={0} total={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should display correct summary: Showing 1–10 of 50 items", () => {
    render(<Pagination {...defaults} />);
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText("1–10")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("should display correct summary on page 2: Showing 11–20 of 50", () => {
    render(<Pagination {...defaults} page={2} />);
    expect(screen.getByText("11–20")).toBeInTheDocument();
  });

  it("should display the custom itemLabel", () => {
    render(<Pagination {...defaults} itemLabel="students" />);
    // The label is embedded inside a span with surrounding text nodes;
    // match the containing span using a function matcher.
    expect(
      screen.getByText((_content, element) =>
        element?.tagName === "SPAN" && element.textContent?.includes("students") === true
      )
    ).toBeInTheDocument();
  });

  it("should disable the Previous button on page 1", () => {
    render(<Pagination {...defaults} page={1} />);
    const prevBtn = screen.getByRole("button", { name: /previous page/i });
    expect(prevBtn).toBeDisabled();
  });

  it("should disable the Next button on the last page", () => {
    render(<Pagination {...defaults} page={5} totalPages={5} />);
    const nextBtn = screen.getByRole("button", { name: /next page/i });
    expect(nextBtn).toBeDisabled();
  });

  it("should enable Previous button when not on page 1", () => {
    render(<Pagination {...defaults} page={3} />);
    expect(screen.getByRole("button", { name: /previous page/i })).not.toBeDisabled();
  });

  it("should enable Next button when not on last page", () => {
    render(<Pagination {...defaults} page={2} totalPages={5} />);
    expect(screen.getByRole("button", { name: /next page/i })).not.toBeDisabled();
  });

  it("should call onPageChange with page-1 when Previous is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaults} page={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("should call onPageChange with page+1 when Next is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaults} page={2} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("should call onPageChange with the page number when a page button is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Pagination {...defaults} page={1} totalPages={5} onPageChange={onPageChange} />
    );
    // Page numbers 1-5 are all visible for totalPages <= 7
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("should render all page buttons when totalPages <= 7", () => {
    render(<Pagination {...defaults} page={1} totalPages={5} />);
    [1, 2, 3, 4, 5].forEach((n) => {
      expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    });
  });

  it("should show ellipsis for large page sets (totalPages > 7)", () => {
    render(<Pagination {...defaults} page={5} totalPages={20} total={200} />);
    // Ellipsis rendered as "…" text nodes
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it("should show the last page number button for large sets", () => {
    render(<Pagination {...defaults} page={1} totalPages={20} total={200} />);
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
  });
});
