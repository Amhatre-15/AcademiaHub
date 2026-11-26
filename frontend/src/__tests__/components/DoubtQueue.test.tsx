import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoubtQueue from '../../components/classroom/DoubtQueue';
import { studentApi } from '../../api/student';

vi.mock('../../api/student', () => ({
  studentApi: {
    doubts: {
      list: vi.fn(),
      create: vi.fn(),
      toggleUpvote: vi.fn(),
    },
  },
}));

vi.mock('../../api/faculty', () => ({
  facultyApi: {
    doubts: {
      list: vi.fn(),
      updateStatus: vi.fn(),
    },
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockDoubts = [
  {
    id: 'd-1',
    sessionId: 'session-123',
    question: 'How does Dijkstra handle negative cycle weights?',
    isAnonymous: false,
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
    authorName: 'Atharva Mhatre',
    isAuthor: true,
    upvotesCount: 7,
    hasUpvoted: true,
  },
  {
    id: 'd-2',
    sessionId: 'session-123',
    question: 'Is topological sort valid on cyclic graphs?',
    isAnonymous: true,
    status: 'ANSWERED' as const,
    createdAt: new Date().toISOString(),
    authorName: 'Anonymous Scholar',
    isAuthor: false,
    upvotesCount: 3,
    hasUpvoted: false,
  },
];

describe('DoubtQueue component (Phase 19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(studentApi.doubts.list).mockResolvedValue(mockDoubts);
  });

  it('renders classroom doubts with author name, question, and upvote counters', async () => {
    render(<DoubtQueue sessionId="session-123" isFaculty={false} />);

    await waitFor(() => {
      expect(screen.getByText('In-Session Doubt Queue')).toBeInTheDocument();
      expect(screen.getByText('How does Dijkstra handle negative cycle weights?')).toBeInTheDocument();
      expect(screen.getByText('Is topological sort valid on cyclic graphs?')).toBeInTheDocument();
    });

    expect(screen.getByText('Atharva Mhatre')).toBeInTheDocument();
    expect(screen.getByText('Anonymous Scholar')).toBeInTheDocument();
  });

  it('allows students to toggle anonymous mode before asking', async () => {
    render(<DoubtQueue sessionId="session-123" isFaculty={false} />);

    await waitFor(() => {
      expect(screen.getByText('Ask with my name')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const toggleBtn = screen.getByText('Ask with my name');
    await user.click(toggleBtn);

    expect(screen.getByText('Asking Anonymously')).toBeInTheDocument();
  });

  it('allows students to upvote an active doubt', async () => {
    vi.mocked(studentApi.doubts.toggleUpvote).mockResolvedValue({
      hasUpvoted: true,
      upvotesCount: 4,
    });

    render(<DoubtQueue sessionId="session-123" isFaculty={false} />);

    await waitFor(() => {
      expect(screen.getByText('How does Dijkstra handle negative cycle weights?')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const upvoteButtons = screen.getAllByTitle('Upvote / Me Too (+1)');
    await user.click(upvoteButtons[1]); // Click second doubt

    expect(studentApi.doubts.toggleUpvote).toHaveBeenCalledWith('session-123', 'd-2');
  });
});
