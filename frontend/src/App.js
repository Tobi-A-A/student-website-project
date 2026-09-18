import React, { useCallback, useEffect, useRef, useState } from "react";
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
  en: { Overview: "Overview", Accounts: "Accounts", "CSV uploads": "CSV uploads", "SQLite data": "SQLite data", Courses: "Courses", Assignments: "Assignments", Marking: "Marking", "Tests & Exams": "Tests & Exams", Results: "Results", Reports: "Reports", Profile: "Profile", Design: "Design", signOut: "Sign out", darkMode: "Dark mode", lightMode: "Light mode", language: "Language", welcomeBack: "Welcome back", signInSubtitle: "Sign in to your local campus workspace.", username: "Username", password: "Password", signIn: "Sign in", createAccount: "New student? Create an account", forgotPassword: "Forgot password?", demoAccounts: "Demo accounts", downloadSummary: "Download summary", addMark: "Add mark", delete: "Delete", search: "Search", noRecords: "No records yet", passingRequirementMet: "Passing requirement met", needsRemediation: "Needs remediation", totalWeighted: "Total weighted percentage" },
  af: { Overview: "Oorsig", Accounts: "Rekeninge", "CSV uploads": "CSV-oplaaie", "SQLite data": "SQLite-data", Courses: "Kursusse", Assignments: "Opdragte", Marking: "Nasien", "Tests & Exams": "Toetse en Eksamens", Results: "Uitslae", Reports: "Verslae", Profile: "Profiel", Design: "Ontwerp", signOut: "Teken uit", darkMode: "Donker modus", lightMode: "Lig modus", language: "Taal", welcomeBack: "Welkom terug", signInSubtitle: "Teken in by jou plaaslike kampuswerkarea.", username: "Gebruikersnaam", password: "Wagwoord", signIn: "Teken in", createAccount: "Nuwe student? Skep 'n rekening", forgotPassword: "Wagwoord vergeet?", demoAccounts: "Demo-rekeninge", downloadSummary: "Laai opsomming af", addMark: "Voeg punt by", delete: "Verwyder", search: "Soek", noRecords: "Nog geen rekords nie", passingRequirementMet: "Slaagvereiste bereik", needsRemediation: "Regstelling nodig", totalWeighted: "Totale geweegde persentasie" },
  zu: { Overview: "Uhlolojikelele", Accounts: "Ama-akhawunti", "CSV uploads": "Ukulayisha kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Assignments: "Imisebenzi", Marking: "Ukumaka", "Tests & Exams": "Ukuhlolwa Nezivivinyo", Results: "Imiphumela", Reports: "Imibiko", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Imodi emnyama", lightMode: "Imodi ekhanyayo", language: "Ulimi", welcomeBack: "Siyakwamukela futhi", signInSubtitle: "Ngena ku-workspace yakho yasekhampasini yendawo.", username: "Igama lokungena", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omusha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe iphasiwedi?", demoAccounts: "Ama-akhawunti wedemo", downloadSummary: "Landa isifinyezo", addMark: "Faka amamaki", delete: "Susa", search: "Sesha", noRecords: "Awukho amarekhodi okwamanje", passingRequirementMet: "Isidingo sokuphumelela sitholiwe", needsRemediation: "Kudinga ukulungiswa", totalWeighted: "Iphesenti eliphelele elicaliwe" },
  xh: { Overview: "Ushwankathelo", Accounts: "Iiakhawunti", "CSV uploads": "Ukulayishwa kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Assignments: "Imisebenzi", Marking: "Ukumakisha", "Tests & Exams": "Uvavanyo Neeviwo", Results: "Iziphumo", Reports: "Iingxelo", Profile: "Iprofayile", Design: "Uyilo", signOut: "Phuma", darkMode: "Imowudi emnyama", lightMode: "Imowudi ekhanyayo", language: "Ulwimi", welcomeBack: "Wamkelekile kwakhona", signInSubtitle: "Ngena kwindawo yakho yokusebenzela yekhampasi yasekuhlaleni.", username: "Igama lomsebenzisi", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omtsha? Yenza iakhawunti", forgotPassword: "Ulibele iphasiwedi?", demoAccounts: "Iiakhawunti zedemo", downloadSummary: "Khuphela isishwankathelo", addMark: "Yongeza amanqaku", delete: "Cima", search: "Khangela", noRecords: "Akukabi kho iirekhodi", passingRequirementMet: "Imfuneko yokuphumelela ifikeleliwe", needsRemediation: "Kufuneka ulungiso", totalWeighted: "Ipesenti epheleleyo elilinganisiweyo" },
  nso: { Overview: "Tshedimošo", Accounts: "Diakhaonto", "CSV uploads": "Go rolelwa CSV", "SQLite data": "Tshedimošo ya SQLite", Courses: "Dithuto", Assignments: "Mešomo", Marking: "Go swaya", "Tests & Exams": "Diteko le Ditlhahlobo", Results: "Dipoelo", Reports: "Dipego", Profile: "Boitsebišo", Design: "Moralo", signOut: "Tšwa", darkMode: "Mokgwa o mo nsu", lightMode: "Mokgwa o mo seetšeng", language: "Leleme", welcomeBack: "O amogetšwe gape", signInSubtitle: "Tsena lefelong la gago la mošomo la khamphase.", username: "Leina la modiriši", password: "Phasewete", signIn: "Tsena", createAccount: "Moithuti yo mofsa? Dira akhaonto", forgotPassword: "O lebetše phasewete?", demoAccounts: "Diakhaonto tša mokgwa", downloadSummary: "Laotša kakaretšo", addMark: "Oketša matshwao", delete: "Phumola", search: "Nyakisiša", noRecords: "Ga go na direkoto go fihla ga bjale", passingRequirementMet: "Nyakwa ya go phasa e fihleletšwe", needsRemediation: "E nyaka phošollo", totalWeighted: "Diperesente ka moka tše lekantšwego" },
  tn: { Overview: "Tshedimosetso", Accounts: "Diakhaonto", "CSV uploads": "Go tsenya CSV", "SQLite data": "Data ya SQLite", Courses: "Dithuto", Assignments: "Ditiro", Marking: "Go tshwaya", "Tests & Exams": "Diteko le Ditlhatlhobo", Results: "Dipholo", Reports: "Dipego", Profile: "Porofaele", Design: "Moralo", signOut: "Tswa", darkMode: "Mokgwa o lefifi", lightMode: "Mokgwa o lesedi", language: "Puo", welcomeBack: "O amogetswe gape", signInSubtitle: "Tsena mo lefelong la gago la tiro la khampase.", username: "Leina la modirisi", password: "Phasewete", signIn: "Tsena", createAccount: "Moithuti yo mosha? Dira akhaonto", forgotPassword: "O lebetse phasewete?", demoAccounts: "Diakhaonto tsa demo", downloadSummary: "Latsholola kakaretso", addMark: "Oketsa matshwao", delete: "Phimola", search: "Batla", noRecords: "Ga go na direkoto jaanong", passingRequirementMet: "Tlhokego ya go fenya e fitlheletswe", needsRemediation: "E tlhoka phekolo", totalWeighted: "Diperesente tsotlhe tse lekantsweng" },
  st: { Overview: "Tlhahlobo", Accounts: "Diakhaonto", "CSV uploads": "Ho kenya CSV", "SQLite data": "Data ea SQLite", Courses: "Lithuto", Assignments: "Mesebetsi", Marking: "Ho tshwaya", "Tests & Exams": "Litlhahlobo le Litekanyetso", Results: "Liphetho", Reports: "Ditlaleho", Profile: "Boemo", Design: "Moralo", signOut: "Tsoa", darkMode: "Mokgwa o lefifi", lightMode: "Mokgwa o leseli", language: "Puo", welcomeBack: "Rea u amohela hape", signInSubtitle: "Kena sebakeng sa hao sa mosebetsi sa khamphase.", username: "Lebitso la mosebedisi", password: "Phasewete", signIn: "Kena", createAccount: "Seithuti se secha? Theha akhaonto", forgotPassword: "U lebetse phasewete?", demoAccounts: "Diakhaonto tsa demo", downloadSummary: "Khoasolla kakaretso", addMark: "Kenya matshwao", delete: "Hlakola", search: "Batla", noRecords: "Ha ho na direkoto ho fihlela joale", passingRequirementMet: "Tlhoko ea ho feta e fihletsoe", needsRemediation: "E hloka tokiso", totalWeighted: "Diperesente tsohle tse lekantsweng" },
  ts: { Overview: "Xikombiso", Accounts: "Tiakhawunti", "CSV uploads": "Ku layisha CSV", "SQLite data": "Data ya SQLite", Courses: "Swidyondzo", Assignments: "Mintirho", Marking: "Ku maka", "Tests & Exams": "Mikambo na Swikambelo", Results: "Vuyelo", Reports: "Swiviko", Profile: "Phurofayili", Design: "Muxaka", signOut: "Huma", darkMode: "Muxaka wa munyama", lightMode: "Muxaka wa vona", language: "Ririmi", welcomeBack: "U amukeriwile nakambe", signInSubtitle: "Nghena endhawini ya wena ya ntirho ya khampasi.", username: "Vito ro tirhisa", password: "Phasiwedi", signIn: "Nghena", createAccount: "Xichudeni lexintshwa? Endla akhawunti", forgotPassword: "U rivele phasiwedi?", demoAccounts: "Tiakhawunti ta demo", downloadSummary: "Layishela kutlangela", addMark: "Engetela mamaki", delete: "Susa", search: "Lavisisa", noRecords: "A ku na tirikhodo hi sweswi", passingRequirementMet: "Xilaveko xo hlula xi fikeriwile", needsRemediation: "Yi lava ku lulamisiwa", totalWeighted: "Phesenta hinkwayo leyi pimiweke" },
  ss: { Overview: "Simo", Accounts: "Ema-akhawunti", "CSV uploads": "Kulayisha kwe-CSV", "SQLite data": "Imininingwane ye-SQLite", Courses: "Tifundvo", Assignments: "Imisebenti", Marking: "Kumaka", "Tests & Exams": "Kuhlolwa Netivivinyo", Results: "Imiphumela", Reports: "Imibiko", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Simo lesimnyama", lightMode: "Simo lesikhanyako", language: "Lulwimi", welcomeBack: "Uyemukelwa futsi", signInSubtitle: "Ngena endzaweni yakho yekusebenta yelikhampasi.", username: "Ligama lekungena", password: "Liphasiwedi", signIn: "Ngena", createAccount: "Umfundzi lomusha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe liphasiwedi?", demoAccounts: "Ema-akhawunti wedemo", downloadSummary: "Dawnlowda sifinyeto", addMark: "Faka emamaki", delete: "Sula", search: "Sesha", noRecords: "Awukho emarekhodi kwamanje", passingRequirementMet: "Sidzingo sekuphumelela sifinyelelwe", needsRemediation: "Kudzinga kulungiswa", totalWeighted: "Liphesenti lelphelele lelicaliwe" },
  ve: { Overview: "Musumbulusi", Accounts: "Diakhaundi", "CSV uploads": "U layisha CSV", "SQLite data": "Data ya SQLite", Courses: "Zwifundwa", Assignments: "Mishumo", Marking: "U maka", "Tests & Exams": "Milingo na Mibvunzo", Results: "Mvelelo", Reports: "Mivhigo", Profile: "Purofaili", Design: "Muhangwa", signOut: "Bva", darkMode: "Muhangwa mutswu", lightMode: "Muhangwa mutshena", language: "Luambo", welcomeBack: "Ro U tanganedza hafhu", signInSubtitle: "Dzhenani fhethu havho ha mushumo wa khemphasi.", username: "Dzina la mushumisi", password: "Phasiwede", signIn: "Dzhena", createAccount: "Mugudiswa muswa? Ita akhaundi", forgotPassword: "Wo hangwa phasiwede?", demoAccounts: "Diakhaundi dza demo", downloadSummary: "Dzhenisa tshedziwedzo", addMark: "Engedza mimarikho", delete: "Vhulaha", search: "Ṱoḓa", noRecords: "A huna rekhodo zwazwino", passingRequirementMet: "Ṱhoḓea ya u phasa yo swikelwa", needsRemediation: "I ṱoḓa u lugiswa", totalWeighted: "Phesenthe yoṱhe yo linganyiswaho" },
  nr: { Overview: "Ukubuka konke", Accounts: "Ama-akhawunti", "CSV uploads": "Ukulayisha kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Assignments: "Imisebenzi", Marking: "Ukumaka", "Tests & Exams": "Iimvivinyo Neenzivinyo", Results: "Imiphumela", Reports: "Imibiko", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Imodi emnyama", lightMode: "Imodi ekhanyako", language: "Ilimi", welcomeBack: "Siyakwemukela godu", signInSubtitle: "Ngena esikhundleni sakho semsebenzi wekhampasi lendawo.", username: "Ibizo lokungena", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omutjha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe iphasiwedi?", demoAccounts: "Ama-akhawunti wedemo", downloadSummary: "Layisha ihlathululo", addMark: "Engeza amanqaku", delete: "Susa", search: "Funa", noRecords: "Akukho amarekhodi okwamanje", passingRequirementMet: "Isidingo sokuphumelela sifinyelelwe", needsRemediation: "Kudinga ukulungiswa", totalWeighted: "Iphesenti epheleleko elilinganisiweko" },
};
// Language is scoped per signed-in account (falling back to a "guest" bucket pre-login) so one
// person switching their language can never change what another person — signed in on the same
// browser at a different time, or reviewed by an admin — sees. It is intentionally NOT part of
// the SQLite sync payload or any shared localStorage key.
const languageKeyFor = (username) => `portal-language-${username ? username.toLowerCase() : "guest"}`;
const translate = (language, key) => (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.en[key] || key;

// Assignments are targeted at a course and a year of study. An empty `course` means "every
// course" (e.g. institution-wide orientation work) and an empty `yearLevel` means "every year".
// `academicYear` records the calendar year the work belongs to, which is what lets a learner see
// an archive of the work they did in earlier years of the same course.
const CURRENT_ACADEMIC_YEAR = 2026;
const DEFAULT_ASSIGNMENTS = [
  { id: 1, title: "Welcome reflection", subject: "Orientation", course: "", yearLevel: null, academicYear: 2026, term: "Term 3", start: "2026-09-08T09:00", due: "2026-09-15", duration: 60, file: "reflection-guide.pdf", owner: "Avery Morgan" },
  { id: 2, title: "Science lab report", subject: "Biology", course: "Nursing", yearLevel: 2, academicYear: 2026, term: "Term 3", start: "2026-09-12T10:00", due: "2026-09-22", duration: 90, file: "lab-template.docx", owner: "Avery Morgan" },
  { id: 3, title: "Programming project", subject: "Computer Science", course: "Computer Science", yearLevel: 1, academicYear: 2026, term: "Term 3", start: "2026-09-05T09:00", due: "2026-09-19", duration: 120, file: "project-brief.pdf", owner: "Avery Morgan" },
  { id: 4, title: "Case study analysis", subject: "Business Administration", course: "Business Administration", yearLevel: 1, academicYear: 2026, term: "Term 3", start: "2026-09-10T09:00", due: "2026-09-24", duration: 90, file: "case-study-brief.pdf", owner: "Avery Morgan" },
  // A deliberately overdue, unsubmitted assignment so the "missed deadline → remediation"
  // warning and notification can be seen straight away in the demo.
  { id: 5, title: "Study skills worksheet", subject: "Orientation", course: "", yearLevel: null, academicYear: 2026, term: "Term 2", start: "2026-06-01T09:00", due: "2026-06-14", dueTime: "23:59", duration: 90, file: "study-skills-worksheet.pdf", owner: "Avery Morgan" },
  // Previous years of study for the same courses — these populate each learner's archive.
  { id: 6, title: "Foundations essay", subject: "Computer Science", course: "Computer Science", yearLevel: 1, academicYear: 2025, term: "Term 1", start: "2025-02-10T09:00", due: "2025-02-28", duration: 90, file: "foundations-essay.pdf", owner: "Avery Morgan" },
  { id: 7, title: "Anatomy portfolio", subject: "Nursing", course: "Nursing", yearLevel: 1, academicYear: 2025, term: "Term 2", start: "2025-05-05T09:00", due: "2025-05-23", duration: 120, file: "anatomy-portfolio.pdf", owner: "Avery Morgan" },
  { id: 8, title: "Cell biology practical", subject: "Biology", course: "Biology", yearLevel: 1, academicYear: 2025, term: "Term 3", start: "2025-08-04T09:00", due: "2025-08-22", duration: 120, file: "cell-biology-practical.pdf", owner: "Avery Morgan" },
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
// Turns a #rrggbb theme colour into an rgba() string so the sign-in banner can tint an uploaded
// campus photo with the institution's own accent rather than a hardcoded colour.
const hexToRgba = (hex, alpha) => {
  const match = /^#?([\da-f]{6})$/i.exec(String(hex || "").trim());
  if (!match) return `rgba(15,118,110,${alpha})`;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
};
// Marking memos. Each memo belongs to an assignment and is a list of criteria with a maximum mark,
// so staff can mark on screen against the same rubric every time instead of holding it in their
// head. Weighted percentages are derived from the criteria totals, which means two markers working
// from the same memo arrive at the same score.
const DEFAULT_MEMOS = {
  1: {
    assignmentId: 1, title: "Welcome reflection memo", criteria: [
      { id: "c1", label: "Answers all three reflection prompts", max: 30, guidance: "Full marks when every prompt has a considered answer, not a one-line response." },
      { id: "c2", label: "Uses specific personal examples", max: 30, guidance: "Award for concrete examples; halve where examples are generic." },
      { id: "c3", label: "Structure, spelling and grammar", max: 20, guidance: "Deduct for unstructured writing or repeated errors." },
      { id: "c4", label: "Submitted as a valid ZIP with the required files", max: 20, guidance: "Full marks when the archive opens and contains the named files." },
    ]
  },
  2: {
    assignmentId: 2, title: "Science lab report memo", criteria: [
      { id: "c1", label: "Aim and hypothesis clearly stated", max: 20, guidance: "Both must be present and testable." },
      { id: "c2", label: "Method is reproducible", max: 25, guidance: "Another student should be able to repeat it exactly." },
      { id: "c3", label: "Results tabulated with correct units", max: 25, guidance: "Deduct 5 per missing or wrong unit." },
      { id: "c4", label: "Conclusion refers back to the hypothesis", max: 30, guidance: "Full marks only when the data is used to accept or reject the hypothesis." },
    ]
  },
  3: {
    assignmentId: 3, title: "Programming project memo", criteria: [
      { id: "c1", label: "Program compiles and runs without errors", max: 25, guidance: "Zero if it does not run; note the error in feedback." },
      { id: "c2", label: "Meets every functional requirement in the brief", max: 30, guidance: "Mark each requirement proportionally." },
      { id: "c3", label: "Code readability, naming and comments", max: 20, guidance: "Award for clear names and comments that explain why, not what." },
      { id: "c4", label: "Handles invalid input safely", max: 15, guidance: "Test at least one bad input." },
      { id: "c5", label: "README explains how to run the project", max: 10, guidance: "Must include the exact run command." },
    ]
  },
};
// Demo tests/exams — separate from Assignments because these are auto-marked multiple-choice
// assessments scoped to a course and year level, rather than uploaded files. Attempts feed the
// same pass/remediation logic (score vs a configurable passing mark) as the marks workflow.
const DEFAULT_TESTS = [
  {
    id: 1, title: "Intro to Algorithms quiz", subject: "Computer Science", course: "Computer Science", yearLevel: 1, passingMark: 60, durationMinutes: 20, maxAttempts: 2, questions: [
      { question: "Which data structure uses FIFO order?", options: ["Stack", "Queue", "Tree", "Graph"], correct: 1 },
      { question: "What is the time complexity of binary search?", options: ["O(n)", "O(n^2)", "O(log n)", "O(1)"], correct: 2 },
      { question: "Which keyword declares a constant in JavaScript?", options: ["var", "let", "const", "static"], correct: 2 },
      { question: "What does CPU stand for?", options: ["Central Process Unit", "Central Processing Unit", "Computer Personal Unit", "Central Processor Utility"], correct: 1 },
    ]
  },
  {
    id: 2, title: "Cell Biology exam", subject: "Biology", course: "Biology", yearLevel: 2, passingMark: 60, durationMinutes: 30, maxAttempts: 2, questions: [
      { question: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi apparatus"], correct: 2 },
      { question: "DNA replication occurs in which phase?", options: ["G1", "S", "G2", "M"], correct: 1 },
      { question: "What is the basic unit of life?", options: ["Cell", "Atom", "Tissue", "Organ"], correct: 0 },
      { question: "Which organelle handles photosynthesis?", options: ["Mitochondria", "Chloroplast", "Nucleus", "Vacuole"], correct: 1 },
    ]
  },
  {
    id: 3, title: "Business fundamentals test", subject: "Business Management", course: "Business Management", yearLevel: 1, passingMark: 60, durationMinutes: 25, maxAttempts: 2, questions: [
      { question: "What does ROI stand for?", options: ["Rate of Interest", "Return on Investment", "Risk of Insolvency", "Return on Income"], correct: 1 },
      { question: "A balance sheet reports a company's...", options: ["Revenue only", "Assets, liabilities, and equity", "Cash flow only", "Marketing plan"], correct: 1 },
      { question: "What is a fixed cost?", options: ["Cost that changes with output", "Cost that stays the same regardless of output", "A one-time cost", "Employee salaries only"], correct: 1 },
    ]
  },
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

// A clean install must start genuinely empty, so a real school never sees demo learners,
// submissions or the publicly documented demo passwords. The backend has the matching
// SEED_DEMO flag; this is the browser-side half, because the demo assignments, submissions,
// memos and tests live in localStorage rather than SQLite.
//
// Build or run with REACT_APP_SEED_DEMO=false to get an empty portal.
const SEED_DEMO = process.env.REACT_APP_SEED_DEMO !== "false";
const seed = (demoValue, emptyValue) => (SEED_DEMO ? demoValue : emptyValue);

const SEED_ACCOUNTS = seed(ACCOUNTS, []);
const SEED_ASSIGNMENTS = seed(DEFAULT_ASSIGNMENTS, []);
const SEED_MARKS = seed(DEFAULT_MARKS, []);
const SEED_SUBMISSIONS = seed(DEFAULT_SUBMISSIONS, {});
const SEED_MEMOS = seed(DEFAULT_MEMOS, {});
const SEED_TESTS = seed(DEFAULT_TESTS, []);

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
  const [accounts, setAccounts] = useState(() => load("portal-accounts", SEED_ACCOUNTS));
  const [assignments, setAssignments] = useState(() => load("portal-assignments", SEED_ASSIGNMENTS));
  const [marks, setMarks] = useState(() => load("portal-marks", SEED_MARKS));
  const [theme, setTheme] = useState(() => {
    const saved = normalizeTheme(load("portal-theme", DEFAULT_THEME));
    if (saved.name === APP_NAME && load("portal-theme", DEFAULT_THEME)?.name === "Northstar Academy") localStorage.setItem("portal-theme", JSON.stringify(saved));
    return saved;
  });
  const [darkMode, setDarkMode] = useState(() => load("portal-dark-mode", false));
  const [notice, setNotice] = useState("");
  const [notifications, setNotifications] = useState(() => load("portal-notifications", []));
  const [showNotifications, setShowNotifications] = useState(false);
  const [passMark, setPassMark] = useState(() => load("portal-pass-mark", 60));
  const [welcome, setWelcome] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState("");
  const [sqliteData, setSqliteData] = useState(null);
  const [submissions, setSubmissions] = useState(() => load("portal-submissions", SEED_SUBMISSIONS));
  const [customCourses, setCustomCourses] = useState(() => load("portal-courses", []));
  const [tests, setTests] = useState(() => load("portal-tests", SEED_TESTS));
  const [testAttempts, setTestAttempts] = useState(() => load("portal-test-attempts", DEFAULT_TEST_ATTEMPTS));
  const [memos, setMemos] = useState(() => load("portal-memos", SEED_MEMOS));
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
    const setMemosIfChanged = setIfChanged(setMemos);
    const refreshLocalWorkspace = () => {
      setAssignmentsIfChanged(load("portal-assignments", SEED_ASSIGNMENTS));
      setSubmissionsIfChanged(load("portal-submissions", SEED_SUBMISSIONS));
      // While the SQLite API is connected, marks are owned by the database sync below;
      // skip overwriting them here so the two sources don't fight and flicker the UI.
      if (!apiConnectedRef.current) setMarksIfChanged(load("portal-marks", SEED_MARKS));
      setCustomCoursesIfChanged(load("portal-courses", []));
      setTestsIfChanged(load("portal-tests", SEED_TESTS));
      setTestAttemptsIfChanged(load("portal-test-attempts", DEFAULT_TEST_ATTEMPTS));
      setMemosIfChanged(load("portal-memos", SEED_MEMOS));
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
        const dbAccounts = data.users.map((account) => ({ ...account, temporary: Boolean(account.temporary), }));
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
    ? ["Overview", "Accounts", "CSV uploads", "SQLite data", "Courses", "Assignments", "Marking", "Tests & Exams", "Results", "Reports", "Profile", "Design"]
    : user?.role === "admin" ? ["Overview", "Accounts", "CSV uploads", "SQLite data", "Courses", "Assignments", "Marking", "Tests & Exams", "Results", "Reports", "Profile"] : ["Overview", "Courses", "Assignments", "Tests & Exams", "Results", "Reports", "Profile"];

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
    // Clear transient banners too — otherwise a staff message such as "1 marked result synced"
    // stays on screen for whoever signs in next on this browser. The notification panel is closed
    // for the same reason, so one account's alerts are not left open in front of the next user.
    setUser(null); setLogin({ username: "", password: "" }); setSqliteData(null); setApiConnected(false); setNotice(""); setWelcome(""); setApiError(""); setShowNotifications(false);
  }

  if (loading) return <LoadingScreen theme={theme} />;
  if (!user) return <Login login={login} setLogin={setLogin} setAccounts={setAccounts} error={loginError} onSubmit={signIn} theme={theme} darkMode={darkMode} setDarkMode={setDarkMode} language={language} setLanguage={setLanguage} t={t} />;

  const currentMarks = marks.filter((mark) => user.role !== "student" || (mark.studentId === user.studentId && ["Published", "Locked"].includes(mark.status || "Published")));
  const notify = (message) => {
    // Notifications are shared storage in this local demo, so each entry records who it is for.
    // Without this, a student signing in on the same browser saw staff-only messages (other
    // learners' marks and feedback) in the bell — a genuine privacy leak.
    const next = [{ id: Date.now(), message, date: new Date().toISOString(), audience: user.username }, ...notifications];
    setNotifications(next); localStorage.setItem("portal-notifications", JSON.stringify(next)); setNotice(message);
  };
  // The bell previously had no click handler, so every notification the portal recorded (marks
  // published, remediation warnings, password resets) was write-only — a student could never read
  // one after its toast was dismissed. It now opens a panel over the recorded history.
  // Legacy entries saved before notifications were scoped have no audience; show those to staff
  // only, since they were produced by staff actions.
  const visibleNotifications = notifications.filter((item) => (item.audience ? item.audience === user.username : user.role !== "student"));
  const clearNotifications = () => {
    const kept = notifications.filter((item) => !visibleNotifications.includes(item));
    setNotifications(kept); localStorage.setItem("portal-notifications", JSON.stringify(kept));
  };
  // Dark mode is expressed as a `.dark-mode` rule that redefines --paper and --ink. An inline
  // style always wins over a stylesheet rule, so pinning the light theme colours here left the
  // page background and body text light while the panels correctly went dark — unreadable dark
  // ink on dark panels across every tab. In dark mode we therefore omit those two variables and
  // let the stylesheet supply them; the accent and font are theme choices that apply in both modes.
  const shellStyle = darkMode
    ? { "--accent": theme.accent, "--portal-font": theme.font }
    : { "--accent": theme.accent, "--paper": theme.background, "--ink": theme.ink, "--portal-font": theme.font };
  return (
    <div className={`app-shell${darkMode ? " dark-mode" : ""}`} style={shellStyle}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
        <div className="profile"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div></div>
        <nav aria-label="Main navigation">{nav.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => { setActive(item); setShowNotifications(false); }}>{t(item)}</button>)}</nav>
        <button className="sign-out" onClick={signOut}>{t("signOut")}</button>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">Academic workspace</p><h1>{t(active)}</h1><span className="storage-note">SQLite API: {apiConnected ? "connected and syncing every 5 seconds" : "offline/browser fallback"} · port 5000</span></div><div className="top-actions"><label className="language-select"><span className="sr-only">{t("language")}</span><select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("language")}>{LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}</select></label><button className="theme-toggle" onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem("portal-dark-mode", JSON.stringify(next)); }} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>{darkMode ? t("lightMode") : t("darkMode")}</button><span className="status-dot">{apiConnected ? "SQLite connected" : "Local mode"}</span><div className="notification-wrap"><button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} title={`${visibleNotifications.length} notifications`} onClick={() => setShowNotifications((open) => !open)}>{visibleNotifications.length ? "●" : "○"}{visibleNotifications.length > 0 && <span className="notification-count">{visibleNotifications.length}</span>}</button>{showNotifications && <div className="notification-panel" role="dialog" aria-label="Notifications"><div className="notification-head"><strong>Notifications</strong>{visibleNotifications.length > 0 && <button className="text-button" onClick={clearNotifications}>Clear all</button>}</div>{visibleNotifications.length === 0 ? <p className="muted small-print">Nothing yet. Published marks, remediation warnings and account changes appear here.</p> : <ul className="notification-list">{visibleNotifications.slice(0, 20).map((item) => <li key={item.id}><span>{item.message}</span><small>{new Date(item.date).toLocaleString()}</small></li>)}</ul>}</div>}</div></div></header>
        {welcome && <div className="welcome-toast" role="status">{welcome}<button onClick={() => setWelcome("")}>×</button></div>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {apiError && user.role !== "student" && <div className="notice error" role="alert">{apiError}</div>}
        {active === "Overview" && <Overview user={user} assignments={assignments} marks={currentMarks} accounts={accounts} apiConnected={apiConnected} />}
        {active === "Accounts" && (
          <Accounts
            accounts={accounts}
            setAccounts={setAccounts}
            user={user}
          />
        )}
        {active === "CSV uploads" && <CsvUploads setNotice={setNotice} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} accounts={accounts} passMark={passMark} />}
        {active === "SQLite data" && <SQLiteData data={sqliteData} connected={apiConnected} />}
        {active === "Courses" && <><Courses accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} user={user} setUser={setUser} apiConnected={apiConnected} notify={notify} courses={courses} canManage={user.role !== "student"} removeCourse={(name) => { const next = customCourses.filter((course) => course.name !== name); persist("portal-courses", next, setCustomCourses); }} /><CourseManager courses={courses} setCustomCourses={(v) => persist("portal-courses", v, setCustomCourses)} canManage={user.role !== "student"} /></>}
        {active === "Assignments" && <Assignments user={user} assignments={assignments} setAssignments={(v) => persist("portal-assignments", v, setAssignments)} submissions={submissions} setSubmissions={(v) => persist("portal-submissions", v, setSubmissions)} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} accounts={accounts} courses={courses} passMark={passMark} setNotice={setNotice} />}
        {active === "Tests & Exams" && <TestsExams user={user} tests={tests} setTests={(v) => persist("portal-tests", v, setTests)} attempts={testAttempts} setAttempts={(v) => persist("portal-test-attempts", v, setTestAttempts)} accounts={accounts} courses={courses} passMark={passMark} notify={notify} marks={marks} setMarks={(v) => persist("portal-marks", v, setMarks)} />}
        {active === "Results" && <Results marks={user.role === "student" ? currentMarks : marks} allMarks={marks} canEdit={user.role !== "student"} setMarks={(v) => persist("portal-marks", v, setMarks)} user={user} notify={notify} passMark={passMark} setPassMark={(v) => persist("portal-pass-mark", v, setPassMark)} accounts={accounts} institution={theme.name} t={t} />}
        {active === "Marking" && user.role !== "student" && <MarkingRoom user={user} assignments={assignments} submissions={submissions} setSubmissions={(v) => persist("portal-submissions", v, setSubmissions)} memos={memos} setMemos={(v) => persist("portal-memos", v, setMemos)} passMark={passMark} apiConnected={apiConnected} notify={notify} setNotice={setNotice} />}
        {active === "Reports" && <TermReport marks={marks} accounts={accounts} user={user} passMark={passMark} institution={theme.name} notify={notify} />}
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
  const register = async (event) => {
    event.preventDefault();

    const username = registration.username.trim().toLowerCase();
    const studentId = registration.studentId.trim();

    if (
      !registration.name.trim() ||
      !username ||
      !registration.password ||
      !studentId ||
      !registration.course
    ) {
      setRegistrationError(
        "Complete every field, including your course, to create your student account."
      );
      return;
    }

    if (registration.password.length < 8) {
      setRegistrationError(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      const created = await apiRequest("/api/accounts/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registration.name.trim(),
          username,
          password: registration.password,
          studentId,
          course: registration.course,
          yearLevel: 1,
        }),
      });

      setAccounts((currentAccounts) => [
        ...currentAccounts,
        created,
      ]);

      setRegistrationError("");
      setRegistered(true);

      setLogin({
        username: created.username,
        password: registration.password,
      });
    } catch (error) {
      setRegistrationError(
        error.message || "Could not create your student account."
      );
    }
  };
  // The backend already implements a real, token-based reset (hashed single-use token, one hour
  // expiry). The UI previously only printed a fake confirmation, so a user who genuinely forgot
  // their password had no way back in. This drives the real endpoints instead: request a token,
  // then set a new password with it. The token is shown on screen because this build is local-only
  // and deliberately sends no external email — in production it would be emailed, never displayed.
  const [resetStage, setResetStage] = useState("request");
  const [resetToken, setResetToken] = useState("");
  const [resetError, setResetError] = useState("");
  const requestReset = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim();
    const email = String(data.get("email") || "").trim();
    setResetError("");
    if (!username) { setResetError("Enter the username you sign in with."); return; }
    try {
      const response = await apiRequest("/api/accounts/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      if (response.token) {
        setResetToken(response.token); setResetStage("confirm");
        setRecoveryMessage(`Reset notification prepared for ${email || username}. Because this demo runs entirely locally and sends no external email, your single-use token is shown below.`);
      } else {
        // The API deliberately answers the same way for an unknown username so the form cannot be
        // used to discover which accounts exist. Mirror that wording here.
        setRecoveryMessage(`If ${username} is a registered account, a reset notification has been prepared for it.`);
      }
    } catch (error) { setResetError(`Could not reach the local API: ${error.message}`); }
  };
  const confirmReset = async (event) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    setResetError("");
    if (password.length < 8) { setResetError("Choose a password of at least 8 characters."); return; }
    try {
      await apiRequest("/api/accounts/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password }) });
      setResetStage("done"); setRecoveryMessage("Your password has been changed. You can sign in with it now.");
    } catch (error) { setResetError(error.message); }
  };
  const closeForgot = () => { setForgot(false); setResetStage("request"); setResetToken(""); setResetError(""); setRecoveryMessage(""); };
  // The sign-in page is the first thing a visitor sees, so it should reflect the institution's
  // chosen font and accent too. Previously it only picked up the accent variable, which meant a
  // school that chose Georgia saw DM Sans until after signing in, and an uploaded showcase image
  // was always tinted with the stock teal regardless of the configured accent.
  const accent = theme.accent || "#0f766e";
  const artStyle = theme.backgroundImage
    ? { backgroundImage: `linear-gradient(180deg, ${hexToRgba(accent, 0.55)}, rgba(15,32,28,0.78)), url(${theme.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;
  return (
    <div
      className={`login-page${darkMode ? " dark-mode" : ""}`}
      style={{
        "--accent": accent,
        "--portal-font": theme.font || "DM Sans",
        fontFamily: `${theme.font || "DM Sans"}, sans-serif`,
      }}
    >
      <div className="login-art" style={artStyle}>
        <span className="brand-mark">{initials(theme.name)}</span>

        <p className="eyebrow">Your campus, connected</p>

        <h1>
          Make space for
          <br />
          <em>what’s next.</em>
        </h1>

        <p>One calm place for teaching, learning and progress.</p>
      </div>

      <div className="login-top-actions">
        <label className="language-select login-language-toggle">
          <span className="sr-only">{t("language")}</span>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label={t("language")}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>

        <button
          className="theme-toggle login-theme-toggle"
          onClick={() => {
            const next = !darkMode;

            setDarkMode(next);
            localStorage.setItem("portal-dark-mode", JSON.stringify(next));
          }}
          aria-label={
            darkMode ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {darkMode ? t("lightMode") : t("darkMode")}
        </button>
      </div>

      {registering ? (
        <form className="login-card" onSubmit={register}>
          <div className="brand dark">
            <span className="brand-mark">{initials(theme.name)}</span>
            <span>{theme.name}</span>
          </div>

          {registered ? (
            <>
              <h2>Profile created</h2>

              <p className="muted">
                Your course and learner details are stored locally in this
                browser.
              </p>

              <button
                className="primary full"
                type="button"
                onClick={() => {
                  setRegistering(false);
                  setRegistered(false);
                }}
              >
                {t("signIn")}
              </button>
            </>
          ) : (
            <>
              <h2>Create your account</h2>

              <p className="muted">
                Register as a new student for this local campus demo.
              </p>

              <label>
                Full name
                <input
                  autoFocus
                  value={registration.name}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      name: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Student ID
                <input
                  value={registration.studentId}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      studentId: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Course
                <select
                  required
                  value={registration.course}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      course: e.target.value,
                    })
                  }
                >
                  <option value="">Choose your course</option>

                  {COURSES.map(([name]) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label>
                Username
                <input
                  value={registration.username}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      username: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={registration.password}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      password: e.target.value,
                    })
                  }
                />
              </label>

              {registrationError && (
                <p className="error">{registrationError}</p>
              )}

              <button className="primary full" type="submit">
                Create account
              </button>

              <button
                className="text-button auth-link"
                type="button"
                onClick={() => {
                  setRegistering(false);
                  setRegistrationError("");
                }}
              >
                Already have an account? Sign in
              </button>
            </>
          )}
        </form>
      ) : forgot ? (
        <form
          className="login-card"
          onSubmit={
            resetStage === "confirm" ? confirmReset : requestReset
          }
        >
          <div className="brand dark">
            <span className="brand-mark">{initials(theme.name)}</span>
            <span>{theme.name}</span>
          </div>

          <h2>{t("forgotPassword")}</h2>

          {resetStage === "request" && (
            <>
              <p className="muted">
                Enter the username you sign in with, plus a trusted email
                address. This local demo prepares the reset without sending
                external mail.
              </p>

              <label>
                Username
                <input
                  required
                  name="username"
                  autoComplete="username"
                  placeholder="e.g. student"
                />
              </label>

              <label>
                Trusted email
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="off"
                  placeholder="you@example.com"
                />
              </label>
            </>
          )}

          {resetStage === "confirm" && (
            <>
              <p className="muted">
                Your single-use reset token is below. It expires in one hour
                and can only be used once.
              </p>

              <p className="reset-token">{resetToken}</p>

              <label>
                New password
                <input
                  required
                  type="password"
                  name="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </label>
            </>
          )}

          {recoveryMessage && (
            <p className="notice">{recoveryMessage}</p>
          )}

          {resetError && <p className="error">{resetError}</p>}

          {resetStage !== "done" && (
            <button className="primary full" type="submit">
              {resetStage === "confirm"
                ? "Set new password"
                : "Prepare reset notification"}
            </button>
          )}

          <button
            className="text-button auth-link"
            type="button"
            onClick={closeForgot}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <form className="login-card" onSubmit={onSubmit}>
          <div className="brand dark">
            <span className="brand-mark">{initials(theme.name)}</span>
            <span>{theme.name}</span>
          </div>

          <h2>{t("welcomeBack")}</h2>

          <p className="muted">{t("signInSubtitle")}</p>

          <label>
            {t("username")}
            <input
              autoFocus
              value={login.username}
              onChange={(e) =>
                setLogin({
                  ...login,
                  username: e.target.value,
                })
              }
            />
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              value={login.password}
              onChange={(e) =>
                setLogin({
                  ...login,
                  password: e.target.value,
                })
              }
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button
            className="primary full auth-submit"
            type="submit"
          >
            {t("signIn")}
          </button>

          <button
            className="text-button auth-link"
            type="button"
            onClick={() => setRegistering(true)}
          >
            {t("createAccount")}
          </button>

          <button
            className="text-button auth-link"
            type="button"
            onClick={() => setForgot(true)}
          >
            {t("forgotPassword")}
          </button>

          {SEED_DEMO && (
            <div className="demo-box">
              <strong>{t("demoAccounts")}</strong>
              <span>mainadmin / ChangeMe123!</span>
              <span>admin / Admin123!</span>
              <span>student / Student123!</span>
            </div>
          )}
        </form>
      )}
    </div>
  );

}

function Overview({ user, assignments, marks, accounts, apiConnected }) {
  const waitingForSync = user.role !== "student" && !apiConnected;
  const stats = user.role === "student" ? [["Assignments", assignments.length], ["Average score", marks.length ? `${Math.round(marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length)}%` : "—"], ["Feedback", marks.filter((m) => m.feedback).length]] : [["Students", waitingForSync ? "Syncing…" : accounts.filter((a) => a.role === "student").length], ["Assignments", assignments.length], ["Results published", waitingForSync ? "Syncing…" : marks.length]];
  const isClosed = (assignment) => assignment.completed || (assignment.due && new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) < new Date());
  return <><section className="welcome"><div><p className="eyebrow">{displayDate()}</p><h2>Good morning, {user.name.split(" ")[0]}.</h2><p className="muted">Here’s what needs your attention today.</p></div><span className="welcome-shape">✦</span></section><div className="stats">{stats.map(([label, value]) => <div className="stat-card" key={label}><small>{label}</small><strong>{value}</strong><span className="trend">Updated just now</span></div>)}</div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Next up</p><h3>Upcoming and past assignments</h3></div><span className="count">{assignments.length} total</span></div>{assignments.slice(0, 6).map((a) => <div className={`list-row${isClosed(a) ? " assignment-completed" : ""}`} key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong><small>{a.subject} · Opens {a.start ? new Date(a.start).toLocaleString() : "now"} · Due {a.due}{a.dueTime ? ` at ${a.dueTime}` : ""} · {a.duration || 60} minutes</small></div><span className="pill">{isClosed(a) ? "Completed" : user.role === "student" ? "To do" : "Published"}</span></div>)}</section></>;
}

function Accounts({ accounts = [], setAccounts, user }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    temporary: true,
    role: "admin",
  });

  const [error, setError] = useState("");

  const isMainAdmin = user?.role === "main-admin";

  const updateField = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const add = async (event) => {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    const username = form.username.trim().toLowerCase();
    const password = form.password;

    if (!name || !username || !password) {
      setError("Name, username, and password are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const role =
      isMainAdmin && form.role === "main-admin"
        ? "main-admin"
        : "admin";

    try {
      const created = await apiRequest("/admin/accounts/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          password,
          role,
          temporary:
            role === "main-admin"
              ? false
              : Boolean(form.temporary),
        }),
      });

      setAccounts((currentAccounts) => [
        ...currentAccounts,
        created,
      ]);

      window.dispatchEvent(new Event("portal-sync-now"));

      setForm({
        name: "",
        username: "",
        password: "",
        temporary: true,
        role: "admin",
      });

      setError("");
    } catch (error) {
      setError(
        error.message || "Could not create administrator."
      );
    }
  };

  const deleteAccount = async (account) => {
    if (!account?.id) {
      setError("Invalid account.");
      return;
    }

    if (account.role === "main-admin") {
      setError("The main administrator cannot be deleted.");
      return;
    }

    try {
      await apiRequest(`/admin/accounts/${account.id}`, {
        method: "DELETE",
      });

      setAccounts((currentAccounts) =>
        currentAccounts.filter((item) => item.id !== account.id)
      );

      setError("");
    } catch (error) {
      setError(error.message || "Unable to delete account.");
    }
  };

  const learners = accounts.filter(
    (account) => account.role === "student"
  );

  const administratorRows = accounts
    .filter((account) => account.role !== "student")
    .map((account) =>
      React.createElement(
        "div",
        {
          className: "list-row",
          key: account.username,
        },

        React.createElement(
          "div",
          { className: "avatar small" },
          account.name
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        ),

        React.createElement(
          "div",
          null,
          React.createElement("strong", null, account.name),
          React.createElement(
            "small",
            null,
            "@",
            account.username,
            " · ",
            account.role === "main-admin"
              ? "Main administrator"
              : account.temporary
                ? "Temporary administrator"
                : "Permanent administrator"
          )
        ),

        account.role !== "main-admin" &&
        React.createElement(
          "button",
          {
            type: "button",
            className: "text-button danger",
            onClick: () => deleteAccount(account),
          },
          "Delete"
        )
      )
    );

  const learnerRows = learners.map((learner) =>
    React.createElement(
      "div",
      {
        className: "list-row",
        key: learner.username,
      },

      React.createElement(
        "div",
        { className: "avatar small" },
        learner.name
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      ),

      React.createElement(
        "div",
        null,
        React.createElement("strong", null, learner.name),
        React.createElement(
          "small",
          null,
          learner.studentId || "No student ID",
          " · ",
          learner.course || "Course not assigned"
        )
      ),

      React.createElement(
        "button",
        {
          type: "button",
          className: "text-button danger",
          onClick: () => deleteAccount(learner),
        },
        "Delete"
      )
    )
  );

  return (
    <div className="account-layout">
      <section className="panel">
        <p className="eyebrow">Access control</p>
        <h3>Administrator accounts</h3>

        {administratorRows}
      </section>

      <form className="panel form-panel" onSubmit={add}>
        <p className="eyebrow">New access</p>
        <h3>Add a permanent or temporary administrator</h3>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <label>
          Full name
          <input
            required
            value={form.name}
            onChange={(event) =>
              updateField("name", event.target.value)
            }
          />
        </label>

        <label>
          Username
          <input
            required
            value={form.username}
            onChange={(event) =>
              updateField("username", event.target.value)
            }
          />
        </label>

        <label>
          Secure password
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) =>
              updateField("password", event.target.value)
            }
          />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.temporary}
            onChange={(event) =>
              updateField("temporary", event.target.checked)
            }
          />
          Temporary administrator
        </label>

        {isMainAdmin && (
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) =>
                updateField("role", event.target.value)
              }
            >
              <option value="admin">
                Administrator
              </option>
              <option value="main-admin">
                Main administrator
              </option>
            </select>
          </label>
        )}

        <button className="primary" type="submit">
          Create account
        </button>
      </form>

      <section className="panel">
        <p className="eyebrow">Learners</p>
        <h3>Student accounts</h3>

        {learnerRows}
      </section>
    </div>
  );
}

function Profile({ user, accounts, setAccounts, setUser }) {
  const [draft, setDraft] = useState({ name: user.name || "", username: user.username || "", email: user.email || "", studentId: user.studentId || "", course: user.course || "" });
  const [message, setMessage] = useState("");
  const save = async (event) => {
    event.preventDefault();
    setMessage("");

    const name = draft.name.trim();
    const username = draft.username.trim().toLowerCase();
    const studentId = draft.studentId.trim();

    if (!name || !username) {
      setMessage("Name and username are required.");
      return;
    }

    try {
      const updated = await apiRequest("/api/accounts/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          studentId:
            user.role === "student"
              ? studentId
              : null,
        }),
      });

      setUser(updated);

      setAccounts((currentAccounts) =>
        currentAccounts.map((account) =>
          account.id === updated.id
            ? { ...account, ...updated }
            : account
        )
      );

      setDraft((currentDraft) => ({
        ...currentDraft,
        name: updated.name || "",
        username: updated.username || "",
        studentId: updated.studentId || "",
        course: updated.course || "",
      }));

      window.dispatchEvent(
        new Event("portal-sync-now")
      );

      setMessage("Profile saved to SQLite.");
    } catch (error) {
      setMessage(
        error.message || "Could not save your profile."
      );
    }
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
  // Acknowledgment is tracked per assignment id. It used to be a single boolean shared by every
  // assignment, so ticking the box for one assignment silently unlocked uploads for all the
  // others — the student only ever confirmed the work was their own once.
  const [conductAgreed, setConductAgreed] = useState({});
  const agreedFor = (assignmentId) => Boolean(conductAgreed[assignmentId]);
  const setAgreedFor = (assignmentId, value) => setConductAgreed((prev) => ({ ...prev, [assignmentId]: value }));
  const [showArchive, setShowArchive] = useState(false);
  const canManage = user.role !== "student";

  // --- Course/year distribution -------------------------------------------------------------
  // A learner only ever sees work that matches the course they chose and the year of study they
  // are currently in. An assignment with no course targets every course (institution-wide work
  // such as orientation), and one with no yearLevel targets every year of that course. Staff are
  // never filtered — they need to see and mark everything.
  // A learner in Year 2 today was in Year 1 last academic year, so when matching older work we
  // compare against the year of study they were actually in at the time. Without this offset a
  // learner's own previous-year assignments would never appear in their archive.
  const matchesStudent = (assignment) => {
    if (assignment.course && assignment.course !== user.course) return false;
    const yearsAgo = CURRENT_ACADEMIC_YEAR - (assignment.academicYear || CURRENT_ACADEMIC_YEAR);
    const yearThen = user.yearLevel ? Number(user.yearLevel) - yearsAgo : null;
    if (assignment.yearLevel && yearThen && Number(assignment.yearLevel) !== yearThen) return false;
    return true;
  };
  const isCurrentYear = (assignment) => (assignment.academicYear || CURRENT_ACADEMIC_YEAR) >= CURRENT_ACADEMIC_YEAR;
  const targeted = canManage ? assignments : assignments.filter(matchesStudent);
  // Work from earlier academic years of the same course becomes the learner's archive rather
  // than cluttering their current to-do list.
  const currentAssignments = canManage ? assignments : targeted.filter(isCurrentYear);
  const archivedAssignments = canManage ? [] : targeted.filter((assignment) => !isCurrentYear(assignment));

  // --- Deadline / missed-submission warnings -------------------------------------------------
  const deadlineOf = (assignment) =>
    assignment.due
      ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`)
      : null;

  const hoursUntilDue = (assignment) => {
    const deadline = deadlineOf(assignment);
    return deadline
      ? (deadline.getTime() - Date.now()) / 3600000
      : null;
  };

  // "Missed" means the deadline (including any extra time staff already granted by moving the
  // due date) has passed with nothing uploaded — that is what triggers remediation.
  const isMissed = (assignment) => {
    const deadline = deadlineOf(assignment);
    return Boolean(
      deadline &&
      deadline < new Date() &&
      !submissions[`${assignment.id}-${user.username}`]
    );
  };

  const isAtRisk = (assignment) => {
    const hours = hoursUntilDue(assignment);
    return (
      hours !== null &&
      hours > 0 &&
      hours <= 72 &&
      !submissions[`${assignment.id}-${user.username}`]
    );
  };
  // Raise a one-off in-portal notification the first time a learner opens the page after a
  // deadline has lapsed with nothing submitted. The ids of assignments already warned about are
  // remembered per account so the learner is not re-notified on every visit.
  const missedIds = currentAssignments.filter(isMissed).map((assignment) => assignment.id);
  const missedKey = missedIds.join(",");
  useEffect(() => {
    if (canManage || !missedIds.length) return;
    const storageKey = `portal-missed-warned-${user.username}`;
    const warned = load(storageKey, []);
    const fresh = missedIds.filter((id) => !warned.includes(id));
    if (!fresh.length) return;
    const titles = currentAssignments.filter((assignment) => fresh.includes(assignment.id)).map((assignment) => assignment.title);
    localStorage.setItem(storageKey, JSON.stringify([...warned, ...fresh]));
    setNotice(`Missed deadline: ${titles.join(", ")}. Extra time was already allowed, so this now goes to remediation — contact your lecturer to arrange your remediation attempt.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missedKey, canManage, user.username]);

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
    if (!agreedFor(assignment.id)) return setNotice("Please acknowledge the code of conduct for this assignment before submitting your work.");
    const key = `${assignment.id}-${user.username}`;
    const existing = submissions[key];
    const remediationOpen = existing?.mark !== undefined && existing.mark < passMark;
    const deadline = assignment.due ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) : null;
    if ((assignment.completed || (deadline && deadline < new Date())) && !remediationOpen) return setNotice("This assignment is closed because its due date has passed.");
    if (!file || !window.confirm(`Upload “${file.name}” for ${assignment.title}? You can remove it before submitting.`)) return;
    const blocked = /\.(exe|dll|bat|cmd|com|js|vbs|scr|msi|ps1|sh)$/i.test(file.name);
    const allowed = /\.zip$/i.test(file.name) && (file.type === "" || /zip/i.test(file.type));
    if (blocked || !allowed || file.size > 25 * 1024 * 1024) return setNotice("Upload rejected: assignments must be submitted as a single compressed .zip folder, up to 25 MB. Executable files are not accepted.");
    const next = { ...submissions, [key]: remediationOpen ? { ...existing, remediationFileName: file.name, remediationFileUrl: URL.createObjectURL(file), remediationSubmittedAt: new Date().toISOString(), remediationOpen: false } : { assignmentId: assignment.id, assignmentTitle: assignment.title, subject: assignment.subject, course: user.course, studentUsername: user.username, studentName: user.name, studentId: user.studentId, fileName: file.name, fileUrl: URL.createObjectURL(file), submittedAt: new Date().toISOString(), completed: true, closed: false, conductAcknowledged: true } };
    setSubmissions(next); setAgreedFor(assignment.id, false); setNotice(remediationOpen ? `Remediation file submitted for ${assignment.title}. Staff will review it for a final mark.` : `“${file.name}” submitted safely for ${assignment.title}. It is marked completed; marks will be given once reviewed.`);
  };
  const removeSubmission = (assignment) => { const deadline = assignment.due ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`) : null; if (assignment.completed || (deadline && deadline < new Date())) return setNotice("Completed or closed assignments cannot have files removed."); const key = `${assignment.id}-${user.username}`; const next = { ...submissions }; delete next[key]; setSubmissions(next); setNotice("Your file was removed and the assignment is ready for another upload."); };
  const closeSubmission = (submission) => { const key = `${submission.assignmentId}-${submission.studentUsername}`; setSubmissions({ ...submissions, [key]: { ...submission, closed: true, closedAt: new Date().toISOString() } }); setNotice(`Submission closed for ${submission.studentName}.`); };
  const saveMark = (submission, value) => { const score = Number(value); if (!Number.isFinite(score) || score < 0 || score > 100) return setNotice("Final marks must be between 0 and 100."); const key = `${submission.assignmentId}-${submission.studentUsername}`; const publishedAt = new Date().toISOString(); setSubmissions({ ...submissions, [key]: { ...submission, mark: score, markPublishedAt: publishedAt, remediationOpen: score < passMark } }); const existing = marks.find((mark) => mark.studentId === submission.studentId && mark.assessmentId === `ASSIGN-${submission.assignmentId}`); const result = { studentId: submission.studentId, assessmentId: `ASSIGN-${submission.assignmentId}`, student: submission.studentName, subject: submission.subject || submission.assignmentTitle, score, weighting: 100, grade: gradeFor(score, passMark), status: "Published", publishedAt: publishedAt.slice(0, 10), feedback: score < passMark ? `Remediation is required below ${passMark}%.` : `Assignment completed successfully at the ${passMark}% passing threshold.`, submissionFile: submission.fileName }; setMarks(existing ? marks.map((mark) => mark === existing ? { ...mark, ...result } : mark) : [...marks, result]); setNotice(score < passMark ? `Remediation is available to ${submission.studentName}.` : `Final mark ${score}% sent to ${submission.studentName}'s profile.`); };
  const uploadMarkedFile = (submission, file) => { if (!file) return; if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) return setNotice("Marked feedback must be a ZIP file up to 25 MB."); const key = `${submission.assignmentId}-${submission.studentUsername}`; setSubmissions({ ...submissions, [key]: { ...submission, markedFileName: file.name, markedFileUrl: URL.createObjectURL(file), markedUploadedAt: new Date().toISOString() } }); setNotice(`Marked ZIP uploaded for ${submission.studentName}.`); };
  const modifyAssignment = (event) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const replacement = data.get("file");

    const updated = {
      ...editingAssignment,
      title: String(data.get("title") || "").trim(),
      subject: String(data.get("subject") || "").trim(),
      course: String(data.get("course") || "").trim(),
      yearLevel: Number(data.get("yearLevel")) || null,
      academicYear:
        Number(data.get("academicYear")) || CURRENT_ACADEMIC_YEAR,
      term: String(data.get("term") || "").trim(),
      start: String(data.get("start") || ""),
      due: String(data.get("due") || ""),
      dueTime: String(data.get("dueTime") || ""),
      duration: Number(data.get("duration")) || 60,
    };

    if (replacement instanceof File && replacement.name) {
      updated.file = replacement.name;
      updated.url = URL.createObjectURL(replacement);
    }

    setAssignments(
      assignments.map((assignment) =>
        assignment.id === updated.id ? updated : assignment
      )
    );

    setEditingAssignment(null);

    setNotice(
      `Assignment updated. It is now shown to ${updated.course || "all courses"
      }${updated.yearLevel ? `, year ${updated.yearLevel}` : ", all years"}.`
    );
  };
  const toggleCompleted = (assignment) => { setAssignments(assignments.map((item) => item.id === assignment.id ? { ...item, completed: !item.completed } : item)); setNotice(assignment.completed ? "Assignment reopened for students." : "Assignment marked completed; new student submissions are closed."); };
  const deleteAssignment = (assignment) => { if (!window.confirm(`Delete “${assignment.title}” and its local submission records?`)) return; setAssignments(assignments.filter((item) => item.id !== assignment.id)); const next = Object.fromEntries(Object.entries(submissions).filter(([, submission]) => submission.assignmentId !== assignment.id)); setSubmissions(next); setNotice("Assignment deleted."); };
  const downloadMark = (submission) => { const result = `<html><body><h1>Final assignment result</h1><p>Student: ${submission.studentName}</p><p>Assignment: ${submission.assignmentTitle}</p><p>Submitted file: ${submission.fileName}</p><h2>Final mark: ${submission.mark}%</h2><p>${submission.mark < passMark ? `Remediation required below ${passMark}%.` : `Passing requirement met at ${passMark}%.`}</p><p>Published: ${new Date(submission.markPublishedAt).toLocaleString()}</p></body></html>`; const popup = window.open("", "_blank"); if (!popup) return setNotice("Allow pop-ups to print the final mark as a PDF."); popup.document.write(result); popup.document.close(); popup.focus(); popup.print(); };
  const addAssignment = (e) => {
    e.preventDefault();

    const data = new FormData(e.currentTarget);
    const file = data.get("file");

    if (!(file instanceof File) || !file.name) {
      setNotice("Please select an assignment file.");
      return;
    }

    const title = String(data.get("title") || "").trim();
    const subject = String(data.get("subject") || "").trim();
    const course = String(data.get("course") || "").trim();
    const yearLevel = Number(data.get("yearLevel")) || null;
    const academicYear =
      Number(data.get("academicYear")) || CURRENT_ACADEMIC_YEAR;
    const term = String(data.get("term") || "").trim();

    if (!title || !subject) {
      setNotice("Title and subject are required.");
      return;
    }

    if (
      assignments.some(
        (assignment) =>
          assignment.title.toLowerCase() === title.toLowerCase() &&
          assignment.subject.toLowerCase() === subject.toLowerCase() &&
          (assignment.course || "") === course &&
          (assignment.yearLevel || null) === yearLevel &&
          (assignment.academicYear || CURRENT_ACADEMIC_YEAR) === academicYear
      )
    ) {
      setNotice(
        "That assignment already exists for this course, year of study and academic year."
      );
      return;
    }
    const audience = accounts.filter(
      (account) =>
        account.role === "student" &&
        (!course || account.course === course) &&
        (!yearLevel || Number(account.yearLevel) === yearLevel)
    ).length;

    setAssignments([
      {
        id: Date.now(),
        title,
        subject,
        course,
        yearLevel,
        academicYear,
        term,
        start: String(data.get("start") || ""),
        due: String(data.get("due") || ""),
        dueTime: String(data.get("dueTime") || ""),
        duration: Number(data.get("duration")) || 60,
        file: file.name,
        url: URL.createObjectURL(file),
        owner: user.name,
      },
      ...assignments,
    ]);

    e.currentTarget.reset();

    setNotice(
      `Assignment published to ${course || "all courses"
      }${yearLevel ? `, year ${yearLevel}` : ", all years"} — ${audience} learner(s) will see it.`
    );
  };
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
  return <>
    <div className="two-col">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Shared resources</p>
            <h3>
              {canManage ? "Assignments and submissions" : "Your assignments"}
            </h3>
          </div>
        </div>

        {!canManage && (
          <p className="muted course-scope">
            Showing work for <strong>{user.course || "your course"}</strong>
            {user.yearLevel ? ` · Year ${user.yearLevel}` : ""}. Change your
            course or year on the Courses page and this list updates automatically.
          </p>
        )}

        {!canManage && missedIds.length > 0 && (
          <div className="missed-banner" role="alert">
            <strong>{missedIds.length} assignment(s) missed.</strong> You were
            given the full submission window (plus any extra time your lecturer
            allowed) and nothing was uploaded, so these now go to remediation.
            Speak to your lecturer to book your remediation attempt.
          </div>
        )}

        {currentAssignments.map((a) => {
          const own = ownSubmission(a);
          const ownResult = own ? resultForSubmission(own) : null;
          const related = Object.values(submissions).filter(
            (submission) => submission.assignmentId === a.id,
          );

          const isPastDue =
            a.due &&
            new Date(`${a.due}T${a.dueTime || "23:59"}`) < new Date();

          const isClosed = a.completed || isPastDue;
          const remediationOpen =
            own?.mark !== undefined && own.mark < passMark;

          return (
            <div
              className={`list-row assignment-row${isClosed ? " assignment-completed" : ""
                }`}
              key={a.id}
            >
              <div className="file-icon">↗</div>

              <div>
                <strong>{a.title}</strong>

                <small>
                  {a.file} · {a.course || "All courses"}
                  {a.yearLevel ? ` · Year ${a.yearLevel}` : " · All years"} · Opens{" "}
                  {a.start ? new Date(a.start).toLocaleString() : "now"} · Ends{" "}
                  {a.due}
                  {a.dueTime ? ` at ${a.dueTime}` : ""} · {a.duration || 60}{" "}
                  minutes · {isClosed ? "Completed / closed" : "Open"}
                </small>

                {isMissed(a) && (
                  <small className="warning-text missed-warning">
                    Missed — no submission was uploaded before the deadline. Extra
                    time was already allowed, so this result goes to remediation.
                  </small>
                )}

                {isAtRisk(a) && (
                  <small className="warning-text">
                    Due in under {Math.max(1, Math.ceil(hoursUntilDue(a)))} hour(s)
                    and nothing is uploaded yet — missing the deadline means
                    remediation.
                  </small>
                )}

                {own && (
                  <small className="submission">
                    Submitted: {own.fileName} ·{" "}
                    {own.completed
                      ? "Completed — marks will be given once marked"
                      : "Awaiting review"}
                    {own.mark !== undefined ? ` · Final mark: ${own.mark}%` : ""}
                    {ownResult &&
                      (ownResult.grade === "R"
                        ? ` · R — remediation required${ownResult.remediation?.date
                          ? ` on ${ownResult.remediation.date}`
                          : ""
                        }${ownResult.remediation?.time
                          ? ` at ${ownResult.remediation.time}`
                          : ""
                        }`
                        : ` · Grade ${ownResult.grade}`)}
                  </small>
                )}

                {canManage && related.length > 0 && (
                  <small className="submission">
                    {related.length} submission(s) — see the submissions table
                    below to review, mark, or download them.
                  </small>
                )}

                {canManage && related.length > 1 && (
                  <button
                    className="secondary bulk-download"
                    onClick={() => downloadAllSubmissions(a, related)}
                  >
                    Download all {related.length} submissions (ZIP)
                  </button>
                )}

                {!isClosed && (
                  <button className="secondary" onClick={() => download(a)}>
                    Download assignment
                  </button>
                )}

                {!canManage && own?.markedFileUrl && (
                  <button
                    className="secondary"
                    onClick={() =>
                      downloadSubmission({
                        fileUrl: own.markedFileUrl,
                        fileName: own.markedFileName,
                      })
                    }
                  >
                    Download marked ZIP
                  </button>
                )}

                {canManage && (
                  <>
                    <button
                      className="secondary"
                      onClick={() => setEditingAssignment(a)}
                    >
                      Modify
                    </button>

                    <button
                      className="secondary"
                      onClick={() => toggleCompleted(a)}
                    >
                      {a.completed ? "Reopen" : "Mark completed"}
                    </button>

                    <button
                      className="text-button danger"
                      onClick={() => deleteAssignment(a)}
                    >
                      Delete
                    </button>
                  </>
                )}

                {!canManage &&
                  !own?.closed &&
                  ((!a.completed && !isPastDue) || remediationOpen) && (
                    <>
                      <div className="conduct-box">
                        <span>
                          Code of conduct: by submitting, I confirm this work is my
                          own and complies with the academic integrity policy.
                        </span>

                        <label>
                          <input
                            type="checkbox"
                            checked={agreedFor(a.id)}
                            onChange={(e) =>
                              setAgreedFor(a.id, e.target.checked)
                            }
                          />{" "}
                          I acknowledge this is my own work
                        </label>
                      </div>

                      <label className="secondary upload-button">
                        Upload ZIP folder
                        <input
                          type="file"
                          accept=".zip,application/zip,application/x-zip-compressed"
                          onChange={(e) => submit(a, e.target.files[0])}
                        />
                      </label>
                    </>
                  )}

                {!canManage && own && !own.closed && (
                  <button
                    className="text-button danger"
                    onClick={() => removeSubmission(a)}
                  >
                    Remove file
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {selected && (
          <div className="download-note">
            “{selected.file}” is ready locally. Closed assignments hide the
            pre-made file; staff can still download student submissions and upload
            marked ZIP feedback locally.
          </div>
        )}

        {!canManage && archivedAssignments.length > 0 && (
          <div className="archive-block">
            <button
              className="text-button archive-toggle"
              onClick={() => setShowArchive(!showArchive)}
            >
              {showArchive ? "Hide" : "Show"} previous years of{" "}
              {user.course || "your course"} ({archivedAssignments.length})
            </button>

            {showArchive && (
              <div className="archive-list">
                {archivedAssignments.map((a) => {
                  const own = ownSubmission(a);
                  const ownResult = own ? resultForSubmission(own) : null;

                  return (
                    <div className="list-row archive-row" key={a.id}>
                      <div className="file-icon">🗄</div>

                      <div>
                        <strong>{a.title}</strong>

                        <small>
                          {a.subject} · {a.academicYear} · {a.term || "—"} · Year{" "}
                          {a.yearLevel || "—"} of {a.course || "your course"}
                        </small>

                        <small className="submission">
                          {own
                            ? `Submitted ${own.fileName}${own.mark !== undefined
                              ? ` · Final mark ${own.mark}%`
                              : ""
                            }`
                            : "No submission was recorded for this assignment."}
                          {ownResult ? ` · Grade ${ownResult.grade}` : ""}
                        </small>

                        {own?.markedFileUrl && (
                          <button
                            className="secondary"
                            onClick={() =>
                              downloadSubmission({
                                fileUrl: own.markedFileUrl,
                                fileName: own.markedFileName,
                              })
                            }
                          >
                            Download marked ZIP
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {canManage &&
        (editingAssignment ? (
          <form className="panel form-panel" onSubmit={modifyAssignment}>
            <p className="eyebrow">Edit assignment</p>
            <h3>Modify for students</h3>

            <label>
              Title
              <input
                name="title"
                required
                defaultValue={editingAssignment.title}
              />
            </label>

            <label>
              Subject
              <input
                name="subject"
                required
                defaultValue={editingAssignment.subject}
              />
            </label>

            <label>
              Course
              <select
                name="course"
                defaultValue={editingAssignment.course || ""}
              >
                <option value="">All courses</option>
                {courses.map(([name]) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Year of study
              <select
                name="yearLevel"
                defaultValue={editingAssignment.yearLevel || ""}
              >
                <option value="">All years</option>
                {[1, 2, 3, 4, 5, 6].map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Academic year
              <input
                name="academicYear"
                type="number"
                min="2000"
                max="2100"
                defaultValue={
                  editingAssignment.academicYear || CURRENT_ACADEMIC_YEAR
                }
              />
            </label>

            <label>
              Term or semester
              <input
                name="term"
                defaultValue={editingAssignment.term || ""}
                placeholder="e.g. Term 3 / Semester 2"
              />
            </label>

            <label>
              Replace assignment file
              <input
                name="file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.zip"
              />
            </label>

            <label>
              Start date and time
              <input
                name="start"
                required
                type="datetime-local"
                defaultValue={editingAssignment.start}
              />
            </label>

            <label>
              End date
              <input
                name="due"
                required
                type="date"
                defaultValue={editingAssignment.due}
              />
            </label>

            <label>
              End time
              <input
                name="dueTime"
                required
                type="time"
                defaultValue={editingAssignment.dueTime || "23:59"}
              />
            </label>

            <label>
              Duration (minutes)
              <input
                name="duration"
                required
                type="number"
                min="1"
                defaultValue={editingAssignment.duration || 60}
              />
            </label>

            <button className="primary" type="submit">
              Save changes
            </button>

            <button
              className="text-button auth-link"
              type="button"
              onClick={() => setEditingAssignment(null)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <form className="panel form-panel" onSubmit={addAssignment}>
            <p className="eyebrow">Publish work</p>
            <h3>Schedule an assignment or test</h3>

            <label>
              Title
              <input name="title" required placeholder="e.g. Week 3 essay" />
            </label>

            <label>
              Subject
              <input name="subject" required placeholder="e.g. History" />
            </label>

            <label>
              Course
              <select name="course" defaultValue="">
                <option value="">All courses</option>
                {courses.map(([name]) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <small className="muted">
                Only learners enrolled on this course will see the assignment.
              </small>
            </label>

            <label>
              Year of study
              <select name="yearLevel" defaultValue="">
                <option value="">All years</option>
                {[1, 2, 3, 4, 5, 6].map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Academic year
              <input
                name="academicYear"
                type="number"
                min="2000"
                max="2100"
                defaultValue={CURRENT_ACADEMIC_YEAR}
              />
            </label>

            <label>
              Term or semester
              <input name="term" placeholder="e.g. Term 3 / Semester 2" />
            </label>

            <label>
              Start date and time
              <input name="start" required type="datetime-local" />
            </label>

            <label>
              End date
              <input name="due" required type="date" />
            </label>

            <label>
              End time
              <input name="dueTime" required type="time" defaultValue="23:59" />
            </label>

            <label>
              Duration (minutes)
              <input
                name="duration"
                required
                type="number"
                min="1"
                defaultValue="60"
              />
            </label>

            <label className="file-drop">
              Choose any file
              <input name="file" required type="file" />
            </label>

            <button className="primary" type="submit">
              Publish scheduled work
            </button>
          </form>
        ))}
    </div>

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
            {submission.markedFileUrl && <button className="secondary" onClick={() => downloadSubmission({ fileUrl: submission.markedFileUrl, fileName: submission.markedFileName })}>Uploaded ZIP</button>}
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
  const [reviewing, setReviewing] = useState(null);

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

  const submitTest = async () => {
    const test = taking;

    if (!test) {
      notify("No test is currently open.");
      return;
    }

    try {
      const mcqQuestions = test.questions.filter((q) => q.type !== "essay");
      const essayQuestions = test.questions.filter((q) => q.type === "essay");

      const total = mcqQuestions.length;
      let correct = 0;

      mcqQuestions.forEach((q) => {
        const index = test.questions.indexOf(q);

        if (answers[index] === q.correct) {
          correct += 1;
        }
      });

      const score = total
        ? Math.round((correct / total) * 100)
        : 0;

      const essayAnswers = essayQuestions.map((q) => ({
        question: q.question,
        answer: answers[test.questions.indexOf(q)] || "",
      }));

      const needsReview = essayQuestions.length > 0;

      const key = `${test.id}-${user.studentId}`;
      const list = attempts[key] || [];

      const attempt = {
        attemptNumber: list.length + 1,
        score,
        correct,
        total,
        essayAnswers,
        needsReview,
        takenAt: new Date().toISOString(),
        passed: total
          ? score >= (test.passingMark ?? passMark)
          : null,
      };

      /*
       * Keep the attempt in the current browser state as well.
       * This preserves the existing Tests & Exams UI while the
       * actual mark is now also stored in SQLite below.
       */
      const nextAttempts = {
        ...attempts,
        [key]: [...list, attempt],
      };

      setAttempts(nextAttempts);

      /*
       * Essay-only tests are intentionally not given an automatic
       * result. Staff must review those answers first.
       */
      if (total > 0) {
        const response = await apiRequest("/api/tests/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            testId: String(test.id),
            testTitle: test.title,
            passingMark: Number(test.passingMark ?? passMark),
            score,
            correct,
            total,
            essayAnswers,
            needsReview,
          }),
        });

        const saved = response.mark || response;

        const markResult = {
          id: saved.id,
          studentId: saved.studentId || user.studentId,
          assessmentId:
            saved.assessmentId || `TEST-${test.id}`,
          student: user.name,
          subject: test.title,
          score: Number(saved.mark ?? score),
          weighting: 100,
          passingMark: Number(
            test.passingMark ?? passMark
          ),
          grade: gradeFor(
            Number(saved.mark ?? score),
            Number(test.passingMark ?? passMark)
          ),
          status: saved.status || "Published",
          publishedAt:
            saved.publishedAt ||
            new Date().toISOString().slice(0, 10),
          feedback:
            Number(saved.mark ?? score) <
              Number(test.passingMark ?? passMark)
              ? `Remediation is required below ${test.passingMark ?? passMark
              }% on ${test.title}.`
              : `${test.title} passed at the ${test.passingMark ?? passMark
              }% threshold.`,
        };

        /*
         * Replace the existing database-backed result when the
         * student improves their best score. Otherwise keep the
         * existing best result.
         */
        const existingMark = marks.find(
          (mark) =>
            mark.studentId === user.studentId &&
            mark.assessmentId === `TEST-${test.id}`
        );

        if (existingMark) {
          setMarks(
            marks.map((mark) =>
              mark === existingMark
                ? {
                  ...mark,
                  ...markResult,
                }
                : mark
            )
          );
        } else {
          setMarks([...marks, markResult]);
        }

        /*
         * Ask the app to refresh from SQLite immediately rather
         * than waiting for the normal five-second sync.
         */
        window.dispatchEvent(
          new Event("portal-sync-now")
        );
      }

      setTaking(null);
      setAnswers({});

      if (needsReview) {
        notify(
          `${test.title} submitted. Your long-answer response${essayQuestions.length > 1 ? "s are" : " is"
          } awaiting staff review.`
        );
      } else if (attempt.passed) {
        notify(
          `You passed ${test.title} with ${score}%!`
        );
      } else {
        const remaining =
          test.maxAttempts - attempt.attemptNumber;

        notify(
          remaining > 0
            ? `You scored ${score}% on ${test.title}. ${remaining} attempt(s) remaining.`
            : `You scored ${score}% on your final attempt for ${test.title}.`
        );
      }
    } catch (error) {
      notify(
        `Could not save the test result: ${error.message}`
      );
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

  if (reviewing) {
    const { student, test, attempt } = reviewing;
    return <section className="panel">
      <h2>Long-answer review</h2>
      <p className="muted">{student.name} ({student.studentId}) · {test.title} · Submitted {new Date(attempt.takenAt).toLocaleString()}</p>
      {attempt.essayAnswers.map((entry, i) => <div key={i} className="question-block"><p><strong>Q.</strong> {entry.question}</p><p className="essay-response">{entry.answer || "(No answer provided)"}</p></div>)}
      <div className="actions"><button className="secondary" onClick={() => setReviewing(null)}>Back to Tests &amp; Exams</button></div>
    </section>;
  }

  if (taking) {
    const test = taking;
    const allAnswered = test.questions.every((q, i) => q.type === "essay" ? String(answers[i] || "").trim().length > 0 : answers[i] !== undefined);
    return <section className="panel"><h2>{test.title}</h2><p className="muted">{test.subject} · {test.questions.length} question(s) · Passing mark {test.passingMark ?? passMark}%</p>
      {test.questions.map((q, i) => <div key={i} className="question-block">
        <p><strong>Q{i + 1}.</strong> {q.question}</p>
        {q.type === "essay"
          ? <textarea className="essay-answer" rows={6} placeholder="Write your answer here…" value={answers[i] || ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />
          : q.options.map((opt, oi) => <label key={oi} className="option-row"><input type="radio" name={`q-${i}`} checked={answers[i] === oi} onChange={() => setAnswers({ ...answers, [i]: oi })} /> {opt}</label>)}
      </div>)}
      <div className="actions"><button onClick={submitTest} disabled={!allAnswered}>Submit test</button><button className="secondary" onClick={() => setTaking(null)}>Cancel</button></div>
    </section>;
  }

  if (editing) {
    const t = editing;
    const setField = (field, value) => setEditing({ ...t, [field]: value });
    const setQuestion = (i, field, value) => { const qs = [...t.questions]; qs[i] = { ...qs[i], [field]: value }; setEditing({ ...t, questions: qs }); };
    const setOption = (i, oi, value) => { const qs = [...t.questions]; const opts = [...qs[i].options]; opts[oi] = value; qs[i] = { ...qs[i], options: opts }; setEditing({ ...t, questions: qs }); };
    const addQuestion = () => setEditing({ ...t, questions: [...t.questions, { type: "mcq", question: "", options: ["", "", "", ""], correct: 0 }] });
    // Long-answer/essay questions test understanding of the fundamentals rather than a single
    // correct option — they are never auto-scored, so submissions containing one are flagged
    // `needsReview` in submitTest() and must be marked by a staff member on the Results page.
    const addEssayQuestion = () => setEditing({ ...t, questions: [...t.questions, { type: "essay", question: "" }] });
    const setQuestionType = (i, type) => { const qs = [...t.questions]; qs[i] = type === "essay" ? { type: "essay", question: qs[i].question } : { type: "mcq", question: qs[i].question, options: ["", "", "", ""], correct: 0 }; setEditing({ ...t, questions: qs }); };
    const removeQuestion = (i) => setEditing({ ...t, questions: t.questions.filter((_, qi) => qi !== i) });
    return <section className="panel">
      <h2>{tests.some((x) => x.id === t.id) ? "Edit test" : "New test"}</h2>
      <div className="form-grid">
        <label>Title<input value={t.title} onChange={(e) => setField("title", e.target.value)} /></label>
        <label>Subject<input value={t.subject} onChange={(e) => setField("subject", e.target.value)} /></label>
        <label>Course<select value={t.course} onChange={(e) => setField("course", e.target.value)}><option value="">Select a course</option>{courses.map(([name]) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>Year level<input type="number" min="1" max="6" value={t.yearLevel || ""} onChange={(e) => setField("yearLevel", Number(e.target.value) || undefined)} /></label>
        <label>Passing mark %<input type="number" min="0" max="100" value={t.passingMark} onChange={(e) => setField("passingMark", Number(e.target.value))} /></label>
        <label>Max attempts<input type="number" min="1" max="10" value={t.maxAttempts} onChange={(e) => setField("maxAttempts", Number(e.target.value))} /></label>
        <label>Duration (minutes)<input type="number" min="1" value={t.durationMinutes} onChange={(e) => setField("durationMinutes", Number(e.target.value))} /></label>
      </div>
      <h3>Questions</h3>
      {t.questions.map((q, i) => <div key={i} className="question-block">
        <label>Question {i + 1}<input value={q.question} onChange={(e) => setQuestion(i, "question", e.target.value)} /></label>
        <label className="question-type-row">Question type<select value={q.type === "essay" ? "essay" : "mcq"} onChange={(e) => setQuestionType(i, e.target.value)}><option value="mcq">Multiple choice (auto-marked)</option><option value="essay">Long answer / essay (staff-marked)</option></select></label>
        {q.type === "essay"
          ? <p className="muted essay-note">Students will see a large textbox for a written answer. This question is not auto-marked — a staff member reviews and marks it manually on the Results page.</p>
          : q.options.map((opt, oi) => <label key={oi} className="option-row"><input type="radio" checked={q.correct === oi} onChange={() => setQuestion(i, "correct", oi)} /><input value={opt} placeholder={`Option ${oi + 1}`} onChange={(e) => setOption(i, oi, e.target.value)} /></label>)}
        <button className="secondary" onClick={() => removeQuestion(i)}>Remove question</button>
      </div>)}
      <div className="actions">
        <button className="secondary" onClick={addQuestion}>Add multiple-choice question</button>
        <button className="secondary" onClick={addEssayQuestion}>Add long-answer question</button>
        <button onClick={() => saveTest(t)}>Save test</button>
        <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </section>;
  }

  return <>
    <section className="panel">
      <div className="card-header"><h2>Tests &amp; Exams</h2>{canManage && <button onClick={() => setEditing({ id: 0, title: "", subject: "", course: "", yearLevel: undefined, passingMark: passMark, maxAttempts: 2, durationMinutes: 20, questions: [{ type: "mcq", question: "", options: ["", "", "", ""], correct: 0 }] })}>Add test</button>}</div>
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
          {canManage && <div className="fixed-table"><table><thead><tr><th>Student</th><th>Year</th><th>Attempts</th><th>Best score</th><th>Status</th><th>Long-answer review</th></tr></thead><tbody>
            {studentsForTest(test).map((student) => {
              const list = attemptsFor(test.id, student.studentId);
              const best2 = list.length ? Math.max(...list.map((a) => a.score)) : null;
              const latest = list[list.length - 1];
              const hasEssays = test.questions.some((q) => q.type === "essay");
              return <tr key={student.studentId}><td>{student.name} ({student.studentId})</td><td>{student.yearLevel || "—"}</td><td>{list.length}/{test.maxAttempts}</td><td>{best2 !== null ? `${best2}%` : "Not attempted"}</td><td>{best2 === null ? "Pending" : best2 >= test.passingMark ? "Passed" : list.length >= test.maxAttempts ? "Failed — remediation needed" : "Remediation recommended"}</td><td>{hasEssays ? (latest?.essayAnswers?.length ? <button className="text-button" onClick={() => setReviewing({ student, test, attempt: latest })}>View answers</button> : "Not submitted") : "—"}</td></tr>;
            })}
          </tbody></table></div>}
        </div>;
      })}
    </section>
  </>;
}

function Results({ marks, allMarks, canEdit, setMarks, user, notify, passMark, setPassMark, accounts, institution, t = (key) => key }) {
  const [editing, setEditing] = useState(null);
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
    // Build a per-student overall weighted average across the whole school (from allMarks, not just
    // this view's filtered subset) so we can show where this student's average ranks against
    // everyone else's — this is the "top percentage of the school" figure requested for the summary.
    const pool = (allMarks || marks).filter((m) => ["Published", "Locked"].includes(m.status || "Published"));
    const byStudent = {};
    pool.forEach((m) => { const key = m.studentId; if (!byStudent[key]) byStudent[key] = { total: 0, weight: 0, name: m.student }; byStudent[key].total += Number(m.score || 0) * Number(m.weighting || 100); byStudent[key].weight += Number(m.weighting || 100); });
    const schoolAverages = Object.entries(byStudent).map(([studentId, v]) => ({ studentId, average: v.weight ? v.total / v.weight : 0 })).sort((a, b) => b.average - a.average);
    const rankOf = (studentId) => { const index = schoolAverages.findIndex((s) => s.studentId === studentId); return index === -1 ? null : { rank: index + 1, of: schoolAverages.length, percentile: Math.round(((schoolAverages.length - index) / schoolAverages.length) * 100) }; };
    const studentIds = [...new Set(visibleMarks.map((m) => m.studentId))];
    const today = new Date().toLocaleDateString();

    const rows = visibleMarks.map((m) => {
      const account = accounts?.find((a) => a.studentId === m.studentId);
      const rank = rankOf(m.studentId);
      return `<tr><td>${m.studentId}</td><td>${account?.name || m.student || ""}</td><td>${m.subject}</td><td>${m.assessmentId || "N/A"}</td><td>${effectiveScore(m)}%</td><td>${m.grade || gradeFor(effectiveScore(m), markThreshold(m))}</td><td>${m.status || "Published"}</td><td>${m.publishedAt || today}</td><td>${rank ? `Top ${100 - rank.percentile + 1}% (rank ${rank.rank} of ${rank.of})` : "—"}</td></tr>`;
    }).join("");

    const single = studentIds.length === 1 ? accounts?.find((a) => a.studentId === studentIds[0]) : null;
    const header = single
      ? `<p><strong>Student ID:</strong> ${single.studentId} &nbsp; <strong>Full name:</strong> ${single.name} &nbsp; <strong>Date printed:</strong> ${today}</p>`
      : `<p><strong>Records:</strong> ${visibleMarks.length} &nbsp; <strong>Date printed:</strong> ${today}</p>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) { notify("Please allow pop-ups to print or save the result summary as a PDF."); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Result summary</title><style>
      body{font-family:Arial,sans-serif;color:#17211f;padding:32px}
      h1{font-size:20px;margin-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#0f766e;color:#fff}
      tr:nth-child(even){background:#f4f8f6}
      @media print{button{display:none}}
    </style></head><body>
      <h1>${institution || "Meridian Learning Hub"} — Result summary</h1>
      ${header}
      <table><thead><tr><th>Student ID</th><th>Full name</th><th>Subject</th><th>Assessment</th><th>Score</th><th>Grade</th><th>Status</th><th>Published</th><th>School ranking</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:24px;font-size:11px;color:#72807d">Generated locally by ${institution || "Meridian Learning Hub"}. Rankings are calculated from locally stored published/locked marks only.</p>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;">Print / Save as PDF</button>
    </body></html>`);
    printWindow.document.close();
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
  const addMark = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    const studentId = String(data.get("studentId") || "").trim();
    const assessmentId = String(data.get("assessmentId") || "").trim();
    const subject = String(data.get("subject") || "").trim();
    const score = Number(data.get("score"));
    const passingMark = Number(data.get("passingMark")) || passMark;
    const weighting = Number(data.get("weighting")) || 100;

    if (!studentId || !assessmentId || !subject) {
      notify("Student ID, Assessment ID and Subject are required.");
      return;
    }

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      notify("Score must be between 0 and 100.");
      return;
    }

    if (
      marks.some(
        (mark) =>
          String(mark.studentId).toLowerCase() === studentId.toLowerCase() &&
          String(mark.assessmentId).toLowerCase() === assessmentId.toLowerCase()
      )
    ) {
      notify("That student and assessment already have a mark.");
      return;
    }

    try {
      const response = await apiRequest("/admin/marks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          assessmentId,
          assessmentName: subject,
          mark: score,
          feedback: "",
        }),
      });

      const saved = response.mark || response;

      const result = {
        id: saved.id,
        studentId: saved.studentId || studentId,
        assessmentId: saved.assessmentId || assessmentId,
        student:
          accounts.find((a) => a.studentId === studentId)?.name || studentId,
        subject,
        score: Number(saved.mark ?? score),
        passingMark,
        grade: gradeFor(score, passingMark),
        weighting,
        status: saved.status || "Submitted",
        updatedAt: saved.updatedAt,
        feedback: "",
        remediation: { count: 0 },
      };

      setMarks([...marks, result]);

      form.reset();

      window.dispatchEvent(new Event("portal-sync-now"));

      notify(`Mark saved for ${result.student}.`);
    } catch (error) {
      notify(`Could not save the mark: ${error.message}`);
    }
  };
  const updateRemediation = (mark, field, value) => setMarks(marks.map((item) => item === mark ? { ...item, remediation: { ...(item.remediation || {}), [field]: field === "count" ? Number(value) : value } } : item));
  const deleteMark = (mark) => setMarks(marks.filter((item) => item !== mark));
  return (
    <>
      <section className="panel tips-panel">
        <p className="eyebrow">Next steps</p>

        <h3>
          {canEdit ? "Staff marking checklist" : "How to get your marks back"}
        </h3>

        <p className="muted">
          {canEdit
            ? "Review the learner's submission, check the student ID and course, enter the mark, add feedback, then publish it. Use remediation when the mark is below the configured passing threshold."
            : "Check Results after staff publish. Download your summary and any marked ZIP feedback. If remediation is shown, follow the scheduled instructions and upload the replacement work before its new deadline."}
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Progress report</p>

            <h3>
              {canEdit ? "Mark publication workflow" : "Your results"}
            </h3>
          </div>

          <div>
            <span className="count">{visibleMarks.length} records</span>

            {!canEdit && (
              <button
                className="secondary summary-button"
                onClick={downloadSummary}
              >
                {t("downloadSummary")}
              </button>
            )}

            {canEdit && (
              <button
                className="secondary summary-button"
                onClick={downloadSummary}
              >
                Print result summary
              </button>
            )}
          </div>
        </div>

        <div className="result-filters">
          <label>
            Show
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All results</option>
              <option value="remediation">Needs remediation</option>
              <option value="passing">Passing / no remediation</option>
            </select>
          </label>

          {canEdit && (
            <label>
              Find student
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`${t("search")}…`}
              />
            </label>
          )}
        </div>

        {canEdit && (
          <div className="workflow-tools">
            <form className="inline-form" onSubmit={addMark}>
              <input
                name="studentId"
                required
                placeholder="Student ID"
              />

              <input
                name="assessmentId"
                required
                placeholder="Assessment ID"
              />

              <input
                name="subject"
                required
                placeholder="Subject"
              />

              <input
                name="score"
                required
                type="number"
                min="0"
                max="100"
                placeholder="Score"
              />

              <input
                name="passingMark"
                type="number"
                min="0"
                max="100"
                defaultValue={passMark}
                placeholder="Passing %"
              />

              <input
                name="weighting"
                type="number"
                min="1"
                max="100"
                defaultValue="100"
                placeholder="Weight %"
              />

              <button className="primary" type="submit">
                {t("addMark")}
              </button>
            </form>

            <label className="pass-rule">
              Default passing mark
              <input
                type="number"
                min="0"
                max="100"
                value={passMark}
                onChange={(e) => setPassMark(Number(e.target.value))}
              />
              %
            </label>
          </div>
        )}

        {!canEdit && (
          <div className="result-summary">
            <strong>{Math.round(total)}%</strong>

            <span>
              {t("totalWeighted")} ·{" "}
              {total >= passMark
                ? t("passingRequirementMet")
                : t("needsRemediation")}{" "}
              · Attempts min {attempts.length ? Math.min(...attempts) : 0}% · max{" "}
              {attempts.length ? Math.max(...attempts) : 0}% · avg{" "}
              {Math.round(average)}%
            </span>
          </div>
        )}

        {visibleMarks.length ? (
          visibleMarks.map((mark) => (
            <div className="result-row" key={resultId(mark)}>
              <div>
                <strong>{mark.subject}</strong>

                <small>
                  {mark.student} · {mark.assessmentId || "Assessment"} ·{" "}
                  {effectiveScore(mark)}% · {mark.weighting || 100}% weighting ·
                  Passing requirement: {markThreshold(mark)}%
                </small>

                <small className="warning-text">
                  {effectiveScore(mark) < markThreshold(mark)
                    ? `R · Below the ${markThreshold(
                      mark,
                    )}% passing requirement — remediation will be scheduled.`
                    : `Passing requirement met at ${markThreshold(mark)}%.`}
                </small>

                {!canEdit && (
                  <small>
                    Published {mark.publishedAt || "locally"} · Previous result
                    history is retained
                  </small>
                )}

                {canEdit &&
                  effectiveScore(mark) < markThreshold(mark) && (
                    <div className="remediation-fields">
                      <label>
                        Remediation date
                        <input
                          type="date"
                          value={mark.remediation?.date || ""}
                          onChange={(e) =>
                            updateRemediation(mark, "date", e.target.value)
                          }
                        />
                      </label>

                      <label>
                        Time
                        <input
                          type="time"
                          value={mark.remediation?.time || ""}
                          onChange={(e) =>
                            updateRemediation(mark, "time", e.target.value)
                          }
                        />
                      </label>

                      <label>
                        Attempts
                        <input
                          type="number"
                          min="0"
                          value={mark.remediation?.count || 0}
                          onChange={(e) =>
                            updateRemediation(mark, "count", e.target.value)
                          }
                        />
                      </label>

                      <label>
                        Remediation mark
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={mark.remediation?.score || ""}
                          onChange={(e) =>
                            updateRemediation(mark, "score", e.target.value)
                          }
                        />
                      </label>

                      <button
                        className="secondary"
                        onClick={() =>
                          updateRemediation(
                            mark,
                            "completed",
                            !mark.remediation?.completed,
                          )
                        }
                      >
                        {mark.remediation?.completed
                          ? "Remediated"
                          : "Mark remediated"}
                      </button>
                    </div>
                  )}
              </div>

              {editingScore === resultId(mark) ? (
                <input
                  className="inline-input score-editor"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={mark.score}
                  onBlur={(e) => {
                    updateScore(mark, e.target.value);
                    setEditingScore(null);
                    notify(`Corrected locked result for ${mark.student}.`);
                  }}
                  autoFocus
                />
              ) : (
                <b className="grade">
                  {gradeFor(effectiveScore(mark), markThreshold(mark))}
                </b>
              )}

              {canEdit && (
                <div className="workflow">
                  <span
                    className={`status status-${(
                      mark.status || "Published"
                    ).toLowerCase()}`}
                  >
                    {mark.status || "Published"}
                  </span>

                  {mark.status !== "Locked" && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          transition(mark, e.target.value);
                        }
                      }}
                    >
                      <option value="">
                        {`Move to ${nextStatusOptions[mark.status || "Published"]?.[0] ||
                          "next stage"
                          }…`}
                      </option>

                      {(
                        nextStatusOptions[mark.status || "Published"] || []
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}

                  {mark.status === "Locked" && (
                    <button
                      className="text-button"
                      onClick={() => setEditingScore(resultId(mark))}
                    >
                      Correct score
                    </button>
                  )}

                  <button
                    className="text-button danger"
                    onClick={() => deleteMark(mark)}
                  >
                    {t("delete")}
                  </button>
                </div>
              )}

              {editing === resultId(mark) ? (
                <input
                  className="inline-input"
                  value={mark.feedback || ""}
                  onChange={(e) => update(mark, e.target.value)}
                  onBlur={() => {
                    setEditing(null);
                    notify(`Feedback changed for ${mark.student}.`);
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="feedback"
                  onClick={() =>
                    canEdit && setEditing(resultId(mark))
                  }
                >
                  {mark.feedback ||
                    (canEdit ? "Click to add feedback" : "No feedback yet")}
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="muted">
            {canEdit ? "No marks have been imported yet." : t("noRecords")}
          </p>
        )}
      </section>
    </>
  );

}

function CsvUploads({ setNotice, marks, setMarks, accounts, passMark }) {
  const [file, setFile] = useState(null);
  const [createAssessments, setCreateAssessments] = useState(false);
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
      form.append("createAssessments", String(createAssessments));
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
  return <section className="panel upload-panel"><p className="eyebrow">Main admin workspace</p><h3>Bulk CSV marks upload</h3><p className="muted">Required columns: studentId, assessmentId, mark. The complete file is validated before any marks are stored.</p><label className="file-drop">Choose marks CSV<input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0])} /></label>{file && <p className="muted">{file.name} ready for validation.</p>}<label className="checkbox-line"><input type="checkbox" checked={createAssessments} onChange={(e) => setCreateAssessments(e.target.checked)} />Create missing assessments <small className="small-print">Leave this off so a typo in the assessmentId column is reported instead of quietly creating a new assessment.</small></label><button className="primary" disabled={!file} onClick={upload}>Validate and upload</button><div className="export-tools"><a className="secondary" href={csvDownloadUrl("/admin/marks.csv")} download="marks.csv">Download marks CSV</a><label>Student rows<select value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option value={30}>30</option><option value={50}>50</option><option value={75}>75</option><option value={100}>100</option></select></label><a className="secondary" href={csvDownloadUrl(`/admin/students.csv?limit=${limit}`)} download={`students-${limit}.csv`}>Download {limit} students</a></div></section>;
}

const MARK_STATUSES = ["Draft", "Submitted", "Approved", "Published", "Locked"];

function SQLiteData({ data, connected }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const marks = data?.marks || [];
  // Counts come from the unfiltered set so the chips still show the shape of the whole table
  // while a filter is applied.
  const statusCounts = MARK_STATUSES.reduce((totals, status) => ({ ...totals, [status]: marks.filter((mark) => mark.status === status).length }), {});
  const term = search.trim().toLowerCase();
  const visible = marks.filter((mark) => {
    if (statusFilter !== "all" && mark.status !== statusFilter) return false;
    if (!term) return true;
    return [mark.student, mark.studentId, mark.assessmentId, mark.status].some((field) => String(field || "").toLowerCase().includes(term));
  });
  if (!connected || !data) return <section className="panel"><p className="eyebrow">SQLite data</p><h3>Waiting for the local API</h3><p className="muted">Start the backend with <code>cd backend; npm start</code>, then sign in again or wait for the next sync.</p></section>;
  return <><section className="stats"><div className="stat-card"><small>SQLite users</small><strong>{data.users.length}</strong></div><div className="stat-card"><small>SQLite marks</small><strong>{data.marks.length}</strong></div><div className="stat-card"><small>Assessments</small><strong>{data.assessments.length}</strong></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Live database view</p><h3>Marks stored on localhost:5000</h3></div><span className="count">Updated {new Date(data.updatedAt).toLocaleTimeString()}</span></div>
    <div className="filter-bar">
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, ID, assessment or status…" aria-label="Search the stored marks" />
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by workflow status">
        <option value="all">All statuses ({marks.length})</option>
        {MARK_STATUSES.map((status) => <option key={status} value={status}>{status} ({statusCounts[status]})</option>)}
      </select>
      {(statusFilter !== "all" || term) && <button className="link-button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button>}
    </div>
    <p className="muted small-print">Showing {visible.length} of {marks.length} stored mark(s). Filter by <strong>Locked</strong> to review the results that are sealed against edits, or by <strong>Draft</strong>/<strong>Submitted</strong> to find marks still moving through the workflow.</p>
    {marks.length === 0 ? <p className="muted">No marks have been imported yet.</p> : visible.length === 0 ? <p className="muted">No stored marks match this search or status filter.</p> : <div className="data-table"><div className="data-row data-head"><b>Student</b><b>Assessment</b><b>Mark</b><b>Status</b></div>{visible.map((mark) => <div className="data-row" key={mark.id}><span>{mark.student} ({mark.studentId})</span><span>{mark.assessmentId}</span><span>{mark.mark}%</span><span className={`status status-${mark.status.toLowerCase()}`}>{mark.status}</span></div>)}</div>}
  </section></>;
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
  const enroll = async (event) => {
    event.preventDefault();
    setError("");

    const name = studentName.trim();
    const username = temporaryUsername.trim().toLowerCase();
    const password = "Welcome123!";
    const normalizedId = studentId.trim();
    const yearLevel = 1;

    if (!name || !username || !normalizedId || !selected) {
      setError("Complete all required learner fields.");
      return;
    }

    if (
      accounts.some(
        (account) =>
          account.studentId?.toLowerCase() ===
          normalizedId.toLowerCase()
      )
    ) {
      setError("That student ID is already registered.");
      return;
    }

    if (
      accounts.some(
        (account) =>
          account.username.toLowerCase() === username
      )
    ) {
      setError("That username is already in use.");
      return;
    }

    try {
      const created = await apiRequest("/admin/accounts/student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          password,
          studentId: normalizedId,
          course: selected,
          yearLevel,
        }),
      });

      setAccounts((currentAccounts) => [
        ...currentAccounts,
        created,
      ]);

      setStudentName("");
      setStudentId("");
      setStudentEmail("");
      setTemporaryUsername("");
      setSelected("");
      setError("");

      window.dispatchEvent(
        new Event("portal-sync-now")
      );

      notify(
        `Student account created for ${created.name}.`
      );
    } catch (error) {
      setError(
        error.message || "Could not create the student account."
      );
    }
  };
  const saveMyCourse = async (event) => {
    event.preventDefault();

    if (!myCourse) {
      notify("Choose a course before saving.");
      return;
    }

    setSaving(true);

    try {
      const updated = await apiRequest(
        "/api/accounts/course",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            course: myCourse,
            yearLevel: Number(myYear),
          }),
        }
      );

      const updatedUser = {
        ...user,
        course: updated.course,
        yearLevel: updated.yearLevel,
      };

      setUser(updatedUser);

      setAccounts((currentAccounts) =>
        currentAccounts.map((account) =>
          account.id === user.id
            ? {
              ...account,
              course: updated.course,
              yearLevel: updated.yearLevel,
            }
            : account
        )
      );

      window.dispatchEvent(
        new Event("portal-sync-now")
      );

      notify(
        `Course saved: ${updated.course}, year ${updated.yearLevel}.`
      );
    } catch (error) {
      notify(
        `Could not save your course: ${error.message}`
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="two-col">
      <section className="panel">
        <p className="eyebrow">Course catalogue</p>
        <h3>Available pathways</h3>

        {courses.map(([name, requirement], index) => (
          <div className="list-row" key={name}>
            <div>
              <strong>{name}</strong>
              <small>Entry requirements: {requirement}</small>
            </div>

            {canManage && (
              <button
                className="secondary"
                onClick={() => setSelected(name)}
              >
                Select
              </button>
            )}

            {canManage && index >= COURSES.length && (
              <button
                className="text-button danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove ${name} from the course catalogue?`,
                    )
                  ) {
                    removeCourse(name);
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </section>

      {user.role === "student" && (
        <form className="panel form-panel" onSubmit={saveMyCourse}>
          <p className="eyebrow">Your enrolment</p>
          <h3>Choose your course and year</h3>

          <p className="muted">
            This is saved to{" "}
            {apiConnected
              ? "the local SQLite database"
              : "your browser (offline mode)"}
            and will still be there after you refresh or sign in again.
          </p>

          <label>
            Course
            <select
              required
              value={myCourse}
              onChange={(e) => setMyCourse(e.target.value)}
            >
              <option value="">Choose your course</option>

              {courses.map(([name]) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>

          <label>
            Year of study
            <select
              value={myYear}
              onChange={(e) => setMyYear(Number(e.target.value))}
            >
              <option value={1}>1st year</option>
              <option value={2}>2nd year</option>
              <option value={3}>3rd year</option>
              <option value={4}>4th year</option>
              <option value={5}>5th year</option>
              <option value={6}>6th year</option>
            </select>
          </label>

          <button
            className="primary"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save my course"}
          </button>
        </form>
      )}

      {user.role !== "student" && (
        <form className="panel form-panel" onSubmit={enroll}>
          <p className="eyebrow">Learner details</p>
          <h3>Register or assign a learner</h3>

          <label>
            Full name
            <input
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="New learner name"
            />
          </label>

          <label>
            Student ID
            <input
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="STU-002"
            />
          </label>

          <label>
            Temporary username
            <input
              required
              value={temporaryUsername}
              onChange={(e) => setTemporaryUsername(e.target.value)}
              placeholder="learner.temp"
            />
          </label>

          <label>
            Trusted email
            <input
              required
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="learner@example.com"
            />
          </label>

          <label>
            Course
            <select
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a course</option>

              {courses.map(([name]) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>

          {error && <p className="error">{error}</p>}

          <button className="primary" type="submit">
            Create learner profile
          </button>

          <p className="muted">
            Temporary username and password:{" "}
            <strong>
              {temporaryUsername || "chosen username"} / Welcome123!
            </strong>
            . The learner can change them after signing in. Stored locally in
            browser storage.
          </p>
        </form>
      )}
    </div>
  );

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

// End-of-term / end-of-semester reporting. Staff generate a printable report card per learner,
// and both staff and learners can see who the institution's top achievers were for the term.
// Everything is derived locally from the marks already stored in SQLite — no extra endpoint and
// no external service — so it works the same offline as it does when the API is connected.
function TermReport({ marks, accounts, user, passMark, institution, notify }) {
  const canManage = user.role !== "student";
  const [studentId, setStudentId] = useState(canManage ? "" : user.studentId || "");
  const [term, setTerm] = useState("all");
  const [topCount, setTopCount] = useState(5);

  // Only Published/Locked marks count towards a report or the leaderboard, so a half-finished
  // Draft/Submitted mark can never leak into a report card or change someone's ranking.
  const releasable = marks.filter((mark) => ["Published", "Locked"].includes(mark.status || "Published"));
  const inTerm = (mark) => term === "all" || (mark.publishedAt || "").startsWith(term);
  const scoped = releasable.filter(inTerm);
  const terms = [...new Set(releasable.map((mark) => (mark.publishedAt || "").slice(0, 4)).filter(Boolean))].sort().reverse();

  const scoreOf = (mark) => Number(mark.remediation?.score ?? mark.score ?? 0);
  // Weighted average per learner: each mark contributes in proportion to its weighting, which is
  // how a real term average is built (a 100%-weighted exam should outweigh a 10% quiz).
  const averageFor = (id) => {
    const own = scoped.filter((mark) => mark.studentId === id);
    const weight = own.reduce((sum, mark) => sum + Number(mark.weighting || 100), 0);
    return weight ? own.reduce((sum, mark) => sum + scoreOf(mark) * Number(mark.weighting || 100), 0) / weight : null;
  };
  const studentIds = [...new Set(scoped.map((mark) => mark.studentId))];
  const leaderboard = studentIds
    .map((id) => { const account = accounts.find((a) => a.studentId === id); return { studentId: id, name: account?.name || scoped.find((m) => m.studentId === id)?.student || id, course: account?.course || "—", yearLevel: account?.yearLevel || null, average: averageFor(id) }; })
    .filter((entry) => entry.average !== null)
    .sort((a, b) => b.average - a.average);
  const topAchievers = leaderboard.slice(0, topCount);

  const selected = accounts.find((account) => account.studentId === studentId);
  const ownMarks = scoped.filter((mark) => mark.studentId === studentId);
  const ownAverage = averageFor(studentId);
  const ownRank = leaderboard.findIndex((entry) => entry.studentId === studentId);

  const printReport = () => {
    if (!studentId || !ownMarks.length) { notify("Choose a learner who has published marks for this term first."); return; }
    const today = new Date().toLocaleDateString();
    // Marks that arrive from the SQLite sync carry no pre-computed letter grade, so printing
    // `mark.grade` alone left the Grade column as "—" on every synced row. Derive it the same way
    // the results table and the result-summary printer already do.
    const gradeOf = (mark) => mark.grade || gradeFor(scoreOf(mark), Number(mark.passingMark ?? passMark));
    const rows = ownMarks.map((mark) => `<tr><td>${mark.subject}</td><td>${mark.assessmentId || "N/A"}</td><td>${scoreOf(mark)}%</td><td>${mark.weighting || 100}%</td><td>${gradeOf(mark)}</td><td>${scoreOf(mark) >= Number(mark.passingMark ?? passMark) ? "Passed" : "Remediation required"}</td><td>${mark.publishedAt || "—"}</td></tr>`).join("");
    const topRows = topAchievers.map((entry, index) => `<tr><td>${index + 1}</td><td>${entry.studentId}</td><td>${entry.name}</td><td>${entry.course}</td><td>${Math.round(entry.average)}%</td></tr>`).join("");
    const window_ = window.open("", "_blank", "width=900,height=700");
    if (!window_) { notify("Please allow pop-ups to print or save the term report as a PDF."); return; }
    window_.document.write(`<!DOCTYPE html><html><head><title>End of term report</title><style>
      body{font-family:Arial,sans-serif;color:#17211f;padding:32px}
      h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin-top:26px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;border:1.5px solid #7d918c}
      th,td{border:1px solid #7d918c;padding:7px 9px;text-align:left}
      th{background:#0f766e;color:#fff;border-color:#0f766e}tr:nth-child(even){background:#f4f8f6}
      tbody tr:last-child td{border-bottom:1.5px solid #7d918c}
      .summary{margin-top:14px;padding:12px;background:#f1f6f4;border-radius:8px;font-size:13px}
      @media print{button{display:none}}
    </style></head><body>
      <h1>${institution || "Meridian Learning Hub"} — End of ${term === "all" ? "year" : term} report</h1>
      <p><strong>Student ID:</strong> ${selected?.studentId || studentId} &nbsp; <strong>Full name:</strong> ${selected?.name || "—"} &nbsp; <strong>Course:</strong> ${selected?.course || "—"} &nbsp; <strong>Year of study:</strong> ${selected?.yearLevel || "—"} &nbsp; <strong>Issued:</strong> ${today}</p>
      <h2>Subjects and assessments</h2>
      <table><thead><tr><th>Subject</th><th>Assessment</th><th>Score</th><th>Weighting</th><th>Grade</th><th>Outcome</th><th>Published</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="summary"><strong>Weighted term average: ${Math.round(ownAverage)}%</strong> &nbsp;·&nbsp; Passing requirement: ${passMark}% &nbsp;·&nbsp; ${ownAverage >= passMark ? "Progressed — passing requirement met." : "Remediation required — below the passing requirement."} &nbsp;·&nbsp; Position: ${ownRank + 1} of ${leaderboard.length}</div>
      <h2>Top ${topAchievers.length} achievers — whole institution</h2>
      <table><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Course</th><th>Average</th></tr></thead><tbody>${topRows}</tbody></table>
      <p style="margin-top:24px;font-size:11px;color:#72807d">Issued locally by ${institution || "Meridian Learning Hub"} from published and locked marks only. Draft, submitted and approved marks are excluded.</p>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;">Print / Save as PDF</button>
    </body></html>`);
    window_.document.close();
  };

  return <>
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">End of term</p><h3>{canManage ? "Build a term or semester report" : "Your term report"}</h3></div><span className="count">{scoped.length} released marks</span></div>
      <p className="muted">Reports are built only from marks that have reached <strong>Published</strong> or <strong>Locked</strong>, so incomplete marking can never appear on a report card.</p>
      <div className="filter-bar">
        {canManage && <select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Choose a learner…</option>{[...leaderboard].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.studentId})</option>)}</select>}
        <select value={term} onChange={(e) => setTerm(e.target.value)}><option value="all">All terms / whole year</option>{terms.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        <button className="primary" onClick={printReport}>Print report card</button>
      </div>
      {studentId && ownMarks.length > 0 ? <>
        <div className="result-summary"><strong>{Math.round(ownAverage)}%</strong><span>Weighted average · {ownAverage >= passMark ? "Progressed — passing requirement met" : "Remediation required"} · Position {ownRank + 1} of {leaderboard.length} · {ownMarks.length} assessment(s)</span></div>
        <div className="table-scroll"><table className="data-table ruled-table"><thead><tr><th>Subject</th><th>Assessment</th><th>Score</th><th>Weighting</th><th>Grade</th><th>Outcome</th><th>Published</th></tr></thead><tbody>
          {ownMarks.map((mark) => <tr key={`${mark.studentId}-${mark.assessmentId}-${mark.subject}`}>
            <td>{mark.subject}</td><td>{mark.assessmentId || "N/A"}</td><td>{scoreOf(mark)}%</td><td>{mark.weighting || 100}%</td><td>{mark.grade || gradeFor(scoreOf(mark), Number(mark.passingMark ?? passMark))}</td>
            <td className={scoreOf(mark) >= Number(mark.passingMark ?? passMark) ? "" : "warning-text"}>{scoreOf(mark) >= Number(mark.passingMark ?? passMark) ? "Passed" : "Remediation required"}</td>
            <td>{mark.publishedAt || "—"}</td>
          </tr>)}
        </tbody></table></div>
      </> : <p className="muted">{canManage ? "Choose a learner above to preview and print their end-of-term report." : "No published marks are available for this term yet."}</p>}
    </section>
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Recognition</p><h3>Top achievers — whole institution</h3></div><label className="pass-rule">Show top <input type="number" min="5" max="10" value={topCount} onChange={(e) => setTopCount(Math.min(10, Math.max(5, Number(e.target.value) || 5)))} /></label></div>
      <div className="table-scroll"><table className="data-table ruled-table"><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Course</th><th>Year</th><th>Weighted average</th></tr></thead><tbody>
        {topAchievers.length === 0 && <tr><td colSpan={6} className="muted">No published marks are available for this term yet.</td></tr>}
        {topAchievers.map((entry, index) => <tr key={entry.studentId} className={entry.studentId === user.studentId ? "own-row" : ""}>
          <td><strong>{index + 1}</strong></td><td>{entry.studentId}</td><td>{entry.name}</td><td>{entry.course}</td><td>{entry.yearLevel ? `Year ${entry.yearLevel}` : "—"}</td><td>{Math.round(entry.average)}%</td>
        </tr>)}
      </tbody></table></div>
    </section>
  </>;
}

// ---------------------------------------------------------------------------------------------
// Marking room
//
// A dedicated workspace where staff open a learner's submission side by side with the assignment
// memo and score it criterion by criterion. Three deliberate design choices make it safe to use on
// a flaky connection, which is the whole point of the page:
//
//  1. **Autosave.** Every keystroke writes the in-progress marking sheet to localStorage under
//     `portal-marking-drafts`. Closing the tab, refreshing, a crash, or losing power all leave the
//     draft intact — reopening the same submission restores exactly where the marker left off.
//     Drafts are keyed per submission AND per marker, so two admins marking the same class never
//     overwrite each other's in-progress work.
//  2. **Offline marking.** Nothing in the scoring flow touches the network. Staff can mark an
//     entire class with the API down; the memo, the submission file and the draft are all local.
//  3. **Release outbox.** "Release to student" writes the finished mark to an outbox
//     (`portal-marking-outbox`) first, then tries to send it. If the API is down the entry simply
//     stays queued and is retried automatically the moment the connection returns. The backend
//     endpoint is idempotent by (studentId, assessmentId), so a retry after a lost response can
//     never double-post a mark.
// ---------------------------------------------------------------------------------------------
function MarkingRoom({ user, assignments, submissions, setSubmissions, memos, setMemos, passMark, apiConnected, notify, setNotice }) {
  const draftsKey = "portal-marking-drafts";
  const outboxKey = "portal-marking-outbox";
  const [drafts, setDrafts] = useState(() => load(draftsKey, {}));
  const [outbox, setOutbox] = useState(() => load(outboxKey, []));
  const [openKey, setOpenKey] = useState("");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [editingMemo, setEditingMemo] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  const queue = Object.entries(submissions).map(([key, submission]) => ({ ...submission, key }));
  const draftFor = (key) => drafts[`${key}::${user.username}`];
  const stateOf = (item) => item.mark !== undefined ? "released" : draftFor(item.key) ? "in-progress" : "not-started";
  const courses = [...new Set(queue.map((item) => item.course).filter(Boolean))].sort();
  const visible = queue.filter((item) => {
    const term = search.trim().toLowerCase();
    if (term && ![item.studentName, item.studentId, item.assignmentTitle, item.subject].some((field) => String(field || "").toLowerCase().includes(term))) return false;
    if (courseFilter !== "all" && item.course !== courseFilter) return false;
    if (stateFilter !== "all" && stateOf(item) !== stateFilter) return false;
    return true;
  }).sort((a, b) => String(a.studentName).localeCompare(String(b.studentName)));

  const open = queue.find((item) => item.key === openKey);
  const memo = open ? memos[open.assignmentId] : null;
  const memoTotal = memo ? memo.criteria.reduce((sum, criterion) => sum + Number(criterion.max || 0), 0) : 0;
  const draft = open ? draftFor(open.key) : null;
  const scores = draft?.scores || {};
  const scored = memo ? memo.criteria.reduce((sum, criterion) => sum + (Number(scores[criterion.id]) || 0), 0) : 0;
  // Criteria maxima rarely sum to exactly 100, so the released percentage is always normalised
  // against the memo total. That keeps a 40-mark memo and a 100-mark memo directly comparable.
  const percentage = memoTotal ? Math.round((scored / memoTotal) * 100) : 0;
  // Nothing scored yet must not read as a real "0%" — that looks like a fail rather than an
  // untouched sheet, which is alarming when a marker first opens a submission.
  const started = memo ? memo.criteria.some((criterion) => scores[criterion.id] !== undefined && scores[criterion.id] !== "") : false;

  const saveDraft = (patch) => {
    if (!open) return;
    const key = `${open.key}::${user.username}`;
    const next = { ...drafts, [key]: { ...(drafts[key] || { scores: {}, comment: "" }), ...patch, submissionKey: open.key, marker: user.username, savedAt: new Date().toISOString() } };
    setDrafts(next); localStorage.setItem(draftsKey, JSON.stringify(next)); setSavedAt(new Date().toLocaleTimeString());
  };
  const setScore = (criterion, value) => {
    const raw = value === "" ? "" : Number(value);
    if (raw !== "" && (!Number.isFinite(raw) || raw < 0 || raw > Number(criterion.max))) return setNotice(`"${criterion.label}" is out of ${criterion.max} — enter a score between 0 and ${criterion.max}.`);
    saveDraft({ scores: { ...scores, [criterion.id]: raw } });
  };
  const discardDraft = () => {
    if (!open || !window.confirm("Discard this saved marking sheet? The scores and comments you entered will be lost.")) return;
    const next = { ...drafts }; delete next[`${open.key}::${user.username}`];
    setDrafts(next); localStorage.setItem(draftsKey, JSON.stringify(next)); setNotice("Marking sheet discarded.");
  };

  // The outbox is the only thing that talks to the network. Entries are appended when a mark is
  // released and removed only once the API confirms; anything left over is retried on reconnect.
  // An entry is only dropped when the server gives a definitive rejection (a 4xx that will never
  // succeed on retry, e.g. the mark was already published with a different score, or the student
  // no longer exists). Transient failures — API down, session expired, network glitch — keep the
  // entry queued forever, because losing a marker's completed work is far worse than a stale queue.
  const flushOutbox = useCallback(async (queued) => {
    if (!queued.length) return;
    const remaining = []; const rejected = [];
    for (const entry of queued) {
      try { await apiRequest("/admin/marking/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry.payload) }); }
      catch (error) {
        const permanent = /already published or locked|No student exists|must be a number|are required/i.test(error.message);
        if (permanent) rejected.push({ ...entry, lastError: error.message });
        else remaining.push({ ...entry, attempts: (entry.attempts || 0) + 1, lastError: error.message });
      }
    }
    setOutbox(remaining); localStorage.setItem(outboxKey, JSON.stringify(remaining));
    const synced = queued.length - remaining.length - rejected.length;
    if (synced > 0) setNotice(`${synced} marked result(s) synced to SQLite.`);
    if (rejected.length) notify(`${rejected.length} queued mark(s) could not be saved to SQLite and were removed from the queue: ${rejected.map((entry) => `${entry.student} — ${entry.lastError}`).join("; ")}`);
  }, [setNotice, notify]);
  useEffect(() => {
    if (!apiConnected || !outbox.length) return;
    flushOutbox(outbox);
  }, [apiConnected, outbox, flushOutbox]);

  const release = () => {
    if (!open || !memo) return;
    const missing = memo.criteria.filter((criterion) => scores[criterion.id] === undefined || scores[criterion.id] === "");
    if (missing.length) return setNotice(`Score every criterion before releasing — still open: ${missing.map((criterion) => criterion.label).join(", ")}.`);
    // Re-marking an already-released submission is allowed for staff, but it is a deliberate,
    // reason-stamped correction rather than a silent overwrite: the API refuses to change a
    // published or locked score unless `override` is set, which it audits as marks_edited.
    const isRemark = open.mark !== undefined;
    let reason = "";
    if (isRemark) {
      if (Number(open.mark) === Number(percentage) && !window.confirm(`${open.studentName} already has ${open.mark}% for this assignment and your sheet gives the same score. Re-release it anyway?`)) return;
      if (Number(open.mark) !== Number(percentage)) {
        // The reason lives in the autosaved draft rather than a window.prompt(), so it survives a
        // refresh or an offline session and cannot be lost between typing it and releasing.
        reason = String(draft?.remarkReason || "").trim();
        if (!reason) return setNotice(`Give a reason for changing ${open.studentName}'s mark from ${open.mark}% to ${percentage}% before re-releasing it. The reason is recorded in the audit log.`);
        if (!window.confirm(`Re-mark ${open.studentName} from ${open.mark}% to ${percentage}%?\n\nReason: ${reason}\n\nThe learner will be told their mark changed.`)) return;
      }
    } else if (!window.confirm(`Release ${percentage}% to ${open.studentName}? They will be able to see this mark and your feedback.`)) return;
    const publishedAt = new Date().toISOString();
    const breakdown = memo.criteria.map((criterion) => `${criterion.label}: ${scores[criterion.id]}/${criterion.max}`).join(" · ");
    const feedback = `${breakdown}${draft?.comment ? ` — ${draft.comment}` : ""}`;
    const previousMark = open.mark;
    setSubmissions({ ...submissions, [open.key]: { ...open, mark: percentage, markPublishedAt: publishedAt, markedBy: user.name, markBreakdown: breakdown, markComment: draft?.comment || "", remediationOpen: percentage < passMark, remarkedAt: isRemark ? publishedAt : open.remarkedAt, remarkReason: isRemark && reason ? reason : open.remarkReason } });
    const entry = { id: `${open.key}-${Date.now()}`, queuedAt: publishedAt, marker: user.username, student: open.studentName, payload: { studentId: open.studentId, assessmentId: `ASSIGN-${open.assignmentId}`, assessmentName: open.assignmentTitle, mark: percentage, status: "Published", override: isRemark, reason: reason || undefined } };
    const nextOutbox = [...outbox, entry];
    setOutbox(nextOutbox); localStorage.setItem(outboxKey, JSON.stringify(nextOutbox));
    const nextDrafts = { ...drafts }; delete nextDrafts[`${open.key}::${user.username}`];
    setDrafts(nextDrafts); localStorage.setItem(draftsKey, JSON.stringify(nextDrafts));
    notify(`${open.studentName} — ${open.assignmentTitle}: ${percentage}%.${isRemark && previousMark !== undefined ? ` This mark was re-marked from ${previousMark}%${reason ? ` (${reason})` : ""}.` : ""} ${percentage < passMark ? `Below the ${passMark}% requirement, so remediation has been opened.` : "Passing requirement met."} ${feedback}`);
    setNotice(`${isRemark ? "Re-marked" : "Released"} ${percentage}% ${isRemark && previousMark !== undefined ? `(was ${previousMark}%) ` : ""}to ${open.studentName}.${apiConnected ? "" : " You are offline, so it is queued and will sync automatically when the API returns."}`);
    setOpenKey("");
  };

  const saveMemo = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const criteria = memo.criteria.map((criterion, index) => ({ ...criterion, label: String(data.get(`label-${index}`) || criterion.label).trim(), max: Number(data.get(`max-${index}`)) || criterion.max, guidance: String(data.get(`guidance-${index}`) || "").trim() }));
    const newLabel = String(data.get("new-label") || "").trim();
    if (newLabel) criteria.push({ id: `c${Date.now()}`, label: newLabel, max: Number(data.get("new-max")) || 10, guidance: String(data.get("new-guidance") || "").trim() });
    setMemos({ ...memos, [open.assignmentId]: { ...memo, criteria } });
    setEditingMemo(false); setNotice("Memo saved. It applies to every learner on this assignment.");
  };
  const createMemo = () => {
    if (!open) return;
    setMemos({ ...memos, [open.assignmentId]: { assignmentId: open.assignmentId, title: `${open.assignmentTitle} memo`, criteria: [{ id: "c1", label: "Meets the brief", max: 100, guidance: "" }] } });
    setEditingMemo(true);
  };

  const deleteMemo = () => {
    if (!open) return;
    if (window.confirm(`Delete memo for "${open.assignmentTitle}"?`)) {
      const { [open.assignmentId]: _, ...remainingMemos } = memos;
      setMemos(remainingMemos);
      setEditingMemo(false);
      setNotice("Memo deleted.");
    }
  }

  const counts = { total: queue.length, released: queue.filter((item) => stateOf(item) === "released").length, inProgress: queue.filter((item) => stateOf(item) === "in-progress").length };

  return <>
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Marking room</p><h3>Mark submissions against the memo</h3></div><span className="count">{counts.total} in queue · {counts.inProgress} in progress · {counts.released} released</span></div>
      <p className="muted">Your scores and comments autosave to this browser as you type, so nothing is lost if you close the tab, refresh, or lose your connection. Marking works completely offline — released marks are queued and sync to SQLite on their own once the API is back.</p>
      {outbox.length > 0 && <div className="outbox-banner" role="status"><strong>{outbox.length} released mark(s) waiting to sync.</strong> They are saved safely in this browser and will be sent automatically when the local API is reachable. {outbox[0].lastError && <span className="small-print"> Last attempt: {outbox[0].lastError}.</span>} {apiConnected && <button className="link-button" onClick={() => flushOutbox(outbox)}>Retry now</button>}</div>}
      <div className="filter-bar">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, ID or assignment…" aria-label="Search the marking queue" />
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter by course"><option value="all">All courses</option>{courses.map((course) => <option key={course} value={course}>{course}</option>)}</select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Filter by marking state"><option value="all">All states</option><option value="not-started">Not started</option><option value="in-progress">In progress (saved)</option><option value="released">Released</option></select>
      </div>
      <div className="table-scroll"><table className="data-table ruled-table"><thead><tr><th>Student</th><th>Student ID</th><th>Assignment</th><th>Course</th><th>Year</th><th>Submitted</th><th>State</th><th>Mark</th><th>Action</th></tr></thead><tbody>
        {visible.length === 0 && <tr><td colSpan={9} className="muted">No submissions match this search or filter.</td></tr>}
        {visible.map((item) => {
          const state = stateOf(item); const saved = draftFor(item.key); return <tr key={item.key} className={openKey === item.key ? "own-row" : ""}>
            <td>{item.studentName}</td><td>{item.studentId}</td><td>{item.assignmentTitle}</td><td>{item.course || "—"}</td><td>{item.yearLevel ? `Year ${item.yearLevel}` : "—"}</td>
            <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : "—"}</td>
            <td><span className={`state-chip state-${state}`}>{state === "released" ? "Released" : state === "in-progress" ? `Saved ${saved?.savedAt ? new Date(saved.savedAt).toLocaleTimeString() : ""}` : "Not started"}</span></td>
            <td>{item.mark !== undefined ? `${item.mark}%` : "—"}</td>
            <td><button className="link-button" onClick={() => { setOpenKey(openKey === item.key ? "" : item.key); setEditingMemo(false); }}>{openKey === item.key ? "Close" : state === "released" ? "Re-mark" : state === "in-progress" ? "Resume marking" : "Open"}</button></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>

    {open && <section className="panel wide-panel">
      <div className="panel-heading"><div><p className="eyebrow">Marking {open.studentName} · {open.studentId}</p><h3>{open.assignmentTitle}</h3></div><span className="count">{savedAt ? `Autosaved ${savedAt}` : draft ? `Restored a saved sheet from ${new Date(draft.savedAt).toLocaleString()}` : "Nothing entered yet"}</span></div>
      <div className="marking-grid">
        <div className="marking-pane">
          <h4>The learner's submission</h4>
          <p className="muted">{open.fileName || "No file recorded"}{open.submittedAt ? ` · submitted ${new Date(open.submittedAt).toLocaleString()}` : ""}</p>
          {open.fileUrl
            ? <a className="button-link" href={open.fileUrl} download={open.fileName}>Download submission</a>
            : <p className="warning-text">No file is attached to this submission.</p>}
          {open.remediationFileUrl && <a className="button-link" href={open.remediationFileUrl} download={open.remediationFileName}>Download remediation attempt</a>}
          <p className="muted small-print">Downloading works offline: the file is already held in this browser, so you can open the ZIP, read it alongside the memo and mark it with no connection at all.</p>
          <h4>Memo</h4>
          {!memo && <><p className="warning-text">No memo exists for this assignment yet.</p><button className="primary" onClick={createMemo}>Create a memo</button></>}
          {memo && !editingMemo && <>
            <p className="muted">{memo.title} · {memoTotal} marks total. Each criterion and its guidance is shown on the marking sheet beside this, so you can read the learner's file here and score it there.</p>
            <button className="link-button" onClick={() => setEditingMemo(true)}>Edit memo</button>
          </>}
          {memo && editingMemo && <form className="memo-form" onSubmit={saveMemo}>
            {memo.criteria.map((criterion, index) => <div key={criterion.id} className="memo-edit-row">
              <label>Criterion<input name={`label-${index}`} defaultValue={criterion.label} required /></label>
              <label>Out of<input name={`max-${index}`} type="number" min="1" max="100" defaultValue={criterion.max} required /></label>
              <label>Marking guidance<input name={`guidance-${index}`} defaultValue={criterion.guidance || ""} /></label>
            </div>)}
            <div className="memo-edit-row">
              <label>Add criterion<input name="new-label" placeholder="Optional new criterion" /></label>
              <label>Out of<input name="new-max" type="number" min="1" max="100" defaultValue={10} /></label>
              <label>Marking guidance<input name="new-guidance" /></label>
            </div>
            <div className="form-actions"><button className="primary" type="submit">Save memo</button><button type="button" className="link-button" onClick={() => setEditingMemo(false)}>Cancel</button><button type="button" className="link-button" onClick={deleteMemo} style={{ color: "red" }}>Delete memo</button></div>
          </form>}
        </div>
        <div className="marking-pane">
          <h4>Your marking sheet</h4>
          {open.mark !== undefined && <p className="warning-text">This submission was already released at <strong>{open.mark}%</strong>{open.markPublishedAt ? ` on ${new Date(open.markPublishedAt).toLocaleString()}` : ""}{open.markedBy ? ` by ${open.markedBy}` : ""}. You can re-mark it — you will be asked for a reason, the learner is notified that the mark changed, and the correction is written to the audit log.</p>}
          {!memo ? <p className="muted">Create a memo first so there is a rubric to mark against.</p> : <>
            <div className="table-scroll"><table className="data-table ruled-table"><thead><tr><th>Criterion</th><th>Out of</th><th>Score</th></tr></thead><tbody>
              {memo.criteria.map((criterion) => <tr key={criterion.id}>
                <td title={criterion.guidance || ""}>{criterion.label}{criterion.guidance && <div className="small-print muted">{criterion.guidance}</div>}</td><td>{criterion.max}</td>
                <td><input className="score-input" type="number" min="0" max={criterion.max} value={scores[criterion.id] ?? ""} onChange={(e) => setScore(criterion, e.target.value)} aria-label={`Score for ${criterion.label}`} /></td>
              </tr>)}
              <tr className="total-row"><td><strong>Total</strong></td><td><strong>{memoTotal}</strong></td><td><strong>{scored}</strong></td></tr>
            </tbody></table></div>
            <div className={`result-summary${started && percentage < passMark ? " below" : ""}`}><strong>{started ? `${percentage}%` : "—"}</strong><span>{!started ? "Enter a score for each criterion to see the running percentage." : percentage >= passMark ? `Passing requirement of ${passMark}% met.` : `Below the ${passMark}% requirement — releasing this will open remediation for the learner.`}</span></div>
            <label className="stacked">Feedback for the learner<textarea rows={4} value={draft?.comment || ""} onChange={(e) => saveDraft({ comment: e.target.value })} placeholder="Explain where marks were earned and what to improve…" /></label>{open.mark !== undefined && <label className="stacked">Reason for changing this released mark<input value={draft?.remarkReason || ""} onChange={(e) => saveDraft({ remarkReason: e.target.value })} placeholder="e.g. Criterion 3 was added up wrong" /><small className="small-print">Required only when the new percentage differs from the {open.mark}% already released. It is saved to the audit log with the previous mark.</small></label>}
            <div className="form-actions">
              <button className="primary" onClick={release}>{open.mark !== undefined ? "Re-mark and re-release" : "Release to student"}</button>
              <button className="link-button" onClick={discardDraft} disabled={!draft}>Discard sheet</button>
            </div>
            <p className="muted small-print">Releasing saves the mark in this browser immediately and queues it for SQLite. {apiConnected ? "The API is connected, so it will sync straight away." : "You are offline — it will sync by itself once the local API is running again."}</p>
          </>}
        </div>
      </div>
    </section>}
  </>;
}

function Design({ theme, setTheme }) {
  const [draft, setDraft] = useState(theme);
  useEffect(() => setDraft(theme), [theme]);
  const save = (e) => { e.preventDefault(); setTheme(draft); };
  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Stored as a base64 data URL in localStorage (via the theme object) so the showcase image
    // stays fully local — no cloud upload or external service is used.
    const reader = new FileReader();
    reader.onload = () => setDraft({ ...draft, backgroundImage: reader.result });
    reader.readAsDataURL(file);
  };
  return <form className="panel design-panel" onSubmit={save}><p className="eyebrow">Brand settings</p><h3>Make the portal yours</h3><p className="muted">Personalise the local workspace for your institution. Changes apply to every account in this browser.</p><label>Institution name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Accent colour<div className="color-control"><input type="color" value={draft.accent} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} /><code>{draft.accent}</code></div></label><label>Background colour<div className="color-control"><input type="color" value={draft.background || "#f7faf8"} onChange={(e) => setDraft({ ...draft, background: e.target.value })} /><code>{draft.background || "#f7faf8"}</code></div></label><label>Text colour<div className="color-control"><input type="color" value={draft.ink || "#17211f"} onChange={(e) => setDraft({ ...draft, ink: e.target.value })} /><code>{draft.ink || "#17211f"}</code></div></label><label>Portal font<select value={draft.font || "DM Sans"} onChange={(e) => setDraft({ ...draft, font: e.target.value })}><option>DM Sans</option><option>Georgia</option><option>Arial</option><option>Verdana</option></select></label><label>School showcase image<input type="file" accept="image/*" onChange={onImage} /><small className="muted">Shown on the sign-in page banner to showcase your campus. Stored locally in this browser only.</small></label>{draft.backgroundImage && <div className="showcase-preview"><img src={draft.backgroundImage} alt="School showcase preview" /><button type="button" className="text-button danger" onClick={() => setDraft({ ...draft, backgroundImage: "" })}>Remove image</button></div>}<button className="primary" type="submit">Save design</button></form>;
}

export default App;
