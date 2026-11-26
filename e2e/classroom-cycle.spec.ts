import { expect, test, request as requestFactory, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import {
  API_URL,
  FIXTURE,
  apiLogin,
  bearer,
  buildDynamicQrPayload,
  endQuizAndSession,
  launchMultiQuestionQuiz,
  launchQuestion,
  loginViaUi,
  readProjectedQr,
  waitForActiveCheckpoint,
  waitForActiveSession,
  type ActiveClassSession,
} from './fixtures';

/**
 * Phase 17 — Test Journey 1: The Complete Classroom Cycle
 * ─────────────────────────────────────────────────────────────────────────────
 *  Faculty starts class → projects a rotating QR → Student A checks in with the
 *  manual fallback → Student B captures the projected QR and checks in → both
 *  close out with the END QR → a three-question live quiz is delivered over the
 *  WebSocket → anti-cheat blur is persisted → XP is awarded → attendance is
 *  finalised PRESENT for both students.
 *
 * The faculty and student stay in one browser context each so the WebSocket
 * live-sync path is exercised exactly as a real user experiences it.
 */
test.describe.serial('Complete classroom cycle', () => {
  let facultyPage: Page;
  let studentPage: Page;
  let facultyContext: BrowserContext;
  let studentContext: BrowserContext;

  let api: APIRequestContext;
  let facultyToken: string;
  let studentAToken: string;
  let session: ActiveClassSession;
  let startCheckpoint: { id: string; code: string; qrSecret: string; checkpointType: 'START' };
  let endCheckpoint: { id: string; code: string; qrSecret: string; checkpointType: 'END' };

  test.beforeAll(async ({ browser }) => {
    // Worker-independent API client sharing the faculty + student tokens.
    api = await requestFactory.newContext();
    facultyToken = (await apiLogin(api, FIXTURE.faculty)).token;
    studentAToken = (await apiLogin(api, FIXTURE.studentA)).token;

    facultyContext = await browser.newContext();
    facultyPage = await facultyContext.newPage();
    studentContext = await browser.newContext();
    studentPage = await studentContext.newPage();

    await loginViaUi(facultyPage, FIXTURE.faculty);
    await loginViaUi(studentPage, FIXTURE.studentA);
  });

  test.afterAll(async () => {
    await facultyContext?.close();
    await studentContext?.close();
    await api?.dispose();
  });

  test('faculty starts class from the timetable and projects the rotating QR', async () => {
    await facultyPage.goto('/faculty/timetable');

    const startButton = facultyPage.getByRole('button', { name: /start class/i }).first();
    await expect(startButton).toBeVisible({ timeout: 60_000 });
    await startButton.click();

    await expect(facultyPage).toHaveURL(/\/faculty\/live/, { timeout: 30_000 });
    await expect(facultyPage.getByRole('heading', { name: /live classroom/i })).toBeVisible();

    session = await waitForActiveSession(api, facultyToken);
    expect(session.status).toBe('ACTIVE');
    // Regression guard: scheduledStart/End must be "HH:MM", not a UUID.
    expect(session.scheduledStart).toMatch(/^\d{2}:\d{2}$/);
    expect(session.scheduledEnd).toMatch(/^\d{2}:\d{2}$/);
    expect(session.attendanceCheckpoints).toBeDefined();

    await facultyPage.getByRole('button', { name: /Launch Dynamic QR \(Start Checkpoint/i }).click();

    // Generation is a POST; poll until it commits before asserting on state.
    startCheckpoint = await waitForActiveCheckpoint(api, facultyToken, 'START', 45_000);
    expect(startCheckpoint.code).toMatch(/^[A-Z0-9]{4,6}$/);
    expect(startCheckpoint.qrSecret).toHaveLength(64);

    // Rendered only after the checkpoint is in React state (not just the DB).
    await expect(facultyPage.getByText('START CHECKPOINT')).toBeVisible({ timeout: 30_000 });
    await expect(facultyPage.getByText('Dynamic QR • 1s Rotation')).toBeVisible();
    // The projector canvas must actually contain a decodable QR payload.
    const projected = await readProjectedQr(facultyPage);
    expect(JSON.parse(projected)).toMatchObject({
      sid: session.id,
      cid: startCheckpoint.id,
      type: 'START',
    });
  });

  test('student A checks in with the emergency manual code and faculty sees the live count', async () => {
    await studentPage.goto('/student/live');

    await expect(studentPage.getByText(/START Attendance Active/i)).toBeVisible({ timeout: 60_000 });
    await expect(studentPage.getByText(/Live Now/i)).toBeVisible();

    // Camera-based scanning is covered by unit tests; here we exercise the
    // official manual fallback that hits the same attendance endpoint.
    await studentPage.getByRole('button', { name: /Manual Code/i }).click();
    await studentPage.getByPlaceholder('ENTER CODE').fill(startCheckpoint.code);
    await studentPage.getByRole('button', { name: /Mark Present/i }).click();

    await expect(studentPage.getByRole('heading', { name: /Attendance Recorded/i })).toBeVisible({
      timeout: 30_000,
    });

    // ATTENDANCE_SUBMITTED arrives over the socket; the faculty page increments
    // the checkpoint counter without a reload.
    await expect(facultyPage.getByText(/1 student/i)).toBeVisible({ timeout: 20_000 });
  });

  test('student B captures the projected QR for START and END, while a stale replay is rejected', async ({ request }) => {
    const studentBToken = (await apiLogin(request, FIXTURE.studentB)).token;

    // 1. Decode the live projector canvas (START) and submit that exact payload.
    const startQrPayload = await readProjectedQr(facultyPage);
    expect(JSON.parse(startQrPayload)).toMatchObject({
      sid: session.id,
      cid: startCheckpoint.id,
      type: 'START',
    });

    const startAccepted = await request.post(
      `${API_URL}/api/student/sessions/${session.id}/attendance/submit`,
      { headers: bearer(studentBToken), data: { qrPayload: startQrPayload } }
    );
    expect(startAccepted.status(), await startAccepted.text()).toBe(201);

    // The roster/checkpoint count is updated over the WebSocket, not by reload.
    await expect(facultyPage.getByText(/2 students/i)).toBeVisible({ timeout: 20_000 });

    // 2. Faculty opens END. The projector re-renders and B captures that QR too.
    const generate = await request.post(
      `${API_URL}/api/faculty/sessions/${session.id}/attendance/generate`,
      {
        headers: bearer(facultyToken),
        data: { checkpointType: 'END', durationSeconds: 60 },
      }
    );
    expect(generate.ok(), `END checkpoint generation failed: ${await generate.text()}`).toBeTruthy();
    endCheckpoint = await generate.json();
    expect(endCheckpoint.qrSecret).toHaveLength(64);

    await expect(facultyPage.getByText('END CHECKPOINT')).toBeVisible({ timeout: 30_000 });

    const endQrPayload = await readProjectedQr(facultyPage);
    expect(JSON.parse(endQrPayload)).toMatchObject({
      sid: session.id,
      cid: endCheckpoint.id,
      type: 'END',
    });

    const endAccepted = await request.post(
      `${API_URL}/api/student/sessions/${session.id}/attendance/submit`,
      { headers: bearer(studentBToken), data: { qrPayload: endQrPayload } }
    );
    expect(endAccepted.status(), await endAccepted.text()).toBe(201);

    // Student A also closes out with the END checkpoint, so both students have
    // START + END and will finalise as PRESENT.
    const studentAEndPayload = buildDynamicQrPayload({
      sessionId: session.id,
      checkpointId: endCheckpoint.id,
      secret: endCheckpoint.qrSecret,
      type: 'END',
    });
    const studentAEnd = await request.post(
      `${API_URL}/api/student/sessions/${session.id}/attendance/submit`,
      { headers: bearer(studentAToken), data: { qrPayload: studentAEndPayload } }
    );
    expect(studentAEnd.status(), await studentAEnd.text()).toBe(201);

    // 3. A screenshot from 30 seconds ago must be rejected as expired.
    const stalePayload = buildDynamicQrPayload({
      sessionId: session.id,
      checkpointId: endCheckpoint.id,
      secret: endCheckpoint.qrSecret,
      type: 'END',
      timestampSeconds: Math.floor(Date.now() / 1000) - 30,
    });

    const rejected = await request.post(
      `${API_URL}/api/student/sessions/${session.id}/attendance/submit`,
      { headers: bearer(studentBToken), data: { qrPayload: stalePayload } }
    );
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).error).toMatch(/expired/i);
  });

  test('student answers three live questions, blur is persisted, and XP is awarded', async ({ request }) => {
    const quiz = await launchMultiQuestionQuiz(request, facultyToken, session, 3);

    // WebSocket may deliver the quiz instantly; reload guarantees a
    // deterministic fetch even if the socket raced.
    await studentPage.reload();

    for (let index = 0; index < quiz.questions.length; index++) {
      if (index > 0) {
        await launchQuestion(request, facultyToken, quiz.quizId, quiz.questions[index].id);
        await studentPage.reload();
      }

      await expect(studentPage.getByText(quiz.questions[index].text)).toBeVisible({ timeout: 30_000 });

      if (index === 0) {
        // Anti-cheat: the client warns on blur and persists the signal.
        await studentPage.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(studentPage.getByText(/Window blur detected/i)).toBeVisible({ timeout: 10_000 });
      }

      await studentPage.getByRole('button', { name: 'Correct answer' }).click();
      await studentPage.getByRole('button', { name: /Submit Answer/i }).click();
      await expect(studentPage.getByText(/Correct!/).first()).toBeVisible({ timeout: 30_000 });
    }

    // Faculty results expose the persisted anti-cheat count and all 3 answers.
    let attempt: any;
    let answers: any[] = [];
    const deadline = Date.now() + 20_000;

    while (Date.now() < deadline) {
      const response = await request.get(`${API_URL}/api/faculty/quiz/${quiz.quizId}/results`, {
        headers: bearer(facultyToken),
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const { quiz: result } = await response.json();

      attempt = result.attempts.find(
        (candidate: any) => candidate.student?.prn === FIXTURE.studentAPrn
      );
      answers = result.questions
        .flatMap((question: any) => question.answers)
        .filter((answer: any) => answer.attempt?.student?.prn === FIXTURE.studentAPrn);

      if (attempt && attempt.violationCount >= 1 && answers.length === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(attempt?.violationCount).toBeGreaterThanOrEqual(1);
    expect(answers).toHaveLength(3);
    expect(attempt?.score).toBe(3);

    // 50 (attendance) + 20 (quiz attempt) + 3 × 30 (correct) = 160 XP.
    const analytics = await request.get(`${API_URL}/api/student/analytics`, {
      headers: bearer(studentAToken),
    });
    expect(analytics.ok(), await analytics.text()).toBeTruthy();
    const analyticsBody = await analytics.json();
    expect(analyticsBody.engagement.totalXp).toBe(160);
    expect(
      analyticsBody.recentEvents.filter((event: any) => event.eventType === 'QUIZ_CORRECT')
    ).toHaveLength(3);
    expect(
      analyticsBody.recentEvents.some((event: any) => event.eventType === 'ATTENDANCE_PRESENT')
    ).toBeTruthy();

    // Close the quiz + session through the same endpoints the cockpit uses.
    await endQuizAndSession(request, facultyToken, quiz.quizId, session.id);

    // Students are redirected to their dashboard by the SESSION_ENDED socket.
    await expect(studentPage).toHaveURL(/\/student(\/|$)/, { timeout: 30_000 });
  });

  test('attendance state machine finalises PRESENT for both students', async ({ request }) => {
    const assertStatus = async (token: string) => {
      const deadline = Date.now() + 20_000;
      let actual = 'UNKNOWN';

      while (Date.now() < deadline) {
        const response = await request.get(`${API_URL}/api/student/attendance`, {
          headers: bearer(token),
        });
        expect(response.ok(), await response.text()).toBeTruthy();
        const body = await response.json();
        const record = (body.recentSessions ?? []).find(
          (entry: { sessionId: string }) => entry.sessionId === session.id
        );
        if (record) {
          actual = record.status;
          if (actual === 'PRESENT') break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(actual).toBe('PRESENT');
    };

    const studentBToken = (await apiLogin(request, FIXTURE.studentB)).token;
    await assertStatus(studentAToken);
    await assertStatus(studentBToken);
  });
});
