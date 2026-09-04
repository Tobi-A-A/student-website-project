import { useEffect, useState } from "react";
import "./App.css";

const ACCOUNTS = [
  { username: "mainadmin", password: "ChangeMe123!", role: "main-admin", name: "Jordan Lee" },
  { username: "admin", password: "Admin123!", role: "admin", name: "Avery Morgan", temporary: false },
  { username: "tempadmin", password: "TempAdmin123!", role: "admin", name: "Taylor Brooks", temporary: true },
  { username: "student", password: "Student123!", role: "student", name: "Sam Taylor", studentId: "STU-001", course: "Biology" },
];
const APP_NAME = "Meridian Learning Hub";
const DEFAULT_THEME = { name: APP_NAME, accent: "#0f766e", background: "#f7faf8", ink: "#17211f", font: "DM Sans" };
const normalizeTheme = (saved) => saved?.name === "Northstar Academy" ? { ...DEFAULT_THEME, ...saved, name: APP_NAME } : { ...DEFAULT_THEME, ...saved };

const DEFAULT_ASSIGNMENTS = [
  { id: 1, title: "Welcome reflection", subject: "Orientation", start: "2026-09-08T09:00", due: "2026-09-15", duration: 60, file: "reflection-guide.pdf", owner: "Avery Morgan" },
  { id: 2, title: "Science lab report", subject: "Biology", start: "2026-09-12T10:00", due: "2026-09-22", duration: 90, file: "lab-template.docx", owner: "Avery Morgan" },
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
const initials = (name) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "N";
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
  const [notice, setNotice] = useState("");
  const [notifications, setNotifications] = useState(() => load("portal-notifications", []));
  const [passMark, setPassMark] = useState(() => load("portal-pass-mark", 60));
  const [welcome, setWelcome] = useState("");
  const [submissions, setSubmissions] = useState(() => load("portal-submissions", {}));
  const [customCourses, setCustomCourses] = useState(() => load("portal-courses", []));
  const courses = [...COURSES, ...customCourses.map((course) => [course.name, course.requirement])];
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 450); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    const refreshLocalWorkspace = () => {
      setAssignments(load("portal-assignments", DEFAULT_ASSIGNMENTS));
      setSubmissions(load("portal-submissions", {}));
      setMarks(load("portal-marks", DEFAULT_MARKS));
      setCustomCourses(load("portal-courses", []));
    };
    const handleStorage = (event) => {
      refreshLocalWorkspace();
      if (event.key === "portal-theme") setTheme(normalizeTheme(load("portal-theme", DEFAULT_THEME)));
    };
    window.addEventListener("storage", handleStorage);
    const timer = setInterval(refreshLocalWorkspace, 1000);
    return () => { window.removeEventListener("storage", handleStorage); clearInterval(timer); };
  }, []);

  const persist = (key, value, setter) => { setter(value); localStorage.setItem(key, JSON.stringify(value)); };
  const roleLabel = { "main-admin": "Main administrator", admin: "Administrator", student: "Student" };
  const nav = user?.role === "main-admin"
    ? ["Overview", "Accounts", "CSV uploads", "Courses", "Assignments", "Results", "Profile", "Design"]
    : user?.role === "admin" ? ["Overview", "Accounts", "CSV uploads", "Courses", "Assignments", "Results", "Profile"] : ["Overview", "Courses", "Assignments", "Results", "Profile"];

  function signIn(event) {
    event.preventDefault();
    const found = accounts.find((account) => account.username === login.username.trim() && account.password === login.password);
    if (!found) { setLoginError("Those details do not match a local account."); return; }
    setUser(found); setActive("Overview"); setLoginError(""); setWelcome(found.role === "student" ? `Welcome to ${theme.name}, ${found.name.split(" ")[0]}! Your learning journey starts here.` : DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length]);
  }

  function LoadingScreen({ theme }) {
    return <div className="loading-screen" style={{ "--accent": theme.accent }}><span className="brand-mark">{initials(theme.name)}</span><h1>{theme.name}</h1><p>Preparing your local workspace…</p><span className="loading-bar" /></div>;
  }

  function signOut() { setUser(null); setLogin({ username: "", password: "" }); }

  if (loading) return <LoadingScreen theme={theme} />;
  if (!user) return <Login login={login} setLogin={setLogin} setAccounts={setAccounts} error={loginError} onSubmit={signIn} theme={theme} />;

  const currentMarks = marks.filter((mark) => user.role !== "student" || (mark.studentId === user.studentId && ["Published", "Locked"].includes(mark.status || "Published")));
  const notify = (message) => {
    const next = [{ id: Date.now(), message, date: new Date().toISOString() }, ...notifications];
    setNotifications(next); localStorage.setItem("portal-notifications", JSON.stringify(next)); setNotice(message);
  };
  return (
    <div className="app-shell" style={{ "--accent": theme.accent, "--paper": theme.background, "--ink": theme.ink, "--portal-font": theme.font }}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
        <div className="profile"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div></div>
        <nav aria-label="Main navigation">{nav.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
        <button className="sign-out" onClick={signOut}>Sign out</button>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">Academic workspace</p><h1>{active}</h1><span className="storage-note">Stored locally in browser storage · SQLite API data lives in backend/school_data/portal.sqlite</span></div><div className="top-actions"><span className="status-dot">Local mode</span><button className="icon-button" aria-label="Notifications" title={`${notifications.length} notifications`}>○</button></div></header>
        {welcome && <div className="welcome-toast" role="status">{welcome}<button onClick={() => setWelcome("")}>×</button></div>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {active === "Overview" && <Overview user={user} assignments={assignments} marks={currentMarks} accounts={accounts} />}
        {active === "Accounts" && <Accounts accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} user={user} />}
        {active === "CSV uploads" && <CsvUploads setNotice={setNotice} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} accounts={accounts} passMark={passMark} />}
        {active === "Courses" && <><Courses accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} user={user} courses={courses} canManage={user.role !== "student"} removeCourse={(name) => { const next = customCourses.filter((course) => course.name !== name); persist("portal-courses", next, setCustomCourses); }} /><CourseManager courses={courses} setCustomCourses={(v) => persist("portal-courses", v, setCustomCourses)} canManage={user.role !== "student"} /></>}
        {active === "Assignments" && <Assignments user={user} assignments={assignments} setAssignments={(v) => persist("portal-assignments", v, setAssignments)} submissions={submissions} setSubmissions={(v) => persist("portal-submissions", v, setSubmissions)} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} accounts={accounts} courses={courses} passMark={passMark} setNotice={setNotice} />}
        {active === "Results" && <Results marks={user.role === "student" ? currentMarks : marks} canEdit={user.role !== "student"} setMarks={(v) => persist("portal-marks", v, setMarks)} user={user} notify={notify} passMark={passMark} setPassMark={(v) => persist("portal-pass-mark", v, setPassMark)} accounts={accounts} />}
        {active === "Profile" && <Profile user={user} accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} setUser={setUser} />}
        {active === "Design" && <Design theme={theme} setTheme={(v) => persist("portal-theme", v, setTheme)} />}
      </main>
    </div>
  );
}

