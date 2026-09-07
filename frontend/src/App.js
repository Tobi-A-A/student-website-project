import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import "./App.css";

const ACCOUNTS = [
  { username: "mainadmin", password: "ChangeMe123!", role: "main-admin", name: "Jordan Lee" },
  { username: "admin", password: "Admin123!", role: "admin", name: "Avery Morgan", temporary: false },
  { username: "tempadmin", password: "TempAdmin123!", role: "admin", name: "Taylor Brooks", temporary: true },
  { username: "student", password: "Student123!", role: "student", name: "Sam Taylor", studentId: "STU-001", course: "Biology" },
];
const APP_NAME = "Meridian Learning Hub";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const DEFAULT_THEME = { name: APP_NAME, accent: "#0f766e", background: "#f7faf8", ink: "#17211f", font: "DM Sans" };
const normalizeTheme = (saved) => saved?.name === "Northstar Academy" ? { ...DEFAULT_THEME, ...saved, name: APP_NAME } : { ...DEFAULT_THEME, ...saved };

// South Africa has 11 official languages. Each learner/staff member can pick their own — the
// preference is stored per-account (see languageKeyFor below) so switching language never
// touches, overwrites, or "syncs" anyone else's session, in the same browser or otherwise.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "zu", label: "isiZulu" },
  { code: "xh", label: "isiXhosa" },
  { code: "nso", label: "Sepedi" },
  { code: "tn", label: "Setswana" },
  { code: "st", label: "Sesotho" },
  { code: "ts", label: "Xitsonga" },
  { code: "ss", label: "siSwati" },
  { code: "ve", label: "Tshivenda" },
  { code: "nr", label: "isiNdebele" },
];
const TRANSLATIONS = {
  en: { Overview: "Overview", Accounts: "Accounts", "CSV uploads": "CSV uploads", "SQLite data": "SQLite data", Courses: "Courses", Assignments: "Assignments", "Tests & Exams": "Tests & Exams", Results: "Results", Profile: "Profile", Design: "Design", signOut: "Sign out", darkMode: "Dark mode", lightMode: "Light mode", language: "Language", welcomeBack: "Welcome back", signInSubtitle: "Sign in to your local campus workspace.", username: "Username", password: "Password", signIn: "Sign in", createAccount: "New student? Create an account", forgotPassword: "Forgot password?", demoAccounts: "Demo accounts" },
  af: { Overview: "Oorsig", Accounts: "Rekeninge", "CSV uploads": "CSV-oplaaie", "SQLite data": "SQLite-data", Courses: "Kursusse", Assignments: "Opdragte", "Tests & Exams": "Toetse en Eksamens", Results: "Uitslae", Profile: "Profiel", Design: "Ontwerp", signOut: "Teken uit", darkMode: "Donker modus", lightMode: "Lig modus", language: "Taal", welcomeBack: "Welkom terug", signInSubtitle: "Teken in by jou plaaslike kampuswerkarea.", username: "Gebruikersnaam", password: "Wagwoord", signIn: "Teken in", createAccount: "Nuwe student? Skep 'n rekening", forgotPassword: "Wagwoord vergeet?", demoAccounts: "Demo-rekeninge" },
  zu: { Overview: "Uhlolojikelele", Accounts: "Ama-akhawunti", "CSV uploads": "Ukulayisha kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Assignments: "Imisebenzi", "Tests & Exams": "Ukuhlolwa Nezivivinyo", Results: "Imiphumela", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Imodi emnyama", lightMode: "Imodi ekhanyayo", language: "Ulimi", welcomeBack: "Siyakwamukela futhi", signInSubtitle: "Ngena ku-workspace yakho yasekhampasini yendawo.", username: "Igama lokungena", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omusha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe iphasiwedi?", demoAccounts: "Ama-akhawunti wedemo" },
  xh: { Overview: "Ushwankathelo", Accounts: "Iiakhawunti", "CSV uploads": "Ukulayishwa kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Assignments: "Imisebenzi", "Tests & Exams": "Uvavanyo Neeviwo", Results: "Iziphumo", Profile: "Iprofayile", Design: "Uyilo", signOut: "Phuma", darkMode: "Imowudi emnyama", lightMode: "Imowudi ekhanyayo", language: "Ulwimi", welcomeBack: "Wamkelekile kwakhona", signInSubtitle: "Ngena kwindawo yakho yokusebenzela yekhampasi yasekuhlaleni.", username: "Igama lomsebenzisi", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omtsha? Yenza iakhawunti", forgotPassword: "Ulibele iphasiwedi?", demoAccounts: "Iiakhawunti zedemo" },
  nso: { Overview: "Tshedimošo", Accounts: "Diakhaonto", "CSV uploads": "Go rolelwa CSV", "SQLite data": "Tshedimošo ya SQLite", Courses: "Dithuto", Assignments: "Mešomo", "Tests & Exams": "Diteko le Ditlhahlobo", Results: "Dipoelo", Profile: "Boitsebišo", Design: "Moralo", signOut: "Tšwa", darkMode: "Mokgwa o mo nsu", lightMode: "Mokgwa o mo seetšeng", language: "Leleme", welcomeBack: "O amogetšwe gape", signInSubtitle: "Tsena lefelong la gago la mošomo la khamphase.", username: "Leina la modiriši", password: "Phasewete", signIn: "Tsena", createAccount: "Moithuti yo mofsa? Dira akhaonto", forgotPassword: "O lebetše phasewete?", demoAccounts: "Diakhaonto tša mokgwa" },
  tn: { Overview: "Tshedimosetso", Accounts: "Diakhaonto", "CSV uploads": "Go tsenya CSV", "SQLite data": "Data ya SQLite", Courses: "Dithuto", Assignments: "Ditiro", "Tests & Exams": "Diteko le Ditlhatlhobo", Results: "Dipholo", Profile: "Porofaele", Design: "Moralo", signOut: "Tswa", darkMode: "Mokgwa o lefifi", lightMode: "Mokgwa o lesedi", language: "Puo", welcomeBack: "O amogetswe gape", signInSubtitle: "Tsena mo lefelong la gago la tiro la khampase.", username: "Leina la modirisi", password: "Phasewete", signIn: "Tsena", createAccount: "Moithuti yo mosha? Dira akhaonto", forgotPassword: "O lebetse phasewete?", demoAccounts: "Diakhaonto tsa demo" },
  st: { Overview: "Tlhahlobo", Accounts: "Diakhaonto", "CSV uploads": "Ho kenya CSV", "SQLite data": "Data ea SQLite", Courses: "Lithuto", Assignments: "Mesebetsi", "Tests & Exams": "Litlhahlobo le Litekanyetso", Results: "Liphetho", Profile: "Boemo", Design: "Moralo", signOut: "Tsoa", darkMode: "Mokgwa o lefifi", lightMode: "Mokgwa o leseli", language: "Puo", welcomeBack: "Rea u amohela hape", signInSubtitle: "Kena sebakeng sa hao sa mosebetsi sa khamphase.", username: "Lebitso la mosebedisi", password: "Phasewete", signIn: "Kena", createAccount: "Seithuti se secha? Theha akhaonto", forgotPassword: "U lebetse phasewete?", demoAccounts: "Diakhaonto tsa demo" },
  ts: { Overview: "Xikombiso", Accounts: "Tiakhawunti", "CSV uploads": "Ku layisha CSV", "SQLite data": "Data ya SQLite", Courses: "Swidyondzo", Assignments: "Mintirho", "Tests & Exams": "Mikambo na Swikambelo", Results: "Vuyelo", Profile: "Phurofayili", Design: "Muxaka", signOut: "Huma", darkMode: "Muxaka wa munyama", lightMode: "Muxaka wa vona", language: "Ririmi", welcomeBack: "U amukeriwile nakambe", signInSubtitle: "Nghena endhawini ya wena ya ntirho ya khampasi.", username: "Vito ro tirhisa", password: "Phasiwedi", signIn: "Nghena", createAccount: "Xichudeni lexintshwa? Endla akhawunti", forgotPassword: "U rivele phasiwedi?", demoAccounts: "Tiakhawunti ta demo" },
  ss: { Overview: "Simo", Accounts: "Ema-akhawunti", "CSV uploads": "Kulayisha kwe-CSV", "SQLite data": "Imininingwane ye-SQLite", Courses: "Tifundvo", Assignments: "Imisebenti", "Tests & Exams": "Kuhlolwa Netivivinyo", Results: "Imiphumela", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Simo lesimnyama", lightMode: "Simo lesikhanyako", language: "Lulwimi", welcomeBack: "Uyemukelwa futsi", signInSubtitle: "Ngena endzaweni yakho yekusebenta yelikhampasi.", username: "Ligama lekungena", password: "Liphasiwedi", signIn: "Ngena", createAccount: "Umfundzi lomusha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe liphasiwedi?", demoAccounts: "Ema-akhawunti wedemo" },
  ve: { Overview: "Musumbulusi", Accounts: "Diakhaundi", "CSV uploads": "U layisha CSV", "SQLite data": "Data ya SQLite", Courses: "Zwifundwa", Assignments: "Mishumo", "Tests & Exams": "Milingo na Mibvunzo", Results: "Mvelelo", Profile: "Purofaili", Design: "Muhangwa", signOut: "Bva", darkMode: "Muhangwa mutswu", lightMode: "Muhangwa mutshena", language: "Luambo", welcomeBack: "Ro U tanganedza hafhu", signInSubtitle: "Dzhenani fhethu havho ha mushumo wa khemphasi.", username: "Dzina la mushumisi", password: "Phasiwede", signIn: "Dzhena", createAccount: "Mugudiswa muswa? Ita akhaundi", forgotPassword: "Wo hangwa phasiwede?", demoAccounts: "Diakhaundi dza demo" },
  nr: { Overview: "Ukubuka konke", Accounts: "Ama-akhawunti", "CSV uploads": "Ukulayisha kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Assignments: "Imisebenzi", "Tests & Exams": "Iimvivinyo Neenzivinyo", Results: "Imiphumela", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Imodi emnyama", lightMode: "Imodi ekhanyako", language: "Ilimi", welcomeBack: "Siyakwemukela godu", signInSubtitle: "Ngena esikhundleni sakho semsebenzi wekhampasi lendawo.", username: "Ibizo lokungena", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omutjha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe iphasiwedi?", demoAccounts: "Ama-akhawunti wedemo" },
};
// Language is scoped per signed-in account (falling back to a "guest" bucket pre-login) so one
// person switching their language can never change what another person — signed in on the same
// browser at a different time, or reviewed by an admin — sees. It is intentionally NOT part of
// the SQLite sync payload or any shared localStorage key.
const languageKeyFor = (username) => `portal-language-${username ? username.toLowerCase() : "guest"}`;
const translate = (language, key) => (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.en[key] || key;

const DEFAULT_ASSIGNMENTS = [
  { id: 1, title: "Welcome reflection", subject: "Orientation", start: "2026-09-08T09:00", due: "2026-09-15", duration: 60, file: "reflection-guide.pdf", owner: "Avery Morgan" },
  { id: 2, title: "Science lab report", subject: "Biology", start: "2026-09-12T10:00", due: "2026-09-22", duration: 90, file: "lab-template.docx", owner: "Avery Morgan" },
  { id: 3, title: "Programming project", subject: "Computer Science", start: "2026-09-05T09:00", due: "2026-09-19", duration: 120, file: "project-brief.pdf", owner: "Avery Morgan" },
  { id: 4, title: "Case study analysis", subject: "Business Administration", start: "2026-09-10T09:00", due: "2026-09-24", duration: 90, file: "case-study-brief.pdf", owner: "Avery Morgan" },
];

const DEFAULT_MARKS = [{ studentId: "STU-001", assessmentId: "BIO-001", student: "Sam Taylor", subject: "Biology", grade: "A", score: 92, weighting: 100, status: "Published", publishedAt: "2026-08-28", feedback: "Excellent analysis and clear evidence." }];
const COURSES = [
  ["Computer Science", "Maths, English, and logical problem-solving; often a programming project."],
  ["Business Administration", "English, basic Maths, and an interest in finance, management, or enterprise."],
  ["Psychology", "English, Biology or Social Science, plus strong research and essay skills."],
  ["Nursing", "Biology or Health Science, Maths, English, DBS/background checks, and an interview."],
  ["Engineering", "Advanced Maths and Physics/Chemistry, with practical problem-solving skills."]
];
const DAILY_QUOTES = ["Small steps become remarkable progress.", "Your consistency today shapes your success tomorrow.", "Learn boldly, reflect often, and keep moving forward."];
// Demo submissions so the Assignments page has realistic upload/download/marking data out of
// the box — several still awaiting review (to exercise the bulk ZIP download), one closed and
// marked with feedback (so students can see how a marked ZIP download looks), and one below the
// passing mark to demonstrate remediation. Names/courses/years match the bulk demo students
// seeded in backend/db.js (STU-002..STU-050) so the submission rows line up with the real
// SQLite-backed account data instead of showing a mismatched name. fileUrl uses a tiny in-memory
// data: URL so "download" buttons work immediately without needing a real ZIP on disk.
const demoZipUrl = "data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==";
const DEFAULT_SUBMISSIONS = {
  "1-student2": { assignmentId: 1, assignmentTitle: "Welcome reflection", subject: "Orientation", course: "Biology", yearLevel: 3, studentUsername: "student2", studentName: "Casey Clark", studentId: "STU-002", fileName: "welcome-reflection.zip", fileUrl: demoZipUrl, submittedAt: "2026-09-09T10:00:00.000Z", completed: true, closed: false },
  "1-student5": { assignmentId: 1, assignmentTitle: "Welcome reflection", subject: "Orientation", course: "Computer Science", yearLevel: 2, studentUsername: "student5", studentName: "Frankie Foster", studentId: "STU-005", fileName: "welcome-reflection.zip", fileUrl: demoZipUrl, submittedAt: "2026-09-09T11:20:00.000Z", completed: true, closed: false },
  "1-student6": { assignmentId: 1, assignmentTitle: "Welcome reflection", subject: "Orientation", course: "Business Management", yearLevel: 3, studentUsername: "student6", studentName: "Gray Gibson", studentId: "STU-006", fileName: "welcome-reflection.zip", fileUrl: demoZipUrl, submittedAt: "2026-09-10T08:05:00.000Z", completed: true, closed: false },
  "2-student3": { assignmentId: 2, assignmentTitle: "Science lab report", subject: "Biology", course: "Psychology", yearLevel: 4, studentUsername: "student3", studentName: "Drew Diaz", studentId: "STU-003", fileName: "lab-report.zip", fileUrl: demoZipUrl, submittedAt: "2026-09-13T09:30:00.000Z", completed: true, closed: true, mark: 88, markedFileName: "lab-report-marked.zip", markedFileUrl: demoZipUrl },
  "3-student4": { assignmentId: 3, assignmentTitle: "Programming project", subject: "Computer Science", course: "Mechanical Engineering", yearLevel: 1, studentUsername: "student4", studentName: "Ellis Evans", studentId: "STU-004", fileName: "programming-project.zip", fileUrl: demoZipUrl, submittedAt: "2026-09-06T14:15:00.000Z", completed: true, closed: true, mark: 48, markedFileName: "programming-project-marked.zip", markedFileUrl: demoZipUrl },
};
const initials = (name) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "N";
// Demo tests/exams — separate from Assignments because these are auto-marked multiple-choice
// assessments scoped to a course and year level, rather than uploaded files. Attempts feed the
// same pass/remediation logic (score vs a configurable passing mark) as the marks workflow.
const DEFAULT_TESTS = [
  { id: 1, title: "Intro to Algorithms quiz", subject: "Computer Science", course: "Computer Science", yearLevel: 1, passingMark: 60, durationMinutes: 20, maxAttempts: 2, questions: [
    { question: "Which data structure uses FIFO order?", options: ["Stack", "Queue", "Tree", "Graph"], correct: 1 },
    { question: "What is the time complexity of binary search?", options: ["O(n)", "O(n^2)", "O(log n)", "O(1)"], correct: 2 },
    { question: "Which keyword declares a constant in JavaScript?", options: ["var", "let", "const", "static"], correct: 2 },
    { question: "What does CPU stand for?", options: ["Central Process Unit", "Central Processing Unit", "Computer Personal Unit", "Central Processor Utility"], correct: 1 },
  ] },
  { id: 2, title: "Cell Biology exam", subject: "Biology", course: "Biology", yearLevel: 2, passingMark: 60, durationMinutes: 30, maxAttempts: 2, questions: [
    { question: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi apparatus"], correct: 2 },
    { question: "DNA replication occurs in which phase?", options: ["G1", "S", "G2", "M"], correct: 1 },
    { question: "What is the basic unit of life?", options: ["Cell", "Atom", "Tissue", "Organ"], correct: 0 },
    { question: "Which organelle handles photosynthesis?", options: ["Mitochondria", "Chloroplast", "Nucleus", "Vacuole"], correct: 1 },
  ] },
  { id: 3, title: "Business fundamentals test", subject: "Business Management", course: "Business Management", yearLevel: 1, passingMark: 60, durationMinutes: 25, maxAttempts: 2, questions: [
    { question: "What does ROI stand for?", options: ["Rate of Interest", "Return on Investment", "Risk of Insolvency", "Return on Income"], correct: 1 },
    { question: "A balance sheet reports a company's...", options: ["Revenue only", "Assets, liabilities, and equity", "Cash flow only", "Marketing plan"], correct: 1 },
    { question: "What is a fixed cost?", options: ["Cost that changes with output", "Cost that stays the same regardless of output", "A one-time cost", "Employee salaries only"], correct: 1 },
  ] },
];
const DEFAULT_TEST_ATTEMPTS = {};
const displayDate = () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
const gradeFor = (score, passingMark) => {
  const percentage = Number(score);
  const threshold = Number(passingMark);
  if (percentage < threshold) return "R";
  if (percentage >= 70) return "A";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  return "D";
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Local API returned ${response.status}.`);
  return body;
}

function csvDownloadUrl(path) {
  return `${API_BASE}${path}`;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [active, setActive] = useState("Overview");
  const [accounts, setAccounts] = useState(() => load("portal-accounts", ACCOUNTS));
  const [assignments, setAssignments] = useState(() => load("portal-assignments", DEFAULT_ASSIGNMENTS));
  const [marks, setMarks] = useState(() => load("portal-marks", DEFAULT_MARKS));
  const [theme, setTheme] = useState(() => {
    const saved = normalizeTheme(load("portal-theme", DEFAULT_THEME));
    if (saved.name === APP_NAME && load("portal-theme", DEFAULT_THEME)?.name === "Northstar Academy") localStorage.setItem("portal-theme", JSON.stringify(saved));
    return saved;
  });
  const [darkMode, setDarkMode] = useState(() => load("portal-dark-mode", false));
  const [notice, setNotice] = useState("");
  const [notifications, setNotifications] = useState(() => load("portal-notifications", []));
  const [passMark, setPassMark] = useState(() => load("portal-pass-mark", 60));
  const [welcome, setWelcome] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState("");
  const [sqliteData, setSqliteData] = useState(null);
  const [submissions, setSubmissions] = useState(() => load("portal-submissions", DEFAULT_SUBMISSIONS));
  const [customCourses, setCustomCourses] = useState(() => load("portal-courses", []));
  const [tests, setTests] = useState(() => load("portal-tests", DEFAULT_TESTS));
  const [testAttempts, setTestAttempts] = useState(() => load("portal-test-attempts", DEFAULT_TEST_ATTEMPTS));
  // Language is loaded fresh for whichever account is signed in (or "guest" on the login screen)
  // — see languageKeyFor's comment above. Re-reading it whenever `user` changes means switching
  // accounts in the same browser always picks up that account's own saved language rather than
  // leaking the previous user's choice.
  const [language, setLanguageState] = useState(() => load(languageKeyFor(null), "en"));
  useEffect(() => { setLanguageState(load(languageKeyFor(user?.username), "en")); }, [user?.username]);
  const setLanguage = (code) => { setLanguageState(code); localStorage.setItem(languageKeyFor(user?.username), JSON.stringify(code)); };
  const t = (key) => translate(language, key);
  const courses = [...COURSES, ...customCourses.map((course) => [course.name, course.requirement])];
  const apiConnectedRef = useRef(false);
  useEffect(() => { apiConnectedRef.current = apiConnected; }, [apiConnected]);
  // Only replaces state when the incoming value is actually different, so a matching
  // poll/refresh tick does not force every consumer of this data to re-render (which
  // previously caused the whole Results page to flicker on every 1s/5s sync).
  const setIfChanged = (setter) => (next) => setter((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 450); return () => clearTimeout(timer); }, []);
  // Restore a signed-in session after a page refresh. The browser keeps the HttpOnly
  // session cookie, but all React state (including `user`) resets on reload; without this
  // the app always fell back to the login screen even though the backend session was
  // still valid, which looked like every refresh signed the user out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restored = await apiRequest("/api/accounts/me");
        if (!cancelled) {
          setUser(restored);
          setApiConnected(true);
        }
      } catch (_) {
        // No valid session (fresh browser, expired cookie, or offline API) — stay on the login screen.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const setAssignmentsIfChanged = setIfChanged(setAssignments);
    const setSubmissionsIfChanged = setIfChanged(setSubmissions);
    const setMarksIfChanged = setIfChanged(setMarks);
    const setCustomCoursesIfChanged = setIfChanged(setCustomCourses);
    const setTestsIfChanged = setIfChanged(setTests);
    const setTestAttemptsIfChanged = setIfChanged(setTestAttempts);
    const refreshLocalWorkspace = () => {
      setAssignmentsIfChanged(load("portal-assignments", DEFAULT_ASSIGNMENTS));
      setSubmissionsIfChanged(load("portal-submissions", DEFAULT_SUBMISSIONS));
      // While the SQLite API is connected, marks are owned by the database sync below;
      // skip overwriting them here so the two sources don't fight and flicker the UI.
      if (!apiConnectedRef.current) setMarksIfChanged(load("portal-marks", DEFAULT_MARKS));
      setCustomCoursesIfChanged(load("portal-courses", []));
      setTestsIfChanged(load("portal-tests", DEFAULT_TESTS));
      setTestAttemptsIfChanged(load("portal-test-attempts", DEFAULT_TEST_ATTEMPTS));
    };
    const handleStorage = (event) => {
      refreshLocalWorkspace();
      if (event.key === "portal-theme") setTheme(normalizeTheme(load("portal-theme", DEFAULT_THEME)));
    };
    window.addEventListener("storage", handleStorage);
    const timer = setInterval(refreshLocalWorkspace, 1000);
    return () => { window.removeEventListener("storage", handleStorage); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const setMarksIfChanged = setIfChanged(setMarks);
    const setAccountsIfChanged = setIfChanged(setAccounts);
    const setSqliteDataIfChanged = setIfChanged(setSqliteData);
    const sync = async () => {
      try {
        if (user.role === "student") {
          const rows = await apiRequest(`/student/marks/local/${encodeURIComponent(user.studentId)}`);
          if (cancelled) return;
          setMarksIfChanged(rows.map((mark) => ({ ...mark, score: mark.mark, subject: mark.assessmentId, weighting: 100, grade: gradeFor(mark.mark, 60) })));
          setApiConnected(true);
          setApiError("");
          return;
        }
        const data = await apiRequest("/admin/data");
        if (cancelled) return;
        setSqliteDataIfChanged(data);
        setApiConnected(true);
        setApiError("");
        const dbAccounts = data.users.map((account) => ({ ...account, temporary: false }));
        const dbMarks = data.marks.map((mark) => ({ ...mark, score: mark.mark, subject: mark.assessmentId, weighting: 100 }));
        setAccountsIfChanged(dbAccounts);
        setMarksIfChanged(dbMarks);
      } catch (error) {
        if (!cancelled) {
          setApiConnected(false);
          setApiError(`SQLite sync unavailable: ${error.message}`);
        }
      }
    };
    sync();
    const timer = setInterval(sync, 5000);
    const onSyncNow = () => sync();
    window.addEventListener("portal-sync-now", onSyncNow);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("portal-sync-now", onSyncNow); };
  }, [user]);

  const persist = (key, value, setter) => { setter(value); localStorage.setItem(key, JSON.stringify(value)); };
  const roleLabel = { "main-admin": "Main administrator", admin: "Administrator", student: "Student" };
  const nav = user?.role === "main-admin"
    ? ["Overview", "Accounts", "CSV uploads", "SQLite data", "Courses", "Assignments", "Tests & Exams", "Results", "Profile", "Design"]
    : user?.role === "admin" ? ["Overview", "Accounts", "CSV uploads", "SQLite data", "Courses", "Assignments", "Tests & Exams", "Results", "Profile"] : ["Overview", "Courses", "Assignments", "Tests & Exams", "Results", "Profile"];

  async function signIn(event) {
    event.preventDefault();
    try {
      if (process.env.NODE_ENV === "test") throw new Error("browser-only test mode");
      const found = await apiRequest("/api/accounts/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(login) });
      setUser(found); setApiConnected(true); setLoginError(""); setActive("Overview");
      setWelcome(found.role === "student" ? `Welcome to ${theme.name}, ${found.name.split(" ")[0]}! Your learning journey starts here.` : DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length]);
    } catch (error) {
      const local = accounts.find((account) => account.username === login.username.trim() && account.password === login.password);
      if (!local) { setLoginError(error.message || "Those details do not match a local account."); return; }
      setUser(local); setApiConnected(false); setLoginError(""); setActive("Overview");
      setWelcome(local.role === "student" ? `Welcome to ${theme.name}, ${local.name.split(" ")[0]}! Your learning journey starts here.` : "Working in browser-only mode.");
    }
  }

  function LoadingScreen({ theme }) {
    return <div className="loading-screen" style={{ "--accent": theme.accent }}><span className="brand-mark">{initials(theme.name)}</span><h1>{theme.name}</h1><p>Preparing your local workspace…</p><span className="loading-bar" /></div>;
  }

  async function signOut() {
    try { await apiRequest("/api/accounts/logout", { method: "POST" }); } catch (_) { /* local sign-out still succeeds when API is offline */ }
    setUser(null); setLogin({ username: "", password: "" }); setSqliteData(null); setApiConnected(false);
  }

  if (loading) return <LoadingScreen theme={theme} />;
  if (!user) return <Login login={login} setLogin={setLogin} setAccounts={setAccounts} error={loginError} onSubmit={signIn} theme={theme} darkMode={darkMode} setDarkMode={setDarkMode} language={language} setLanguage={setLanguage} t={t} />;

  const currentMarks = marks.filter((mark) => user.role !== "student" || (mark.studentId === user.studentId && ["Published", "Locked"].includes(mark.status || "Published")));
  const notify = (message) => {
    const next = [{ id: Date.now(), message, date: new Date().toISOString() }, ...notifications];
    setNotifications(next); localStorage.setItem("portal-notifications", JSON.stringify(next)); setNotice(message);
  };
  return (
    <div className={`app-shell${darkMode ? " dark-mode" : ""}`} style={{ "--accent": theme.accent, "--paper": theme.background, "--ink": theme.ink, "--portal-font": theme.font }}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
        <div className="profile"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div></div>
        <nav aria-label="Main navigation">{nav.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)}>{t(item)}</button>)}</nav>
        <button className="sign-out" onClick={signOut}>{t("signOut")}</button>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">Academic workspace</p><h1>{t(active)}</h1><span className="storage-note">SQLite API: {apiConnected ? "connected and syncing every 5 seconds" : "offline/browser fallback"} · port 5000</span></div><div className="top-actions"><label className="language-select"><span className="sr-only">{t("language")}</span><select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("language")}>{LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}</select></label><button className="theme-toggle" onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem("portal-dark-mode", JSON.stringify(next)); }} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>{darkMode ? t("lightMode") : t("darkMode")}</button><span className="status-dot">{apiConnected ? "SQLite connected" : "Local mode"}</span><button className="icon-button" aria-label="Notifications" title={`${notifications.length} notifications`}>○</button></div></header>
        {welcome && <div className="welcome-toast" role="status">{welcome}<button onClick={() => setWelcome("")}>×</button></div>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {apiError && user.role !== "student" && <div className="notice error" role="alert">{apiError}</div>}
        {active === "Overview" && <Overview user={user} assignments={assignments} marks={currentMarks} accounts={accounts} apiConnected={apiConnected} />}
        {active === "Accounts" && <Accounts accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} user={user} />}
        {active === "CSV uploads" && <CsvUploads setNotice={setNotice} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} accounts={accounts} passMark={passMark} />}
        {active === "SQLite data" && <SQLiteData data={sqliteData} connected={apiConnected} />}
        {active === "Courses" && <><Courses accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} user={user} setUser={setUser} apiConnected={apiConnected} notify={notify} courses={courses} canManage={user.role !== "student"} removeCourse={(name) => { const next = customCourses.filter((course) => course.name !== name); persist("portal-courses", next, setCustomCourses); }} /><CourseManager courses={courses} setCustomCourses={(v) => persist("portal-courses", v, setCustomCourses)} canManage={user.role !== "student"} /></>}
        {active === "Assignments" && <Assignments user={user} assignments={assignments} setAssignments={(v) => persist("portal-assignments", v, setAssignments)} submissions={submissions} setSubmissions={(v) => persist("portal-submissions", v, setSubmissions)} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} accounts={accounts} courses={courses} passMark={passMark} setNotice={setNotice} />}
        {active === "Tests & Exams" && <TestsExams user={user} tests={tests} setTests={(v) => persist("portal-tests", v, setTests)} attempts={testAttempts} setAttempts={(v) => persist("portal-test-attempts", v, setTestAttempts)} accounts={accounts} courses={courses} passMark={passMark} notify={notify} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} />}
        {active === "Results" && <Results marks={user.role === "student" ? currentMarks : marks} canEdit={user.role !== "student"} setMarks={(v) => persist("portal-marks", v, setMarks)} user={user} notify={notify} passMark={passMark} setPassMark={(v) => persist("portal-pass-mark", v, setPassMark)} accounts={accounts} />}
        {active === "Profile" && <Profile user={user} accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} setUser={setUser} />}
        {active === "Design" && <Design theme={theme} setTheme={(v) => persist("portal-theme", v, setTheme)} />}
      </main>
    </div>
  );
}

function Login({ login, setLogin, setAccounts, error, onSubmit, theme, darkMode, setDarkMode, language, setLanguage, t }) {
  const [registering, setRegistering] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [registration, setRegistration] = useState({ name: "", username: "", password: "", studentId: "", course: "" });
  const [registered, setRegistered] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const register = (event) => {
    event.preventDefault();
    const username = registration.username.trim();
    if (!registration.name.trim() || !username || !registration.password || !registration.studentId.trim() || !registration.course) {
      setRegistrationError("Complete every field, including your course, to create your student account."); return;
    }
    const accounts = load("portal-accounts", ACCOUNTS);
    if (accounts.some((account) => account.username.toLowerCase() === username.toLowerCase())) {
      setRegistrationError("That username is already in use."); return;
    }
    if (accounts.some((account) => account.studentId?.toLowerCase() === registration.studentId.trim().toLowerCase())) {
      setRegistrationError("That student ID is already registered."); return;
    }
    const nextAccounts = [...accounts, { ...registration, name: registration.name.trim(), username, studentId: registration.studentId.trim(), role: "student" }];
    localStorage.setItem("portal-accounts", JSON.stringify(nextAccounts)); setAccounts(nextAccounts);
    setRegistrationError(""); setRegistered(true); setLogin({ username, password: registration.password });
  };
  const requestReset = (event) => { event.preventDefault(); const email = new FormData(event.currentTarget).get("email"); setRecoveryMessage(`A local password-reset notification was prepared for ${email}. Check the in-portal demo notifications.`); };
  return <div className={`login-page${darkMode ? " dark-mode" : ""}`} style={{ "--accent": theme.accent || "#0f766e" }}><div className="login-art"><span className="brand-mark">{initials(theme.name)}</span><p className="eyebrow">Your campus, connected</p><h1>Make space for<br /><em>what’s next.</em></h1><p>One calm place for teaching, learning and progress.</p></div><div className="login-top-actions"><label className="language-select login-language-toggle"><span className="sr-only">{t("language")}</span><select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("language")}>{LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}</select></label><button className="theme-toggle login-theme-toggle" onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem("portal-dark-mode", JSON.stringify(next)); }} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>{darkMode ? t("lightMode") : t("darkMode")}</button></div>{registering ?  <form className="login-card" onSubmit={register}><div className="brand dark"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>{registered ? <><h2>Profile created</h2><p className="muted">Your course and learner details are stored locally in this browser.</p><button className="primary full" type="button" onClick={() => { setRegistering(false); setRegistered(false); }}>{t("signIn")}</button></> : <><h2>Create your account</h2><p className="muted">Register as a new student for this local campus demo.</p><label>Full name<input autoFocus value={registration.name} onChange={(e) => setRegistration({ ...registration, name: e.target.value })} /></label><label>Student ID<input value={registration.studentId} onChange={(e) => setRegistration({ ...registration, studentId: e.target.value })} /></label><label>Course<select required value={registration.course} onChange={(e) => setRegistration({ ...registration, course: e.target.value })}><option value="">Choose your course</option>{COURSES.map(([name]) => <option key={name}>{name}</option>)}</select></label><label>Username<input value={registration.username} onChange={(e) => setRegistration({ ...registration, username: e.target.value })} /></label><label>Password<input type="password" value={registration.password} onChange={(e) => setRegistration({ ...registration, password: e.target.value })} /></label>{registrationError && <p className="error">{registrationError}</p>}<button className="primary full" type="submit">Create account</button><button className="text-button auth-link" type="button" onClick={() => { setRegistering(false); setRegistrationError(""); }}>Already have an account? Sign in</button></>}</form> : forgot ? <form className="login-card" onSubmit={requestReset}><div className="brand dark"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div><h2>{t("forgotPassword")}</h2><p className="muted">Use a trusted Gmail or other email address. This local demo prepares the notification without sending external mail.</p><label>Trusted email<input required type="email" name="email" placeholder="you@example.com" /></label>{recoveryMessage && <p className="notice">{recoveryMessage}</p>}<button className="primary full" type="submit">Prepare reset notification</button><button className="text-button auth-link" type="button" onClick={() => setForgot(false)}>Back to sign in</button></form> : <form className="login-card" onSubmit={onSubmit}><div className="brand dark"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div><h2>{t("welcomeBack")}</h2><p className="muted">{t("signInSubtitle")}</p><label>{t("username")}<input autoFocus value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} /></label><label>{t("password")}<input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></label>{error && <p className="error">{error}</p>}<button className="primary full auth-submit" type="submit">{t("signIn")}</button><button className="text-button auth-link" type="button" onClick={() => setRegistering(true)}>{t("createAccount")}</button><button className="text-button auth-link" type="button" onClick={() => setForgot(true)}>{t("forgotPassword")}</button><div className="demo-box"><strong>{t("demoAccounts")}</strong><span>mainadmin / ChangeMe123!</span><span>admin / Admin123!</span><span>student / Student123!</span></div></form>}</div>;
}

function Overview({ user, assignments, marks, accounts, apiConnected }) {
  const waitingForSync = user.role !== "student" && !apiConnected;
  const stats = user.role === "student" ? [["Assignments", assignments.length], ["Average score", marks.length ? `${Math.round(marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length)}%` : "—"], ["Feedback", marks.filter((m) => m.feedback).length]] : [["Students", waitingForSync ? "Syncing…" : accounts.filter((a) => a.role === "student").length], ["Assignments", assignments.length], ["Results published", waitingForSync ? "Syncing…" : marks.length]];
  const isClosed = (assignment) => assignment.completed || (assignment.due && new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) < new Date());
  return <><section className="welcome"><div><p className="eyebrow">{displayDate()}</p><h2>Good morning, {user.name.split(" ")[0]}.</h2><p className="muted">Here’s what needs your attention today.</p></div><span className="welcome-shape">✦</span></section><div className="stats">{stats.map(([label, value]) => <div className="stat-card" key={label}><small>{label}</small><strong>{value}</strong><span className="trend">Updated just now</span></div>)}</div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Next up</p><h3>Upcoming and past assignments</h3></div><span className="count">{assignments.length} total</span></div>{assignments.slice(0, 6).map((a) => <div className={`list-row${isClosed(a) ? " assignment-completed" : ""}`} key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong><small>{a.subject} · Opens {a.start ? new Date(a.start).toLocaleString() : "now"} · Due {a.due}{a.dueTime ? ` at ${a.dueTime}` : ""} · {a.duration || 60} minutes</small></div><span className="pill">{isClosed(a) ? "Completed" : user.role === "student" ? "To do" : "Published"}</span></div>)}</section></>;
}

function Accounts({ accounts, setAccounts, user }) {
  const [form, setForm] = useState({ name: "", username: "", password: "", temporary: true, role: "admin" });
  const add = (e) => { e.preventDefault(); const username = form.username.trim().toLowerCase(); if (!form.name.trim() || !username || !form.password) return; if (accounts.some((account) => account.username.toLowerCase() === username)) return; setAccounts([...accounts, { ...form, name: form.name.trim(), username, role: user.role === "main-admin" ? form.role : "admin" }]); setForm({ name: "", username: "", password: "", temporary: true, role: "admin" }); };
  const download = (account) => { const studentMarks = load("portal-marks", DEFAULT_MARKS).filter((mark) => mark.studentId === account.studentId); const text = studentMarks.map((mark) => `${mark.subject},${mark.assessmentId || "Assessment"},${mark.score}%,${mark.grade}`).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`Subject,Assessment,Score,Grade\n${text}`], { type: "text/csv" })); link.download = `${account.studentId}-marks-summary.csv`; link.click(); };
  const learners = accounts.filter((a) => a.role === "student");
  return <div className="account-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Access control</p><h3>Administrator accounts</h3></div></div>{accounts.filter((a) => a.role !== "student").map((a) => <div className="list-row" key={a.username}><div className="avatar small">{a.name.split(" ").map((p) => p[0]).join("")}</div><div><strong>{a.name}</strong><small>@{a.username} · {a.role === "main-admin" ? "Permanent main account" : a.temporary ? "Temporary admin" : "Permanent admin"}</small></div>{a.role !== "main-admin" && <button className="text-button danger" onClick={() => setAccounts(accounts.filter((item) => item.username !== a.username))}>Delete</button>}</div>)}</section><form className="panel form-panel" onSubmit={add}><p className="eyebrow">New access</p><h3>Add a permanent or temp admin</h3><label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Username<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>Secure password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label className="check-row"><input type="checkbox" checked={form.temporary} onChange={(e) => setForm({ ...form, temporary: e.target.checked })} /> Temporary account</label>{user.role === "main-admin" && <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Administrator</option><option value="main-admin">Main administrator</option></select></label>}<button className="primary" type="submit">Create account</button></form><section className="panel"><p className="eyebrow">Learners</p><h3>Student accounts</h3>{learners.map((learner) => <div className="list-row" key={learner.username}><div className="avatar small">{learner.name.split(" ").map((p) => p[0]).join("")}</div><div><strong>{learner.name}</strong><small>{learner.studentId} · {learner.course || "Course not assigned"}</small></div><button className="secondary" onClick={() => download(learner)}>Download marks</button><button className="text-button danger" onClick={() => setAccounts(accounts.filter((item) => item.username !== learner.username))}>Delete</button></div>)}</section></div>;
}

function Profile({ user, accounts, setAccounts, setUser }) {
  const [draft, setDraft] = useState({ name: user.name || "", username: user.username || "", email: user.email || "", studentId: user.studentId || "", course: user.course || "" });
  const [message, setMessage] = useState("");
  const save = (event) => {
    event.preventDefault();
    const username = draft.username.trim().toLowerCase();
    if (!draft.name.trim() || !username) return setMessage("Name and username are required.");
    if (accounts.some((account) => account.username.toLowerCase() === username && account.username !== user.username)) return setMessage("That username is already in use.");
    if (draft.studentId && accounts.some((account) => account.studentId?.toLowerCase() === draft.studentId.trim().toLowerCase() && account.username !== user.username)) return setMessage("That student ID is already in use.");
    const updated = { ...user, ...draft, name: draft.name.trim(), username, studentId: draft.studentId.trim() };
    setAccounts(accounts.map((account) => account.username === user.username ? updated : account)); setUser(updated); setMessage("Profile saved locally.");
  };
  return <form className="panel profile-panel" onSubmit={save}><p className="eyebrow">Your information</p><h3>View profile</h3><p className="muted">Update details recorded by the school. Changes are stored in browser localStorage for this demo.</p><label>Full name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Username<input required value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></label><label>Email<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>{user.role === "student" && <><label>Student ID<input value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })} /></label><label>Course<input value={draft.course} onChange={(e) => setDraft({ ...draft, course: e.target.value })} /></label></>}<button className="primary" type="submit">Save profile</button>{message && <p className="notice" role="status">{message}</p>}</form>;
}

function Assignments({ user, assignments, setAssignments, submissions, setSubmissions, marks, setMarks, accounts, courses, passMark, setNotice }) {
  const [selected, setSelected] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [subSearch, setSubSearch] = useState("");
  const [subAssignmentFilter, setSubAssignmentFilter] = useState("all");
  const [subCourseFilter, setSubCourseFilter] = useState("all");
  const [subYearFilter, setSubYearFilter] = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const canManage = user.role !== "student";
  const download = (assignment) => { if (assignment.completed || (assignment.due && new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) < new Date())) return setNotice("This assignment is closed; its pre-made file is no longer available."); if (assignment.url) { const link = document.createElement("a"); link.href = assignment.url; link.download = assignment.file; link.click(); } setSelected(assignment); };
  const downloadSubmission = (submission) => { if (!submission.fileUrl) return setNotice("This older local submission has no downloadable file data. Ask the learner to upload it again."); const link = document.createElement("a"); link.href = submission.fileUrl; link.download = submission.fileName; link.click(); setNotice(`Downloaded ${submission.fileName}. It was checked against the allowed file types before submission.`); };
  const downloadAllSubmissions = async (assignment, related) => {
    const withFiles = related.filter((submission) => submission.fileUrl);
    if (!withFiles.length) return setNotice("No downloadable submissions are available for this assignment yet.");
    setNotice(`Preparing a ZIP of ${withFiles.length} submission(s)…`);
    try {
      const zip = new JSZip();
      const usedNames = new Set();
      let failed = 0;
      // Fetch every submission's blob in parallel (bounded by the browser's concurrent
      // connection limit) instead of one-at-a-time, so bulk downloads of 30-100+ students
      // stay fast. A single failed/missing blob is skipped and reported rather than aborting
      // the whole bundle, so one bad submission can't block everyone else's marks.
      const results = await Promise.allSettled(withFiles.map(async (submission) => {
        const response = await fetch(submission.fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return { submission, blob };
      }));
      for (const result of results) {
        if (result.status !== "fulfilled") { failed++; continue; }
        const { submission, blob } = result.value;
        let name = `${submission.studentId || submission.studentUsername}-${submission.fileName}`;
        while (usedNames.has(name)) name = `copy-${name}`;
        usedNames.add(name);
        zip.file(name, blob);
      }
      if (!usedNames.size) return setNotice("Could not build the bulk ZIP: every submission failed to download. Ask learners to re-upload.");
      const bundle = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(bundle);
      link.download = `${assignment.title.replace(/[^a-z0-9_-]+/gi, "-")}-submissions.zip`;
      link.click();
      const skipped = related.length - withFiles.length + failed;
      setNotice(`Downloaded a ZIP with ${usedNames.size} submission(s) for ${assignment.title}.${skipped > 0 ? ` ${skipped} submission(s) had no file data or failed to download and were skipped.` : ""}`);
    } catch (error) {
      setNotice(`Could not build the bulk ZIP: ${error.message}`);
    }
  };
  const submit = (assignment, file) => {
    const key = `${assignment.id}-${user.username}`;
    const existing = submissions[key];
    const remediationOpen = existing?.mark !== undefined && existing.mark < passMark;
    const deadline = assignment.due ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) : null;
    if ((assignment.completed || (deadline && deadline < new Date())) && !remediationOpen) return setNotice("This assignment is closed because its due date has passed.");
    if (!file || !window.confirm(`Upload “${file.name}” for ${assignment.title}? You can remove it before submitting.`)) return;
    const blocked = /\.(exe|dll|bat|cmd|com|js|vbs|scr|msi|ps1|sh)$/i.test(file.name);
    const allowed = /\.zip$/i.test(file.name) && (file.type === "" || /zip/i.test(file.type));
    if (blocked || !allowed || file.size > 25 * 1024 * 1024) return setNotice("Upload rejected: assignments must be submitted as a single compressed .zip folder, up to 25 MB. Executable files are not accepted.");
    const next = { ...submissions, [key]: remediationOpen ? { ...existing, remediationFileName: file.name, remediationFileUrl: URL.createObjectURL(file), remediationSubmittedAt: new Date().toISOString(), remediationOpen: false } : { assignmentId: assignment.id, assignmentTitle: assignment.title, subject: assignment.subject, course: user.course, studentUsername: user.username, studentName: user.name, studentId: user.studentId, fileName: file.name, fileUrl: URL.createObjectURL(file), submittedAt: new Date().toISOString(), completed: true, closed: false } };
    setSubmissions(next); setNotice(remediationOpen ? `Remediation file submitted for ${assignment.title}. Staff will review it for a final mark.` : `“${file.name}” submitted safely for ${assignment.title}. It is marked completed; marks will be given once reviewed.`);
  };
  const removeSubmission = (assignment) => { const deadline = assignment.due ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) : null; if (assignment.completed || (deadline && deadline < new Date())) return setNotice("Completed or closed assignments cannot have files removed."); const key = `${assignment.id}-${user.username}`; const next = { ...submissions }; delete next[key]; setSubmissions(next); setNotice("Your file was removed and the assignment is ready for another upload."); };
  const closeSubmission = (submission) => { const key = `${submission.assignmentId}-${submission.studentUsername}`; setSubmissions({ ...submissions, [key]: { ...submission, closed: true, closedAt: new Date().toISOString() } }); setNotice(`Submission closed for ${submission.studentName}.`); };
  const saveMark = (submission, value) => { const score = Number(value); if (!Number.isFinite(score) || score < 0 || score > 100) return setNotice("Final marks must be between 0 and 100."); const key = `${submission.assignmentId}-${submission.studentUsername}`; const publishedAt = new Date().toISOString(); setSubmissions({ ...submissions, [key]: { ...submission, mark: score, markPublishedAt: publishedAt, remediationOpen: score < passMark } }); const existing = marks.find((mark) => mark.studentId === submission.studentId && mark.assessmentId === `ASSIGN-${submission.assignmentId}`); const result = { studentId: submission.studentId, assessmentId: `ASSIGN-${submission.assignmentId}`, student: submission.studentName, subject: submission.subject || submission.assignmentTitle, score, weighting: 100, grade: gradeFor(score, passMark), status: "Published", publishedAt: publishedAt.slice(0, 10), feedback: score < passMark ? `Remediation is required below ${passMark}%.` : `Assignment completed successfully at the ${passMark}% passing threshold.`, submissionFile: submission.fileName }; setMarks(existing ? marks.map((mark) => mark === existing ? { ...mark, ...result } : mark) : [...marks, result]); setNotice(score < passMark ? `Remediation is available to ${submission.studentName}.` : `Final mark ${score}% sent to ${submission.studentName}'s profile.`); };
  const uploadMarkedFile = (submission, file) => { if (!file) return; if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) return setNotice("Marked feedback must be a ZIP file up to 25 MB."); const key = `${submission.assignmentId}-${submission.studentUsername}`; setSubmissions({ ...submissions, [key]: { ...submission, markedFileName: file.name, markedFileUrl: URL.createObjectURL(file), markedUploadedAt: new Date().toISOString() } }); setNotice(`Marked ZIP uploaded for ${submission.studentName}.`); };
  const modifyAssignment = (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const replacement = data.get("file"); const updated = { ...editingAssignment, title: String(data.get("title")).trim(), subject: String(data.get("subject")).trim(), start: data.get("start"), due: data.get("due"), dueTime: data.get("dueTime"), duration: Number(data.get("duration")) || 60 }; if (replacement?.name) { updated.file = replacement.name; updated.url = URL.createObjectURL(replacement); } setAssignments(assignments.map((assignment) => assignment.id === updated.id ? updated : assignment)); setEditingAssignment(null); setNotice("Assignment details and file type updated for students."); };
  const toggleCompleted = (assignment) => { setAssignments(assignments.map((item) => item.id === assignment.id ? { ...item, completed: !item.completed } : item)); setNotice(assignment.completed ? "Assignment reopened for students." : "Assignment marked completed; new student submissions are closed."); };
  const deleteAssignment = (assignment) => { if (!window.confirm(`Delete “${assignment.title}” and its local submission records?`)) return; setAssignments(assignments.filter((item) => item.id !== assignment.id)); const next = Object.fromEntries(Object.entries(submissions).filter(([, submission]) => submission.assignmentId !== assignment.id)); setSubmissions(next); setNotice("Assignment deleted."); };
  const downloadMark = (submission) => { const result = `<html><body><h1>Final assignment result</h1><p>Student: ${submission.studentName}</p><p>Assignment: ${submission.assignmentTitle}</p><p>Submitted file: ${submission.fileName}</p><h2>Final mark: ${submission.mark}%</h2><p>${submission.mark < passMark ? `Remediation required below ${passMark}%.` : `Passing requirement met at ${passMark}%.`}</p><p>Published: ${new Date(submission.markPublishedAt).toLocaleString()}</p></body></html>`; const popup = window.open("", "_blank"); if (!popup) return setNotice("Allow pop-ups to print the final mark as a PDF."); popup.document.write(result); popup.document.close(); popup.focus(); popup.print(); };
  const addAssignment = (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); const file = data.get("file"); const title = String(data.get("title")).trim(); const subject = String(data.get("subject")).trim(); const course = String(data.get("course")).trim(); if (!file?.name) return; if (assignments.some((assignment) => assignment.title.toLowerCase() === title.toLowerCase() && assignment.subject.toLowerCase() === subject.toLowerCase() && assignment.course === course)) { setNotice("That assignment already exists for this course."); return; } setAssignments([{ id: Date.now(), title, subject, course, start: data.get("start"), due: data.get("due"), dueTime: data.get("dueTime"), duration: Number(data.get("duration")) || 60, file: file.name, url: URL.createObjectURL(file), owner: user.name }, ...assignments]); e.currentTarget.reset(); setNotice("Assignment published locally."); };
  const ownSubmission = (assignment) => submissions[`${assignment.id}-${user.username}`];
  const resultForSubmission = (submission) => marks.find((mark) => mark.studentId === submission.studentId && mark.assessmentId === `ASSIGN-${submission.assignmentId}`);
  // A single consolidated, searchable/filterable table of every submission across all
  // assignments, grouped by year of study — replaces the previous per-assignment inline
  // cards which made it hard to find a specific learner once there were many assignments.
  const yearOf = (submission) => accounts.find((account) => account.username === submission.studentUsername)?.yearLevel || accounts.find((account) => account.studentId === submission.studentId)?.yearLevel || null;
  const allSubmissions = canManage ? Object.values(submissions).map((submission) => ({ ...submission, yearLevel: yearOf(submission), status: submission.closed ? (submission.mark !== undefined ? "Marked" : "Closed — awaiting mark") : "Open — awaiting review" })) : [];
  const filteredSubmissions = allSubmissions.filter((submission) => {
    const query = subSearch.trim().toLowerCase();
    const matchesSearch = !query || submission.studentName?.toLowerCase().includes(query) || submission.studentId?.toLowerCase().includes(query) || submission.assignmentTitle?.toLowerCase().includes(query);
    const matchesAssignment = subAssignmentFilter === "all" || String(submission.assignmentId) === subAssignmentFilter;
    const matchesCourse = subCourseFilter === "all" || submission.course === subCourseFilter;
    const matchesYear = subYearFilter === "all" || String(submission.yearLevel || "") === subYearFilter;
    const matchesStatus = subStatusFilter === "all" || submission.status === subStatusFilter;
    return matchesSearch && matchesAssignment && matchesCourse && matchesYear && matchesStatus;
  });
  const submissionCourses = [...new Set(allSubmissions.map((s) => s.course).filter(Boolean))];
  const submissionYears = [...new Set(allSubmissions.map((s) => s.yearLevel).filter(Boolean))].sort();
  return <><div className="two-col"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Shared resources</p><h3>{canManage ? "Assignments and submissions" : "Your assignments"}</h3></div></div>{assignments.map((a) => { const own = ownSubmission(a); const ownResult = own ? resultForSubmission(own) : null; const related = Object.values(submissions).filter((submission) => submission.assignmentId === a.id); const isPastDue = a.due && new Date(`${a.due}T${a.dueTime || "23:59"}`) < new Date(); const isClosed = a.completed || isPastDue; const remediationOpen = own?.mark !== undefined && own.mark < passMark; return <div className={`list-row assignment-row${isClosed ? " assignment-completed" : ""}`} key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong>  <small>{a.file} · Opens {a.start ? new Date(a.start).toLocaleString() : "now"} · Ends {a.due}{a.dueTime ? ` at ${a.dueTime}` : ""} · {a.duration || 60} minutes · {isClosed ? "Completed / closed" : "Open"}</small>  {own && <small className="submission">Submitted: {own.fileName} · {own.completed ? "Completed — marks will be given once marked" : "Awaiting review"}{own.mark !== undefined ? ` · Final mark: ${own.mark}%` : ""}{ownResult && ` · ${ownResult.grade === "R" ? `R — remediation required${ownResult.remediation?.date ? ` on ${ownResult.remediation.date}` : ""}${ownResult.remediation?.time ? ` at ${ownResult.remediation.time}` : ""}` : `Grade ${ownResult.grade}`}`}</small>}{canManage && related.length > 0 && <small className="submission">{related.length} submission(s) — see the submissions table below to review, mark, or download them.</small>}{canManage && related.length > 1 && <button className="secondary bulk-download" onClick={() => downloadAllSubmissions(a, related)}>Download all {related.length} submissions (ZIP)</button>}{!isClosed && <button className="secondary" onClick={() => download(a)}>Download assignment</button>}{!canManage && own?.markedFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: own.markedFileUrl, fileName: own.markedFileName })}>Download marked ZIP</button>}{canManage && <><button className="secondary" onClick={() => setEditingAssignment(a)}>Modify</button>  <button className="secondary" onClick={() => toggleCompleted(a)}>{a.completed ? "Reopen" : "Mark completed"}</button><button className="text-button danger" onClick={() => deleteAssignment(a)}>Delete</button></>}{!canManage && !own?.closed && ((!a.completed && !isPastDue) || remediationOpen) && <label className="secondary upload-button">Upload ZIP folder<input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(e) => submit(a, e.target.files[0])} /></label>}{!canManage && own && !own.closed && <button className="text-button danger" onClick={() => removeSubmission(a)}>Remove file</button>}</div></div>; })}{selected && <div className="download-note">“{selected.file}” is ready locally. Closed assignments hide the pre-made file; staff can still download student submissions and upload marked ZIP feedback locally.</div>}</section>{canManage && (editingAssignment ? <form className="panel form-panel" onSubmit={modifyAssignment}><p className="eyebrow">Edit assignment</p><h3>Modify for students</h3><label>Title<input name="title" required defaultValue={editingAssignment.title} /></label>  <label>Subject<input name="subject" required defaultValue={editingAssignment.subject} /></label><label>Replace assignment file<input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.zip" /></label><label>Start date and time<input name="start" required type="datetime-local" defaultValue={editingAssignment.start} /></label><label>End date<input name="due" required type="date" defaultValue={editingAssignment.due} /></label><label>End time<input name="dueTime" required type="time" defaultValue={editingAssignment.dueTime || "23:59"} /></label><label>End time<input name="dueTime" required type="time" defaultValue="23:59" /></label><label>Duration (minutes)<input name="duration" required type="number" min="1" defaultValue={editingAssignment.duration || 60} /></label><button className="primary" type="submit">Save changes</button><button className="text-button auth-link" type="button" onClick={() => setEditingAssignment(null)}>Cancel</button></form> : <form className="panel form-panel" onSubmit={addAssignment}><p className="eyebrow">Publish work</p><h3>Schedule an assignment or test</h3><label>Title<input name="title" required placeholder="e.g. Week 3 essay" /></label><label>Subject<input name="subject" required placeholder="e.g. History" /></label><label>Start date and time<input name="start" required type="datetime-local" /></label><label>End date<input name="due" required type="date" /></label><label>End time<input name="dueTime" required type="time" defaultValue="23:59" /></label><label>Duration (minutes)<input name="duration" required type="number" min="1" defaultValue="60" /></label><label className="file-drop">Choose any file<input name="file" required type="file" /></label><button className="primary" type="submit">Publish scheduled work</button></form>)}</div>
    {canManage && <section className="panel wide-panel"><div className="panel-heading"><div><p className="eyebrow">All submissions</p><h3>Search, filter and mark student work</h3></div><span className="count">{filteredSubmissions.length} of {allSubmissions.length}</span></div>
      <div className="filter-bar">
        <input className="search-input" placeholder="Search by name, student ID or assignment…" value={subSearch} onChange={(e) => setSubSearch(e.target.value)} />
        <select value={subAssignmentFilter} onChange={(e) => setSubAssignmentFilter(e.target.value)}><option value="all">All assignments</option>{assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
        <select value={subCourseFilter} onChange={(e) => setSubCourseFilter(e.target.value)}><option value="all">All courses</option>{submissionCourses.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={subYearFilter} onChange={(e) => setSubYearFilter(e.target.value)}><option value="all">All years</option>{submissionYears.map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
        <select value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="Open — awaiting review">Open — awaiting review</option><option value="Closed — awaiting mark">Closed — awaiting mark</option><option value="Marked">Marked</option></select>
      </div>
      <div className="table-scroll"><table className="data-table fixed-table"><thead><tr><th>Student</th><th>Year</th><th>Course</th><th>Assignment</th><th>File</th><th>Submitted</th><th>Status</th><th>Mark</th><th>Actions</th></tr></thead><tbody>
        {filteredSubmissions.length === 0 && <tr><td colSpan={9} className="muted">No submissions match this search or filter.</td></tr>}
        {filteredSubmissions.map((submission) => <tr key={`${submission.assignmentId}-${submission.studentUsername}`}>
          <td>{submission.studentName} <small>({submission.studentId})</small></td>
          <td>{submission.yearLevel ? `Year ${submission.yearLevel}` : "—"}</td>
          <td>{submission.course || "—"}</td>
          <td>{submission.assignmentTitle}</td>
          <td>{submission.fileName}</td>
          <td>{new Date(submission.submittedAt).toLocaleString()}</td>
          <td><span className={`status status-${submission.status.split(" ")[0].toLowerCase()}`}>{submission.status}</span></td>
          <td>{submission.closed ? <input type="number" min="0" max="100" defaultValue={submission.mark ?? ""} onBlur={(e) => saveMark(submission, e.target.value)} /> : "—"}</td>
          <td className="table-actions">
            <button className="secondary" onClick={() => downloadSubmission(submission)}>Download</button>
            {!submission.closed && <button className="secondary" onClick={() => closeSubmission(submission)}>Close</button>}
            {submission.closed && <label className="secondary upload-button">Marked ZIP<input type="file" accept=".zip,application/zip" onChange={(e) => uploadMarkedFile(submission, e.target.files[0])} /></label>}
            {submission.markedFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: submission.markedFileUrl, fileName: submission.markedFileName })}>Marked ZIP</button>}
            {submission.remediationFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: submission.remediationFileUrl, fileName: submission.remediationFileName })}>Remediation file</button>}
            {submission.mark !== undefined && <button className="secondary" onClick={() => downloadMark(submission)}>Print PDF</button>}
          </td>
        </tr>)}
      </tbody></table></div>
    </section>}
  </>;
}

