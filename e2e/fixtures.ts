import { expect, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

/** Origins are configurable so the suite can target a deployed staging stack. */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';

/**
 * Must stay in sync with `backend/e2e/seedE2E.ts`.
 */
export const FIXTURE = {
  password: 'E2e@Test123',
  admin: 'e2e_admin',
  faculty: 'e2e_faculty',
  studentA: 'e2e_student_a',
  studentB: 'e2e_student_b',
  studentAPrn: 'E2E0001',
  studentBPrn: 'E2E0002',
  facultyName: 'E2E Faculty',
} as const;

export interface AuthSession {
  token: string;
  user: { id: string; username: string; role: 'IT_ADMIN' | 'FACULTY' | 'STUDENT'; firstLogin: boolean };
}

export interface ActiveClassSession {
  id: string;
  timetableEntryId: string;
  classId: string;
  subjectId: string;
  divisionId: string | null;
  batchId: string | null;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  subject?: { id: string; name: string };
  class?: { id: string; name: string };
  attendanceCheckpoints?: Array<{
    id: string;
    checkpointType: 'START' | 'END';
    code: string;
    expiresAt: string;
    isActive: boolean;
    /** Returned only to the owning faculty member. */
    qrSecret: string;
  }>;
  serverTime?: number;
}

// ── API helpers ──────────────────────────────────────────────────────────────

export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string = FIXTURE.password
): Promise<AuthSession> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { username, password },
  });

  expect(response.ok(), `Login failed for ${username}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const body = await response.json();
  expect(body.token, `No token returned for ${username}`).toBeTruthy();
  return body as AuthSession;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getFacultyActiveSession(
  request: APIRequestContext,
  token: string
): Promise<ActiveClassSession | null> {
  const response = await request.get(`${API_URL}/api/faculty/sessions/active`, {
    headers: bearer(token),
  });
  expect(response.ok(), `GET active session failed: ${response.status()}`).toBeTruthy();

  const body = await response.json();
  return body && body.id ? (body as ActiveClassSession) : null;
}

/** Poll until the faculty has an ACTIVE session (used after clicking "Start Class"). */
export async function waitForActiveSession(
  request: APIRequestContext,
  token: string,
  timeoutMs = 15_000
): Promise<ActiveClassSession> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = await getFacultyActiveSession(request, token);
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('No ACTIVE faculty session appeared within timeout.');
}

/**
 * Poll until the faculty session exposes an active checkpoint of the requested
 * type. Checkpoint generation is a separate request, so the UI and the API can
 * briefly disagree while it is in flight.
 */
export async function waitForActiveCheckpoint(
  request: APIRequestContext,
  token: string,
  type: 'START' | 'END',
  timeoutMs = 30_000
): Promise<{ id: string; code: string; qrSecret: string; checkpointType: 'START' | 'END' }> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen = 'no checkpoints';

  while (Date.now() < deadline) {
    const session = await getFacultyActiveSession(request, token);
    const checkpoint = session?.attendanceCheckpoints?.find(
      (candidate) => candidate.isActive && candidate.checkpointType === type
    );

    if (checkpoint) return checkpoint;

    lastSeen = JSON.stringify(
      (session?.attendanceCheckpoints ?? []).map((candidate) => ({
        type: candidate.checkpointType,
        isActive: candidate.isActive,
      }))
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No active ${type} checkpoint appeared within ${timeoutMs}ms (last seen: ${lastSeen}).`);
}

/**
 * Guarantees a live START checkpoint. The UI opens a 60-second window; on slow
 * (remote) databases the browser steps can consume it before the student logs
 * in, so this restarts the class with a wider window when necessary.
 */