function Login({ login, setLogin, setAccounts, error, onSubmit, theme }) {
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
  return <div className="login-page"><div className="login-art"><span className="brand-mark">{initials(theme.name)}</span><p className="eyebrow">Your campus, connected</p><h1>Make space for<br /><em>what’s next.</em></h1><p>One calm place for teaching, learning and progress.</p></div>{registering ? <form className="login-card" onSubmit={register}><div className="brand dark"><span className="brand-mark">N</span><span>{theme.name}</span></div>{registered ? <><h2>Profile created</h2><p className="muted">Your course and learner details are stored locally in this browser.</p><button className="primary full" type="button" onClick={() => { setRegistering(false); setRegistered(false); }}>Sign in</button></> : <><h2>Create your account</h2><p className="muted">Register as a new student for this local campus demo.</p><label>Full name<input autoFocus value={registration.name} onChange={(e) => setRegistration({ ...registration, name: e.target.value })} /></label><label>Student ID<input value={registration.studentId} onChange={(e) => setRegistration({ ...registration, studentId: e.target.value })} /></label><label>Course<select required value={registration.course} onChange={(e) => setRegistration({ ...registration, course: e.target.value })}><option value="">Choose your course</option>{COURSES.map(([name]) => <option key={name}>{name}</option>)}</select></label><label>Username<input value={registration.username} onChange={(e) => setRegistration({ ...registration, username: e.target.value })} /></label><label>Password<input type="password" value={registration.password} onChange={(e) => setRegistration({ ...registration, password: e.target.value })} /></label>{registrationError && <p className="error">{registrationError}</p>}<button className="primary full" type="submit">Create account</button><button className="text-button auth-link" type="button" onClick={() => { setRegistering(false); setRegistrationError(""); }}>Already have an account? Sign in</button></>}</form> : forgot ? <form className="login-card" onSubmit={requestReset}><div className="brand dark"><span className="brand-mark">N</span><span>{theme.name}</span></div><h2>Forgot password?</h2><p className="muted">Use a trusted Gmail or other email address. This local demo prepares the notification without sending external mail.</p><label>Trusted email<input required type="email" name="email" placeholder="you@example.com" /></label>{recoveryMessage && <p className="notice">{recoveryMessage}</p>}<button className="primary full" type="submit">Prepare reset notification</button><button className="text-button auth-link" type="button" onClick={() => setForgot(false)}>Back to sign in</button></form> : <form className="login-card" onSubmit={onSubmit}><div className="brand dark"><span className="brand-mark">N</span><span>{theme.name}</span></div><h2>Welcome back</h2><p className="muted">Sign in to your local campus workspace.</p><label>Username<input autoFocus value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} /></label><label>Password<input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></label>{error && <p className="error">{error}</p>}<button className="primary full" type="submit">Sign in</button><button className="text-button auth-link" type="button" onClick={() => setRegistering(true)}>New student? Create an account</button><button className="text-button auth-link" type="button" onClick={() => setForgot(true)}>Forgot password?</button><div className="demo-box"><strong>Demo accounts</strong><span>mainadmin / ChangeMe123!</span><span>admin / Admin123!</span><span>student / Student123!</span></div></form>}</div>;
}