// Tests & Exams — auto-marked multiple-choice assessments scoped to a course and year level,
// separate from file-based Assignments. Students attempt a test (up to maxAttempts); each
// attempt is scored instantly against the answer key, and the best score feeds the same
// pass/remediation notification pattern used for marks/assignments.
function TestsExams({ user, tests, setTests, attempts, setAttempts, accounts, courses, passMark, notify, marks, setMarks }) {
  const canManage = user.role !== "student";
  const [editing, setEditing] = useState(null);
  const [taking, setTaking] = useState(null);
  const [answers, setAnswers] = useState({});
  const [courseFilter, setCourseFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [search, setSearch] = useState("");

  const visibleTests = tests.filter((test) => user.role === "student" ? (test.course === user.course && (!test.yearLevel || test.yearLevel === user.yearLevel)) : true);
  const filteredTests = visibleTests.filter((test) => (courseFilter === "all" || test.course === courseFilter) && (yearFilter === "all" || String(test.yearLevel || "") === yearFilter));
  const testCourses = [...new Set(tests.map((test) => test.course).filter(Boolean))];
  const testYears = [...new Set(tests.map((test) => String(test.yearLevel || "")).filter(Boolean))].sort();

  const attemptsFor = (testId, studentId) => attempts[`${testId}-${studentId}`] || [];
  const bestScore = (testId, studentId) => { const list = attemptsFor(testId, studentId); return list.length ? Math.max(...list.map((a) => a.score)) : null; };

  const startTest = (test) => {
    const list = attemptsFor(test.id, user.studentId);
    if (list.length >= test.maxAttempts) return notify(`No attempts remaining for ${test.title}. You have used all ${test.maxAttempts} attempt(s).`);
    setTaking(test); setAnswers({});
  };

  const submitTest = () => {
    const test = taking;
    const total = test.questions.length;
    let correct = 0;
    test.questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const score = Math.round((correct / total) * 100);
    const key = `${test.id}-${user.studentId}`;
    const list = attempts[key] || [];
    const attempt = { attemptNumber: list.length + 1, score, correct, total, takenAt: new Date().toISOString(), passed: score >= (test.passingMark ?? passMark) };
    setAttempts({ ...attempts, [key]: [...list, attempt] });
    setTaking(null); setAnswers({});
    // Feed the best attempt into the same marks list Results/Overview use, so a passed/failed
    // test counts toward the student's overall average and shows up on the Results page —
    // exactly like an assignment mark, using a TEST- prefixed assessment ID to avoid collisions.
    const assessmentId = `TEST-${test.id}`;
    const existingMark = marks.find((mark) => mark.studentId === user.studentId && mark.assessmentId === assessmentId);
    const bestOfAll = Math.max(score, existingMark?.score ?? 0);
    const markResult = { studentId: user.studentId, assessmentId, student: user.name, subject: test.title, score: bestOfAll, weighting: 100, grade: gradeFor(bestOfAll, test.passingMark ?? passMark), status: "Published", publishedAt: new Date().toISOString().slice(0, 10), feedback: bestOfAll < (test.passingMark ?? passMark) ? `Remediation is required below ${test.passingMark ?? passMark}% on ${test.title}.` : `${test.title} passed at the ${test.passingMark ?? passMark}% threshold.` };
    setMarks(existingMark ? marks.map((mark) => mark === existingMark ? { ...mark, ...markResult } : mark) : [...marks, markResult]);
    if (attempt.passed) notify(`You passed ${test.title} with ${score}%! Great work.`);
    else {
      const remaining = test.maxAttempts - attempt.attemptNumber;
      notify(remaining > 0 ? `You scored ${score}% on ${test.title} — below the ${test.passingMark ?? passMark}% pass mark. Remediation is recommended before your next attempt (${remaining} left).` : `You scored ${score}% on ${test.title} on your final attempt. Please speak with your instructor about remediation.`);
    }
  };

  const saveTest = (test) => {
    if (!test.title.trim() || !test.course || test.questions.length === 0) return notify("A test needs a title, course, and at least one question.");
    const exists = tests.some((t) => t.id === test.id);
    setTests(exists ? tests.map((t) => t.id === test.id ? test : t) : [...tests, { ...test, id: Date.now() }]);
    setEditing(null);
    notify(`${test.title} saved for ${test.course}${test.yearLevel ? ` (Year ${test.yearLevel})` : ""}.`);
  };
  const removeTest = (test) => { if (!window.confirm(`Delete ${test.title}? This cannot be undone.`)) return; setTests(tests.filter((t) => t.id !== test.id)); notify(`${test.title} deleted.`); };

  const studentsForTest = (test) => accounts.filter((account) => account.role === "student" && account.course === test.course && (!test.yearLevel || account.yearLevel === test.yearLevel))
    .filter((account) => !search || account.name.toLowerCase().includes(search.toLowerCase()) || (account.studentId || "").toLowerCase().includes(search.toLowerCase()));

  if (taking) {
    const test = taking;
    return <section className="panel"><h2>{test.title}</h2><p className="muted">{test.subject} · {test.questions.length} question(s) · Passing mark {test.passingMark ?? passMark}%</p>
      {test.questions.map((q, i) => <div key={i} className="question-block">
        <p><strong>Q{i + 1}.</strong> {q.question}</p>
        {q.options.map((opt, oi) => <label key={oi} className="option-row"><input type="radio" name={`q-${i}`} checked={answers[i] === oi} onChange={() => setAnswers({ ...answers, [i]: oi })} /> {opt}</label>)}
      </div>)}
      <div className="actions"><button onClick={submitTest} disabled={Object.keys(answers).length < test.questions.length}>Submit test</button><button className="secondary" onClick={() => setTaking(null)}>Cancel</button></div>
    </section>;
  }

  if (editing) {
    const t = editing;
    const setField = (field, value) => setEditing({ ...t, [field]: value });
    const setQuestion = (i, field, value) => { const qs = [...t.questions]; qs[i] = { ...qs[i], [field]: value }; setEditing({ ...t, questions: qs }); };
    const setOption = (i, oi, value) => { const qs = [...t.questions]; const opts = [...qs[i].options]; opts[oi] = value; qs[i] = { ...qs[i], options: opts }; setEditing({ ...t, questions: qs }); };
    const addQuestion = () => setEditing({ ...t, questions: [...t.questions, { question: "", options: ["", "", "", ""], correct: 0 }] });
    const removeQuestion = (i) => setEditing({ ...t, questions: t.questions.filter((_, qi) => qi !== i) });
    return <section className="panel">
      <h2>{tests.some((x) => x.id === t.id) ? "Edit test" : "New test"}</h2>
      <div className="form-grid">
        <label>Title<input value={t.title} onChange={(e) => setField("title", e.target.value)} /></label>
        <label>Subject<input value={t.subject} onChange={(e) => setField("subject", e.target.value)} /></label>
        <label>Course<select value={t.course} onChange={(e) => setField("course", e.target.value)}><option value="">Select a course</option>{courses.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
        <label>Year level<input type="number" min="1" max="6" value={t.yearLevel || ""} onChange={(e) => setField("yearLevel", Number(e.target.value) || undefined)} /></label>
        <label>Passing mark %<input type="number" min="0" max="100" value={t.passingMark} onChange={(e) => setField("passingMark", Number(e.target.value))} /></label>
        <label>Max attempts<input type="number" min="1" max="10" value={t.maxAttempts} onChange={(e) => setField("maxAttempts", Number(e.target.value))} /></label>
        <label>Duration (minutes)<input type="number" min="1" value={t.durationMinutes} onChange={(e) => setField("durationMinutes", Number(e.target.value))} /></label>
      </div>
      <h3>Questions</h3>
      {t.questions.map((q, i) => <div key={i} className="question-block">
        <label>Question {i + 1}<input value={q.question} onChange={(e) => setQuestion(i, "question", e.target.value)} /></label>
        {q.options.map((opt, oi) => <label key={oi} className="option-row"><input type="radio" checked={q.correct === oi} onChange={() => setQuestion(i, "correct", oi)} /><input value={opt} placeholder={`Option ${oi + 1}`} onChange={(e) => setOption(i, oi, e.target.value)} /></label>)}
        <button className="secondary" onClick={() => removeQuestion(i)}>Remove question</button>
      </div>)}
      <div className="actions">
        <button className="secondary" onClick={addQuestion}>Add question</button>
        <button onClick={() => saveTest(t)}>Save test</button>
        <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </section>;
  }

  return <>
    <section className="panel">
      <div className="card-header"><h2>Tests &amp; Exams</h2>{canManage && <button onClick={() => setEditing({ id: 0, title: "", subject: "", course: "", yearLevel: undefined, passingMark: passMark, maxAttempts: 2, durationMinutes: 20, questions: [{ question: "", options: ["", "", "", ""], correct: 0 }] })}>Add test</button>}</div>
      <div className="filters">
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}><option value="all">All courses</option>{testCourses.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}><option value="all">All years</option>{testYears.map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
        {canManage && <input placeholder="Search students…" value={search} onChange={(e) => setSearch(e.target.value)} />}
      </div>
      {!filteredTests.length && <p className="muted">No tests or exams match the current filters yet.</p>}
      {filteredTests.map((test) => {
        const best = user.role === "student" ? bestScore(test.id, user.studentId) : null;
        const attemptCount = user.role === "student" ? attemptsFor(test.id, user.studentId).length : null;
        return <div key={test.id} className="test-card">
          <div className="test-card-head">
            <div><strong>{test.title}</strong><small> {test.subject} · {test.course}{test.yearLevel ? ` · Year ${test.yearLevel}` : ""} · Pass mark {test.passingMark}% · {test.durationMinutes} min · {test.questions.length} question(s)</small></div>
            {canManage && <div className="actions"><button className="secondary" onClick={() => setEditing(test)}>Edit</button><button className="secondary" onClick={() => removeTest(test)}>Delete</button></div>}
          </div>
          {user.role === "student" && <div className="test-card-body">
            <p>Attempts used: {attemptCount}/{test.maxAttempts}{best !== null ? ` · Best score: ${best}%` : ""}</p>
            <button onClick={() => startTest(test)} disabled={attemptCount >= test.maxAttempts}>{attemptCount ? "Retake test" : "Start test"}</button>
          </div>}
          {canManage && <div className="fixed-table"><table><thead><tr><th>Student</th><th>Year</th><th>Attempts</th><th>Best score</th><th>Status</th></tr></thead><tbody>
            {studentsForTest(test).map((student) => {
              const list = attemptsFor(test.id, student.studentId);
              const best2 = list.length ? Math.max(...list.map((a) => a.score)) : null;
              return <tr key={student.studentId}><td>{student.name} ({student.studentId})</td><td>{student.yearLevel || "—"}</td><td>{list.length}/{test.maxAttempts}</td><td>{best2 !== null ? `${best2}%` : "Not attempted"}</td><td>{best2 === null ? "Pending" : best2 >= test.passingMark ? "Passed" : list.length >= test.maxAttempts ? "Failed — remediation needed" : "Remediation recommended"}</td></tr>;
            })}
          </tbody></table></div>}
        </div>;
      })}
    </section>
  </>;
}

function Results({ marks, canEdit, setMarks, user, notify, passMark, setPassMark, accounts }) {  const [editing, setEditing] = useState(null);
  const [editingScore, setEditingScore] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const resultId = (mark) => `${mark.studentId}::${mark.subject}::${mark.assessmentId || "assessment"}`;
  // Marks synced from SQLite carry a numeric `id`; locally-added marks (browser-only mode)
  // do not. Only marks with an `id` can be persisted to the database.
  const nextStatusOptions = { Draft: ["Submitted"], Submitted: ["Approved"], Approved: ["Published"], Published: ["Locked"] };
  const update = (mark, value) => setMarks(marks.map((item) => resultId(item) === resultId(mark) ? { ...item, feedback: value } : item));
  const updateScore = async (mark, value) => {
    const score = Number(value);
    if (mark.id) {
      try {
        await apiRequest(`/admin/marks/${mark.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mark: score }) });
        window.dispatchEvent(new Event("portal-sync-now"));
        return;
      } catch (error) { notify(`Could not update the score: ${error.message}`); return; }
    }
    setMarks(marks.map((item) => item === mark ? { ...item, score, grade: gradeFor(value, item.passingMark ?? passMark), status: "Draft" } : item));
  };
  const transition = async (mark, nextStatus) => {
    const currentStatus = mark.status || "Draft";
    if (!nextStatusOptions[currentStatus]?.includes(nextStatus)) { notify(`Marks can only move from ${currentStatus} to ${nextStatusOptions[currentStatus]?.[0] || "the next stage"}.`); return; }
    if (mark.id) {
      try {
        await apiRequest(`/admin/marks/${mark.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
        window.dispatchEvent(new Event("portal-sync-now"));
        if (nextStatus === "Published") notify(`Results published for ${mark.student}.`);
        return;
      } catch (error) { notify(`Could not change the status: ${error.message}`); return; }
    }
    setMarks(marks.map((item) => item === mark ? { ...item, status: nextStatus, publishedAt: nextStatus === "Published" ? new Date().toISOString().slice(0, 10) : item.publishedAt } : item));
    if (nextStatus === "Published") notify(`Results published for ${mark.student}.`);
  };
  const downloadSummary = () => {
    const summary = marks.map((m) => `${m.subject},${m.assessmentId || "N/A"},${m.score}%,${m.grade},${m.status || "Published"}`).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`Subject,Assessment,Score,Grade,Status\n${summary}`], { type: "text/csv" })); link.download = "result-summary.csv"; link.click();
  };
  const effectiveScore = (mark) => Number(mark.remediation?.score ?? mark.score ?? 0);
  const markThreshold = (mark) => Number(mark.passingMark ?? passMark);
  const scopedMarks = canEdit ? marks : marks.filter((mark) => mark.studentId === user.studentId && ["Published", "Locked"].includes(mark.status || "Published"));
  // Staff-only search so a main admin/admin with dozens of learners on screen can jump
  // straight to one student (by name or student ID) to remark or continue marking, instead
  // of scrolling through every result.
  const searchedMarks = canEdit && search.trim() ? scopedMarks.filter((mark) => `${mark.student || ""} ${mark.studentId || ""}`.toLowerCase().includes(search.trim().toLowerCase())) : scopedMarks;
  const visibleMarks = searchedMarks.filter((mark) => filter === "all" || (filter === "remediation" ? effectiveScore(mark) < markThreshold(mark) : effectiveScore(mark) >= markThreshold(mark)));
  const attempts = visibleMarks.flatMap((mark) => [Number(mark.score || 0), ...(mark.remediation?.score === undefined ? [] : [Number(mark.remediation.score)])]);
  const totalWeight = visibleMarks.reduce((sum, mark) => sum + Number(mark.weighting || 100), 0);
  const weightedTotal = visibleMarks.reduce((sum, mark) => sum + effectiveScore(mark) * Number(mark.weighting || 100), 0);
  const total = totalWeight ? weightedTotal / totalWeight : 0;
  const average = attempts.length ? attempts.reduce((sum, value) => sum + value, 0) / attempts.length : 0;
  const addMark = (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const studentId = String(data.get("studentId")).trim(); const assessmentId = String(data.get("assessmentId")).trim(); if (marks.some((mark) => mark.studentId.toLowerCase() === studentId.toLowerCase() && String(mark.assessmentId).toLowerCase() === assessmentId.toLowerCase())) { notify("That student and assessment already have a mark."); return; } const score = Number(data.get("score")); const passingMark = Number(data.get("passingMark")) || passMark; setMarks([...marks, { studentId, assessmentId, student: accounts.find((a) => a.studentId === studentId)?.name || studentId, subject: data.get("subject"), score, passingMark, grade: gradeFor(score, passingMark), weighting: Number(data.get("weighting")) || 100, status: "Draft", feedback: "", remediation: { count: 0 } }]); event.currentTarget.reset(); };
  const updateRemediation = (mark, field, value) => setMarks(marks.map((item) => item === mark ? { ...item, remediation: { ...(item.remediation || {}), [field]: field === "count" ? Number(value) : value } } : item));
  const deleteMark = (mark) => setMarks(marks.filter((item) => item !== mark));
  return <><section className="panel tips-panel"><p className="eyebrow">Next steps</p><h3>{canEdit ? "Staff marking checklist" : "How to get your marks back"}</h3><p className="muted">{canEdit ? "Review the learner's submission, check the student ID and course, enter the mark, add feedback, then publish it. Use remediation when the mark is below the configured passing threshold." : "Check Results after staff publish. Download your summary and any marked ZIP feedback. If remediation is shown, follow the scheduled instructions and upload the replacement work before its new deadline."}</p></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Progress report</p><h3>{canEdit ? "Mark publication workflow" : "Your results"}</h3></div><div><span className="count">{visibleMarks.length} records</span>{!canEdit && <button className="secondary summary-button" onClick={downloadSummary}>Download summary</button>}</div></div><div className="result-filters"><label>Show <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All results</option><option value="remediation">Needs remediation</option><option value="passing">Passing / no remediation</option></select></label>{canEdit && <label>Find student <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or student ID…" /></label>}</div>{canEdit && <div className="workflow-tools"><form className="inline-form" onSubmit={addMark}><input name="studentId" required placeholder="Student ID" /><input name="assessmentId" required placeholder="Assessment ID" /><input name="subject" required placeholder="Subject" /><input name="score" required type="number" min="0" max="100" placeholder="Score" /><input name="passingMark" type="number" min="0" max="100" defaultValue={passMark} placeholder="Passing %" /><input name="weighting" type="number" min="1" max="100" defaultValue="100" placeholder="Weight %" /><button className="primary" type="submit">Add mark</button></form><label className="pass-rule">Default passing mark <input type="number" min="0" max="100" value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} />%</label></div>}{!canEdit && <div className="result-summary"><strong>{Math.round(total)}%</strong><span>Total weighted percentage · {total >= passMark ? "Passing requirement met" : "Needs remediation"} · Attempts min {attempts.length ? Math.min(...attempts) : 0}% · max {attempts.length ? Math.max(...attempts) : 0}% · avg {Math.round(average)}%</span></div>}{visibleMarks.length ? visibleMarks.map((mark) => <div className="result-row" key={resultId(mark)}><div><strong>{mark.subject}</strong><small>{mark.student} · {mark.assessmentId || "Assessment"} · {effectiveScore(mark)}% · {mark.weighting || 100}% weighting · Passing requirement: {markThreshold(mark)}%</small><small className="warning-text">{effectiveScore(mark) < markThreshold(mark) ? `R · Below the ${markThreshold(mark)}% passing requirement — remediation will be scheduled.` : `Passing requirement met at ${markThreshold(mark)}%.`}</small>{!canEdit && <small>Published {mark.publishedAt || "locally"} · Previous result history is retained</small>}{canEdit && effectiveScore(mark) < markThreshold(mark) && <div className="remediation-fields"><label>Remediation date<input type="date" value={mark.remediation?.date || ""} onChange={(e) => updateRemediation(mark, "date", e.target.value)} /></label><label>Time<input type="time" value={mark.remediation?.time || ""} onChange={(e) => updateRemediation(mark, "time", e.target.value)} /></label><label>Attempts<input type="number" min="0" value={mark.remediation?.count || 0} onChange={(e) => updateRemediation(mark, "count", e.target.value)} /></label><label>Remediation mark<input type="number" min="0" max="100" value={mark.remediation?.score || ""} onChange={(e) => updateRemediation(mark, "score", e.target.value)} /></label><button className="secondary" onClick={() => updateRemediation(mark, "completed", !mark.remediation?.completed)}>{mark.remediation?.completed ? "Remediated" : "Mark remediated"}</button></div>}  </div>{editingScore === resultId(mark) ? <input className="inline-input score-editor" type="number" min="0" max="100" defaultValue={mark.score} onBlur={(e) => { updateScore(mark, e.target.value); setEditingScore(null); notify(`Corrected locked result for ${mark.student}.`); }} autoFocus /> : <b className="grade">{gradeFor(effectiveScore(mark), markThreshold(mark))}</b>}{canEdit && <div className="workflow"><span className={`status status-${(mark.status || "Published").toLowerCase()}`}>{mark.status || "Published"}</span>{mark.status !== "Locked" && <select value="" onChange={(e) => { if (e.target.value) transition(mark, e.target.value); }}><option value="">{`Move to ${nextStatusOptions[mark.status || "Published"]?.[0] || "next stage"}…`}</option>{(nextStatusOptions[mark.status || "Published"] || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>}{mark.status === "Locked" && <button className="text-button" onClick={() => setEditingScore(resultId(mark))}>Correct score</button>}<button className="text-button danger" onClick={() => deleteMark(mark)}>Delete</button></div>}{editing === resultId(mark) ? <input className="inline-input" value={mark.feedback || ""} onChange={(e) => update(mark, e.target.value)} onBlur={() => { setEditing(null); notify(`Feedback changed for ${mark.student}.`); }} autoFocus /> : <span className="feedback" onClick={() => canEdit && setEditing(resultId(mark))}>{mark.feedback || (canEdit ? "Click to add feedback" : "No feedback yet")}</span>}</div>) : <p className="muted">{canEdit ? "No marks have been imported yet." : "No published results have been published yet."}</p>}</section></>;
}

function CsvUploads({ setNotice, marks, setMarks, accounts, passMark }) {
  const [file, setFile] = useState(null);
  const [limit, setLimit] = useState(30);
  const parse = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error("CSV must include a header and at least one data row.");
    const headers = lines[0].replace(/^\uFEFF/, "").split(",").map((header) => header.trim().toLowerCase());
    const studentIndex = headers.indexOf("studentid") >= 0 ? headers.indexOf("studentid") : headers.indexOf("student_id");
    const assessmentIndex = headers.indexOf("assessmentid") >= 0 ? headers.indexOf("assessmentid") : headers.indexOf("assessment_id");
    const markIndex = headers.indexOf("mark");
    if (studentIndex < 0 || assessmentIndex < 0 || markIndex < 0) throw new Error("Required columns are studentId, assessmentId, and mark.");
    return lines.slice(1).map((line, index) => {
      const values = line.split(",").map((value) => value.trim().replace(/^"(.*)"$/, "$1"));
      const studentId = values[studentIndex] || "";
      const assessmentId = values[assessmentIndex] || "";
      const score = Number(values[markIndex]);
      if (!/^[A-Za-z0-9_-]+$/.test(studentId)) throw new Error(`Row ${index + 2}: invalid student ID.`);
      if (!/^[A-Za-z0-9_-]+$/.test(assessmentId)) throw new Error(`Row ${index + 2}: invalid assessment ID.`);
      if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`Row ${index + 2}: mark must be between 0 and 100.`);
      if (!accounts.some((account) => account.studentId === studentId)) throw new Error(`Row ${index + 2}: student was not found.`);
      if (marks.some((mark) => mark.studentId === studentId && mark.assessmentId === assessmentId) || lines.slice(1, index + 1).some((previous) => previous.split(",")[studentIndex]?.trim() === studentId && previous.split(",")[assessmentIndex]?.trim() === assessmentId)) throw new Error(`Row ${index + 2}: duplicate student and assessment.`);
      return { studentId, assessmentId, student: accounts.find((account) => account.studentId === studentId)?.name || studentId, subject: assessmentId, score, grade: gradeFor(score, passMark), weighting: 100, status: "Draft", feedback: "" };
    });
  };
  const upload = async () => {
    if (!file) return;
    let apiAttempted = false;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("schoolId", "local");
      apiAttempted = true;
      const response = await fetch(`${API_BASE}/admin/upload-marks`, { method: "POST", credentials: "include", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(`CSV rejected by SQLite: ${body.errors?.map((item) => `row ${item.row || "?"}: ${item.error}`).join("; ") || body.error || "CSV was rejected."} No marks were imported.`);
        return;
      }
      setFile(null);
      setNotice(`${body.imported} mark(s) imported into SQLite as Draft.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      if (apiAttempted) {
        setNotice(`SQLite upload failed: ${error.message} No marks were imported.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try { const imported = parse(String(reader.result)); setMarks([...marks, ...imported]); setFile(null); setNotice(`SQLite unavailable; ${imported.length} mark(s) stored in browser mode.`); }
        catch (fallbackError) { setNotice(`CSV rejected: ${fallbackError.message} No marks were imported.`); }
      };
      reader.readAsText(file);
    }
  };
  return <section className="panel upload-panel"><p className="eyebrow">Main admin workspace</p><h3>Bulk CSV marks upload</h3><p className="muted">Required columns: studentId, assessmentId, mark. The complete file is validated before any marks are stored.</p><label className="file-drop">Choose marks CSV<input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0])} /></label>{file && <p className="muted">{file.name} ready for validation.</p>}<button className="primary" disabled={!file} onClick={upload}>Validate and upload</button><div className="export-tools"><a className="secondary" href={csvDownloadUrl("/admin/marks.csv")} download="marks.csv">Download marks CSV</a><label>Student rows<select value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option value={30}>30</option><option value={50}>50</option><option value={75}>75</option><option value={100}>100</option></select></label><a className="secondary" href={csvDownloadUrl(`/admin/students.csv?limit=${limit}`)} download={`students-${limit}.csv`}>Download {limit} students</a></div></section>;
}

