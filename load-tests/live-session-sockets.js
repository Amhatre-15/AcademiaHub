/**
 * AcademiaHub — Phase 17 Load Test: Live Session WebSocket Storm
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens up to 1,200 simultaneous authenticated WebSocket connections, joins
 * the same session room, and holds them open while the engine broadcasts.
 * This measures the real-time fan-out path used by attendance, quizzes and
 * projector sync (`backend/src/websocket/SessionManager.ts`).
 *
 * Prerequisites
 *   npm run e2e:seed --prefix backend
 *   npm run e2e:load-users --prefix backend   # creates load-tests/tokens.json
 *   A live session (start one from the Faculty cockpit)
 *
 * Run
 *   k6 run load-tests/live-session-sockets.js
 *   k6 run -e VUS=500 -e HOLD_SECONDS=30 load-tests/live-session-sockets.js
 *
 * Environment
 *   API_URL              default http://localhost:5000
 *   WS_URL               default derived from API_URL (http → ws)
 *   VUS                  peak concurrent sockets (default 1200)
 *   HOLD_SECONDS         how long each socket stays open (default 60)
 *   FACULTY_USERNAME / FACULTY_PASSWORD  defaults from the E2E fixture
 */

import ws from 'k6/ws';
import http from 'k6/http';
import exec from 'k6/execution';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const API_URL = __ENV.API_URL ?? 'http://localhost:5000';
const WS_URL = __ENV.WS_URL ?? API_URL.replace(/^http/, 'ws');
const VUS = Number(__ENV.VUS ?? 1200);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS ?? 60);

let TOKENS = [];
try {
  TOKENS = JSON.parse(open('./tokens.json'));
} catch {
  // Validated in setup().
}

const wsConnected = new Counter('ws_connected');
const wsMessages = new Counter('ws_messages');
const wsConnectionTime = new Trend('ws_connection_time', true);
const wsErrorRate = new Rate('ws_error_rate');
const wsBroadcastLatency = new Trend('ws_broadcast_latency', true);
const wsBroadcastReceived = new Counter('ws_broadcast_received');

export const options = {
  scenarios: {
    live_sockets: {
      // Exactly one socket per virtual user: 1,200 simultaneous connections.
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: `${HOLD_SECONDS + 60}s`,
      gracefulStop: '10s',
      tags: { scenario: 'live_sockets' },
    },
    // Fires one real faculty broadcast while every socket is connected.
    broadcast_trigger: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      startTime: '40s',
      maxDuration: '20s',
      exec: 'triggerBroadcast',
      tags: { scenario: 'broadcast_trigger' },
    },
  },
  thresholds: {
    ws_error_rate: ['rate<0.01'],
    ws_connection_time: ['p(95)<1500'],
    ws_broadcast_latency: ['p(95)<500', 'p(99)<1000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  if (!TOKENS.length) {
    fail(
      'load-tests/tokens.json is missing or empty. Run:\n' +
        '  npm run e2e:load-users --prefix backend'
    );
  }

  const login = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({
      username: __ENV.FACULTY_USERNAME ?? 'e2e_faculty',
      password: __ENV.FACULTY_PASSWORD ?? 'E2e@Test123',
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'faculty_login' } }
  );

  if (login.status !== 200) fail(`Faculty login failed (${login.status}): ${login.body}`);

  const session = http.get(`${API_URL}/api/faculty/sessions/active`, {
    headers: {
      Authorization: `Bearer ${login.json('token')}`,
    },
    tags: { name: 'get_active_session' },
  }).json();

  if (!session || !session.id) {
    fail(
      'No ACTIVE session found. Start a class from the Faculty cockpit, then re-run.\n' +
        'Tip: `npm run e2e:seed --prefix backend` resets stale sessions.'
    );
  }

  const facultyToken = login.json('token');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${facultyToken}`,
  };

  // Create a throwaway quiz so the trigger can emit a real QUIZ_STARTED
  // broadcast through SessionManager.broadcastToSession.
  const quizResponse = http.post(
    `${API_URL}/api/faculty/quiz`,
    JSON.stringify({
      title: `[Load] WS broadcast ${Date.now()}`,
      subjectId: session.subjectId,
      classId: session.classId,
      divisionId: session.divisionId ?? undefined,
      batchId: session.batchId ?? undefined,
      sessionId: session.id,
    }),
    { headers: authHeaders, tags: { name: 'create_load_quiz' } }
  );

  if (quizResponse.status !== 201) {
    fail(`Load quiz creation failed (${quizResponse.status}): ${quizResponse.body}`);
  }
  const quizId = quizResponse.json('quiz.id');

  http.post(
    `${API_URL}/api/faculty/quiz/${quizId}/questions`,
    JSON.stringify({
      text: 'WebSocket fan-out probe',
      type: 'MCQ',
      durationSeconds: 60,
      options: [
        { text: 'Probe A', isCorrect: true },
        { text: 'Probe B', isCorrect: false },
      ],
    }),
    { headers: authHeaders, tags: { name: 'create_load_question' } }
  );

  console.log(`[load] opening ${VUS} sockets against session ${session.id}`);
  return { sessionId: session.id, quizId, facultyToken };
}

export default function liveSocket(data) {
  // Stagger the 1,200 handshakes over ~24s so the OS/backend accept queue is
  // not thrashed by a single instantaneous burst. All sockets are still alive
  // together when the broadcast trigger fires at t=40s.
  sleep(Math.max(0, exec.vu.idInTest - 1) * 0.02);

  const student = TOKENS[(exec.vu.idInTest - 1) % TOKENS.length];
  const url = `${WS_URL}?token=${encodeURIComponent(student.token)}`;
  const startedAt = Date.now();

  const response = ws.connect(
    url,
    { tags: { name: 'session_socket' } },
    (socket) => {
      socket.on('open', () => {
        wsConnectionTime.add(Date.now() - startedAt);
        wsConnected.add(1);
        socket.send(JSON.stringify({ action: 'join_session', sessionId: data.sessionId }));
      });

      socket.on('message', (raw) => {
        wsMessages.add(1);
        try {
          const message = JSON.parse(raw);
          if (message.type === 'QUIZ_STARTED' && typeof message.serverTime === 'number') {
            wsBroadcastLatency.add(Date.now() - message.serverTime);
            wsBroadcastReceived.add(1);
          }
        } catch {
          // Non-JSON frames are still counted above.
        }
      });

      socket.on('error', () => {
        wsErrorRate.add(1);
      });

      // Keep the socket open for the lecture window, then disconnect cleanly.
      socket.setTimeout(() => {
        socket.send(JSON.stringify({ action: 'leave_session', sessionId: data.sessionId }));
        socket.close();
      }, HOLD_SECONDS * 1000);
    }
  );

  const upgraded = check(response, {
    'websocket upgraded (101)': (r) => r && r.status === 101,
  });

  if (!upgraded) wsErrorRate.add(1);
  else wsErrorRate.add(0);
}

/**
 * Runs once, 45 seconds into the test, after the socket ramp has completed.
 * Starting the quiz emits QUIZ_STARTED through SessionManager, which adds a
 * `serverTime` field used by every connected VU to measure fan-out latency.
 */
export function triggerBroadcast(data) {
  const response = http.post(
    `${API_URL}/api/faculty/quiz/${data.quizId}/start`,
    null,
    {
      headers: { Authorization: `Bearer ${data.facultyToken}` },
      tags: { name: 'trigger_quiz_broadcast' },
    }
  );

  check(response, {
    'broadcast trigger accepted': (r) => r.status === 200 || r.status === 201,
  });
}