function Overview({ user, assignments, marks, accounts }) {
  const stats = user.role === "student" ? [["Assignments", assignments.length], ["Average score", marks.length ? `${Math.round(marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length)}%` : "—"], ["Feedback", marks.filter((m) => m.feedback).length]] : [["Students", accounts.filter((a) => a.role === "student").length], ["Assignments", assignments.length], ["Results published", marks.length]];
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
  const canManage = user.role !== "student";
  const download = (assignment) => { if (assignment.completed || (assignment.due && new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) < new Date())) return setNotice("This assignment is closed; its pre-made file is no longer available."); if (assignment.url) { const link = document.createElement("a"); link.href = assignment.url; link.download = assignment.file; link.click(); } setSelected(assignment); };
  const downloadSubmission = (submission) => { if (!submission.fileUrl) return setNotice("This older local submission has no downloadable file data. Ask the learner to upload it again."); const link = document.createElement("a"); link.href = submission.fileUrl; link.download = submission.fileName; link.click(); setNotice(`Downloaded ${submission.fileName}. It was checked against the allowed file types before submission.`); };
  const submit = (assignment, file) => {
    const key = `${assignment.id}-${user.username}`;
    const existing = submissions[key];
    const remediationOpen = existing?.mark !== undefined && existing.mark < passMark;
    const deadline = assignment.due ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) : null;
    if ((assignment.completed || (deadline && deadline < new Date())) && !remediationOpen) return setNotice("This assignment is closed because its due date has passed.");
    if (!file || !window.confirm(`Upload “${file.name}” for ${assignment.title}? You can remove it before submitting.`)) return;
    const blocked = /\.(exe|dll|bat|cmd|com|js|vbs|scr|msi|ps1|sh)$/i.test(file.name);
    const allowed = /\.(pdf|doc|docx|txt|rtf|jpg|jpeg|png|zip)$/i.test(file.name);
    if (blocked || !allowed || file.size > 25 * 1024 * 1024) return setNotice("Upload rejected: use a PDF, document, image, or ZIP up to 25 MB. Executable files are not accepted.");
    const next = { ...submissions, [key]: remediationOpen ? { ...existing, remediationFileName: file.name, remediationFileUrl: URL.createObjectURL(file), remediationSubmittedAt: new Date().toISOString(), remediationOpen: false } : { assignmentId: assignment.id, assignmentTitle: assignment.title, subject: assignment.subject, course: user.course, studentUsername: user.username, studentName: user.name, studentId: user.studentId, fileName: file.name, fileUrl: URL.createObjectURL(file), submittedAt: new Date().toISOString(), completed: true, closed: false } };
    setSubmissions(next); setNotice(remediationOpen ? `Remediation file submitted for ${assignment.title}. Staff will review it for a final mark.` : `“${file.name}” submitted safely for ${assignment.title}. It is marked completed; marks will be given once reviewed.`);
  };
  const removeSubmission = (assignment) => { const deadline = assignment.due ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) : null; if (assignment.completed || (deadline && deadline < new Date())) return setNotice("Completed or closed assignments cannot have files removed."); const key = `${assignment.id}-${user.username}`; const next = { ...submissions }; delete next[key]; setSubmissions(next); setNotice("Your file was removed and the assignment is ready for another upload."); };
  const closeSubmission = (submission) => { const key = `${submission.assignmentId}-${submission.studentUsername}`; setSubmissions({ ...submissions, [key]: { ...submission, closed: true, closedAt: new Date().toISOString() } }); setNotice(`Submission closed for ${submission.studentName}.`); };
  const saveMark = (submission, value) => { const score = Number(value); if (!Number.isFinite(score) || score < 0 || score > 100) return setNotice("Final marks must be between 0 and 100."); const key = `${submission.assignmentId}-${submission.studentUsername}`; const publishedAt = new Date().toISOString(); setSubmissions({ ...submissions, [key]: { ...submission, mark: score, markPublishedAt: publishedAt, remediationOpen: score < passMark } }); const existing = marks.find((mark) => mark.studentId === submission.studentId && mark.assessmentId === `ASSIGN-${submission.assignmentId}`); const result = { studentId: submission.studentId, assessmentId: `ASSIGN-${submission.assignmentId}`, student: submission.studentName, subject: submission.subject || submission.assignmentTitle, score, weighting: 100, grade: gradeFor(score, passMark), status: "Published", publishedAt: publishedAt.slice(0, 10), feedback: score < passMark ? `Remediation is required below ${passMark}%.` : `Assignment completed successfully at the ${passMark}% passing threshold.`, submissionFile: submission.fileName }; setMarks(existing ? marks.map((mark) => mark === existing ? { ...mark, ...result } : mark) : [...marks, result]); setNotice(score < passMark ? `Remediation is available to ${submission.studentName}.` : `Final mark ${score}% sent to ${submission.studentName}'s profile.`); };
  const uploadMarkedFile = (submission, file) => { if (!file) return; if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) return setNotice("Marked feedback must be a ZIP file up to 25 MB."); const key = `${submission.assignmentId}-${submission.studentUsername}`; setSubmissions({ ...submissions, [key]: { ...submission, markedFileName: file.name, markedFileUrl: URL.createObjectURL(file), markedUploadedAt: new Date().toISOString() } }); setNotice(`Marked ZIP uploaded for ${submission.studentName}.`); };
  const modifyAssignment = (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const updated = { ...editingAssignment, title: String(data.get("title")).trim(), subject: String(data.get("subject")).trim(), start: data.get("start"), due: data.get("due"), dueTime: data.get("dueTime"), duration: Number(data.get("duration")) || 60 }; setAssignments(assignments.map((assignment) => assignment.id === updated.id ? updated : assignment)); setEditingAssignment(null); setNotice("Assignment details updated for students."); };
  const toggleCompleted = (assignment) => { setAssignments(assignments.map((item) => item.id === assignment.id ? { ...item, completed: !item.completed } : item)); setNotice(assignment.completed ? "Assignment reopened for students." : "Assignment marked completed; new student submissions are closed."); };
  const deleteAssignment = (assignment) => { if (!window.confirm(`Delete “${assignment.title}” and its local submission records?`)) return; setAssignments(assignments.filter((item) => item.id !== assignment.id)); const next = Object.fromEntries(Object.entries(submissions).filter(([, submission]) => submission.assignmentId !== assignment.id)); setSubmissions(next); setNotice("Assignment deleted."); };
  const downloadMark = (submission) => { const result = `<html><body><h1>Final assignment result</h1><p>Student: ${submission.studentName}</p><p>Assignment: ${submission.assignmentTitle}</p><p>Submitted file: ${submission.fileName}</p><h2>Final mark: ${submission.mark}%</h2><p>${submission.mark < passMark ? `Remediation required below ${passMark}%.` : `Passing requirement met at ${passMark}%.`}</p><p>Published: ${new Date(submission.markPublishedAt).toLocaleString()}</p></body></html>`; const popup = window.open("", "_blank"); if (!popup) return setNotice("Allow pop-ups to print the final mark as a PDF."); popup.document.write(result); popup.document.close(); popup.focus(); popup.print(); };
  const addAssignment = (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); const file = data.get("file"); const title = String(data.get("title")).trim(); const subject = String(data.get("subject")).trim(); const course = String(data.get("course")).trim(); if (!file?.name) return; if (assignments.some((assignment) => assignment.title.toLowerCase() === title.toLowerCase() && assignment.subject.toLowerCase() === subject.toLowerCase() && assignment.course === course)) { setNotice("That assignment already exists for this course."); return; } setAssignments([{ id: Date.now(), title, subject, course, start: data.get("start"), due: data.get("due"), dueTime: data.get("dueTime"), duration: Number(data.get("duration")) || 60, file: file.name, url: URL.createObjectURL(file), owner: user.name }, ...assignments]); e.currentTarget.reset(); setNotice("Assignment published locally."); };
  const ownSubmission = (assignment) => submissions[`${assignment.id}-${user.username}`];
  const resultForSubmission = (submission) => marks.find((mark) => mark.studentId === submission.studentId && mark.assessmentId === `ASSIGN-${submission.assignmentId}`);
  return <div className="two-col"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Shared resources</p><h3>{canManage ? "Assignments and submissions" : "Your assignments"}</h3></div></div>{assignments.map((a) => { const own = ownSubmission(a); const ownResult = own ? resultForSubmission(own) : null; const related = Object.values(submissions).filter((submission) => submission.assignmentId === a.id); const isPastDue = a.due && new Date(`${a.due}T${a.dueTime || "23:59"}`) < new Date(); const isClosed = a.completed || isPastDue; const remediationOpen = own?.mark !== undefined && own.mark < passMark; return <div className={`list-row assignment-row${isClosed ? " assignment-completed" : ""}`} key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong>  <small>{a.file} · Opens {a.start ? new Date(a.start).toLocaleString() : "now"} · Ends {a.due}{a.dueTime ? ` at ${a.dueTime}` : ""} · {a.duration || 60} minutes · {isClosed ? "Completed / closed" : "Open"}</small>  {own && <small className="submission">Submitted: {own.fileName} · {own.completed ? "Completed — marks will be given once marked" : "Awaiting review"}{own.mark !== undefined ? ` · Final mark: ${own.mark}%` : ""}{ownResult && ` · ${ownResult.grade === "R" ? `R — remediation required${ownResult.remediation?.date ? ` on ${ownResult.remediation.date}` : ""}${ownResult.remediation?.time ? ` at ${ownResult.remediation.time}` : ""}` : `Grade ${ownResult.grade}`}`}</small>}{canManage && related.map((submission) => <div className="submission-card" key={`${submission.assignmentId}-${submission.studentUsername}`}><strong>{submission.studentName}</strong><small>{submission.fileName} · {new Date(submission.submittedAt).toLocaleString()}</small><button className="secondary" onClick={() => downloadSubmission(submission)}>Download student submission</button>{!submission.closed && <button className="secondary" onClick={() => closeSubmission(submission)}>Close submission</button>}{submission.closed && <label className="mark-entry">Final mark %<input type="number" min="0" max="100" defaultValue={submission.mark ?? ""} onBlur={(e) => saveMark(submission, e.target.value)} /></label>}{submission.closed && <label className="secondary upload-button">Upload marked ZIP<input type="file" accept=".zip,application/zip" onChange={(e) => uploadMarkedFile(submission, e.target.files[0])} /></label>}{submission.markedFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: submission.markedFileUrl, fileName: submission.markedFileName })}>Download marked ZIP</button>}{submission.remediationFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: submission.remediationFileUrl, fileName: submission.remediationFileName })}>Download remediation file</button>}{submission.mark !== undefined && <button className="secondary" onClick={() => downloadMark(submission)}>Print mark PDF</button>}{submission.mark !== undefined && <small className="submission-outcome">{submission.mark < passMark ? `R — remediation required${resultForSubmission(submission)?.remediation?.date ? ` on ${resultForSubmission(submission).remediation.date}` : ""}` : `Passed at ${submission.mark}%`}</small>}</div>)}</div>{!isClosed && <button className="secondary" onClick={() => download(a)}>Download assignment</button>}{!canManage && own?.markedFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: own.markedFileUrl, fileName: own.markedFileName })}>Download marked ZIP</button>}{canManage && <><button className="secondary" onClick={() => setEditingAssignment(a)}>Modify</button>  <button className="secondary" onClick={() => toggleCompleted(a)}>{a.completed ? "Reopen" : "Mark completed"}</button><button className="text-button danger" onClick={() => deleteAssignment(a)}>Delete</button></>}{!canManage && !own?.closed && ((!a.completed && !isPastDue) || remediationOpen) && <label className="secondary upload-button">Upload / replace<input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.zip" onChange={(e) => submit(a, e.target.files[0])} /></label>}{!canManage && own && !own.closed && <button className="text-button danger" onClick={() => removeSubmission(a)}>Remove file</button>}</div>; })}{selected && <div className="download-note">“{selected.file}” is ready locally. Closed assignments hide the pre-made file; staff can still download student submissions and upload marked ZIP feedback locally.</div>}</section>{canManage && (editingAssignment ? <form className="panel form-panel" onSubmit={modifyAssignment}><p className="eyebrow">Edit assignment</p><h3>Modify for students</h3><label>Title<input name="title" required defaultValue={editingAssignment.title} /></label><label>Subject<input name="subject" required defaultValue={editingAssignment.subject} /></label><label>Start date and time<input name="start" required type="datetime-local" defaultValue={editingAssignment.start} /></label><label>End date<input name="due" required type="date" defaultValue={editingAssignment.due} /></label><label>End time<input name="dueTime" required type="time" defaultValue={editingAssignment.dueTime || "23:59"} /></label><label>End time<input name="dueTime" required type="time" defaultValue="23:59" /></label><label>Duration (minutes)<input name="duration" required type="number" min="1" defaultValue={editingAssignment.duration || 60} /></label><button className="primary" type="submit">Save changes</button><button className="text-button auth-link" type="button" onClick={() => setEditingAssignment(null)}>Cancel</button></form> : <form className="panel form-panel" onSubmit={addAssignment}><p className="eyebrow">Publish work</p><h3>Schedule an assignment or test</h3><label>Title<input name="title" required placeholder="e.g. Week 3 essay" /></label><label>Subject<input name="subject" required placeholder="e.g. History" /></label><label>Start date and time<input name="start" required type="datetime-local" /></label><label>End date<input name="due" required type="date" /></label><label>End time<input name="dueTime" required type="time" defaultValue="23:59" /></label><label>Duration (minutes)<input name="duration" required type="number" min="1" defaultValue="60" /></label><label className="file-drop">Choose any file<input name="file" required type="file" /></label><button className="primary" type="submit">Publish scheduled work</button></form>)}</div>;
}

