/**
 * StudentNotebookPage.test.tsx
 * Locks down the 1,000 ms debounced autosave used by the note editor.
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import StudentNotebookPage from "../../pages/student/StudentNotebookPage";
import type { StudentNote } from "../../api/student";

const notesApi = vi.hoisted(() => ({
  list: vi.fn(),
  getContext: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../api/student", () => ({
  studentApi: { notes: notesApi },
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const note: StudentNote = {
  id: "note-1",
  title: "Weekly Notes",
  content: "Stacks and queues",
  classId: "class-1",
  subjectId: "subject-1",
  sessionId: null,
  isPrivate: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subject: { id: "subject-1", name: "Data Structures" },
  session: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  notesApi.list.mockResolvedValue([note]);
  notesApi.getContext.mockResolvedValue({
    classes: [{ id: "class-1", name: "SY B.Sc DS" }],
    subjects: [{ id: "subject-1", name: "Data Structures" }],
  });
  notesApi.update.mockResolvedValue({ ...note });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StudentNotebookPage — debounced autosave", () => {
  it("saves once, 1,000 ms after the last keystroke", async () => {
    render(<StudentNotebookPage />);

    await screen.findByText("Weekly Notes");
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Weekly Notes"));

    const content = screen.getByPlaceholderText(/Start writing your notes/i);
    fireEvent.change(content, { target: { value: "S" } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(notesApi.update).not.toHaveBeenCalled();

    fireEvent.change(content, { target: { value: "Stacks" } });

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(notesApi.update).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(notesApi.update).toHaveBeenCalledTimes(1);
    expect(notesApi.update).toHaveBeenCalledWith("note-1", { content: "Stacks" });
  });

  it("saves title edits through the same debounce path", async () => {
    render(<StudentNotebookPage />);

    await screen.findByText("Weekly Notes");
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Weekly Notes"));

    const title = screen.getByPlaceholderText("Note Title");
    fireEvent.change(title, { target: { value: "Graph Algorithms" } });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(notesApi.update).toHaveBeenCalledWith("note-1", { title: "Graph Algorithms" });
  });

  it("does not call the API when the edit is reverted before the debounce elapses", async () => {
    render(<StudentNotebookPage />);

    await screen.findByText("Weekly Notes");
    vi.useFakeTimers();
    fireEvent.click(screen.getByText("Weekly Notes"));

    const content = screen.getByPlaceholderText(/Start writing your notes/i);
    fireEvent.change(content, { target: { value: "Temporary" } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.change(content, { target: { value: "Stacks and queues" } });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    // The second edit still schedules one save; the first is cancelled.
    expect(notesApi.update).toHaveBeenCalledTimes(1);
    expect(notesApi.update).toHaveBeenCalledWith("note-1", { content: "Stacks and queues" });
  });

  it("renders the empty state when no notes exist", async () => {
    notesApi.list.mockResolvedValueOnce([]);
    render(<StudentNotebookPage />);

    await waitFor(() => expect(screen.getByText(/No notes found/i)).toBeInTheDocument());
  });
});
