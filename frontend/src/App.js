import { useState } from "react";
import "./App.css";

const ACCOUNTS = [
  { username: "mainadmin", password: "ChangeMe123!", role: "main-admin", name: "Jordan Lee" },
  { username: "admin", password: "Admin123!", role: "admin", name: "Avery Morgan" },
  { username: "student", password: "Student123!", role: "student", name: "Sam Taylor", studentId: "STU-001" },
];

const DEFAULT_ASSIGNMENTS = [
  { id: 1, title: "Welcome reflection", subject: "Orientation", due: "2026-09-15", file: "reflection-guide.pdf", owner: "Avery Morgan" },
  { id: 2, title: "Science lab report", subject: "Biology", due: "2026-09-22", file: "lab-template.docx", owner: "Avery Morgan" },
];

const DEFAULT_MARKS = [{ studentId: "STU-001", student: "Sam Taylor", subject: "Biology", grade: "A", score: 92, feedback: "Excellent analysis and clear evidence." }];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function App() {
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [active, setActive] = useState("Overview");
  const [accounts, setAccounts] = useState(() => load("portal-accounts", ACCOUNTS));
  const [assignments, setAssignments] = useState(() => load("portal-assignments", DEFAULT_ASSIGNMENTS));
  const [marks, setMarks] = useState(() => load("portal-marks", DEFAULT_MARKS));
  const [theme, setTheme] = useState(() => load("portal-theme", { name: "Northstar Academy", accent: "#0f766e" }));
  const [notice, setNotice] = useState("");

  const persist = (key, value, setter) => { setter(value); localStorage.setItem(key, JSON.stringify(value)); };
  const roleLabel = { "main-admin": "Main administrator", admin: "Administrator", student: "Student" };
  const nav = user?.role === "main-admin"
    ? ["Overview", "Accounts", "Assignments", "Results", "Design"]
    : user?.role === "admin" ? ["Overview", "Assignments", "Results"] : ["Overview", "Assignments", "Results"];

  function signIn(event) {
    event.preventDefault();
    const found = accounts.find((account) => account.username === login.username.trim() && account.password === login.password);
    if (!found) { setLoginError("Those details do not match a local account."); return; }
    setUser(found); setActive("Overview"); setLoginError("");
  }

  function signOut() { setUser(null); setLogin({ username: "", password: "" }); }

  if (!user) return <Login login={login} setLogin={setLogin} error={loginError} onSubmit={signIn} theme={theme} />;

  const currentMarks = marks.filter((mark) => user.role !== "student" || mark.studentId === user.studentId);
  return (
    <div className="app-shell" style={{ "--accent": theme.accent }}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">N</span><span>{theme.name}</span></div>
        <div className="profile"><div className="avatar">{user.name.split(" ").map((part) => part[0]).join("")}</div><div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div></div>
        <nav aria-label="Main navigation">{nav.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
        <button className="sign-out" onClick={signOut}>Sign out</button>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">Academic workspace</p><h1>{active}</h1></div><div className="top-actions"><span className="status-dot">Local mode</span><button className="icon-button" aria-label="Notifications">○</button></div></header>
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {active === "Overview" && <Overview user={user} assignments={assignments} marks={currentMarks} accounts={accounts} />}
        {active === "Accounts" && <Accounts accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} />}
        {active === "Assignments" && <Assignments user={user} assignments={assignments} setAssignments={(v) => persist("portal-assignments", v, setAssignments)} setNotice={setNotice} />}
        {active === "Results" && <Results marks={currentMarks} canEdit={user.role !== "student"} setMarks={(v) => persist("portal-marks", v, setMarks)} />}
        {active === "Design" && <Design theme={theme} setTheme={(v) => persist("portal-theme", v, setTheme)} />}
      </main>
    </div>
  );
}

function Login({ login, setLogin, error, onSubmit, theme }) {
  return <div className="login-page"><div className="login-art"><span className="brand-mark">N</span><p className="eyebrow">Your campus, connected</p><h1>Make space for<br /><em>what’s next.</em></h1><p>One calm place for teaching, learning and progress.</p></div><form className="login-card" onSubmit={onSubmit}><div className="brand dark"><span className="brand-mark">N</span><span>{theme.name}</span></div><h2>Welcome back</h2><p className="muted">Sign in to your local campus workspace.</p><label>Username<input autoFocus value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} /></label><label>Password<input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></label>{error && <p className="error">{error}</p>}<button className="primary full" type="submit">Sign in</button><div className="demo-box"><strong>Demo accounts</strong><span>mainadmin / ChangeMe123!</span><span>admin / Admin123!</span><span>student / Student123!</span></div></form></div>;
}

function Overview({ user, assignments, marks, accounts }) {
  const stats = user.role === "student" ? [["Assignments", assignments.length], ["Average score", marks.length ? `${Math.round(marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length)}%` : "—"], ["Feedback", marks.filter((m) => m.feedback).length]] : [["Students", accounts.filter((a) => a.role === "student").length], ["Assignments", assignments.length], ["Results published", marks.length]];
  return <><section className="welcome"><div><p className="eyebrow">Tuesday, September 2, 2026</p><h2>Good morning, {user.name.split(" ")[0]}.</h2><p className="muted">Here’s what needs your attention today.</p></div><span className="welcome-shape">✦</span></section><div className="stats">{stats.map(([label, value]) => <div className="stat-card" key={label}><small>{label}</small><strong>{value}</strong><span className="trend">Updated just now</span></div>)}</div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Next up</p><h3>Upcoming assignments</h3></div><span className="count">{assignments.length} total</span></div>{assignments.slice(0, 3).map((a) => <div className="list-row" key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong><small>{a.subject} · Due {a.due}</small></div><span className="pill">{user.role === "student" ? "To do" : "Published"}</span></div>)}</section></>;
}