function Results({ marks, canEdit, setMarks, user, notify, passMark, setPassMark, accounts }) {
  const [editing, setEditing] = useState(null);
  const [editingScore, setEditingScore] = useState(null);
  const [filter, setFilter] = useState("all");
  const resultId = (mark) => `${mark.studentId}::${mark.subject}::${mark.assessmentId || "assessment"}`;
  const update = (mark, value) => setMarks(marks.map((item) => resultId(item) === resultId(mark) ? { ...item, feedback: value } : item));
  const updateScore = (mark, value) => setMarks(marks.map((item) => item === mark ? { ...item, score: Number(value), grade: gradeFor(value, item.passingMark ?? passMark), status: "Draft" } : item));
  const transition = (mark, nextStatus) => {
    if (nextStatus === "Published" && mark.status !== "Approved") return;
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
  const visibleMarks = scopedMarks.filter((mark) => filter === "all" || (filter === "remediation" ? effectiveScore(mark) < markThreshold(mark) : effectiveScore(mark) >= markThreshold(mark)));
  const attempts = visibleMarks.flatMap((mark) => [Number(mark.score || 0), ...(mark.remediation?.score === undefined ? [] : [Number(mark.remediation.score)])]);
  const totalWeight = visibleMarks.reduce((sum, mark) => sum + Number(mark.weighting || 100), 0);
  const weightedTotal = visibleMarks.reduce((sum, mark) => sum + effectiveScore(mark) * Number(mark.weighting || 100), 0);
  const total = totalWeight ? weightedTotal / totalWeight : 0;
  const average = attempts.length ? attempts.reduce((sum, value) => sum + value, 0) / attempts.length : 0;
  const addMark = (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const studentId = String(data.get("studentId")).trim(); const assessmentId = String(data.get("assessmentId")).trim(); if (marks.some((mark) => mark.studentId.toLowerCase() === studentId.toLowerCase() && String(mark.assessmentId).toLowerCase() === assessmentId.toLowerCase())) { notify("That student and assessment already have a mark."); return; } const score = Number(data.get("score")); const passingMark = Number(data.get("passingMark")) || passMark; setMarks([...marks, { studentId, assessmentId, student: accounts.find((a) => a.studentId === studentId)?.name || studentId, subject: data.get("subject"), score, passingMark, grade: gradeFor(score, passingMark), weighting: Number(data.get("weighting")) || 100, status: "Draft", feedback: "", remediation: { count: 0 } }]); event.currentTarget.reset(); };
  const updateRemediation = (mark, field, value) => setMarks(marks.map((item) => item === mark ? { ...item, remediation: { ...(item.remediation || {}), [field]: field === "count" ? Number(value) : value } } : item));
  const deleteMark = (mark) => setMarks(marks.filter((item) => item !== mark));
  return <><section className="panel tips-panel"><p className="eyebrow">Next steps</p><h3>{canEdit ? "Staff marking checklist" : "How to get your marks back"}</h3><p className="muted">{canEdit ? "Review the learner's submission, check the student ID and course, enter the mark, add feedback, then publish it. Use remediation when the mark is below the configured passing threshold." : "Check Results after staff publish. Download your summary and any marked ZIP feedback. If remediation is shown, follow the scheduled instructions and upload the replacement work before its new deadline."}</p></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Progress report</p><h3>{canEdit ? "Mark publication workflow" : "Your results"}</h3></div><div><span className="count">{visibleMarks.length} records</span>{!canEdit && <button className="secondary summary-button" onClick={downloadSummary}>Download summary</button>}</div></div><div className="result-filters"><label>Show <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All results</option><option value="remediation">Needs remediation</option><option value="passing">Passing / no remediation</option></select></label></div>{canEdit && <div className="workflow-tools"><form className="inline-form" onSubmit={addMark}><input name="studentId" required placeholder="Student ID" /><input name="assessmentId" required placeholder="Assessment ID" /><input name="subject" required placeholder="Subject" /><input name="score" required type="number" min="0" max="100" placeholder="Score" /><input name="passingMark" type="number" min="0" max="100" defaultValue={passMark} placeholder="Passing %" /><input name="weighting" type="number" min="1" max="100" defaultValue="100" placeholder="Weight %" /><button className="primary" type="submit">Add mark</button></form><label className="pass-rule">Default passing mark <input type="number" min="0" max="100" value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} />%</label></div>}{!canEdit && <div className="result-summary"><strong>{Math.round(total)}%</strong><span>Total weighted percentage · {total >= passMark ? "Passing requirement met" : "Needs remediation"} · Attempts min {attempts.length ? Math.min(...attempts) : 0}% · max {attempts.length ? Math.max(...attempts) : 0}% · avg {Math.round(average)}%</span></div>}{visibleMarks.length ? visibleMarks.map((mark) => <div className="result-row" key={resultId(mark)}><div><strong>{mark.subject}</strong><small>{mark.student} · {mark.assessmentId || "Assessment"} · {effectiveScore(mark)}% · {mark.weighting || 100}% weighting · Passing requirement: {markThreshold(mark)}%</small><small className="warning-text">{effectiveScore(mark) < markThreshold(mark) ? `R · Below the ${markThreshold(mark)}% passing requirement — remediation will be scheduled.` : `Passing requirement met at ${markThreshold(mark)}%.`}</small>{!canEdit && <small>Published {mark.publishedAt || "locally"} · Previous result history is retained</small>}{canEdit && effectiveScore(mark) < markThreshold(mark) && <div className="remediation-fields"><label>Remediation date<input type="date" value={mark.remediation?.date || ""} onChange={(e) => updateRemediation(mark, "date", e.target.value)} /></label><label>Time<input type="time" value={mark.remediation?.time || ""} onChange={(e) => updateRemediation(mark, "time", e.target.value)} /></label><label>Attempts<input type="number" min="0" value={mark.remediation?.count || 0} onChange={(e) => updateRemediation(mark, "count", e.target.value)} /></label><label>Remediation mark<input type="number" min="0" max="100" value={mark.remediation?.score || ""} onChange={(e) => updateRemediation(mark, "score", e.target.value)} /></label><button className="secondary" onClick={() => updateRemediation(mark, "completed", !mark.remediation?.completed)}>{mark.remediation?.completed ? "Remediated" : "Mark remediated"}</button></div>}  </div>{editingScore === resultId(mark) ? <input className="inline-input score-editor" type="number" min="0" max="100" defaultValue={mark.score} onBlur={(e) => { updateScore(mark, e.target.value); setEditingScore(null); notify(`Corrected locked result for ${mark.student}.`); }} autoFocus /> : <b className="grade">{gradeFor(effectiveScore(mark), markThreshold(mark))}</b>}{canEdit && <div className="workflow"><span className={`status status-${(mark.status || "Published").toLowerCase()}`}>{mark.status || "Published"}</span>{mark.status !== "Locked" && <select value={mark.status || "Published"} onChange={(e) => transition(mark, e.target.value)}><option>Draft</option><option>Submitted</option><option>Approved</option><option>Published</option><option>Locked</option></select>}{mark.status === "Locked" && <button className="text-button" onClick={() => setEditingScore(resultId(mark))}>Correct score</button>}<button className="text-button danger" onClick={() => deleteMark(mark)}>Delete</button></div>}{editing === resultId(mark) ? <input className="inline-input" value={mark.feedback || ""} onChange={(e) => update(mark, e.target.value)} onBlur={() => { setEditing(null); notify(`Feedback changed for ${mark.student}.`); }} autoFocus /> : <span className="feedback" onClick={() => canEdit && setEditing(resultId(mark))}>{mark.feedback || (canEdit ? "Click to add feedback" : "No feedback yet")}</span>}</div>) : <p className="muted">{canEdit ? "No marks have been imported yet." : "No published results have been published yet."}</p>}</section></>;
}

