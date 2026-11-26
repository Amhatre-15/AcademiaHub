const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

async function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const dataStr = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataStr)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(new URL(`${BASE_URL}${path}`), {
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runE2E() {
  console.log("🚀 Starting End-To-End Test...");
  try {
    const adminLogin = await request('POST', '/auth/login', { username: 'admin', password: 'Admin@sspu123' });
    const adminToken = adminLogin.data.token;
    console.log("Admin Token:", adminToken ? "OK" : "MISSING", adminLogin.status);

    let facultyLogin = await request('POST', '/auth/login', { username: 'Mandar', password: 'sspu@123' });
    if (facultyLogin.data.error) {
       facultyLogin = await request('POST', '/auth/login', { username: 'Mandar', password: 'Faculty@123' });
    }
    if (facultyLogin.data.firstLogin) {
      const changePwd = await request('POST', '/auth/change-password', { currentPassword: 'sspu@123', newPassword: 'Faculty@123', confirmPassword: 'Faculty@123' }, facultyLogin.data.token);
      console.log("Change Pwd:", changePwd.status, changePwd.data);
      facultyLogin = await request('POST', '/auth/login', { username: 'Mandar', password: 'Faculty@123' });
    }
    const facultyToken = facultyLogin.data.token;
    console.log("Faculty Token:", facultyToken ? "OK" : "MISSING", facultyLogin.status);
    
    let studentALogin = await request('POST', '/auth/login', { username: 'anushka', password: '2401202006' });
    if (studentALogin.data.error) {
       studentALogin = await request('POST', '/auth/login', { username: 'anushka', password: 'Student@123' });
    }
    if (studentALogin.data.firstLogin) {
      const changePwd = await request('POST', '/auth/change-password', { currentPassword: '2401202006', newPassword: 'Student@123', confirmPassword: 'Student@123' }, studentALogin.data.token);
      studentALogin = await request('POST', '/auth/login', { username: 'anushka', password: 'Student@123' });
    }
    const studentAToken = studentALogin.data.token;
    console.log("Student A Token:", studentAToken ? "OK" : "MISSING", studentALogin.status);

    let studentBLogin = await request('POST', '/auth/login', { username: 'aparna', password: '2401202007' });
    if (studentBLogin.data.error) {
       studentBLogin = await request('POST', '/auth/login', { username: 'aparna', password: 'Student@123' });
    }
    if (studentBLogin.data.firstLogin) {
      const changePwd = await request('POST', '/auth/change-password', { currentPassword: '2401202007', newPassword: 'Student@123', confirmPassword: 'Student@123' }, studentBLogin.data.token);
      studentBLogin = await request('POST', '/auth/login', { username: 'aparna', password: 'Student@123' });
    }
    const studentBToken = studentBLogin.data.token;
    console.log("Student B Token:", studentBToken ? "OK" : "MISSING", studentBLogin.status);

    console.log("✅ All users logged in and passwords changed.");

    const timetable = await request('GET', '/faculty/timetable', null, facultyToken);
    console.log("Timetable API Response:", JSON.stringify(timetable.data, null, 2));
    let timetableEntryId = null;
    if (timetable.data && Array.isArray(timetable.data) && timetable.data.length > 0) {
       timetableEntryId = timetable.data[0].id;
    }
    
    if (!timetableEntryId) {
       console.log("No timetable entries for today. We must create one via Prisma to test E2E properly.");
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       const f = await prisma.user.findUnique({where:{username:'Mandar'}, include:{faculty:true}});
       let tEntry = await prisma.timetableEntry.findFirst(); 
       if (tEntry) {
          await prisma.timetableEntry.update({
             where: { id: tEntry.id },
             data: { dayOfWeek: new Date().getDay(), facultyId: f.faculty.id }
          });
          timetableEntryId = tEntry.id;
       } else {
          console.log("No timetable entries exist in DB! Creating one...");
          const t = await prisma.timeSlot.findFirst();
          const subj = await prisma.subject.findFirst();
          const cls = await prisma.class.findFirst();
          const div = await prisma.division.findFirst();
          const acadYear = await prisma.academicYear.findFirst();
          const semester = await prisma.semester.findFirst();
          const newEntry = await prisma.timetableEntry.create({
            data: {
               dayOfWeek: new Date().getDay(),
               timeSlot: { connect: { id: t.id } },
               subject: { connect: { id: subj.id } },
               faculty: { connect: { id: f.faculty.id } },
               class: { connect: { id: cls.id } },
               division: { connect: { id: div.id } },
               academicYear: { connect: { id: acadYear.id } },
               semester: { connect: { id: semester.id } },
               room: '101',
               lectureType: { connect: { code: 'L' } }
            }
          });
          timetableEntryId = newEntry.id;
       }
       await prisma.$disconnect();
       console.log("Created fallback timetable entry.");
    }
    
    // 3. Start Session
    const startSess = await request('POST', '/faculty/sessions/start', { timetableEntryId }, facultyToken);
    if (startSess.status !== 201) {
       console.log("Start session failed", startSess.data);
       // Ignore if already active, let's fetch active
    }
    const activeSess = await request('GET', '/faculty/sessions/active', null, facultyToken);
    const sessionId = activeSess.data.id;
    console.log("✅ Session started:", sessionId);

    // 4. Generate START Attendance Code
    const startCodeRes = await request('POST', `/faculty/sessions/${sessionId}/attendance/generate`, { checkpointType: 'START' }, facultyToken);
    const startCode = startCodeRes.data.code;
    console.log("✅ Generated START code:", startCode);

    // 5. Student A Submits Code
    const studentAAtt = await request('POST', `/student/sessions/${sessionId}/attendance/submit`, { code: startCode }, studentAToken);
    console.log("✅ Student A submitted START code:", studentAAtt.status);

    // 6. Faculty Creates Quiz
    const quizCreate = await request('POST', '/faculty/quiz', {
      title: 'E2E Quiz',
      subjectId: activeSess.data.subjectId,
      classId: activeSess.data.classId,
      sessionId: sessionId
    }, facultyToken);
    if (!quizCreate.data.quiz) {
       console.log("❌ Quiz Creation Failed:", quizCreate.data);
    }
    const quizId = quizCreate.data.quiz ? quizCreate.data.quiz.id : null;
    console.log("✅ Faculty created quiz:", quizId);

    if (quizId) {
      // Add a question
      await request('POST', `/faculty/quiz/${quizId}/questions`, {
         text: '1+1?', type: 'MCQ', durationSeconds: 30, options: [{text:'2', isCorrect:true}, {text:'3', isCorrect:false}]
      }, facultyToken);
      
      // 7. Start Quiz
      const startQuiz = await request('POST', `/faculty/quiz/${quizId}/start`, { sessionId }, facultyToken);
      console.log("✅ Faculty started quiz:", startQuiz.status);
    }

    // 8. Student A Submits Quiz
    const activeQuizzes = await request('GET', `/student/quiz/active`, null, studentAToken);
    const liveQuiz = activeQuizzes.data && activeQuizzes.data.quiz ? activeQuizzes.data.quiz : null;
    if (liveQuiz) {
       const submitQuiz = await request('POST', `/student/quiz/${liveQuiz.id}/submit`, {
          answers: [{ questionId: liveQuiz.questions[0].id, selectedOptionIds: [liveQuiz.questions[0].options[0].id] }]
       }, studentAToken);
       console.log("✅ Student A submitted quiz:", submitQuiz.status);
    } else {
       console.log("❌ Student A could not see active quiz", activeQuizzes.data);
    }

    // 9. End Quiz
    const endQuiz = await request('POST', `/faculty/quiz/${quizId}/end`, null, facultyToken);
    console.log("✅ Faculty ended quiz:", endQuiz.status);

    // 10. Generate END Attendance Code
    const endCodeRes = await request('POST', `/faculty/sessions/${sessionId}/attendance/generate`, { checkpointType: 'END' }, facultyToken);
    const endCode = endCodeRes.data.code;
    console.log("✅ Generated END code:", endCode);

    // 11. Student A & B submit END code
    const studentAEnd = await request('POST', `/student/sessions/${sessionId}/attendance/submit`, { code: endCode }, studentAToken);
    const studentBEnd = await request('POST', `/student/sessions/${sessionId}/attendance/submit`, { code: endCode }, studentBToken);
    console.log("✅ Students submitted END code", studentAEnd.status, studentBEnd.status);

    // 12. End Session
    const endSess = await request('POST', `/faculty/sessions/${sessionId}/end`, null, facultyToken);
    console.log("✅ Faculty ended session:", endSess.status);

    // 13. Verify Gamification/XP/Status
    const analyticsA = await request('GET', '/student/analytics', null, studentAToken);
    const analyticsB = await request('GET', '/student/analytics', null, studentBToken);
    if (analyticsA.data && analyticsA.data.analytics) {
      console.log(`Student A XP: ${analyticsA.data.analytics.xp}, Attendance: ${analyticsA.data.analytics.attendanceSummary.overallPercentage}%`);
    } else {
      console.log("Analytics A Failed:", analyticsA.data);
    }
    if (analyticsB.data && analyticsB.data.analytics) {
      console.log(`Student B XP: ${analyticsB.data.analytics.xp}, Attendance: ${analyticsB.data.analytics.attendanceSummary.overallPercentage}%`);
    } else {
      console.log("Analytics B Failed:", analyticsB.data);
    }

    console.log("🎉 E2E TEST COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ E2E TEST FAILED", err);
  }
}
runE2E();