function Accounts({ accounts, setAccounts }) {
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const add = (e) => { e.preventDefault(); if (!form.name || !form.username || !form.password) return; setAccounts([...accounts, { ...form, role: "admin" }]); setForm({ name: "", username: "", password: "" }); };
  return <div className="two-col"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Access control</p><h3>Administrator accounts</h3></div></div>{accounts.filter((a) => a.role !== "student").map((a) => <div className="list-row" key={a.username}><div className="avatar small">{a.name.split(" ").map((p) => p[0]).join("")}</div><div><strong>{a.name}</strong><small>@{a.username} · {a.role === "main-admin" ? "Main account" : "Admin"}</small></div>{a.role !== "main-admin" && <button className="text-button danger" onClick={() => setAccounts(accounts.filter((item) => item.username !== a.username))}>Delete</button>}</div>)}</section><form className="panel form-panel" onSubmit={add}><p className="eyebrow">New access</p><h3>Add an admin</h3><label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>Temporary password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><button className="primary" type="submit">Create account</button></form></div>;
}

function Assignments({ user, assignments, setAssignments, setNotice }) {
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState(() => load(`portal-submissions-${user.username}`, {}));
  const canManage = user.role !== "student";
  const download = (assignment) => { if (assignment.url) { const link = document.createElement("a"); link.href = assignment.url; link.download = assignment.file; link.click(); } setSelected(assignment); };
  const submit = (assignment, file) => { if (!file) return; const next = { ...submissions, [assignment.id]: file.name }; setSubmissions(next); localStorage.setItem(`portal-submissions-${user.username}`, JSON.stringify(next)); setNotice(`“${file.name}” submitted for ${assignment.title}.`); };
  const addAssignment = (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); const file = data.get("file"); if (!file?.name) return; setAssignments([{ id: Date.now(), title: data.get("title"), subject: data.get("subject"), due: data.get("due"), file: file.name, url: URL.createObjectURL(file), owner: user.name }, ...assignments]); e.currentTarget.reset(); setNotice("Assignment published locally."); };
  return <div className="two-col"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Shared resources</p><h3>{canManage ? "Assignments for students" : "Your assignments"}</h3></div></div>{assignments.map((a) => <div className="list-row" key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong><small>{a.file} · Due {a.due}</small>{submissions[a.id] && <small className="submission">Submitted: {submissions[a.id]}</small>}</div><button className="secondary" onClick={() => download(a)}>Download</button>{!canManage && <label className="secondary upload-button">Submit<input type="file" onChange={(e) => submit(a, e.target.files[0])} /></label>}</div>)}{selected && <div className="download-note">“{selected.file}” is ready locally. Connect the API for shared server storage across devices.</div>}</section>{canManage && <form className="panel form-panel" onSubmit={addAssignment}><p className="eyebrow">Publish work</p><h3>Upload an assignment</h3><label>Title<input name="title" required placeholder="e.g. Week 3 essay" /></label><label>Subject<input name="subject" required placeholder="e.g. History" /></label><label>Due date<input name="due" required type="date" /></label><label className="file-drop">Choose any file<input name="file" required type="file" /></label><button className="primary" type="submit">Publish assignment</button></form>}</div>;
}

function Results({ marks, canEdit, setMarks }) {
  const [editing, setEditing] = useState(null);
  const update = (mark, value) => setMarks(marks.map((item) => item.studentId === mark.studentId && item.subject === mark.subject ? { ...item, feedback: value } : item));
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Progress report</p><h3>{canEdit ? "Published results" : "Your results"}</h3></div><span className="count">{marks.length} records</span></div>{marks.length ? marks.map((mark) => <div className="result-row" key={`${mark.studentId}-${mark.subject}`}><div><strong>{mark.subject}</strong><small>{mark.student} · {mark.score}%</small></div><b className="grade">{mark.grade}</b>{editing === mark.studentId ? <input className="inline-input" value={mark.feedback} onChange={(e) => update(mark, e.target.value)} onBlur={() => setEditing(null)} autoFocus /> : <span className="feedback" onClick={() => canEdit && setEditing(mark.studentId)}>{mark.feedback || (canEdit ? "Click to add feedback" : "No feedback yet")}</span>}</div>) : <p className="muted">No results have been published yet.</p>}</section>;
}

function Design({ theme, setTheme }) {
  const [draft, setDraft] = useState(theme);
  const save = (e) => { e.preventDefault(); setTheme(draft); };
  return <form className="panel design-panel" onSubmit={save}><p className="eyebrow">Brand settings</p><h3>Make the portal yours</h3><p className="muted">These settings are saved in this browser and can mirror your institution’s identity.</p><label>Institution name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Accent colour<div className="color-control"><input type="color" value={draft.accent} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} /><code>{draft.accent}</code></div></label><button className="primary" type="submit">Save design</button></form>;
}

export default App;