function CsvUploads({ setNotice, marks, setMarks, accounts, passMark }) {
  const [file, setFile] = useState(null);
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
  const upload = () => { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const imported = parse(String(reader.result)); setMarks([...marks, ...imported]); setFile(null); setNotice(`${imported.length} mark(s) imported as Draft.`); } catch (error) { setNotice(`CSV rejected: ${error.message} No marks were imported.`); } }; reader.readAsText(file); };
  return <section className="panel upload-panel"><p className="eyebrow">Main admin workspace</p><h3>Bulk CSV marks upload</h3><p className="muted">Required columns: studentId, assessmentId, mark. The complete file is validated before any marks are stored.</p><label className="file-drop">Choose marks CSV<input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0])} /></label>{file && <p className="muted">{file.name} ready for validation.</p>}<button className="primary" disabled={!file} onClick={upload}>Validate and upload</button></section>;
}

function Courses({ accounts, setAccounts, user, courses, canManage, removeCourse }) {
  const [selected, setSelected] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [temporaryUsername, setTemporaryUsername] = useState("");
  const [error, setError] = useState("");
  const enroll = (event) => { event.preventDefault(); const normalizedId = studentId.trim().toLowerCase(); const normalizedUsername = temporaryUsername.trim().toLowerCase(); if (accounts.some((account) => account.studentId?.toLowerCase() === normalizedId)) return setError("That student ID is already registered."); if (accounts.some((account) => account.username.toLowerCase() === normalizedUsername)) return setError("That temporary username is already in use."); const next = [...accounts, { name: studentName.trim(), username: normalizedUsername, password: "Welcome123!", temporary: true, studentId: studentId.trim(), email: studentEmail.trim(), course: selected, role: "student" }]; setAccounts(next); setStudentName(""); setStudentId(""); setStudentEmail(""); setTemporaryUsername(""); setSelected(""); setError(""); };
  return <div className="two-col"><section className="panel"><p className="eyebrow">Course catalogue</p><h3>Available pathways</h3>{courses.map(([name, requirement], index) => <div className="list-row" key={name}><div><strong>{name}</strong><small>Entry requirements: {requirement}</small></div>{canManage && <button className="secondary" onClick={() => setSelected(name)}>Select</button>}{canManage && index >= COURSES.length && <button className="text-button danger" onClick={() => { if (window.confirm(`Remove ${name} from the course catalogue?`)) removeCourse(name); }}>Remove</button>}</div>)}</section>{user.role !== "student" && <form className="panel form-panel" onSubmit={enroll}><p className="eyebrow">Learner details</p><h3>Register or assign a learner</h3><label>Full name<input required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="New learner name" /></label><label>Student ID<input required value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="STU-002" /></label><label>Temporary username<input required value={temporaryUsername} onChange={(e) => setTemporaryUsername(e.target.value)} placeholder="learner.temp" /></label><label>Trusted email<input required type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="learner@example.com" /></label><label>Course<select required value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Choose a course</option>{courses.map(([name]) => <option key={name}>{name}</option>)}</select></label>{error && <p className="error">{error}</p>}<button className="primary" type="submit">Create learner profile</button><p className="muted">Temporary username and password: <strong>{temporaryUsername || "chosen username"} / Welcome123!</strong>. The learner can change them after signing in. Stored locally in browser storage.</p></form>}</div>;
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