function SQLiteData({ data, connected }) {
  if (!connected || !data) return <section className="panel"><p className="eyebrow">SQLite data</p><h3>Waiting for the local API</h3><p className="muted">Start the backend with <code>cd backend; npm start</code>, then sign in again or wait for the next sync.</p></section>;
  return <><section className="stats"><div className="stat-card"><small>SQLite users</small><strong>{data.users.length}</strong></div><div className="stat-card"><small>SQLite marks</small><strong>{data.marks.length}</strong></div><div className="stat-card"><small>Assessments</small><strong>{data.assessments.length}</strong></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Live database view</p><h3>Marks stored on localhost:5000</h3></div><span className="count">Updated {new Date(data.updatedAt).toLocaleTimeString()}</span></div>{data.marks.length ? <div className="data-table"><div className="data-row data-head"><b>Student</b><b>Assessment</b><b>Mark</b><b>Status</b></div>{data.marks.map((mark) => <div className="data-row" key={mark.id}><span>{mark.student} ({mark.studentId})</span><span>{mark.assessmentId}</span><span>{mark.mark}%</span><span className={`status status-${mark.status.toLowerCase()}`}>{mark.status}</span></div>)}</div> : <p className="muted">No marks have been imported yet.</p>}</section></>;
}

function Courses({ accounts, setAccounts, user, setUser, apiConnected, notify, courses, canManage, removeCourse }) {
  const [selected, setSelected] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [temporaryUsername, setTemporaryUsername] = useState("");
  const [error, setError] = useState("");
  const [myCourse, setMyCourse] = useState(user.course || "");
  const [myYear, setMyYear] = useState(user.yearLevel || 1);
  const [saving, setSaving] = useState(false);
  const enroll = (event) => { event.preventDefault(); const normalizedId = studentId.trim().toLowerCase(); const normalizedUsername = temporaryUsername.trim().toLowerCase(); if (accounts.some((account) => account.studentId?.toLowerCase() === normalizedId)) return setError("That student ID is already registered."); if (accounts.some((account) => account.username.toLowerCase() === normalizedUsername)) return setError("That temporary username is already in use."); const next = [...accounts, { name: studentName.trim(), username: normalizedUsername, password: "Welcome123!", temporary: true, studentId: studentId.trim(), email: studentEmail.trim(), course: selected, role: "student" }]; setAccounts(next); setStudentName(""); setStudentId(""); setStudentEmail(""); setTemporaryUsername(""); setSelected(""); setError(""); };
  const saveMyCourse = async (event) => {
    event.preventDefault();
    if (!myCourse) return notify("Choose a course before saving.");
    setSaving(true);
    try {
      if (apiConnected) {
        await apiRequest("/api/accounts/course", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course: myCourse, yearLevel: Number(myYear) }) });
        window.dispatchEvent(new Event("portal-sync-now"));
        setUser({ ...user, course: myCourse, yearLevel: Number(myYear) });
        notify(`Course saved: ${myCourse}, year ${myYear}.`);
      } else {
        const updated = { ...user, course: myCourse, yearLevel: Number(myYear) };
        setAccounts(accounts.map((account) => account.username === user.username ? updated : account));
        setUser(updated);
        notify(`Course saved locally (offline mode): ${myCourse}, year ${myYear}.`);
      }
    } catch (err) {
      notify(`Could not save your course: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  return <div className="two-col"><section className="panel"><p className="eyebrow">Course catalogue</p><h3>Available pathways</h3>{courses.map(([name, requirement], index) => <div className="list-row" key={name}><div><strong>{name}</strong><small>Entry requirements: {requirement}</small></div>{canManage && <button className="secondary" onClick={() => setSelected(name)}>Select</button>}{canManage && index >= COURSES.length && <button className="text-button danger" onClick={() => { if (window.confirm(`Remove ${name} from the course catalogue?`)) removeCourse(name); }}>Remove</button>}</div>)}</section>{user.role === "student" && <form className="panel form-panel" onSubmit={saveMyCourse}><p className="eyebrow">Your enrolment</p><h3>Choose your course and year</h3><p className="muted">This is saved to {apiConnected ? "the local SQLite database" : "your browser (offline mode)"} and will still be there after you refresh or sign in again.</p><label>Course<select required value={myCourse} onChange={(e) => setMyCourse(e.target.value)}><option value="">Choose your course</option>{courses.map(([name]) => <option key={name}>{name}</option>)}</select></label><label>Year of study<select value={myYear} onChange={(e) => setMyYear(Number(e.target.value))}><option value={1}>1st year</option><option value={2}>2nd year</option><option value={3}>3rd year</option><option value={4}>4th year</option><option value={5}>5th year</option><option value={6}>6th year</option></select></label><button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save my course"}</button></form>}{user.role !== "student" && <form className="panel form-panel" onSubmit={enroll}><p className="eyebrow">Learner details</p><h3>Register or assign a learner</h3><label>Full name<input required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="New learner name" /></label><label>Student ID<input required value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="STU-002" /></label><label>Temporary username<input required value={temporaryUsername} onChange={(e) => setTemporaryUsername(e.target.value)} placeholder="learner.temp" /></label><label>Trusted email<input required type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="learner@example.com" /></label><label>Course<select required value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Choose a course</option>{courses.map(([name]) => <option key={name}>{name}</option>)}</select></label>{error && <p className="error">{error}</p>}<button className="primary" type="submit">Create learner profile</button><p className="muted">Temporary username and password: <strong>{temporaryUsername || "chosen username"} / Welcome123!</strong>. The learner can change them after signing in. Stored locally in browser storage.</p></form>}</div>;
}

function CourseManager({ courses, setCustomCourses, canManage }) {
  if (!canManage) return null;
  const add = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const requirement = String(data.get("requirement")).trim();
    if (!name || !requirement || courses.some(([courseName]) => courseName.toLowerCase() === name.toLowerCase())) return;
    setCustomCourses([...courses.slice(COURSES.length).map(([courseName, text]) => ({ name: courseName, requirement: text })), { name, requirement }]);
    event.currentTarget.reset();
  };
  return <form className="panel form-panel course-manager" onSubmit={add}><p className="eyebrow">Course administration</p><h3>Add an additional course</h3><p className="muted">New courses become available for learner enrolment and assignment matching.</p><label>Course name<input name="name" required placeholder="e.g. History" /></label><label>Entry requirements<input name="requirement" required placeholder="Required subjects or experience" /></label><button className="primary" type="submit">Add course</button></form>;
}

function Design({ theme, setTheme }) {
  const [draft, setDraft] = useState(theme);
  useEffect(() => setDraft(theme), [theme]);
  const save = (e) => { e.preventDefault(); setTheme(draft); };
  return <form className="panel design-panel" onSubmit={save}><p className="eyebrow">Brand settings</p><h3>Make the portal yours</h3><p className="muted">Personalise the local workspace for your institution. Changes apply to every account in this browser.</p><label>Institution name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Accent colour<div className="color-control"><input type="color" value={draft.accent} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} /><code>{draft.accent}</code></div></label><label>Background colour<div className="color-control"><input type="color" value={draft.background || "#f7faf8"} onChange={(e) => setDraft({ ...draft, background: e.target.value })} /><code>{draft.background || "#f7faf8"}</code></div></label><label>Text colour<div className="color-control"><input type="color" value={draft.ink || "#17211f"} onChange={(e) => setDraft({ ...draft, ink: e.target.value })} /><code>{draft.ink || "#17211f"}</code></div></label><label>Portal font<select value={draft.font || "DM Sans"} onChange={(e) => setDraft({ ...draft, font: e.target.value })}><option>DM Sans</option><option>Georgia</option><option>Arial</option><option>Verdana</option></select></label><button className="primary" type="submit">Save design</button></form>;
}

export default App;