export async function ensureLiveStartCheckpoint(
  request: APIRequestContext,
  facultyToken: string,
  session: ActiveClassSession,
  durationSeconds = 300,
  minRemainingSeconds = 120
): Promise<{
  session: ActiveClassSession;
  checkpoint: { id: string; code: string; qrSecret: string; checkpointType: 'START' };
}> {
  const active = await getFacultyActiveSession(request, facultyToken);
  const live = active?.attendanceCheckpoints?.find(
    (candidate) => candidate.isActive && candidate.checkpointType === 'START'
  );
  const remainingSeconds = live
    ? Math.floor((new Date(live.expiresAt).getTime() - Date.now()) / 1000)
    : 0;

  if (active && live && remainingSeconds >= minRemainingSeconds) {
    return { session: active, checkpoint: live };
  }

  // The only way to reopen a START window is a new session: the API allows one
  // START checkpoint per session and the old one is intentionally immutable.
  if (active) {
    const end = await request.post(`${API_URL}/api/faculty/sessions/${active.id}/end`, {
      headers: bearer(facultyToken),
    });
    expect(end.ok(), `Closing expired session failed: ${await end.text()}`).toBeTruthy();
  }

  const start = await request.post(`${API_URL}/api/faculty/sessions/start`, {
    headers: bearer(facultyToken),
    data: { timetableEntryId: session.timetableEntryId },
  });
  expect(start.ok(), `Session restart failed: ${await start.text()}`).toBeTruthy();
  const fresh = (await start.json()) as ActiveClassSession;

  const generated = await request.post(
    `${API_URL}/api/faculty/sessions/${fresh.id}/attendance/generate`,
    {
      headers: bearer(facultyToken),
      data: { checkpointType: 'START', durationSeconds },
    }
  );
  expect(generated.ok(), `START checkpoint failed: ${await generated.text()}`).toBeTruthy();
  const checkpoint = await generated.json();

  return {
    session: { ...fresh, attendanceCheckpoints: [checkpoint] },
    checkpoint,
  };
}

/**
 * Reproduces the rotating HMAC-SHA256 token generated by
 * `utils/attendance.ts` and `DynamicQrDisplay.tsx`.
 */
export function buildDynamicQrPayload(options: {
  sessionId: string;
  checkpointId: string;
  secret: string;
  type?: 'START' | 'END';
  timestampSeconds?: number;
}): string {
  const t = options.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHmac('sha256', options.secret)
    .update(`${options.checkpointId}:${t}`)
    .digest('hex')
    .slice(0, 16);

  return JSON.stringify({
    sid: options.sessionId,
    cid: options.checkpointId,
    t,
    hash,
    type: options.type,
  });
}

/**
 * Creates a draft quiz with one MCQ, starts it, and launches the question.
 * Returns the option id that the student should click.
 */
export async function launchSingleQuestionQuiz(
  request: APIRequestContext,
  facultyToken: string,
  session: ActiveClassSession,
  title = `[E2E] Live Quiz ${Date.now()}`
): Promise<{ quizId: string; questionId: string; correctOptionId: string; questionText: string }> {
  const createResponse = await request.post(`${API_URL}/api/faculty/quiz`, {
    headers: bearer(facultyToken),
    data: {
      title,
      subjectId: session.subjectId,
      classId: session.classId,
      divisionId: session.divisionId ?? undefined,
      batchId: session.batchId ?? undefined,
      sessionId: session.id,
    },
  });
  expect(createResponse.ok(), `Quiz creation failed: ${await createResponse.text()}`).toBeTruthy();
  const { quiz } = await createResponse.json();

  const questionText = `E2E checkpoint question ${Date.now()}`;
  const questionResponse = await request.post(`${API_URL}/api/faculty/quiz/${quiz.id}/questions`, {
    headers: bearer(facultyToken),
    data: {
      text: questionText,
      type: 'MCQ',
      durationSeconds: 120,
      options: [
        { text: 'Correct answer', isCorrect: true },
        { text: 'Wrong answer', isCorrect: false },
      ],
    },
  });
  expect(questionResponse.ok(), `Question creation failed: ${await questionResponse.text()}`).toBeTruthy();
  const { question } = await questionResponse.json();

  const startResponse = await request.post(`${API_URL}/api/faculty/quiz/${quiz.id}/start`, {
    headers: bearer(facultyToken),
  });
  expect(startResponse.ok(), `Quiz start failed: ${await startResponse.text()}`).toBeTruthy();

  const launchResponse = await request.post(`${API_URL}/api/faculty/quiz/${quiz.id}/launch-question`, {
    headers: bearer(facultyToken),
    data: { questionId: question.id },
  });
  expect(launchResponse.ok(), `Question launch failed: ${await launchResponse.text()}`).toBeTruthy();

  const correctOption = (question.options as Array<{ id: string; text: string }>).find(
    (option) => option.text === 'Correct answer'
  );
  expect(correctOption, 'Correct option was not persisted').toBeTruthy();

  return {
    quizId: quiz.id,
    questionId: question.id,
    correctOptionId: correctOption!.id,
    questionText,
  };
}

export interface LiveQuizQuestionSeed {
  id: string;
  text: string;
  correctOptionId: string;
}

/**
 * Creates a multi-question live quiz and launches its first question.
 * The caller can launch subsequent questions with `launchQuestion` to exercise
 * the real-time QUIZ_QUESTION_LAUNCHED path for each question.
 */
export async function launchMultiQuestionQuiz(
  request: APIRequestContext,
  facultyToken: string,
  session: ActiveClassSession,
  questionCount = 3,
  title = `[E2E] Journey Quiz ${Date.now()}`
): Promise<{ quizId: string; questions: LiveQuizQuestionSeed[] }> {
  const createResponse = await request.post(`${API_URL}/api/faculty/quiz`, {
    headers: bearer(facultyToken),
    data: {
      title,
      subjectId: session.subjectId,
      classId: session.classId,
      divisionId: session.divisionId ?? undefined,
      batchId: session.batchId ?? undefined,
      sessionId: session.id,
    },
  });
  expect(createResponse.ok(), `Quiz creation failed: ${await createResponse.text()}`).toBeTruthy();
  const { quiz } = await createResponse.json();

  const questions: LiveQuizQuestionSeed[] = [];

  for (let index = 0; index < questionCount; index++) {
    const questionText = `E2E question ${index + 1} · ${Date.now()}-${index}`;
    const questionResponse = await request.post(`${API_URL}/api/faculty/quiz/${quiz.id}/questions`, {
      headers: bearer(facultyToken),
      data: {
        text: questionText,
        type: 'MCQ',
        durationSeconds: 180,
        options: [
          { text: 'Correct answer', isCorrect: true },
          { text: 'Wrong answer', isCorrect: false },
        ],
      },
    });
    expect(questionResponse.ok(), `Question creation failed: ${await questionResponse.text()}`).toBeTruthy();
    const { question } = await questionResponse.json();

    const correctOption = (question.options as Array<{ id: string; text: string }>).find(
      (option) => option.text === 'Correct answer'
    );
    expect(correctOption, 'Correct option was not persisted').toBeTruthy();

    questions.push({
      id: question.id,
      text: questionText,
      correctOptionId: correctOption!.id,
    });
  }

  const startResponse = await request.post(`${API_URL}/api/faculty/quiz/${quiz.id}/start`, {
    headers: bearer(facultyToken),
  });
  expect(startResponse.ok(), `Quiz start failed: ${await startResponse.text()}`).toBeTruthy();

  await launchQuestion(request, facultyToken, quiz.id, questions[0].id);

  return { quizId: quiz.id, questions };
}

export async function launchQuestion(
  request: APIRequestContext,
  facultyToken: string,
  quizId: string,
  questionId: string,
  durationSeconds = 180
): Promise<void> {
  const launchResponse = await request.post(`${API_URL}/api/faculty/quiz/${quizId}/launch-question`, {
    headers: bearer(facultyToken),
    data: { questionId, durationSeconds },
  });
  expect(launchResponse.ok(), `Question launch failed: ${await launchResponse.text()}`).toBeTruthy();
}

/**
 * Screenshots the projected QR canvas and decodes it in Node. Retries because
 * the token rotates every second and a frame can be captured mid-redraw.
 */
export async function readProjectedQr(page: Page, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'canvas not visible';

  while (Date.now() < deadline) {
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible().catch(() => false)) {
      try {
        const png = PNG.sync.read(await canvas.screenshot());
        const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        if (decoded?.data) return decoded.data;
        lastError = 'jsQR found no payload in the captured canvas';
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Could not decode the projected QR code within ${timeoutMs}ms (${lastError}).`);
}

export async function endQuizAndSession(
  request: APIRequestContext,
  facultyToken: string,
  quizId: string,
  sessionId: string
): Promise<void> {
  const endQuiz = await request.post(`${API_URL}/api/faculty/quiz/${quizId}/end`, {
    headers: bearer(facultyToken),
  });
  expect(endQuiz.ok(), `End quiz failed: ${await endQuiz.text()}`).toBeTruthy();

  const endSession = await request.post(`${API_URL}/api/faculty/sessions/${sessionId}/end`, {
    headers: bearer(facultyToken),
  });
  expect(endSession.ok(), `End session failed: ${await endSession.text()}`).toBeTruthy();
}

// ── Browser helpers ──────────────────────────────────────────────────────────

/** Signs in through the real login form and waits for the role dashboard. */
export async function loginViaUi(page: Page, username: string, password: string = FIXTURE.password) {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // ProtectedRoute redirects to /admin, /faculty or /student.
  await expect(page).toHaveURL(/\/(admin|faculty|student)(\/|$)/, { timeout: 20_000 });
}

export function todayDayNumber(): number {
  const today = new Date().getDay(); // 0 = Sunday
  return today === 0 ? 1 : today;
}
