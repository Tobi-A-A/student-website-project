
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import "./App.css";

const APP_NAME = "Meridian Learning Hub";
const API_BASE = (process.env.REACT_APP_API_BASE || (
  typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? ""
    : "http://localhost:5000"
)).replace(/\/+$/, "");
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
  en: { Overview: "Overview", Accounts: "Accounts", "CSV uploads": "CSV uploads", "SQLite data": "SQLite data", Courses: "Courses", Calendar: "Calendar", Assignments: "Assignments", Marking: "Marking", "Tests & Exams": "Tests & Exams", Results: "Results", Reports: "Reports", Profile: "Profile", Design: "Design", signOut: "Sign out", darkMode: "Dark mode", lightMode: "Light mode", language: "Language", welcomeBack: "Welcome back", signInSubtitle: "Sign in to your local campus workspace.", username: "Username", password: "Password", signIn: "Sign in", createAccount: "New student? Create an account", forgotPassword: "Forgot password?", demoAccounts: "Demo accounts", downloadSummary: "Download summary", addMark: "Add mark", delete: "Delete", search: "Search", noRecords: "No records yet", passingRequirementMet: "Passing requirement met", needsRemediation: "Needs remediation", totalWeighted: "Total weighted percentage" },
  af: { Overview: "Oorsig", Accounts: "Rekeninge", "CSV uploads": "CSV-oplaaie", "SQLite data": "SQLite-data", Courses: "Kursusse", Calendar: "Calendar", Assignments: "Opdragte", Marking: "Nasien", "Tests & Exams": "Toetse en Eksamens", Results: "Uitslae", Reports: "Verslae", Profile: "Profiel", Design: "Ontwerp", signOut: "Teken uit", darkMode: "Donker modus", lightMode: "Lig modus", language: "Taal", welcomeBack: "Welkom terug", signInSubtitle: "Teken in by jou plaaslike kampuswerkarea.", username: "Gebruikersnaam", password: "Wagwoord", signIn: "Teken in", createAccount: "Nuwe student? Skep 'n rekening", forgotPassword: "Wagwoord vergeet?", demoAccounts: "Demo-rekeninge", downloadSummary: "Laai opsomming af", addMark: "Voeg punt by", delete: "Verwyder", search: "Soek", noRecords: "Nog geen rekords nie", passingRequirementMet: "Slaagvereiste bereik", needsRemediation: "Regstelling nodig", totalWeighted: "Totale geweegde persentasie" },
  zu: { Overview: "Uhlolojikelele", Accounts: "Ama-akhawunti", "CSV uploads": "Ukulayisha kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Calendar: "Calendar", Assignments: "Imisebenzi", Marking: "Ukumaka", "Tests & Exams": "Ukuhlolwa Nezivivinyo", Results: "Imiphumela", Reports: "Imibiko", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Imodi emnyama", lightMode: "Imodi ekhanyayo", language: "Ulimi", welcomeBack: "Siyakwamukela futhi", signInSubtitle: "Ngena ku-workspace yakho yasekhampasini yendawo.", username: "Igama lokungena", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omusha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe iphasiwedi?", demoAccounts: "Ama-akhawunti wedemo", downloadSummary: "Landa isifinyezo", addMark: "Faka amamaki", delete: "Susa", search: "Sesha", noRecords: "Awukho amarekhodi okwamanje", passingRequirementMet: "Isidingo sokuphumelela sitholiwe", needsRemediation: "Kudinga ukulungiswa", totalWeighted: "Iphesenti eliphelele elicaliwe" },
  xh: { Overview: "Ushwankathelo", Accounts: "Iiakhawunti", "CSV uploads": "Ukulayishwa kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Calendar: "Calendar", Assignments: "Imisebenzi", Marking: "Ukumakisha", "Tests & Exams": "Uvavanyo Neeviwo", Results: "Iziphumo", Reports: "Iingxelo", Profile: "Iprofayile", Design: "Uyilo", signOut: "Phuma", darkMode: "Imowudi emnyama", lightMode: "Imowudi ekhanyayo", language: "Ulwimi", welcomeBack: "Wamkelekile kwakhona", signInSubtitle: "Ngena kwindawo yakho yokusebenzela yekhampasi yasekuhlaleni.", username: "Igama lomsebenzisi", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omtsha? Yenza iakhawunti", forgotPassword: "Ulibele iphasiwedi?", demoAccounts: "Iiakhawunti zedemo", downloadSummary: "Khuphela isishwankathelo", addMark: "Yongeza amanqaku", delete: "Cima", search: "Khangela", noRecords: "Akukabi kho iirekhodi", passingRequirementMet: "Imfuneko yokuphumelela ifikeleliwe", needsRemediation: "Kufuneka ulungiso", totalWeighted: "Ipesenti epheleleyo elilinganisiweyo" },
  nso: { Overview: "Tshedimošo", Accounts: "Diakhaonto", "CSV uploads": "Go rolelwa CSV", "SQLite data": "Tshedimošo ya SQLite", Courses: "Dithuto", Calendar: "Calendar", Assignments: "Mešomo", Marking: "Go swaya", "Tests & Exams": "Diteko le Ditlhahlobo", Results: "Dipoelo", Reports: "Dipego", Profile: "Boitsebišo", Design: "Moralo", signOut: "Tšwa", darkMode: "Mokgwa o mo nsu", lightMode: "Mokgwa o mo seetšeng", language: "Leleme", welcomeBack: "O amogetšwe gape", signInSubtitle: "Tsena lefelong la gago la mošomo la khamphase.", username: "Leina la modiriši", password: "Phasewete", signIn: "Tsena", createAccount: "Moithuti yo mofsa? Dira akhaonto", forgotPassword: "O lebetše phasewete?", demoAccounts: "Diakhaonto tša mokgwa", downloadSummary: "Laotša kakaretšo", addMark: "Oketša matshwao", delete: "Phumola", search: "Nyakisiša", noRecords: "Ga go na direkoto go fihla ga bjale", passingRequirementMet: "Nyakwa ya go phasa e fihleletšwe", needsRemediation: "E nyaka phošollo", totalWeighted: "Diperesente ka moka tše lekantšwego" },
  tn: { Overview: "Tshedimosetso", Accounts: "Diakhaonto", "CSV uploads": "Go tsenya CSV", "SQLite data": "Data ya SQLite", Courses: "Dithuto", Calendar: "Calendar", Assignments: "Ditiro", Marking: "Go tshwaya", "Tests & Exams": "Diteko le Ditlhatlhobo", Results: "Dipholo", Reports: "Dipego", Profile: "Porofaele", Design: "Moralo", signOut: "Tswa", darkMode: "Mokgwa o lefifi", lightMode: "Mokgwa o lesedi", language: "Puo", welcomeBack: "O amogetswe gape", signInSubtitle: "Tsena mo lefelong la gago la tiro la khampase.", username: "Leina la modirisi", password: "Phasewete", signIn: "Tsena", createAccount: "Moithuti yo mosha? Dira akhaonto", forgotPassword: "O lebetse phasewete?", demoAccounts: "Diakhaonto tsa demo", downloadSummary: "Latsholola kakaretso", addMark: "Oketsa matshwao", delete: "Phimola", search: "Batla", noRecords: "Ga go na direkoto jaanong", passingRequirementMet: "Tlhokego ya go fenya e fitlheletswe", needsRemediation: "E tlhoka phekolo", totalWeighted: "Diperesente tsotlhe tse lekantsweng" },
  st: { Overview: "Tlhahlobo", Accounts: "Diakhaonto", "CSV uploads": "Ho kenya CSV", "SQLite data": "Data ea SQLite", Courses: "Lithuto", Calendar: "Calendar", Assignments: "Mesebetsi", Marking: "Ho tshwaya", "Tests & Exams": "Litlhahlobo le Litekanyetso", Results: "Liphetho", Reports: "Ditlaleho", Profile: "Boemo", Design: "Moralo", signOut: "Tsoa", darkMode: "Mokgwa o lefifi", lightMode: "Mokgwa o leseli", language: "Puo", welcomeBack: "Rea u amohela hape", signInSubtitle: "Kena sebakeng sa hao sa mosebetsi sa khamphase.", username: "Lebitso la mosebedisi", password: "Phasewete", signIn: "Kena", createAccount: "Seithuti se secha? Theha akhaonto", forgotPassword: "U lebetse phasewete?", demoAccounts: "Diakhaonto tsa demo", downloadSummary: "Khoasolla kakaretso", addMark: "Kenya matshwao", delete: "Hlakola", search: "Batla", noRecords: "Ha ho na direkoto ho fihlela joale", passingRequirementMet: "Tlhoko ea ho feta e fihletsoe", needsRemediation: "E hloka tokiso", totalWeighted: "Diperesente tsohle tse lekantsweng" },
  ts: { Overview: "Xikombiso", Accounts: "Tiakhawunti", "CSV uploads": "Ku layisha CSV", "SQLite data": "Data ya SQLite", Courses: "Swidyondzo", Calendar: "Calendar", Assignments: "Mintirho", Marking: "Ku maka", "Tests & Exams": "Mikambo na Swikambelo", Results: "Vuyelo", Reports: "Swiviko", Profile: "Phurofayili", Design: "Muxaka", signOut: "Huma", darkMode: "Muxaka wa munyama", lightMode: "Muxaka wa vona", language: "Ririmi", welcomeBack: "U amukeriwile nakambe", signInSubtitle: "Nghena endhawini ya wena ya ntirho ya khampasi.", username: "Vito ro tirhisa", password: "Phasiwedi", signIn: "Nghena", createAccount: "Xichudeni lexintshwa? Endla akhawunti", forgotPassword: "U rivele phasiwedi?", demoAccounts: "Tiakhawunti ta demo", downloadSummary: "Layishela kutlangela", addMark: "Engetela mamaki", delete: "Susa", search: "Lavisisa", noRecords: "A ku na tirikhodo hi sweswi", passingRequirementMet: "Xilaveko xo hlula xi fikeriwile", needsRemediation: "Yi lava ku lulamisiwa", totalWeighted: "Phesenta hinkwayo leyi pimiweke" },
  ss: { Overview: "Simo", Accounts: "Ema-akhawunti", "CSV uploads": "Kulayisha kwe-CSV", "SQLite data": "Imininingwane ye-SQLite", Courses: "Tifundvo", Calendar: "Calendar", Assignments: "Imisebenti", Marking: "Kumaka", "Tests & Exams": "Kuhlolwa Netivivinyo", Results: "Imiphumela", Reports: "Imibiko", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Simo lesimnyama", lightMode: "Simo lesikhanyako", language: "Lulwimi", welcomeBack: "Uyemukelwa futsi", signInSubtitle: "Ngena endzaweni yakho yekusebenta yelikhampasi.", username: "Ligama lekungena", password: "Liphasiwedi", signIn: "Ngena", createAccount: "Umfundzi lomusha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe liphasiwedi?", demoAccounts: "Ema-akhawunti wedemo", downloadSummary: "Dawnlowda sifinyeto", addMark: "Faka emamaki", delete: "Sula", search: "Sesha", noRecords: "Awukho emarekhodi kwamanje", passingRequirementMet: "Sidzingo sekuphumelela sifinyelelwe", needsRemediation: "Kudzinga kulungiswa", totalWeighted: "Liphesenti lelphelele lelicaliwe" },
  ve: { Overview: "Musumbulusi", Accounts: "Diakhaundi", "CSV uploads": "U layisha CSV", "SQLite data": "Data ya SQLite", Courses: "Zwifundwa", Calendar: "Calendar", Assignments: "Mishumo", Marking: "U maka", "Tests & Exams": "Milingo na Mibvunzo", Results: "Mvelelo", Reports: "Mivhigo", Profile: "Purofaili", Design: "Muhangwa", signOut: "Bva", darkMode: "Muhangwa mutswu", lightMode: "Muhangwa mutshena", language: "Luambo", welcomeBack: "Ro U tanganedza hafhu", signInSubtitle: "Dzhenani fhethu havho ha mushumo wa khemphasi.", username: "Dzina la mushumisi", password: "Phasiwede", signIn: "Dzhena", createAccount: "Mugudiswa muswa? Ita akhaundi", forgotPassword: "Wo hangwa phasiwede?", demoAccounts: "Diakhaundi dza demo", downloadSummary: "Dzhenisa tshedziwedzo", addMark: "Engedza mimarikho", delete: "Vhulaha", search: "Ṱoḓa", noRecords: "A huna rekhodo zwazwino", passingRequirementMet: "Ṱhoḓea ya u phasa yo swikelwa", needsRemediation: "I ṱoḓa u lugiswa", totalWeighted: "Phesenthe yoṱhe yo linganyiswaho" },
  nr: { Overview: "Ukubuka konke", Accounts: "Ama-akhawunti", "CSV uploads": "Ukulayisha kwe-CSV", "SQLite data": "Idatha ye-SQLite", Courses: "Izifundo", Calendar: "Calendar", Assignments: "Imisebenzi", Marking: "Ukumaka", "Tests & Exams": "Iimvivinyo Neenzivinyo", Results: "Imiphumela", Reports: "Imibiko", Profile: "Iphrofayela", Design: "Umklamo", signOut: "Phuma", darkMode: "Imodi emnyama", lightMode: "Imodi ekhanyako", language: "Ilimi", welcomeBack: "Siyakwemukela godu", signInSubtitle: "Ngena esikhundleni sakho semsebenzi wekhampasi lendawo.", username: "Ibizo lokungena", password: "Iphasiwedi", signIn: "Ngena", createAccount: "Umfundi omutjha? Yakha i-akhawunti", forgotPassword: "Ukhohlwe iphasiwedi?", demoAccounts: "Ama-akhawunti wedemo", downloadSummary: "Layisha ihlathululo", addMark: "Engeza amanqaku", delete: "Susa", search: "Funa", noRecords: "Akukho amarekhodi okwamanje", passingRequirementMet: "Isidingo sokuphumelela sifinyelelwe", needsRemediation: "Kudinga ukulungiswa", totalWeighted: "Iphesenti epheleleko elilinganisiweko" },
};
// Language is scoped per signed-in account (falling back to a "guest" bucket pre-login) so one
// person switching their language can never change what another person — signed in on the same
// browser at a different time, or reviewed by an admin — sees. It is intentionally NOT part of
// the SQLite sync payload or any shared localStorage key.
const languageKeyFor = (username) => `portal-language-${username ? username.toLowerCase() : "guest"}`;
const translate = (language, key) => (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.en[key] || key;


const DAILY_QUOTES = ["Small steps become remarkable progress.", "Your consistency today shapes your success tomorrow.", "Learn boldly, reflect often, and keep moving forward."];

// Test schedules travel as local wall-clock strings ("YYYY-MM-DDTHH:mm") because that is what
// <input type="datetime-local"> emits and requires. Legacy rows can hold SQLite's
// CURRENT_TIMESTAMP default ("YYYY-MM-DD HH:MM:SS", which is UTC) or a Z-suffixed ISO string;
// the first is silently read as local time and the second is rejected by the input, leaving it
// blank. Normalising on the way in keeps the editor and the saved value in agreement.
const pad2 = (value) => String(value).padStart(2, "0");
const toLocalWallClock = (date) => (date instanceof Date && !Number.isNaN(date.getTime()))
  ? `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  : "";
const normalizeLocalDateTime = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw);
  if (match) {
    // A space separator only ever comes from SQLite's CURRENT_TIMESTAMP, which is UTC.
    if (raw.includes(" ")) return toLocalWallClock(new Date(`${match[1]}T${match[2]}:00Z`));
    return `${match[1]}T${match[2]}`;
  }
  return toLocalWallClock(new Date(raw));
};
const testStartDate = (test) => {
  const normalized = normalizeLocalDateTime(test?.startAt || test?.start);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
// '2099-12-31' is the tests table's column default, not a date anyone chooses. Treating it as
// a real deadline let it round-trip out of the editor and back into the database as though it
// had been set deliberately, so surface it as "not set" and make staff choose a closing date.
const TEST_DUE_SENTINEL = "2099-12-31";
const testDueDate = (test) => {
  const day = String(test?.dueDate || test?.due || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day === TEST_DUE_SENTINEL) return null;
  const parsed = new Date(`${day}T${String(test?.dueTime || "23:59").slice(0, 5)}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const TEST_STATUS_LABELS = { open: "Open now", scheduled: "Scheduled", closed: "Closed", invalid: "Needs attention" };
const formatDurationBetween = (from, to) => {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days && hours) return `${days}d ${hours}h`;
  if (days) return `${days} day${days === 1 ? "" : "s"}`;
  return `${hours}h`;
};
const assignmentStartOf = (assignment) => assignment?.start ? new Date(assignment.start) : null;
const assignmentDeadlineOf = (assignment) => assignment?.due
  ? new Date(`${assignment.due}T${assignment.dueTime || "23:59"}`)
  : null;
// Single source of truth for the submission window, mirroring assignmentWindowState() on the
// backend. Overview previously had its own copy that ignored openOverride, so an assignment
// reopened by staff still showed as "Completed" there while the assignments page showed it open.
const assignmentOpen = (assignment) => {
  if (!assignment || assignment.completed) return false;
  if (assignment.openOverride) return true;
  const now = new Date();
  const start = assignmentStartOf(assignment);
  const deadline = assignmentDeadlineOf(assignment);
  if (start && !Number.isNaN(start.getTime()) && now < start) return false;
  if (deadline && !Number.isNaN(deadline.getTime()) && now > deadline) return false;
  return true;
};
const assignmentNotOpenYet = (assignment) => {
  const start = assignmentStartOf(assignment);
  return !assignment?.openOverride && !assignment?.completed
    && Boolean(start && !Number.isNaN(start.getTime()) && start > new Date());
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

const SEED_DEMO = process.env.REACT_APP_SEED_DEMO === "true";
const seed = (demoValue, emptyValue) => (SEED_DEMO ? demoValue : emptyValue);
const MEMOS_MIGRATED_KEY = "portal-memos-migrated-v1";
const memosFromRows = (rows) => Object.fromEntries((rows || []).map((row) => [row.assignmentId, row]));

// Accounts are deliberately never seeded in the browser. Authentication comes from the SQLite
// API in both demo and clean modes, so credentials do not exist in the frontend bundle.
//
// Clean-install browser data is cleared once per build revision instead of being deleted every
// time `load()` is called. The old implementation removed portal data on every refresh tick,
// which meant legitimate local edits could never persist in clean mode.
const CLEAN_INSTALL_BROWSER_VERSION = "v10.1";
function initialiseCleanInstallBrowserStorage() {
  if (SEED_DEMO || typeof window === "undefined") return;
  const marker = `portal-clean-install-${CLEAN_INSTALL_BROWSER_VERSION}`;
  try {
    if (localStorage.getItem(marker) === "done") return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith("portal-"))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(marker, "done");
  } catch (_) {
    // Browser storage may be disabled; the SQLite API remains authoritative when available.
  }
}
initialiseCleanInstallBrowserStorage();

// The browser caches portal data (memos, notifications, marking drafts and the queue of marks
// waiting to sync) in localStorage. When the API is switched to a different installation — the
// real data, the demo or a clean install — that cache belongs to the previous database. Each
// installation's cache is parked under its id and restored when you switch back, so queued marks
// are never sent to the wrong database and are never lost either.
const INSTALL_ID_KEY = "portal-install-id";
const INSTALL_ARCHIVE_PREFIX = "portal-install-archive-";
const BROWSER_PREFERENCE_KEYS = [/^portal-dark-mode$/, /^portal-language-/, /^portal-clean-install-/];
function adoptInstallation(installId) {
  if (!installId || typeof window === "undefined") return false;
  try {
    const previous = localStorage.getItem(INSTALL_ID_KEY);
    if (previous === installId) return false;
    localStorage.setItem(INSTALL_ID_KEY, installId);
    if (!previous) return false;
    const scoped = Object.keys(localStorage).filter((key) => key.startsWith("portal-")
      && key !== INSTALL_ID_KEY
      && !key.startsWith(INSTALL_ARCHIVE_PREFIX)
      && !BROWSER_PREFERENCE_KEYS.some((pattern) => pattern.test(key)));
    const parked = Object.fromEntries(scoped.map((key) => [key, localStorage.getItem(key)]));
    if (scoped.length) localStorage.setItem(`${INSTALL_ARCHIVE_PREFIX}${previous}`, JSON.stringify(parked));
    scoped.forEach((key) => localStorage.removeItem(key));
    const restore = JSON.parse(localStorage.getItem(`${INSTALL_ARCHIVE_PREFIX}${installId}`) || "{}");
    Object.entries(restore).forEach(([key, value]) => localStorage.setItem(key, value));
    localStorage.removeItem(`${INSTALL_ARCHIVE_PREFIX}${installId}`);
    return true;
  } catch (_) {
    return false;
  }
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

let portalOperationSequence = 0;
let portalNotificationSequence = 0;
function portalBusyStart(message) {
  if (typeof window === "undefined") return null;
  const id = `${Date.now()}-${++portalOperationSequence}`;
  window.dispatchEvent(new CustomEvent("portal-operation", { detail: { type: "start", id, message } }));
  return id;
}
function portalBusyEnd(id) {
  if (!id || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("portal-operation", { detail: { type: "end", id } }));
}

const STUDENT_CARD_FIELDS = [
  ["name", "Full name"],
  ["studentId", "Student ID"],
  ["course", "Course"],
  ["yearLevel", "Year of study"],
  ["academicYear", "Academic year"],
];
const STUDENT_CARD_LAYOUT = {
  photoColumnMm: 28,
  photoWidthMm: 22,
  photoHeightMm: 27,
  accentHeightMm: 8,
  mainPaddingTopMm: 11,
  mainPaddingRightMm: 5,
  mainPaddingBottomMm: 4,
  mainPaddingLeftMm: 5,
  fieldLabelMm: 22,
  fieldGapMm: 2,
};
const DEFAULT_STUDENT_CARD_TEMPLATE = {
  name: "Standard Student Card",
  title: "Student Card",
  subtitle: "Learner identification",
  widthMm: 85.6,
  heightMm: 54,
  background: "#ffffff",
  accent: "#0f766e",
  textColor: "#17211f",
  showPhoto: true,
  fields: ["name", "studentId", "course", "yearLevel", "academicYear"],
};
const STUDENT_CARD_BASE_WIDTH_MM = 85.6;
const STUDENT_CARD_BASE_HEIGHT_MM = 54;
const CSS_PX_PER_MM = 96 / 25.4;
const studentCardContentScale = (widthMm, heightMm) => Math.min(1, Number(widthMm) / STUDENT_CARD_BASE_WIDTH_MM, Number(heightMm) / STUDENT_CARD_BASE_HEIGHT_MM);
const scaledStudentCardMm = (valueMm, scale) => `${(Number(valueMm) * scale).toFixed(3)}mm`;
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
}
function downloadText(content, filename, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function studentCardFieldValue(student, field) {
  if (field === "studentId") return student.studentId || "Not assigned";
  if (field === "yearLevel") return student.yearLevel ? `Year ${student.yearLevel}` : "Not assigned";
  if (field === "academicYear") return student.academicYear || new Date().getFullYear();
  return student[field] || "Not assigned";
}
function buildStudentCardHtml(student, template, institution, photoDataUrl = "") {
  return buildStudentCardsHtml([{ student, photoDataUrl }], template, institution);
}
// One document for one or many learners. Each card is its own printed page (the @page size is the
// card size), so a batch prints straight onto card stock or into a multi-page PDF.
function buildStudentCardsHtml(entries, template, institution, heading = "") {
  const widthMm = Number(template.widthMm || DEFAULT_STUDENT_CARD_TEMPLATE.widthMm);
  const heightMm = Number(template.heightMm || DEFAULT_STUDENT_CARD_TEMPLATE.heightMm);
  const safeWidthMm = Number.isFinite(widthMm) ? Math.min(200, Math.max(40, widthMm)) : DEFAULT_STUDENT_CARD_TEMPLATE.widthMm;
  const safeHeightMm = Number.isFinite(heightMm) ? Math.min(200, Math.max(40, heightMm)) : DEFAULT_STUDENT_CARD_TEMPLATE.heightMm;
  const cardContentScale = studentCardContentScale(safeWidthMm, safeHeightMm);
  const photoColumnMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.photoColumnMm, cardContentScale);
  const photoWidthMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.photoWidthMm, cardContentScale);
  const photoHeightMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.photoHeightMm, cardContentScale);
  const accentHeightMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.accentHeightMm, cardContentScale);
  const mainPaddingTopMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.mainPaddingTopMm, cardContentScale);
  const mainPaddingRightMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.mainPaddingRightMm, cardContentScale);
  const mainPaddingBottomMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.mainPaddingBottomMm, cardContentScale);
  const mainPaddingLeftMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.mainPaddingLeftMm, cardContentScale);
  const fieldLabelMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.fieldLabelMm, cardContentScale);
  const fieldGapMm = scaledStudentCardMm(STUDENT_CARD_LAYOUT.fieldGapMm, cardContentScale);
  const photoPadRightMm = scaledStudentCardMm(2, cardContentScale);
  const titleMarginMm = scaledStudentCardMm(1, cardContentScale);
  const subtitleMarginMm = scaledStudentCardMm(2, cardContentScale);
  const fieldMarginMm = scaledStudentCardMm(1, cardContentScale);
  const footerBottomMm = scaledStudentCardMm(2, cardContentScale);
  const footerRightMm = scaledStudentCardMm(4, cardContentScale);
  const cardRadiusMm = scaledStudentCardMm(4, cardContentScale);
  const photoRadiusMm = scaledStudentCardMm(2, cardContentScale);
  const titleFontPt = `${(12 * cardContentScale).toFixed(2)}pt`;
  const subtitleFontPt = `${(7 * cardContentScale).toFixed(2)}pt`;
  const fieldFontPt = `${(7 * cardContentScale).toFixed(2)}pt`;
  const placeholderFontPt = `${(8 * cardContentScale).toFixed(2)}pt`;
  const footerFontPt = `${(6 * cardContentScale).toFixed(2)}pt`;
  const fields = Array.isArray(template.fields) && template.fields.length ? template.fields : DEFAULT_STUDENT_CARD_TEMPLATE.fields;
  const renderCard = ({ student, photoDataUrl = "" }) => {
    const fieldHtml = fields.map((field) => {
      const label = STUDENT_CARD_FIELDS.find(([key]) => key === field)?.[1] || field;
      return `<div class="student-card-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(studentCardFieldValue(student, field))}</strong></div>`;
    }).join("");
    // Only image data: URLs are embedded, so a crafted value can never inject markup into the print window.
    const safePhoto = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(photoDataUrl) ? photoDataUrl : "";
    const photo = safePhoto ? `<img class="student-card-photo" src="${safePhoto}" alt="Student photo">` : `<div class="student-card-photo student-card-photo-placeholder">Photo</div>`;
    const photoColumn = template.showPhoto ? `<div class="student-card-photo-wrap">${photo}</div>` : "";
    return `<div class="student-card"><div class="student-card-accent"></div>${photoColumn}<div class="student-card-main"><p class="student-card-title">${escapeHtml(template.title || "Student Card")}</p><p class="student-card-subtitle">${escapeHtml(template.subtitle || "")}</p><div class="student-card-fields">${fieldHtml}</div></div><div class="student-card-footer">${escapeHtml(institution)}</div></div>`;
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
  
      <title>${escapeHtml(institution)} — ${escapeHtml(heading || template.title || "Student Card")}</title>
  
      <style>
          * {
              box-sizing: border-box;
          }
  
          html,
          body {
              margin: 0;
              padding: 0;
          }
  
          body {
              padding: 24px;
              font-family: Arial, sans-serif;
              background: #f2f5f3;
              color: ${escapeHtml(template.textColor || "#17211f")};
          }
  
          .student-card {
              --card-content-scale: ${cardContentScale.toFixed(4)};
  
              width: ${safeWidthMm}mm;
              height: ${safeHeightMm}mm;
  
              background: ${escapeHtml(template.background || "#fff")};
              border: 1px solid #cbd8d3;
              border-radius: ${cardRadiusMm};
  
              overflow: hidden;
              position: relative;
  
              display: grid;
              grid-template-columns: ${
                  template.showPhoto
                      ? `${photoColumnMm} 1fr`
                      : "1fr"
              };
  
              box-shadow: 0 3mm 8mm rgba(0, 0, 0, 0.08);
          }

          .student-card + .student-card {
              margin-top: 16px;
          }
  
          .student-card-accent {
              height: ${accentHeightMm};
  
              background: ${escapeHtml(
                  template.accent || "#0f766e"
              )};
  
              position: absolute;
              left: 0;
              right: 0;
              top: 0;
          }
  
          .student-card-main {
              padding:
                  ${mainPaddingTopMm}
                  ${mainPaddingRightMm}
                  ${mainPaddingBottomMm}
                  ${mainPaddingLeftMm};
  
              min-width: 0;
              min-height: 0;
              overflow: hidden;
          }
  
          .student-card-photo-wrap {
              padding:
                  ${mainPaddingTopMm}
                  ${photoPadRightMm}
                  ${mainPaddingBottomMm}
                  ${mainPaddingLeftMm};
  
              display: flex;
              align-items: flex-start;
              justify-content: center;
  
              min-width: 0;
              min-height: 0;
          }
  
          .student-card-photo {
              display: block;
  
              width: ${photoWidthMm};
              height: ${photoHeightMm};
  
              max-width: 100%;
              max-height: 100%;
  
              object-fit: cover;
  
              border-radius: ${photoRadiusMm};
              border: 1px solid #cbd8d3;
              background: #edf3f0;
          }
  
          .student-card-photo-placeholder {
              display: grid;
              place-items: center;
  
              font-size: ${placeholderFontPt};
              color: #71807b;
  
              text-align: center;
          }
  
          .student-card-title {
              font-size: ${titleFontPt};
              line-height: 1.15;
              font-weight: 700;
  
              margin: 0 0 ${titleMarginMm};
  
              overflow-wrap: anywhere;
          }
  
          .student-card-subtitle {
              font-size: ${subtitleFontPt};
              line-height: 1.2;
  
              margin: 0 0 ${subtitleMarginMm};
  
              color: #61716c;
  
              overflow-wrap: anywhere;
          }
  
          .student-card-fields {
              min-width: 0;
          }
  
          .student-card-field {
              display: grid;
  
              grid-template-columns:
                  ${fieldLabelMm}
                  minmax(0, 1fr);
  
              gap: ${fieldGapMm};
  
              margin: ${fieldMarginMm} 0;
  
              font-size: ${fieldFontPt};
              line-height: 1.2;
  
              min-width: 0;
          }
  
          .student-card-field span {
              color: #72817d;
  
              min-width: 0;
  
              overflow-wrap: anywhere;
          }
  
          .student-card-field strong {
              min-width: 0;
  
              overflow-wrap: anywhere;
              word-break: break-word;
          }
  
          .student-card-footer {
              position: absolute;
  
              bottom: ${footerBottomMm};
              right: ${footerRightMm};
  
              max-width: 65%;
  
              font-size: ${footerFontPt};
              line-height: 1.15;
  
              color: #7a8984;
  
              overflow-wrap: anywhere;
  
              text-align: right;
          }
  
          .print-page-heading {
              margin: 0 0 16px;
              font-size: 18px;
          }
  
          .print-controls {
              margin-top: 16px;
          }
  
          .print-controls button {
              font: inherit;
              padding: 8px 12px;
              cursor: pointer;
          }
  
          @media print {
  
              @page {
                  size: ${safeWidthMm}mm ${safeHeightMm}mm;
                  margin: 0;
              }
  
              html,
              body {
                  width: ${safeWidthMm}mm;
                  height: ${safeHeightMm}mm;
              }
  
              body {
                  padding: 0;
                  background: #fff;
              }
  
              .print-page-heading,
              .print-controls {
                  display: none;
              }
  
              .student-card {
                  box-shadow: none;
                  border-radius: 0;
                  break-after: page;
                  page-break-after: always;
              }

              .student-card + .student-card {
                  margin-top: 0;
              }

              .student-card:last-of-type {
                  break-after: auto;
                  page-break-after: auto;
              }
          }
      </style>
  </head>
  
  <body>
  
      <h2 class="print-page-heading">
          ${escapeHtml(institution)} —
          ${escapeHtml(heading || template.name || "Student Card Template")}
      </h2>
  
      ${entries.map(renderCard).join("\n")}
  
      <div class="print-controls">
  
          <button
              type="button"
              onclick="window.print()"
          >
              Print / Save as PDF
          </button>
  
      </div>
  
  </body>
  </html>
  `;
  
}


const normalizeRemediation = (item) => {
  if (!item) return null;
  return {
    ...item,
    date: item.remediationDate ?? item.date ?? "",
    time: item.remediationTime ?? item.time ?? "",
    count: Number(item.attempts ?? item.count ?? 0),
    score: item.remediationMark ?? item.score ?? "",
    completed: ["Completed", "Resolved"].includes(item.status),
  };
};

function testAttemptsFromRows(rows) {
  const next = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = `${row.testId}-${row.studentId}`;
    if (!next[key]) next[key] = [];
    next[key].push({
      testId: String(row.testId),
      studentId: row.studentId,
      studentName: row.studentName || "",
      course: row.course || "",
      yearLevel: row.yearLevel == null ? null : Number(row.yearLevel),
      attemptNumber: Number(row.attemptNumber),
      score: Number(row.score),
      correct: Number(row.correct || 0),
      total: Number(row.total || 0),
      earnedPoints: Number(row.earnedPoints ?? row.earned_points ?? 0),
      totalPoints: Number(row.totalPoints ?? row.total_points ?? row.total ?? 0),
      questionMarks: Array.isArray(row.questionMarks) ? row.questionMarks : [],
      answers: row.answers && typeof row.answers === "object" ? row.answers : {},
      essayAnswers: Array.isArray(row.essayAnswers) ? row.essayAnswers : [],
      reviewFeedback: row.reviewFeedback || "",
      questionFeedback: Array.isArray(row.questionFeedback) ? row.questionFeedback : [],
      questionSnapshot: Array.isArray(row.questionSnapshot) ? row.questionSnapshot : [],
      reviewedBy: row.reviewedBy || null,
      reviewedAt: row.reviewedAt || null,
      needsReview: Boolean(row.needsReview),
      isRemediation: Boolean(row.isRemediation),
      takenAt: row.takenAt || new Date().toISOString(),
      passed: row.passed == null ? null : Boolean(row.passed),
    });
  }
  Object.values(next).forEach((list) => list.sort((a, b) => a.attemptNumber - b.attemptNumber));
  return next;
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
  const [accounts, setAccounts] = useState(() => load("portal-accounts", []));
  const [assignments, setAssignments] = useState([]);
  const [marks, setMarks] = useState([]);
  const [theme, setTheme] = useState(() => {
    const saved = normalizeTheme(load("portal-theme", DEFAULT_THEME));
    if (saved.name === APP_NAME && load("portal-theme", DEFAULT_THEME)?.name === "Northstar Academy") localStorage.setItem("portal-theme", JSON.stringify(saved));
    return saved;
  });
  const [darkMode, setDarkMode] = useState(() => load("portal-dark-mode", false));
  const [notice, setNotice] = useState("");
  const [notifications, setNotifications] = useState(() => load("portal-notifications", []));
  const [busyOperations, setBusyOperations] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [passMark, setPassMark] = useState(() => load("portal-pass-mark", 60));
  const [welcome, setWelcome] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState("");
  const [sqliteData, setSqliteData] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [demoInstall, setDemoInstall] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [submissions, setSubmissions] = useState({});
  const [remediations, setRemediations] = useState(() => load("portal-remediations", []));
  const legacyCourseBackupRef = useRef(load("portal-courses", []));
  const [customCourses, setCustomCourses] = useState(() => load("portal-courses", []));
  const [publicCourses, setPublicCourses] = useState([]);
  const [catalogueConnected, setCatalogueConnected] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [teachingGroups, setTeachingGroups] = useState([]);
  const [allTeachingGroups, setAllTeachingGroups] = useState([]);
  const [courseGroups, setCourseGroups] = useState([]);
  const [supportTeam, setSupportTeam] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [tests, setTests] = useState([]);
  const [testAttempts, setTestAttempts] = useState({});
  const [memos, setMemos] = useState(() => load("portal-memos", seed(DEFAULT_MEMOS, {})));
  // Language is loaded fresh for whichever account is signed in (or "guest" on the login screen)
  // — see languageKeyFor's comment above. Re-reading it whenever `user` changes means switching
  // accounts in the same browser always picks up that account's own saved language rather than
  // leaking the previous user's choice.
  const [language, setLanguageState] = useState(() => load(languageKeyFor(null), "en"));
  useEffect(() => { setLanguageState(load(languageKeyFor(user?.username), "en")); }, [user?.username]);

  const notificationsRef = useRef(notifications);
  const userRef = useRef(user);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { userRef.current = user; }, [user]);
  const notify = useCallback((message) => {
    if (!message || !userRef.current?.username) return;
    const audience = userRef.current.username;
    const now = Date.now();
    const duplicate = notificationsRef.current.find((item) =>
      item.audience === audience &&
      item.message === message &&
      now - new Date(item.date || 0).getTime() < 10000
    );
    if (duplicate) return;
    const next = [{ id: `${now}-${++portalNotificationSequence}`, message, date: new Date(now).toISOString(), audience }, ...notificationsRef.current].slice(0, 100);
    notificationsRef.current = next;
    setNotifications(next);
    localStorage.setItem("portal-notifications", JSON.stringify(next));
    setNotice(message);
  }, []);
  const setLanguage = (code) => { setLanguageState(code); localStorage.setItem(languageKeyFor(user?.username), JSON.stringify(code)); };
  const t = (key) => translate(language, key);
  // `customCourses` is the SQLite-backed institutional catalogue returned by /api/courses.
  // Course selectors use this one live source of truth so newly created courses are immediately
  // available anywhere a course/year assignment is required.
  const courses = customCourses
    .filter((course) => course && course.name && course.active !== false)
    .map((course) => [course.name, course.requirement || "No entry requirement recorded."]);
  const apiConnectedRef = useRef(false);
  useEffect(() => { apiConnectedRef.current = apiConnected; }, [apiConnected]);
  // Only replaces state when the incoming value is actually different, so a matching
  // poll/refresh tick does not force every consumer of this data to re-render (which
  // previously caused the whole Results page to flicker on every 1s/5s sync).
  const setIfChanged = (setter) => (next) => setter((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 450); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    const handleOperation = (event) => {
      const detail = event.detail || {};
      if (detail.type === "start" && detail.id) {
        setBusyOperations((current) => [...current.filter((item) => item.id !== detail.id), { id: detail.id, message: detail.message || "Working…" }]);
      } else if (detail.type === "end" && detail.id) {
        setBusyOperations((current) => current.filter((item) => item.id !== detail.id));
      }
    };
    window.addEventListener("portal-operation", handleOperation);
    return () => window.removeEventListener("portal-operation", handleOperation);
  }, []);
  const busyMessage = busyOperations[busyOperations.length - 1]?.message || "";
  // Bootstrap the application in this order: initialise the database, check whether the
  // installation needs its first main administrator, and only then restore an existing session.
  // This prevents a brand-new installation from exposing student self-registration or local
  // demo fallbacks before the first administrator exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await apiRequest("/api/setup/status");
        if (cancelled) return;
        if (adoptInstallation(status.installId)) {
          // In-memory state was initialised from the previous installation's cache.
          window.location.reload();
          return;
        }
        setDemoInstall(Boolean(status.demo));
        setApiConnected(true);
        setSetupRequired(Boolean(status.setupRequired));
        setSetupChecked(true);

        if (status.setupRequired) return;

        try {
          const restored = await apiRequest("/api/accounts/me");
          if (!cancelled) {
            setUser(restored);
            setApiConnected(true);
          }
        } catch (_) {
          // No valid session (fresh browser, expired cookie, or signed-out user).
        }
      } catch (_) {
        // API unavailable: keep the login screen usable, but do not fall back to hard-coded accounts.
        if (!cancelled) {
          setApiConnected(false);
          setSetupRequired(false);
          setSetupChecked(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Course catalogue sync runs even on the login screen. That is important because a student
  // registering from a second browser must see a course that an administrator created elsewhere.
  useEffect(() => {
    let cancelled = false;
    const setPublicCoursesIfChanged = setIfChanged(setPublicCourses);

    const syncCourses = async () => {
      try {
        const response = await apiRequest("/api/courses");
        const rows = Array.isArray(response?.courses) ? response.courses : [];
        // Keep the same course shape used throughout the portal: [name, requirement].
        // The public API returns course objects, but the Login component and staff course
        // selectors consume tuple entries. Normalising here prevents destructuring runtime
        // errors such as "(destructured parameter) is not iterable" on the registration screen.
        const catalogueRows = rows
          .filter((course) => course && course.active !== false && String(course.name || "").trim())
          .map((course) => [
            String(course.name || "").trim(),
            String(course.requirement || "").trim(),
          ]);

        if (cancelled) return;
        setPublicCoursesIfChanged(catalogueRows);
        setCatalogueConnected(true);
      } catch (_) {
        setCatalogueConnected(false);
        // Registration requires a live course catalogue. The signed-in workspace has its own
        // authenticated SQLite sync and is unaffected when this public catalogue request fails.
      }
    };

    syncCourses();
    const timer = setInterval(syncCourses, 5000);
    const onSyncNow = () => syncCourses();
    window.addEventListener("portal-sync-now", onSyncNow);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("portal-sync-now", onSyncNow);
    };
  }, []);

  // Migrate legacy browser-only courses once. Older versions stored custom courses only in
  // localStorage, so moving them to SQLite here prevents an upgrade from silently losing them.
  const currentUserId = user?.id;
  const currentUserRole = user?.role;

  useEffect(() => {
    if (!currentUserId || currentUserRole === "student") return undefined;
    const migrationKey = "portal-course-sqlite-migration-v1";
    if (load(migrationKey, false)) return undefined;

    let cancelled = false;
    const migrate = async () => {
      const legacyCourses = legacyCourseBackupRef.current;
      if (!Array.isArray(legacyCourses) || legacyCourses.length === 0) {
        localStorage.setItem(migrationKey, JSON.stringify(true));
        return;
      }

      try {
        for (const course of legacyCourses) {
          const name = String(course?.name || "").trim();
          const requirement = String(course?.requirement || "").trim();
          if (!name || cancelled) continue;
          try {
            await apiRequest("/admin/courses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, requirement }),
            });
          } catch (error) {
            // Duplicate names are safe here: the canonical copy already exists in SQLite.
            if (!/already exists|duplicate/i.test(error.message || "")) throw error;
          }
        }
        if (!cancelled) {
          localStorage.setItem(migrationKey, JSON.stringify(true));
          window.dispatchEvent(new Event("portal-sync-now"));
        }
      } catch (error) {
        if (!cancelled) console.warn("Legacy course migration was not completed:", error.message);
      }
    };

    migrate();
    return () => { cancelled = true; };
  }, [currentUserId, currentUserRole]);

  useEffect(() => {
    // Database-backed academic records are intentionally excluded from this browser-storage
    // refresh. Restoring assignments, submissions, tests, attempts or memos from localStorage while
    // SQLite is connected created a second source of truth and could briefly reintroduce stale
    // or empty data every second. Only presentation-only legacy settings remain local here.
    const setThemeIfChanged = setIfChanged(setTheme);
    const refreshLocalWorkspace = () => {
      setThemeIfChanged(normalizeTheme(load("portal-theme", DEFAULT_THEME)));
    };
    const handleStorage = () => {
      refreshLocalWorkspace();
    };
    window.addEventListener("storage", handleStorage);
    const timer = setInterval(refreshLocalWorkspace, 1000);
    return () => { window.removeEventListener("storage", handleStorage); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const syncCalendar = async () => {
      try {
        const response = await apiRequest("/api/calendar");
        if (!cancelled) {
          setCalendarEventsIfChanged(response);
        }
      } catch (_) {
        // Calendar remains available from the last successful sync.
      }
    };
    const setCalendarEventsIfChanged = setIfChanged(setCalendarEvents);
    syncCalendar();
    const timer = setInterval(syncCalendar, 5000);
    const onSyncNow = () => syncCalendar();
    window.addEventListener("portal-sync-now", onSyncNow);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("portal-sync-now", onSyncNow);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    let syncInProgress = false;
    const setMarksIfChanged = setIfChanged(setMarks);
    const setRemediationsIfChanged = setIfChanged(setRemediations);
    const setAccountsIfChanged = setIfChanged(setAccounts);
    const setSqliteDataIfChanged = setIfChanged(setSqliteData);
    const setTeachingGroupsIfChanged = setIfChanged(setTeachingGroups);
    const setAllTeachingGroupsIfChanged = setIfChanged(setAllTeachingGroups);
    const setCourseGroupsIfChanged = setIfChanged(setCourseGroups);
    const setCustomCoursesIfChanged = setIfChanged(setCustomCourses);
    const setTestAttemptsIfChanged = setIfChanged(setTestAttempts);
    const setAssignmentsIfChanged = setIfChanged(setAssignments);
    const setSubmissionsIfChanged = setIfChanged(setSubmissions);
    const setTestsIfChanged = setIfChanged(setTests);
    const setSupportTeamIfChanged = setIfChanged(setSupportTeam);
    const setMemosIfChanged = setIfChanged(setMemos);
    // Memos used to exist only in localStorage. The first time a browser reaches the memo API it
    // uploads any rubric the server does not have yet, so nothing written before this change is
    // lost; afterwards SQLite is the only source of truth and localStorage is just an offline cache.
    const migrateLocalMemos = async (serverMemos, assignmentRows) => {
      if (localStorage.getItem(MEMOS_MIGRATED_KEY)) return false;
      const local = load("portal-memos", {});
      const activeIds = new Set((assignmentRows || []).map((row) => String(row.id)));
      const pending = Object.values(local || {}).filter((memo) => memo && activeIds.has(String(memo.assignmentId)) && !serverMemos[memo.assignmentId] && Array.isArray(memo.criteria) && memo.criteria.length);
      let uploaded = false;
      for (const memo of pending) {
        try {
          await apiRequest(`/admin/memos/${memo.assignmentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: memo.title, criteria: memo.criteria }) });
          uploaded = true;
        } catch (_) {
          // Outside this marker's allocation or invalid; leave it for a marker who can save it.
        }
      }
      localStorage.setItem(MEMOS_MIGRATED_KEY, new Date().toISOString());
      return uploaded;
    };
    const sync = async () => {
      if (syncInProgress) return;
      syncInProgress = true;
      try {
        if (user.role === "student") {
          // Student workspace data is intentionally loaded independently. A failure in one
          // supplementary endpoint (tests, notifications, remediation history, etc.) must not
          // blank the assignments page when /student/assignments itself is healthy.
          const studentRequests = await Promise.allSettled([
            apiRequest(`/student/marks/local/${encodeURIComponent(user.studentId)}`),
            apiRequest("/student/remediations"),
            apiRequest("/student/test-attempts"),
            apiRequest("/student/assignments"),
            apiRequest("/api/tests"),
            apiRequest("/api/notifications"),
            apiRequest("/api/accounts/support-team"),
          ]);
          if (cancelled) return;

          const [marksResult, remediationResult, attemptsResult, assignmentResult, testsResult, notificationResult, supportTeamResult] = studentRequests;
          const failedStudentSources = [];

          if (marksResult.status === "fulfilled") {
            const rows = Array.isArray(marksResult.value) ? marksResult.value : [];
            setMarksIfChanged(rows.map((mark) => ({
              ...mark,
              score: mark.mark,
              subject: mark.subject || mark.assessmentId,
              weighting: Number(mark.weighting ?? 100),
              passingMark: Number(mark.passingMark ?? 60),
              grade: gradeFor(mark.mark, Number(mark.passingMark ?? 60)),
            })));
          } else {
            failedStudentSources.push("results");
          }

          if (remediationResult.status === "fulfilled") {
            setRemediationsIfChanged((Array.isArray(remediationResult.value) ? remediationResult.value : []).map(normalizeRemediation));
          } else {
            failedStudentSources.push("remediation");
          }

          if (attemptsResult.status === "fulfilled") {
            setTestAttemptsIfChanged(testAttemptsFromRows(Array.isArray(attemptsResult.value) ? attemptsResult.value : []));
          } else {
            failedStudentSources.push("test attempts");
          }

          if (assignmentResult.status === "fulfilled") {
            const assignmentData = assignmentResult.value || {};
            setAssignmentsIfChanged(Array.isArray(assignmentData.assignments) ? assignmentData.assignments : []);
            const submissionMap = {};
            (Array.isArray(assignmentData.submissions) ? assignmentData.submissions : []).forEach((submission) => {
              submissionMap[`${submission.assignmentId}-${submission.studentUsername}`] = submission;
            });
            setSubmissionsIfChanged(submissionMap);
          } else {
            failedStudentSources.push("assignments");
          }

          if (testsResult.status === "fulfilled") {
            setTestsIfChanged(Array.isArray(testsResult.value) ? testsResult.value : []);
          } else {
            failedStudentSources.push("tests");
          }

          if (notificationResult.status === "fulfilled" && Array.isArray(notificationResult.value)) {
            const notificationRows = notificationResult.value;
            setNotifications((current) => {
              const localOnly = current.filter((item) => !item.serverId);
              const serverRows = notificationRows.map((item) => ({
                id: `server-${item.id}`,
                serverId: item.id,
                message: item.message,
                title: item.title,
                date: item.createdAt,
                audience: user.username,
                type: item.type,
              }));
              const next = [...serverRows, ...localOnly];
              return JSON.stringify(current) === JSON.stringify(next) ? current : next;
            });
          } else if (notificationResult.status === "rejected") {
            failedStudentSources.push("notifications");
          }

          if (supportTeamResult.status === "fulfilled") {
            setSupportTeamIfChanged(supportTeamResult.value || null);
          } else {
            failedStudentSources.push("support team");
          }

          setAccountsIfChanged([]);
          // The API is considered connected when at least one core request succeeded. This stops a
          // harmless supplementary failure from incorrectly switching the whole workspace to
          // offline mode. A completely unavailable API still reports the normal SQLite error.
          const coreResults = [marksResult, remediationResult, attemptsResult, assignmentResult, testsResult];
          const coreSucceeded = coreResults.some((result) => result.status === "fulfilled");
          if (coreSucceeded) {
            setApiConnected(true);
            setApiError(failedStudentSources.length ? `Some student data could not be refreshed: ${failedStudentSources.join(", ")}.` : "");
          } else {
            throw new Error("No student workspace data could be loaded from the SQLite API.");
          }
          return;
        }
        const data = await apiRequest("/admin/data");
        if (cancelled) return;
        setSqliteDataIfChanged(data);
        setApiConnected(true);
        setApiError("");
        const dbAccounts = data.users.map((account) => ({ ...account, temporary: Boolean(account.temporary), }));
        const dbMarks = data.marks.map((mark) => ({
          ...mark,
          score: mark.mark,
          subject: mark.subject || mark.assessmentId,
          weighting: Number(mark.weighting ?? 100),
          passingMark: Number(mark.passingMark ?? 60),
          grade: mark.grade || gradeFor(mark.mark, Number(mark.passingMark ?? 60)),
        }));
        setAccountsIfChanged(dbAccounts);
        setMarksIfChanged(dbMarks);
        setRemediationsIfChanged((data.remediations || []).map(normalizeRemediation));
        setTestAttemptsIfChanged(testAttemptsFromRows(data.testAttempts || []));
        setAssignmentsIfChanged(Array.isArray(data.assignments) ? data.assignments : []);
        const submissionMap = {};
        (Array.isArray(data.assignmentSubmissions) ? data.assignmentSubmissions : []).forEach((submission) => {
          submissionMap[`${submission.assignmentId}-${submission.studentUsername}`] = submission;
        });
        setSubmissionsIfChanged(submissionMap);
        setTestsIfChanged(Array.isArray(data.tests) ? data.tests : []);
        setTeachingGroupsIfChanged(data.teachingGroups || []);
        setAllTeachingGroupsIfChanged(data.allTeachingGroups || []);
        setCourseGroupsIfChanged(data.courseGroups || []);
        try {
          let memoRows = await apiRequest("/admin/memos");
          if (!cancelled && Array.isArray(memoRows)) {
            if (await migrateLocalMemos(memosFromRows(memoRows), data.assignments)) memoRows = await apiRequest("/admin/memos");
            if (!cancelled && Array.isArray(memoRows)) {
              const serverMemos = memosFromRows(memoRows);
              setMemosIfChanged(serverMemos);
              localStorage.setItem("portal-memos", JSON.stringify(serverMemos));
            }
          }
        } catch (_) {
          // Keep the cached memos visible; the marking room disables memo edits while offline.
        }
        if (Array.isArray(data.courses)) {
          const customCourseRows = data.courses
            .filter((course) => !course.isDefault && course.name)
            .map((course) => ({
              id: course.id,
              name: String(course.name).trim(),
              requirement: String(course.requirement || "").trim(),
              isDefault: false,
              active: course.active !== false,
              createdAt: course.createdAt || null,
            }));
          setCustomCoursesIfChanged(customCourseRows);
          localStorage.setItem("portal-courses", JSON.stringify(customCourseRows));
        }
        try {
          const notificationRows = await apiRequest("/api/notifications");
          if (Array.isArray(notificationRows)) {
            setNotifications((current) => {
              const localOnly = current.filter((item) => !item.serverId);
              const serverRows = notificationRows.map((item) => ({
                id: `server-${item.id}`,
                serverId: item.id,
                message: item.message,
                title: item.title,
                date: item.createdAt,
                audience: user.username,
                type: item.type,
              }));
              const next = [...serverRows, ...localOnly];
              return JSON.stringify(current) === JSON.stringify(next) ? current : next;
            });
          }
        } catch (_) {
          // Notification history is supplementary to the core academic sync.
        }
      } catch (error) {
        if (!cancelled) {
          setApiConnected(false);
          setApiError(`SQLite sync unavailable: ${error.message}`);
        }
      } finally {
        syncInProgress = false;
      }
    };
    sync();
    const timer = setInterval(sync, 5000);
    const onSyncNow = () => sync();
    window.addEventListener("portal-sync-now", onSyncNow);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("portal-sync-now", onSyncNow); };
  }, [user]);

  const persist = (key, value, setter) => { setter(value); localStorage.setItem(key, JSON.stringify(value)); };
  const persistCustomCourses = (valueOrUpdater) => {
    setCustomCourses((current) => {
      const next = typeof valueOrUpdater === "function"
        ? valueOrUpdater(current)
        : valueOrUpdater;
      localStorage.setItem("portal-courses", JSON.stringify(next));
      return next;
    });
  };
  const persistRemediations = (valueOrUpdater) => {
    setRemediations((current) => {
      const next = typeof valueOrUpdater === "function"
        ? valueOrUpdater(current)
        : valueOrUpdater;
      // SQLite is authoritative for remediation cases whenever the API is connected. Keep a
      // browser copy only for the deliberate offline/local fallback, otherwise an old cached case
      // can survive a failed sync and appear to be a current remediation record.
      if (!apiConnectedRef.current) {
        localStorage.setItem("portal-remediations", JSON.stringify(next));
      }
      return next;
    });
  };
  const roleLabel = { "main-admin": "Main administrator · Institute overseer", admin: "Administrator · Teacher/Lecturer", student: "Student" };
  const nav = user?.role === "main-admin"
    ? ["Overview", "Accounts", "CSV uploads", "SQLite data", "Courses", "Assignments", "Calendar", "Marking", "Tests & Exams", "Results", "Reports", "Student Cards", "Profile", "Design"]
    : user?.role === "admin" ? ["Overview", "Accounts", "CSV uploads", "SQLite data", "Courses", "Assignments", "Calendar", "Marking", "Tests & Exams", "Results", "Reports", "Profile"] : ["Overview", "Courses", "Assignments", "Calendar", "Tests & Exams", "Results", "Reports", "Profile"];

  async function signIn(event) {
    event.preventDefault();
    const operationId = portalBusyStart("Signing in and loading your workspace…");
    try {
      const found = await apiRequest("/api/accounts/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(login) });
      // The sign-in response only carries the raw account row. Advisor allocation lives in a
      // separate table and is resolved by /api/accounts/me, so without this hydration a learner
      // saw "Not assigned" for their lecturer until they manually refreshed the page.
      let profile = found;
      try {
        profile = { ...found, ...(await apiRequest("/api/accounts/me")) };
      } catch (_) { /* keep the sign-in payload; the background sync retries shortly */ }
      setAccounts([]);
      setAssignments([]);
      setMarks([]);
      setSubmissions({});
      setRemediations([]);
      setTests([]);
      setTestAttempts({});
      setTeachingGroups([]);
      setAllTeachingGroups([]);
      setCourseGroups([]);
      setCalendarEvents([]);
      setSqliteData(null);
      setUser(profile); setApiConnected(true); setLoginError(""); setActive("Overview");
      setWelcome(profile.role === "student" ? `Welcome to ${theme.name}, ${profile.name.split(" ")[0]}! Your learning journey starts here.` : DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length]);
    } catch (error) {
      setApiConnected(false);
      setLoginError(
        error.message ||
        "The local API is unavailable. Start the backend before signing in."
      );
    } finally {
      portalBusyEnd(operationId);
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
    setAccounts([]);
    setAssignments([]);
    setMarks([]);
    setRemediations([]);
    setSubmissions({});
    setTests([]);
    setTestAttempts({});
    setTeachingGroups([]);
    setAllTeachingGroups([]);
    setCourseGroups([]);
    setCalendarEvents([]);
    setSupportTeam(null);
  }

  const operationOverlay = busyMessage ? <div className="operation-overlay" role="status" aria-live="polite" aria-label={busyMessage}><div className="operation-card"><span className="operation-spinner" aria-hidden="true" /><strong>{busyMessage}</strong><span className="operation-bar" aria-hidden="true" /></div></div> : null;

  if (loading || !setupChecked) return <LoadingScreen theme={theme} />;
  if (setupRequired) {
    return <>
      <SetupScreen
        theme={theme}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        language={language}
        setLanguage={setLanguage}
        t={t}
        onComplete={(created) => {
          setUser(created);
          setApiConnected(true);
          setSetupRequired(false);
          setLoginError("");
          setActive("Overview");
          setWelcome(`Welcome to ${theme.name}, ${created.name.split(" ")[0]}! Your learning journey starts here.`);
        }}
      />
      {operationOverlay}
    </>;
  }
  const demoBanner = demoInstall && <div className="demo-install-banner" role="note"><strong>Demo installation</strong> — sample data with public demo passwords. Do not enter real learner information here.</div>;
  if (!user) return <>{demoBanner}<Login login={login} setLogin={setLogin} error={loginError} onSubmit={signIn} theme={theme} darkMode={darkMode} setDarkMode={setDarkMode} language={language} setLanguage={setLanguage} t={t} courses={publicCourses} catalogueConnected={catalogueConnected} />{operationOverlay}</>;

  const currentMarks = marks
    .filter((mark) => user.role !== "student" || (mark.studentId === user.studentId && ["Published", "Locked"].includes(mark.status || "Published")))
    .map((mark) => {
      const remediation = remediations.find(
        (item) => item.studentId === mark.studentId && item.assessmentId === mark.assessmentId,
      );
      return remediation
        ? { ...mark, remediation: normalizeRemediation(remediation) }
        : mark;
    });
  const academicSyncStatus = !apiConnected
    ? "Sync unavailable"
    : apiError
      ? "Partially synced"
      : "Academic sync connected";
  // The bell previously had no click handler, so every notification the portal recorded (marks
  // published, remediation warnings, password resets) was write-only — a student could never read
  // one after its toast was dismissed. It now opens a panel over the recorded history.
  // Legacy entries saved before notifications were scoped have no audience; show those to staff
  // only, since they were produced by staff actions.
  const visibleNotifications = notifications.filter((item) => (item.audience ? item.audience === user.username : user.role !== "student"));
  const clearNotifications = async () => {
    try { if (apiConnected) await apiRequest("/api/notifications", { method: "DELETE" }); } catch (_) { /* local clear still succeeds */ }
    const kept = notifications.filter((item) => !visibleNotifications.includes(item));
    setNotifications(kept); localStorage.setItem("portal-notifications", JSON.stringify(kept));
    setShowNotifications(false);
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
      {operationOverlay}
      <aside className={`sidebar${mobileNavOpen ? " mobile-nav-open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
          <div className="sidebar-header-actions">
            <button type="button" className="mobile-nav-toggle" aria-expanded={mobileNavOpen} aria-controls="portal-main-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? "Close menu" : "Open menu"}</button>
            <button type="button" className="sign-out mobile-sidebar-sign-out" onClick={signOut}>{t("signOut")}</button>
          </div>
        </div>
        <div className="profile"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{roleLabel[user.role]}</small></div></div>
        <nav id="portal-main-navigation" aria-label="Main navigation" hidden={false}>{nav.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => { setActive(item); setShowNotifications(false); setMobileNavOpen(false); }}>{t(item)}</button>)}</nav>
        <button className="sign-out desktop-sidebar-sign-out" onClick={signOut}>{t("signOut")}</button>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">Academic workspace</p><h1>{t(active)}</h1><span className="storage-note">SQLite API: {academicSyncStatus}{demoInstall && <span className="demo-install-pill">Demo data</span>}</span></div><div className="top-actions"><label className="language-select"><span className="sr-only">{t("language")}</span><select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("language")}>{LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}</select></label><button className="theme-toggle" onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem("portal-dark-mode", JSON.stringify(next)); }} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>{darkMode ? t("lightMode") : t("darkMode")}</button><span className={`status-dot${apiConnected && apiError ? " status-partial" : ""}`}>{academicSyncStatus}</span><div className="notification-wrap"><button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} title={`${visibleNotifications.length} notifications`} onClick={() => setShowNotifications((open) => !open)}>{visibleNotifications.length ? "●" : "○"}{visibleNotifications.length > 0 && <span className="notification-count">{visibleNotifications.length}</span>}</button>{showNotifications && <div className="notification-panel" role="dialog" aria-label="Notifications"><div className="notification-head"><strong>Notifications</strong>{visibleNotifications.length > 0 && <button className="text-button" onClick={clearNotifications}>Clear all</button>}</div>{visibleNotifications.length === 0 ? <p className="muted small-print">Nothing yet. Published marks, remediation warnings and account changes appear here.</p> : <ul className="notification-list">{visibleNotifications.slice(0, 20).map((item) => <li key={item.id}><span>{item.message}</span><small>{new Date(item.date).toLocaleString()}</small></li>)}</ul>}</div>}</div></div></header>
        {welcome && <div className="welcome-toast" role="status">{welcome}<button onClick={() => setWelcome("")}>×</button></div>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {apiError && <div className="notice error" role="alert">{apiError}{user?.username && <button className="text-button" type="button" onClick={() => window.dispatchEvent(new Event("portal-sync-now"))}>Retry sync</button>}</div>}
        {active === "Overview" && <Overview user={user} assignments={assignments} marks={currentMarks} accounts={accounts} apiConnected={apiConnected} supportTeam={supportTeam} submissions={submissions} />}
        {active === "Accounts" && (
          <Accounts
            accounts={accounts}
            setAccounts={setAccounts}
            user={user}
          />
        )}
        {active === "CSV uploads" && <CsvUploads setNotice={setNotice} marks={marks} setMarks={setMarks} accounts={accounts} passMark={passMark} />}
        {active === "SQLite data" && <SQLiteData data={sqliteData} connected={apiConnected} />}
        {active === "Courses" && <><Courses accounts={accounts} setAccounts={(v) => persist("portal-accounts", v, setAccounts)} user={user} notify={notify} courses={courses} canManage={user.role !== "student"} teachingGroups={teachingGroups} setTeachingGroups={setTeachingGroups} allTeachingGroups={allTeachingGroups} courseGroups={courseGroups} /><CourseManager courses={courses} courseRecords={customCourses} setCustomCourses={persistCustomCourses} canManage={user.role !== "student"} apiConnected={apiConnected} notify={notify} /></>}
        {active === "Calendar" && <Calendar user={user} events={calendarEvents} setEvents={setCalendarEvents} teachingGroups={teachingGroups} allTeachingGroups={allTeachingGroups} notify={notify} />}
        {active === "Assignments" && <Assignments user={user} assignments={assignments} setAssignments={setAssignments} submissions={submissions} setSubmissions={setSubmissions} accounts={accounts} passMark={passMark} setRemediations={persistRemediations} remediations={remediations} apiConnected={apiConnected} setNotice={setNotice} teachingGroups={teachingGroups} allTeachingGroups={allTeachingGroups} catalogueCourses={publicCourses} />}
        {active === "Tests & Exams" && <TestsExams user={user} tests={tests} setTests={setTests} attempts={testAttempts} setAttempts={setTestAttempts} accounts={accounts} setMarks={setMarks} passMark={passMark} notify={notify} apiConnected={apiConnected} teachingGroups={teachingGroups} allTeachingGroups={allTeachingGroups} remediations={remediations} catalogueCourses={publicCourses} />}
        {active === "Results" && <Results marks={user.role === "student" ? currentMarks : marks} allMarks={marks} remediations={remediations} setRemediations={persistRemediations} canEdit={user.role !== "student"} apiConnected={apiConnected} setMarks={setMarks} user={user} notify={notify} passMark={passMark} setPassMark={(v) => persist("portal-pass-mark", v, setPassMark)} accounts={accounts} institution={theme.name} t={t} teachingGroups={teachingGroups} setNotice={setNotice} />}
        {active === "Marking" && user.role !== "student" && <MarkingRoom user={user} submissions={submissions} setSubmissions={setSubmissions} memos={memos} setMemos={(v) => persist("portal-memos", v, setMemos)} passMark={passMark} apiConnected={apiConnected} notify={notify} setNotice={setNotice} teachingGroups={teachingGroups} courses={courses} remediations={remediations} setRemediations={setRemediations} />}
        {active === "Reports" && <>
          {user.role === "main-admin" && <InstitutionReport marks={marks} accounts={accounts} tests={tests} testAttempts={testAttempts} remediations={remediations} passMark={passMark} institution={theme.name} notify={notify} courses={courses} />}
          <TermReport marks={marks} accounts={accounts} user={user} passMark={passMark} institution={theme.name} notify={notify} />
        </>}
        {active === "Student Cards" && user.role === "main-admin" && <StudentCards institution={theme.name} notify={notify} />}
        {active === "Profile" && <Profile user={user} setAccounts={setAccounts} setUser={setUser} institution={theme.name} supportTeam={supportTeam} />}
        {active === "Design" && <Design theme={theme} setTheme={(v) => persist("portal-theme", v, setTheme)} />}
      </main>
    </div>
  );
}

function SetupScreen({ theme, darkMode, setDarkMode, language, setLanguage, t, onComplete }) {
  const [form, setForm] = useState({ name: "", username: "", password: "", confirmPassword: "", trustedEmail: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    const username = form.username.trim().toLowerCase();

    if (!name || !username || !form.password) {
      setError("Complete every field to create the first main administrator.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest("/api/setup/create-main-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password: form.password, trustedEmail: form.trustedEmail.trim() || null }),
      });

      onComplete(created);
    } catch (requestError) {
      setError(requestError.message || "Could not complete the initial setup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`login-page${darkMode ? " dark-mode" : ""}`}
      style={{
        "--accent": theme.accent || "#0f766e",
        "--portal-font": theme.font || "DM Sans",
        fontFamily: `${theme.font || "DM Sans"}, sans-serif`,
      }}
    >
      <div className="login-art">
        <span className="brand-mark">{initials(theme.name)}</span>
        <p className="eyebrow">Initial setup</p>
        <h1>Start with a clean workspace.</h1>
        <p>No administrator or student accounts are pre-installed.</p>
      </div>

      <div className="login-top-actions">
        <label className="language-select login-language-toggle">
          <span className="sr-only">{t("language")}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("language")}>
            {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
          </select>
        </label>
        <button
          className="theme-toggle login-theme-toggle"
          onClick={() => {
            const next = !darkMode;
            setDarkMode(next);
            localStorage.setItem("portal-dark-mode", JSON.stringify(next));
          }}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? t("lightMode") : t("darkMode")}
        </button>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="brand dark">
          <span className="brand-mark">{initials(theme.name)}</span>
          <span>{theme.name}</span>
        </div>

        <h2>Initial system setup</h2>
        <p className="muted">Create the first main administrator. This screen is available only while the database contains zero users.</p>

        <label>
          Full name
          <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>

        <label>
          Username
          <input autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>

        <label>
          Trusted email
          <input
            type="email"
            autoComplete="email"
            value={form.trustedEmail}
            onChange={(e) => setForm({ ...form, trustedEmail: e.target.value })}
            placeholder="Optional account recovery email"
          />
        </label>

        <label>
          Password
          <input type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>

        <label>
          Confirm password
          <input type="password" minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary full" type="submit" disabled={saving}>
          {saving ? "Creating main administrator…" : "Create main administrator"}
        </button>
      </form>
    </div>
  );
}

function Login({ login, setLogin, error, onSubmit, theme, darkMode, setDarkMode, language, setLanguage, t, courses = [], catalogueConnected = false }) {
  // `courses` is normalised by App into [name, requirement] tuples before reaching Login.
  // Filter malformed legacy entries defensively so an old browser value cannot break render.
  const courseOptions = Array.isArray(courses)
    ? courses.filter((entry) => Array.isArray(entry) && String(entry[0] || "").trim())
    : [];
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registration, setRegistration] = useState({
    name: "",
    studentId: "",
    trustedEmail: "",
    course: "",
    yearLevel: "1",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [forgot, setForgot] = useState(false);
  const [resetStage, setResetStage] = useState("request");
  const [resetToken, setResetToken] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const resetRegistration = () => {
    setRegistering(false);
    setRegistered(false);
    setRegistrationSaving(false);
    setRegistrationError("");
    setRegistration({
      name: "",
      studentId: "",
      trustedEmail: "",
      course: "",
      yearLevel: "1",
      username: "",
      password: "",
      confirmPassword: "",
    });
  };

  const register = async (event) => {
    event.preventDefault();
    setRegistrationError("");

    const name = registration.name.trim();
    const studentId = registration.studentId.trim();
    const trustedEmail = registration.trustedEmail.trim().toLowerCase();
    const course = registration.course.trim();
    const username = registration.username.trim().toLowerCase();
    const yearLevel = Number.parseInt(registration.yearLevel, 10);

    if (!name || !studentId || !trustedEmail || !course || !username || !registration.password || !registration.confirmPassword) {
      setRegistrationError("Complete every field to create your student account.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trustedEmail)) {
      setRegistrationError("Enter a valid trusted email address.");
      return;
    }
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(username)) {
      setRegistrationError("Username must be 3–100 characters and use only letters, numbers, dots, underscores or hyphens.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(studentId)) {
      setRegistrationError("Student ID may contain only letters, numbers, underscores and hyphens.");
      return;
    }
    if (registration.password.length < 8) {
      setRegistrationError("Password must be at least 8 characters.");
      return;
    }
    if (registration.password !== registration.confirmPassword) {
      setRegistrationError("The passwords do not match.");
      return;
    }
    if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) {
      setRegistrationError("Year of study must be between 1 and 6.");
      return;
    }
    if (!courseOptions.some(([courseName]) => String(courseName).trim().toLowerCase() === course.toLowerCase())) {
      setRegistrationError("Choose a course from the current course catalogue.");
      return;
    }

    setRegistrationSaving(true);
    try {
      await apiRequest("/api/accounts/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          password: registration.password,
          studentId,
          trustedEmail,
          course,
          yearLevel,
        }),
      });

      setLogin({ username, password: registration.password });
      setRegistered(true);
      setRegistrationError("");
    } catch (requestError) {
      setRegistrationError(requestError.message || "Could not create the student account.");
    } finally {
      setRegistrationSaving(false);
    }
  };

  const requestReset = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim();
    const email = String(data.get("email") || "").trim();
    setResetError("");
    if (!username || !email) {
      setResetError("Enter the username and trusted email address linked to the account.");
      return;
    }
    try {
      const response = await apiRequest("/api/accounts/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      if (response.token) {
        setResetToken(response.token);
        setResetStage("confirm");
        setRecoveryMessage(`A single-use reset token was prepared for ${email}. This local build does not send external email, so the token is shown here.`);
      } else {
        setRecoveryMessage(`If ${username} is a registered account with that trusted email, a reset notification has been prepared.`);
      }
    } catch (requestError) {
      setResetError(`Could not reach the local API: ${requestError.message}`);
    }
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    setResetError("");
    if (password.length < 8) {
      setResetError("Choose a password of at least 8 characters.");
      return;
    }
    try {
      await apiRequest("/api/accounts/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      setResetStage("done");
      setRecoveryMessage("Your password has been changed. You can sign in with it now.");
    } catch (requestError) {
      setResetError(requestError.message);
    }
  };

  const closeForgot = () => {
    setForgot(false);
    setResetStage("request");
    setResetToken("");
    setResetError("");
    setRecoveryMessage("");
  };

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
        <h1>Make space for<br /><em>what’s next.</em></h1>
        <p>One calm place for teaching, learning and progress.</p>
      </div>

      <div className="login-top-actions">
        <label className="language-select login-language-toggle">
          <span className="sr-only">{t("language")}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t("language")}>
            {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
          </select>
        </label>
        <button className="theme-toggle login-theme-toggle" type="button" onClick={() => {
          const next = !darkMode;
          setDarkMode(next);
          localStorage.setItem("portal-dark-mode", JSON.stringify(next));
        }}>
          {darkMode ? t("lightMode") : t("darkMode")}
        </button>
      </div>

      {registering ? (
        <form className="login-card" onSubmit={register}>
          <div className="brand dark"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
          {registered ? (
            <>
              <h2>Account created</h2>
              <p className="muted">Your student account has been saved. Your course and year of study were recorded with the account, while teacher/lecturer allocation remains an institutional staff responsibility.</p>
              <p className="notice" role="status">Your username has been placed in the sign-in form.</p>
              <button className="primary full" type="button" onClick={() => { setRegistering(false); setRegistered(false); }}>
                {t("signIn")}
              </button>
            </>
          ) : (
            <>
              <h2>Create your student account</h2>
              <p className="muted">Enter your own learner details, choose your course and year, and create the credentials you will use to sign in.</p>
              <label>Full name<input required autoFocus autoComplete="name" value={registration.name} onChange={(e) => setRegistration({ ...registration, name: e.target.value })} /></label>
              <label>Student ID<input required autoComplete="off" value={registration.studentId} onChange={(e) => setRegistration({ ...registration, studentId: e.target.value })} placeholder="STU-002" /></label>
              <label>Trusted email<input required type="email" autoComplete="email" value={registration.trustedEmail} onChange={(e) => setRegistration({ ...registration, trustedEmail: e.target.value })} placeholder="you@example.com" /></label>
              <label>Course
                <select required value={registration.course} onChange={(e) => setRegistration({ ...registration, course: e.target.value })}>
                  <option value="">Choose your course</option>
                  {courseOptions.map(([name]) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label>Year of study
                <select required value={registration.yearLevel} onChange={(e) => setRegistration({ ...registration, yearLevel: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>Year {year}</option>)}
                </select>
              </label>
              <label>Username<input required autoComplete="username" value={registration.username} onChange={(e) => setRegistration({ ...registration, username: e.target.value })} placeholder="e.g. sam.student" /></label>
              <label>Password<input required type="password" minLength={8} autoComplete="new-password" value={registration.password} onChange={(e) => setRegistration({ ...registration, password: e.target.value })} placeholder="At least 8 characters" /></label>
              <label>Confirm password<input required type="password" minLength={8} autoComplete="new-password" value={registration.confirmPassword} onChange={(e) => setRegistration({ ...registration, confirmPassword: e.target.value })} /></label>
              {!catalogueConnected ? <p className="error">The course catalogue is unavailable right now. Reconnect the backend and try again.</p> : !courses.length ? <p className="error">No active courses are available yet. Ask the main administrator to create the course catalogue first.</p> : null}
              {registrationError && <p className="error" role="alert">{registrationError}</p>}
              <button className="primary full" type="submit" disabled={registrationSaving || !courses.length}>{registrationSaving ? "Creating account…" : "Create account"}</button>
              <button className="text-button auth-link" type="button" onClick={resetRegistration}>Already have an account? {t("signIn")}</button>
            </>
          )}
        </form>
      ) : forgot ? (
        <form className="login-card" onSubmit={resetStage === "confirm" ? confirmReset : requestReset}>
          <div className="brand dark"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
          <h2>{t("forgotPassword")}</h2>
          {resetStage === "request" && <>
            <p className="muted">Account recovery is prepared locally. Enter the username and trusted email recorded for the account.</p>
            <label>Username<input required name="username" autoComplete="username" /></label>
            <label>Trusted email<input required type="email" name="email" autoComplete="off" /></label>
          </>}
          {resetStage === "confirm" && <>
            <p className="muted">The single-use reset token expires in one hour.</p>
            <p className="reset-token">{resetToken}</p>
            <label>New password<input required type="password" name="password" minLength={8} autoComplete="new-password" /></label>
          </>}
          {recoveryMessage && <p className="notice">{recoveryMessage}</p>}
          {resetError && <p className="error">{resetError}</p>}
          {resetStage !== "done" && <button className="primary full" type="submit">{resetStage === "confirm" ? "Set new password" : "Prepare reset notification"}</button>}
          <button className="text-button auth-link" type="button" onClick={closeForgot}>Back to sign in</button>
        </form>
      ) : (
        <form className="login-card" onSubmit={onSubmit}>
          <div className="brand dark"><span className="brand-mark">{initials(theme.name)}</span><span>{theme.name}</span></div>
          <h2>{t("welcomeBack")}</h2>
          <p className="muted">{t("signInSubtitle")}</p>
          <label>{t("username")}<input autoFocus autoComplete="username" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} /></label>
          <label>{t("password")}<input type="password" autoComplete="current-password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary full auth-submit" type="submit">{t("signIn")}</button>
          <button className="secondary full auth-register" type="button" onClick={() => { setRegistering(true); setRegistrationError(""); setRegistered(false); }}>New student? Create an account</button>
          <button className="text-button auth-link" type="button" onClick={() => setForgot(true)}>{t("forgotPassword")}</button>
        </form>
      )}
    </div>
  );
}

const STAFF_ROLE_LABEL = { "main-admin": "Main administrator", admin: "Teacher / lecturer", student: "Student" };

// Shows a learner the staff responsible for them. `advisor.source` distinguishes a lecturer
// allocated to the individual learner from one inferred from their course/year teaching group,
// so the learner knows whether the allocation is confirmed or provisional.
function SupportTeam({ supportTeam, user, variant = "full" }) {
  if (user.role !== "student") return null;

  const advisor = supportTeam?.advisor || null;
  const administrators = Array.isArray(supportTeam?.administrators) ? supportTeam.administrators : [];
  const courseStaff = Array.isArray(supportTeam?.courseStaff) ? supportTeam.courseStaff : [];
  const course = supportTeam?.course || user.course || "";
  const yearLevel = supportTeam?.yearLevel || user.yearLevel || "";
  const academicYear = supportTeam?.academicYear || new Date().getFullYear();

  // The advisor is already the first entry of courseStaff when it was inferred from the group,
  // so drop it here to avoid listing the same person twice.
  const otherStaff = courseStaff.filter((member) => !advisor || Number(member.id) !== Number(advisor.id));

  const person = (member, badge) => (
    <li className="support-person" key={`${badge}-${member.id}`}>
      <span className="support-avatar" aria-hidden="true">{initials(member.name || "?")}</span>
      <span className="support-person-body">
        <strong>{member.name}</strong>
        <small>{STAFF_ROLE_LABEL[member.role] || "Staff"}</small>
      </span>
      <span className={`support-badge support-badge-${badge}`}>
        {badge === "advisor" ? "Your lecturer" : badge === "admin" ? "Administration" : "Course team"}
      </span>
    </li>
  );

  return (
    <section className="panel support-team-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Who supports you</p>
          <h3>Your academic support team</h3>
          <p className="muted">The staff responsible for {course || "your course"}{yearLevel ? `, Year ${yearLevel}` : ""} in the {academicYear} academic year.</p>
        </div>
        <span className="count">{academicYear}</span>
      </div>

      {!supportTeam && <p className="muted">Loading your allocation…</p>}

      {supportTeam && !advisor && (
        <p className="notice error" role="status">
          No teacher or lecturer is allocated to {course || "your course"}{yearLevel ? `, Year ${yearLevel}` : ""} yet.
          Contact an administrator below so your allocation can be completed.
        </p>
      )}

      {advisor && (
        <div className="support-highlight">
          <span className="support-avatar support-avatar-large" aria-hidden="true">{initials(advisor.name || "?")}</span>
          <div>
            <p className="eyebrow">Responsible lecturer</p>
            <strong>{advisor.name}</strong>
            <small>{STAFF_ROLE_LABEL[advisor.role] || "Staff"}{advisor.username ? ` · ${advisor.username}` : ""}</small>
            <p className="muted small-print">
              {advisor.source === "allocated"
                ? `Allocated directly to you for the ${advisor.academicYear || academicYear} academic year.`
                : `Allocated to ${course || "your course"}${yearLevel ? `, Year ${yearLevel}` : ""}. Your individual allocation is still being confirmed by staff.`}
            </p>
          </div>
          <span className={`support-badge support-badge-${advisor.source === "allocated" ? "advisor" : "course"}`}>
            {advisor.source === "allocated" ? "Confirmed" : "Provisional"}
          </span>
        </div>
      )}

      {variant === "full" && (otherStaff.length > 0 || administrators.length > 0) && (
        <ul className="support-person-list">
          {otherStaff.map((member) => person(member, "course"))}
          {administrators.map((member) => person(member, "admin"))}
        </ul>
      )}

      <p className="muted small-print">Lecturer and group allocation is managed by institutional staff. Raise any correction with an administrator listed here.</p>
    </section>
  );
}

function Overview({ user, assignments, marks, accounts, apiConnected, supportTeam, submissions = {} }) {
  const waitingForSync = user.role !== "student" && !apiConnected;
  const stats = user.role === "student" ? [["Assignments", assignments.length], ["Average score", marks.length ? `${Math.round(marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length)}%` : "—"], ["Feedback", marks.filter((m) => m.feedback).length]] : [["Students", waitingForSync ? "Syncing…" : accounts.filter((a) => a.role === "student").length], ["Assignments", assignments.length], ["Results published", waitingForSync ? "Syncing…" : marks.length]];
  // Not-yet-open assignments are neither closed nor actionable, so they get their own label
  // instead of being lumped in with closed work.
  const isClosed = (assignment) => !assignmentOpen(assignment) && !assignmentNotOpenYet(assignment);
  const statusLabel = (assignment) => {
    if (user.role === "student") {
      // The learner's own submission outranks the assignment window: work that was handed in or
      // marked must never be listed as "To do".
      const own = submissions?.[`${assignment.id}-${user.username}`];
      if (own?.markPublishedAt && own.mark !== null && own.mark !== undefined) return `Marked · ${own.mark}%`;
      if (own) return "Submitted";
      if (assignmentNotOpenYet(assignment)) return "Scheduled";
      return isClosed(assignment) ? "Not submitted" : "To do";
    }
    if (assignmentNotOpenYet(assignment)) return "Scheduled";
    if (isClosed(assignment)) return "Closed";
    return "Published";
  };
  return <><section className="welcome"><div><p className="eyebrow">{displayDate()}</p><h2>Good morning, {user.name.split(" ")[0]}.</h2><p className="muted">Here’s what needs your attention today.</p></div><span className="welcome-shape">✦</span></section><div className="stats">{stats.map(([label, value]) => <div className="stat-card" key={label}><small>{label}</small><strong>{value}</strong><span className="trend">Updated just now</span></div>)}</div>{user.role === "student" && <SupportTeam supportTeam={supportTeam} user={user} variant="compact" />}<section className="panel"><div className="panel-heading"><div><p className="eyebrow">Next up</p><h3>Upcoming and past assignments</h3></div><span className="count">{assignments.length} total</span></div>{assignments.slice(0, 6).map((a) => <div className={`list-row${isClosed(a) ? " assignment-completed" : ""}`} key={a.id}><div className="file-icon">↗</div><div><strong>{a.title}</strong><small>{a.subject} · Opens {a.start ? new Date(a.start).toLocaleString() : "now"} · Due {a.due}{a.dueTime ? ` at ${a.dueTime}` : ""} · {a.duration || 60} minutes</small></div><span className="pill">{statusLabel(a)}</span></div>)}</section></>;
}

function Accounts({ accounts = [], setAccounts, user }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    trustedEmail: "",
    temporary: true,
    role: "admin",
  });

  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentImportFile, setStudentImportFile] = useState(null);
  const [studentImporting, setStudentImporting] = useState(false);
  const [studentImportMessage, setStudentImportMessage] = useState("");

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
          trustedEmail: form.trustedEmail.trim() || null,
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
        trustedEmail: "",
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

  const downloadStudentTemplate = () => {
    const template = [
      ["name", "username", "password", "studentId", "trustedEmail", "course", "yearLevel", "teacherUsername", "academicYear"],
      ["Example Student", "student001", "ChangeMe123!", "STU-001", "student@example.com", "Computer Science", "1", "admin", String(new Date().getFullYear())],
    ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-account-import-template.csv";
    link.click();
  };

  const importStudentAccounts = async () => {
    if (!studentImportFile) {
      setError("Choose a student-account CSV file first.");
      return;
    }
    setStudentImporting(true);
    setStudentImportMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", studentImportFile);
      const response = await apiRequest("/admin/accounts/students/import", { method: "POST", body: formData });
      const created = Array.isArray(response.created) ? response.created : [];
      setAccounts((currentAccounts) => {
        const existingIds = new Set(currentAccounts.map((account) => String(account.id)));
        return [...currentAccounts, ...created.filter((account) => !existingIds.has(String(account.id)))];
      });
      setStudentImportFile(null);
      setStudentImportMessage(`Imported ${response.imported} student account${response.imported === 1 ? "" : "s"} successfully.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setError(error.message || "Student account import failed.");
    } finally {
      setStudentImporting(false);
    }
  };

  const learners = accounts.filter(
    (account) => account.role === "student"
  );

  const normalizedStudentSearch = studentSearch.trim().toLowerCase();
  const filteredLearners = learners.filter((learner) => {
    if (!normalizedStudentSearch) return true;
    return [learner.name, learner.studentId, learner.username, learner.course]
      .some((value) => String(value || "").toLowerCase().includes(normalizedStudentSearch));
  });

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

  const learnerRows = filteredLearners.map((learner) =>
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

        <label>
          Trusted email
          <input
            type="email"
            autoComplete="email"
            value={form.trustedEmail}
            onChange={(event) =>
              updateField("trustedEmail", event.target.value)
            }
            placeholder="Optional password-recovery email"
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
              {!accounts.some((account) => account.role === "main-admin") && (
                <option value="main-admin">
                  Main administrator
                </option>
              )}
            </select>
          </label>
        )}

        <button className="primary" type="submit">
          Create account
        </button>
      </form>

      <section className="panel student-account-import-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Bulk onboarding</p>
            <h3>Import student accounts</h3>
          </div>
          <span className="count">Admin only</span>
        </div>
        <p className="muted">Upload a CSV to create multiple learner accounts at once. The same course, year, teacher allocation, duplicate checks and password rules used by individual learner creation are applied to every row.</p>
        <div className="student-import-actions">
          <label className="file-drop student-account-file">
            {studentImportFile ? studentImportFile.name : "Choose student-account CSV"}
            <input key={studentImportFile ? studentImportFile.name : "empty-student-import"} type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0] || null; event.target.value = ""; setStudentImportFile(file); setStudentImportMessage(""); setError(""); }} />
          </label>
          <button type="button" className="secondary" onClick={downloadStudentTemplate}>Download template</button>
          <button type="button" className="primary" disabled={!studentImportFile || studentImporting} onClick={importStudentAccounts}>{studentImporting ? "Importing…" : "Validate and import"}</button>
        </div>
        {studentImportMessage && <p className="success-message" role="status">{studentImportMessage}</p>}
        <p className="muted small-print">Required columns: <code>name, username, password, studentId, course, yearLevel, teacherUsername</code>. <code>trustedEmail</code> and <code>academicYear</code> are recommended; academic year defaults to the current year when omitted.</p>
        <p className="muted small-print">Students do not need a separate self-registration route for this workflow. Staff can create one learner in Courses or many learners here, while sign-in remains handled by the normal account login.</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Learners</p>
            <h3>Student accounts</h3>
          </div>
          <span className="count">{filteredLearners.length} of {learners.length}</span>
        </div>

        <div className="account-search">
          <label>
            Search student by name or ID
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="e.g. Sam Taylor or STU-001"
              aria-label="Search student accounts by name or student ID"
            />
          </label>
          {studentSearch && (
            <button
              type="button"
              className="text-button"
              onClick={() => setStudentSearch("")}
            >
              Clear search
            </button>
          )}
        </div>

        {filteredLearners.length ? learnerRows : (
          <p className="muted">No student accounts match “{studentSearch}”.</p>
        )}
      </section>
    </div>
  );
}

function Profile({ user, setAccounts, setUser, institution, supportTeam }) {
  const [draft, setDraft] = useState({ name: user.name || "", username: user.username || "", email: user.trustedEmail || user.email || "", studentId: user.studentId || "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [cardProfile, setCardProfile] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user.role !== "student") return undefined;
    let cancelled = false;
    apiRequest("/student/student-card")
      .then((response) => { if (!cancelled) setCardProfile(response); })
      .catch((error) => { if (!cancelled) setPhotoError(error.message || "Could not load your student card photo."); });
    return () => { cancelled = true; };
  }, [user.id, user.role]);

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    const name = draft.name.trim();
    const username = draft.username.trim().toLowerCase();
    const studentId = draft.studentId.trim();
    if (!name || !username) { setMessage("Name and username are required."); return; }
    if (user.role === "student" && !studentId) { setMessage("Student ID is required for a student account."); return; }
    setSaving(true);
    const operationId = portalBusyStart("Saving profile changes…");
    try {
      const updated = await apiRequest("/api/accounts/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, trustedEmail: draft.email.trim(), studentId }),
      });
      setUser(updated);
      setAccounts((currentAccounts) => currentAccounts.map((account) => account.id === updated.id ? { ...account, ...updated } : account));
      setDraft({ name: updated.name || "", username: updated.username || "", email: updated.trustedEmail || "", studentId: updated.studentId || "" });
      setMessage("Profile saved successfully.");
    } catch (error) {
      setMessage(error.message || "Could not save profile.");
    } finally {
      setSaving(false);
      portalBusyEnd(operationId);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    if (!passwordDraft.current || !passwordDraft.next || !passwordDraft.confirm) {
      setPasswordMessage("Enter your current password and the new password twice.");
      return;
    }
    if (passwordDraft.next.length < 8 || passwordDraft.next.length > 200) {
      setPasswordMessage("The new password must be 8–200 characters.");
      return;
    }
    if (passwordDraft.next !== passwordDraft.confirm) {
      setPasswordMessage("The new passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    const operationId = portalBusyStart("Changing your password…");
    try {
      await apiRequest("/api/accounts/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwordDraft.current, newPassword: passwordDraft.next }),
      });
      setPasswordDraft({ current: "", next: "", confirm: "" });
      setPasswordMessage("Password changed successfully. Other signed-in sessions were signed out.");
    } catch (error) {
      setPasswordMessage(error.message || "Could not change your password.");
    } finally {
      setPasswordSaving(false);
      portalBusyEnd(operationId);
    }
  };

  // Release the local preview's object URL whenever it is replaced or the page unmounts.
  useEffect(() => () => { if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url); }, [pendingPhoto]);

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Student photos must be JPG, PNG or WebP images.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Student photos are limited to 5 MB.");
      return;
    }
    setPhotoError("");
    setPhotoMessage("");
    setPendingPhoto({ file, url: URL.createObjectURL(file) });
  };

  const uploadPhoto = async () => {
    const file = pendingPhoto?.file;
    if (!file) return;
    setPhotoSaving(true);
    setPhotoError("");
    const operationId = portalBusyStart("Uploading your student-card photo…");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest("/student/student-card/photo", { method: "POST", body: formData });
      setCardProfile(response);
      setPendingPhoto(null);
      setPhotoMessage("Student-card photo saved. The main administrator will use it on your card.");
    } catch (error) {
      setPhotoError(error.message || "Could not upload the student-card photo.");
    } finally {
      setPhotoSaving(false);
      portalBusyEnd(operationId);
    }
  };

  const removePhoto = async () => {
    if (!window.confirm("Delete your student-card photo? Your card will show a photo placeholder until you upload another one.")) return;
    setPhotoSaving(true);
    setPhotoError("");
    const operationId = portalBusyStart("Deleting your student-card photo…");
    try {
      const response = await apiRequest("/student/student-card/photo", { method: "DELETE" });
      setCardProfile(response);
      setPhotoMessage("Student-card photo deleted. You can upload a new one at any time.");
    } catch (error) {
      setPhotoError(error.message || "Could not delete the student-card photo.");
    } finally {
      setPhotoSaving(false);
      portalBusyEnd(operationId);
    }
  };

  const savedPhotoSrc = cardProfile?.photoUrl ? `${API_BASE}${cardProfile.photoUrl}` : "";
  const photoSrc = pendingPhoto?.url || savedPhotoSrc;
  const cardStudent = { name: user.name, studentId: user.studentId, course: user.course, yearLevel: user.yearLevel, academicYear: new Date().getFullYear(), ...(cardProfile || {}) };
  const photoUpdated = cardProfile?.photoUpdatedAt ? new Date(String(cardProfile.photoUpdatedAt).includes("T") ? cardProfile.photoUpdatedAt : `${String(cardProfile.photoUpdatedAt).replace(" ", "T")}Z`) : null;
  return <section className="profile-stack">
    <form className="panel profile-panel" onSubmit={save}>
      <p className="eyebrow">Your information</p><h3>View profile</h3>
      <p className="muted">Profile details are saved to SQLite. Your academic course and year are recorded from your student account; staff manage lecturer/group allocation.</p>
      <label>Full name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Username<input required value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></label>
      <label>Email<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
      {user.role === "student" && <>
        <label>Student ID<input required value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })} /></label>
        <div className="profile-readonly"><span>Course</span><strong>{user.course || "Not selected"}</strong></div>
        <div className="profile-readonly"><span>Year of study</span><strong>{user.yearLevel ? `Year ${user.yearLevel}` : "Not assigned"}</strong></div>
        <div className="profile-readonly"><span>Responsible lecturer</span><strong>{supportTeam?.advisor?.name || user.teacherName || "Not assigned"}</strong></div>
        <div className="profile-readonly"><span>Academic year</span><strong>{supportTeam?.academicYear || user.teacherAcademicYear || new Date().getFullYear()}</strong></div>
      </>}
      <button className="primary" type="submit" disabled={saving}>{saving ? "Saving profile…" : "Save profile"}</button>
      {message && <p className="notice" role="status">{message}</p>}
    </form>

    {user.role === "student" && <SupportTeam supportTeam={supportTeam} user={user} />}

    <form className="panel profile-panel password-panel" onSubmit={changePassword}>
      <p className="eyebrow">Account security</p><h3>Change password</h3>
      <p className="muted">Use a password of at least 8 characters. Changing it signs out other active sessions for this account.</p>
      <label>Current password<input type="password" autoComplete="current-password" required value={passwordDraft.current} onChange={(e) => setPasswordDraft({ ...passwordDraft, current: e.target.value })} /></label>
      <label>New password<input type="password" autoComplete="new-password" required value={passwordDraft.next} onChange={(e) => setPasswordDraft({ ...passwordDraft, next: e.target.value })} /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" required value={passwordDraft.confirm} onChange={(e) => setPasswordDraft({ ...passwordDraft, confirm: e.target.value })} /></label>
      <button className="primary" type="submit" disabled={passwordSaving}>{passwordSaving ? "Changing password…" : "Change password"}</button>
      {passwordMessage && <p className={`notice${/successfully/i.test(passwordMessage) ? "" : " error"}`} role="status">{passwordMessage}</p>}
    </form>

    {user.role === "student" && <section className="panel student-photo-panel">
      <div className="panel-heading"><div><p className="eyebrow">Student card</p><h3>Your photo and card</h3></div><span className={`status-pill ${cardProfile?.photoUrl ? "ok" : "warn"}`}>{cardProfile?.photoUrl ? "Photo on file" : "Photo needed"}</span></div>
      <div className="student-photo-layout">
        <div className="student-photo-preview">{photoSrc ? <img src={photoSrc} crossOrigin={pendingPhoto ? undefined : "use-credentials"} alt={pendingPhoto ? "New photo, not saved yet" : "Your student card photo"} /> : <span>No photo</span>}</div>
        <div className="student-photo-controls">
          {pendingPhoto ? <>
            <p className="notice" role="status"><strong>Check your new photo.</strong> It is not saved yet. The card preview below shows how it will look.</p>
            <div className="actions">
              <button type="button" className="primary" disabled={photoSaving} onClick={uploadPhoto}>{photoSaving ? "Saving…" : "Use this photo"}</button>
              <label className="secondary upload-button">Choose a different photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoSaving} onChange={choosePhoto} /></label>
              <button type="button" className="text-button" disabled={photoSaving} onClick={() => setPendingPhoto(null)}>Cancel</button>
            </div>
          </> : <>
            <p className="muted">Upload a recent, clear photo of your face for your student card. You can delete it or replace it at any time. It is only visible to you and the main administrator.</p>
            <div className="actions">
              <label className="secondary upload-button">{photoSaving ? "Processing…" : cardProfile?.photoUrl ? "Upload a new photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoSaving} onChange={choosePhoto} /></label>
              {cardProfile?.photoUrl && <button type="button" className="danger-button" disabled={photoSaving} onClick={removePhoto}>Delete photo</button>}
            </div>
            {photoUpdated && !Number.isNaN(photoUpdated.getTime()) && <p className="muted small-print">Last updated {photoUpdated.toLocaleString()}{cardProfile?.photoName ? ` · ${cardProfile.photoName}` : ""}</p>}
          </>}
          {photoMessage && <p className="notice" role="status">{photoMessage}</p>}
          {photoError && <p className="error" role="alert">{photoError}</p>}
          <p className="muted small-print">Supported formats: JPG, PNG and WebP. Maximum file size: 5 MB.</p>
        </div>
      </div>
      <div className="student-card-self-preview">
        <p className="eyebrow">Card preview</p>
        {cardProfile?.template
          ? <StudentCardPreview template={cardProfile.template} student={cardStudent} institution={institution} photoSrc={photoSrc} compact />
          : <p className="muted">The main administrator has not published a card design yet. Your photo is saved and will be used once they do.</p>}
      </div>
      <div className="student-card-profile-note"><strong>{institution}</strong> prints your card from this approved design. If any detail is wrong, update your profile above or contact your administrator.</div>
    </section>}
  </section>;
}


function Results({ marks, allMarks, remediations = [], setRemediations, canEdit, apiConnected, setMarks, user, notify, setNotice, passMark, setPassMark, accounts, institution, t = (key) => key, teachingGroups = [] }) {
  const [editing, setEditing] = useState(null);
  const [editingScore, setEditingScore] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const resultId = (mark) => `${mark.studentId}::${mark.subject}::${mark.assessmentId || "assessment"}`;
  // Marks synced from SQLite carry a numeric `id`; locally-added marks (browser-only mode)
  // do not. Only marks with an `id` can be persisted to the database.
  const nextStatusOptions = user.role === "main-admin"
    ? { Draft: ["Submitted"], Submitted: ["Approved"], Approved: ["Published"], Published: ["Locked"] }
    : { Draft: ["Submitted"], Submitted: ["Approved"] };
  const saveFeedback = async (mark, value) => {
    const feedback = String(value ?? "");
    setMarks(marks.map((item) => resultId(item) === resultId(mark) ? { ...item, feedback } : item));
    setEditingFeedback((current) => {
      const next = { ...current };
      delete next[resultId(mark)];
      return next;
    });

    if (!apiConnected || !mark.id) {
      if (!mark.id) notify("Feedback is saved in browser mode. It will sync once this mark exists in SQLite.");
      return;
    }

    try {
      const response = await apiRequest(`/admin/marks/${mark.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const saved = response?.mark;
      if (saved) {
        setMarks((currentMarks) => currentMarks.map((item) =>
          Number(item.id) === Number(saved.id)
            ? { ...item, feedback: saved.feedback ?? "", score: saved.mark ?? item.score, passingMark: saved.passing_mark ?? item.passingMark, status: saved.status ?? item.status }
            : item
        ));
      }
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      notify(`Could not save feedback: ${error.message}`);
    }
  };
  const updateScore = async (mark, value) => {
    const score = Number(value);
    if (mark.id) {
      try {
        const response = await apiRequest(`/admin/marks/${mark.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mark: score }) });
        const saved = response?.mark;
        setMarks((current) => current.map((item) =>
          Number(item.id) === Number(mark.id)
            ? { ...item, score: saved?.mark ?? score, passingMark: saved?.passing_mark ?? item.passingMark, feedback: saved?.feedback ?? item.feedback, status: saved?.status ?? item.status, grade: gradeFor(saved?.mark ?? score, saved?.passing_mark ?? item.passingMark ?? passMark) }
            : item
        ));
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
        const response = await apiRequest(`/admin/marks/${mark.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
        setMarks((current) => current.map((item) => Number(item.id) === Number(mark.id)
          ? { ...item, status: response?.status ?? response?.mark?.status ?? nextStatus }
          : item
        ));
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
  const remediationFor = (mark) => remediations.find(
    (item) => item.studentId === mark.studentId && item.assessmentId === mark.assessmentId,
  );
  const staffGroupMatch = (mark) => {
    if (user.role === "main-admin") return true;
    const account = accounts?.find((item) => item.studentId === mark.studentId);
    if (!account || !teachingGroups.length) return false;
    return teachingGroups.some((group) => group.course === account.course && Number(group.yearLevel) === Number(account.yearLevel));
  };
  const effectiveScore = (mark) => {
    const remediation = remediationFor(mark);
    const remediationIsFinal = remediation && ["Completed", "Resolved"].includes(remediation.status) && remediation.score !== "" && remediation.score != null;
    return remediationIsFinal ? Number(remediation.score) : Number(mark.score ?? 0);
  };
  const markThreshold = (mark) => Number(mark.passingMark ?? remediationFor(mark)?.passingMark ?? passMark);
  const scopedMarks = canEdit
    ? marks.filter(staffGroupMatch)
    : marks.filter((mark) => mark.studentId === user.studentId && ["Published", "Locked"].includes(mark.status || "Published"));
  // Staff-only search so a main admin/admin with dozens of learners on screen can jump
  // straight to one student (by name or student ID) to remark or continue marking, instead
  // of scrolling through every result.
  const searchedMarks = canEdit && search.trim() ? scopedMarks.filter((mark) => `${mark.student || ""} ${mark.studentId || ""}`.toLowerCase().includes(search.trim().toLowerCase())) : scopedMarks;
  const visibleMarks = searchedMarks.filter((mark) => filter === "all" || (filter === "remediation" ? effectiveScore(mark) < markThreshold(mark) : effectiveScore(mark) >= markThreshold(mark)));
  const attempts = visibleMarks.flatMap((mark) => [Number(mark.score || 0), ...(remediationFor(mark)?.score === "" || remediationFor(mark)?.score === undefined ? [] : [Number(remediationFor(mark).score)])]);
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
    const passingMark = Number(data.get("passingMark"));
    const weighting = Number(data.get("weighting"));
    const account = accounts.find((item) => String(item.studentId || "").toLowerCase() === studentId.toLowerCase());

    if (!studentId || !assessmentId || !subject) {
      notify("Student ID, assessment ID and subject are required.");
      return;
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      notify("Score must be between 0 and 100.");
      return;
    }
    const resolvedPassingMark = Number.isFinite(passingMark) ? passingMark : Number(passMark);
    if (!Number.isFinite(resolvedPassingMark) || resolvedPassingMark < 0 || resolvedPassingMark > 100) {
      notify("Passing mark must be between 0 and 100.");
      return;
    }
    const resolvedWeighting = Number.isFinite(weighting) && weighting > 0 ? weighting : 100;
    if (marks.some((mark) => String(mark.studentId || "").toLowerCase() === studentId.toLowerCase() && String(mark.assessmentId || "").toLowerCase() === assessmentId.toLowerCase())) {
      notify("That student and assessment already have a mark.");
      return;
    }
    if (!account && apiConnected) {
      notify("That student ID is not present in the current SQLite student directory.");
      return;
    }

    const localRecord = {
      studentId,
      assessmentId,
      student: account?.name || studentId,
      subject,
      score,
      passingMark: resolvedPassingMark,
      grade: gradeFor(score, resolvedPassingMark),
      weighting: resolvedWeighting,
      status: "Draft",
      feedback: "",
    };

    if (!apiConnected) {
      setMarks((current) => [...current, localRecord]);
      form.reset();
      notify("The mark was added in browser mode. Reconnect SQLite before relying on it as a stored result.");
      return;
    }

    try {
      const response = await apiRequest("/admin/marking/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assessmentId,
          assessmentName: subject,
          mark: score,
          passingMark: resolvedPassingMark,
          academicYear: account?.academicYear || new Date().getFullYear(),
          feedback: "",
          status: "Draft",
        }),
      });
      const saved = response?.release;
      if (!saved?.id) throw new Error("The SQLite API did not return the saved mark record.");
      setMarks((current) => [
        ...current.filter((mark) => !(String(mark.studentId || "").toLowerCase() === studentId.toLowerCase() && String(mark.assessmentId || "").toLowerCase() === assessmentId.toLowerCase())),
        {
          ...localRecord,
          id: saved.id,
          status: saved.status || (user.role === "main-admin" ? "Published" : "Submitted"),
          passingMark: Number(saved.passingMark ?? resolvedPassingMark),
          feedback: saved.feedback || "",
          grade: gradeFor(saved.mark ?? score, saved.passingMark ?? resolvedPassingMark),
        },
      ]);
      form.reset();
      notify(user.role === "main-admin" ? "The mark was published to SQLite." : "The mark was saved to SQLite for main-administrator approval.");
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      notify(`Could not save the mark to SQLite: ${error.message}`);
    }
  };
  const [remediationDrafts, setRemediationDrafts] = useState({});
  const remediationDraftKey = (mark) => `${mark.studentId}::${mark.assessmentId}`;
  const getRemediationView = (mark) => {
    const current = remediationFor(mark);
    const draftValue = remediationDrafts[remediationDraftKey(mark)];
    return draftValue ? { ...current, ...draftValue } : current;
  };
  const updateRemediationDraft = (mark, field, value) => {
    const key = remediationDraftKey(mark);
    setRemediationDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        [field]: ["count", "attemptLimit"].includes(field) ? (value === "" ? "" : Number(value)) : value,
      },
    }));
  };
  const saveRemediation = async (mark) => {
    const current = remediationFor(mark);
    const draftValue = remediationDrafts[remediationDraftKey(mark)] || {};
    const nextStatus = draftValue.status ?? current?.status ?? "Scheduled";
    const nextRecord = normalizeRemediation({
      id: current?.id || `local-${mark.studentId}-${mark.assessmentId}`,
      studentId: mark.studentId,
      studentName: mark.student,
      assessmentId: mark.assessmentId,
      assignmentId: String(mark.assessmentId || "").startsWith("ASSIGN-") ? String(mark.assessmentId).slice(7) : (current?.assignmentId || null),
      assignmentTitle: current?.assignmentTitle || mark.subject || mark.assessmentId,
      subject: mark.subject || current?.subject || mark.assessmentId,
      reason: current?.reason || "failed_mark",
      originalMark: Number(mark.score || 0),
      passingMark: Number(mark.passingMark ?? current?.passingMark ?? passMark),
      date: draftValue.date ?? current?.date ?? "",
      time: draftValue.time ?? current?.time ?? "",
      venue: draftValue.venue ?? current?.venue ?? "",
      instructions: draftValue.instructions ?? current?.instructions ?? "",
      feedback: draftValue.feedback ?? current?.feedback ?? "",
      count: draftValue.count ?? current?.count ?? 0,
      attemptLimit: draftValue.attemptLimit ?? current?.attemptLimit ?? 1,
      score: draftValue.score ?? current?.score ?? "",
      status: nextStatus,
      createdBy: current?.createdBy || user.name,
      createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const operationId = portalBusyStart("Saving remediation instructions and schedule…");
    try {
      if (!apiConnected) {
        setRemediations((items) => current
          ? items.map((item) => item.id === current.id ? nextRecord : item)
          : [...items, nextRecord]);
        setRemediationDrafts((items) => { const next = { ...items }; delete next[remediationDraftKey(mark)]; return next; });
        notify("Remediation details saved in this browser. Reconnect SQLite before final scheduling or student submission.");
        return;
      }
      const payload = {
        studentId: nextRecord.studentId,
        assessmentId: nextRecord.assessmentId,
        assignmentId: nextRecord.assignmentId,
        assignmentTitle: nextRecord.assignmentTitle,
        subject: nextRecord.subject,
        reason: nextRecord.reason,
        originalMark: nextRecord.originalMark,
        passingMark: nextRecord.passingMark,
        remediationDate: nextRecord.date,
        remediationTime: nextRecord.time,
        venue: nextRecord.venue,
        instructions: nextRecord.instructions,
        feedback: nextRecord.feedback,
        attemptLimit: Number(nextRecord.attemptLimit || 1),
        remediationMark: nextRecord.score === "" ? null : Number(nextRecord.score),
        status: nextRecord.status,
      };
      const requestPath = current?.id && !String(current.id).startsWith("local-")
        ? `/admin/remediations/${current.id}`
        : "/admin/remediations";
      const requestOptions = {
        method: current?.id && !String(current.id).startsWith("local-") ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
      const response = await apiRequest(requestPath, requestOptions);
      const savedCase = normalizeRemediation(response.case);
      setRemediations((items) => [...items.filter((item) => item.id !== savedCase.id && item.id !== nextRecord.id), savedCase]);
      setRemediationDrafts((items) => { const next = { ...items }; delete next[remediationDraftKey(mark)]; return next; });
      notify(`Remediation details saved for ${mark.student || mark.studentId}.`);
    } catch (error) {
      notify(`Could not save remediation details: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const deleteMark = async (mark) => {
    if (!canEdit) return;

    const label = `${mark.student || mark.studentId || "learner"} — ${mark.subject || mark.assessmentId || "assessment"}`;
    if (!window.confirm(`Delete this stored mark?\n\n${label}\n\nThis also removes its linked remediation case and mark-release history from SQLite.`)) return;

    // Browser-only marks have no database id. They can still be removed locally.
    if (!mark.id || !apiConnected) {
      setMarks(marks.filter((item) => item !== mark));
      setRemediations((items) =>
        items.filter(
          (item) =>
            !(
              item.studentId === mark.studentId &&
              item.assessmentId === mark.assessmentId
            )
        )
      );
      notify("The local mark was deleted.");
      return;
    }

    try {
      const response = await apiRequest(`/admin/marks/${mark.id}`, {
        method: "DELETE",
      });

      setMarks((items) => items.filter((item) => item.id !== mark.id));
      setRemediations((items) =>
        items.filter(
          (item) =>
            !(
              item.studentId === mark.studentId &&
              item.assessmentId === mark.assessmentId
            )
        )
      );
      window.dispatchEvent(new Event("portal-sync-now"));
      notify(response.message || "Stored mark deleted.");
    } catch (error) {
      notify(`Could not delete the mark: ${error.message}`);
    }
  };
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
                  {remediationFor(mark) && !["Completed", "Resolved"].includes(remediationFor(mark)?.status)
                    ? `R · Original mark ${remediationFor(mark)?.originalMark ?? mark.score}% · remediation is ${remediationFor(mark)?.status?.toLowerCase() || "pending"}.`
                    : effectiveScore(mark) < markThreshold(mark)
                      ? `R · Original/current mark is below the ${markThreshold(mark)}% passing requirement — remediation required.`
                      : `Passing requirement met at ${markThreshold(mark)}%.`}
                </small>

                {!canEdit && (
                  <small>
                    Published {mark.publishedAt || "locally"} · Previous result history is retained
                    {remediationFor(mark) && <> · Original mark: {remediationFor(mark)?.originalMark ?? mark.score}% → Remediation: {remediationFor(mark)?.score != null && remediationFor(mark)?.score !== "" ? `${remediationFor(mark).score}%` : "pending"}</>}
                  </small>
                )}

                {remediationFor(mark) && (() => {
                  const remediation = getRemediationView(mark) || {};
                  const draftKey = remediationDraftKey(mark);
                  const hasUnsaved = Boolean(remediationDrafts[draftKey]);
                  return <div className="remediation-fields">
                    <div className="remediation-history">
                      <strong>Original mark:</strong> {remediation.originalMark ?? mark.score}%
                      {remediation.score !== "" && remediation.score != null
                        ? <> <strong>→ New remediation mark:</strong> {remediation.score}% ({gradeFor(Number(remediation.score), markThreshold(mark))})</>
                        : <> <strong>→ New remediation mark:</strong> Not marked yet</>}
                      <span> · Current result: {effectiveScore(mark)}%</span>
                      {hasUnsaved && <span className="remediation-unsaved">Unsaved changes</span>}
                    </div>
                    <RemediationAttemptFiles remediation={remediation} apiConnected={apiConnected} notify={notify} setNotice={setNotice} onCaseUpdated={(updatedCase) => setRemediations((items) => [...items.filter((item) => item.id !== updatedCase.id), updatedCase])} />
                    <label>Remediation date<input type="date" value={remediation.date || ""} onChange={(e) => updateRemediationDraft(mark, "date", e.target.value)} /></label>
                    <label>Time<input type="time" value={remediation.time || ""} onChange={(e) => updateRemediationDraft(mark, "time", e.target.value)} /></label>
                    <label>Attempts used<input type="number" min="0" value={remediation.count ?? 0} readOnly aria-readonly="true" /></label>
                    <label>Allowed attempts<input type="number" min="1" max="10" value={remediation.attemptLimit ?? 1} onChange={(e) => updateRemediationDraft(mark, "attemptLimit", e.target.value)} /></label>
                    <label>New remediation mark<input type="number" min="0" max="100" value={remediation.score ?? ""} onChange={(e) => updateRemediationDraft(mark, "score", e.target.value)} /></label>
                    <label>Venue<input type="text" value={remediation.venue || ""} onChange={(e) => updateRemediationDraft(mark, "venue", e.target.value)} placeholder="Room / venue" /></label>
                    <label className="remediation-instructions-field">Instructions<textarea rows={4} value={remediation.instructions || ""} onChange={(e) => updateRemediationDraft(mark, "instructions", e.target.value)} placeholder="What the learner must do for the remediation attempt" /></label>
                    <label className="remediation-instructions-field">Feedback<textarea rows={4} value={remediation.feedback || ""} onChange={(e) => updateRemediationDraft(mark, "feedback", e.target.value)} placeholder="Feedback for the remediation attempt" /></label>
                    <label>Remediation status<select value={remediation.status || "Scheduled"} onChange={(e) => updateRemediationDraft(mark, "status", e.target.value)}><option>Open</option><option>Scheduled</option><option>Submitted</option><option>Marked</option><option>Completed</option><option>Cancelled</option><option>Resolved</option></select></label>
                    <div className="remediation-save-row"><button type="button" className="primary" onClick={() => saveRemediation(mark)} disabled={!hasUnsaved}>{hasUnsaved ? "Save remediation details" : "Details saved"}</button><span className="muted small-print">Typing only edits this screen. Save once when the instructions, schedule, mark or feedback are complete.</span></div>
                  </div>;
                })()}
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
                  value={editingFeedback[resultId(mark)] ?? mark.feedback ?? ""}
                  onChange={(e) =>
                    setEditingFeedback((current) => ({
                      ...current,
                      [resultId(mark)]: e.target.value,
                    }))
                  }
                  onBlur={(e) => {
                    setEditing(null);
                    saveFeedback(mark, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="feedback"
                  onClick={() => {
                    if (!canEdit) return;
                    const id = resultId(mark);
                    setEditingFeedback((current) => ({
                      ...current,
                      [id]: mark.feedback || "",
                    }));
                    setEditing(id);
                  }}
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
  return <section className="panel upload-panel"><p className="eyebrow">Main admin workspace</p><h3>Bulk CSV marks upload</h3><p className="muted">Required columns: studentId, assessmentId, mark. The complete file is validated before any marks are stored.</p><label className="file-drop">Choose marks CSV<input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = ""; }} /></label>{file && <p className="muted">{file.name} ready for validation.</p>}<label className="checkbox-line"><input type="checkbox" checked={createAssessments} onChange={(e) => setCreateAssessments(e.target.checked)} />Create missing assessments <small className="small-print">Leave this off so a typo in the assessmentId column is reported instead of quietly creating a new assessment.</small></label><button className="primary" disabled={!file} onClick={upload}>Validate and upload</button><div className="export-tools"><a className="secondary" href={csvDownloadUrl("/admin/marks.csv")} download="marks.csv">Download marks CSV</a><label>Student rows<select value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option value={30}>30</option><option value={50}>50</option><option value={75}>75</option><option value={100}>100</option></select></label><a className="secondary" href={csvDownloadUrl(`/admin/students.csv?limit=${limit}`)} download={`students-${limit}.csv`}>Download {limit} students</a></div></section>;
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

// SQLite CURRENT_TIMESTAMP values ("2026-10-02 10:37:41") are UTC but carry no zone marker, so
// the browser would otherwise display them hours off in any non-UTC timezone.
function serverTime(value) {
  if (!value) return null;
  const text = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text) ? `${text.replace(" ", "T")}Z` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}
const serverTimeText = (value) => serverTime(value)?.toLocaleString() || "";

// The marking room stores feedback as "Criterion: 7/10 · Other: 4/5 — overall comment". Splitting it
// back out lets the learner see exactly which criteria cost them marks.
function parseMarkFeedback(text) {
  const raw = String(text || "").trim();
  if (!raw) return { criteria: [], comment: "" };
  const [head, ...rest] = raw.split(" — ");
  const criteria = head.split(" · ").map((part) => {
    const match = part.match(/^(.*?):\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    return match ? { label: match[1].trim(), score: Number(match[2]), max: Number(match[3]) } : null;
  });
  if (criteria.length && criteria.every(Boolean)) return { criteria, comment: rest.join(" — ").trim() };
  return { criteria: [], comment: raw };
}

function Assignments({
  user,
  assignments,
  setAssignments,
  submissions,
  setSubmissions,
  accounts,
  passMark,
  setRemediations,
  remediations = [],
  apiConnected,
  setNotice,
  teachingGroups = [],
  allTeachingGroups = [],
  catalogueCourses = [],
}) {
  const canManage = user.role !== "student";
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [subSearch, setSubSearch] = useState("");
  const [subAssignmentFilter, setSubAssignmentFilter] = useState("all");
  const [subCourseFilter, setSubCourseFilter] = useState("all");
  const [subYearFilter, setSubYearFilter] = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [conductAgreed, setConductAgreed] = useState({});
  const [saving, setSaving] = useState(false);
  const [remediationSavingId, setRemediationSavingId] = useState(null);

  const currentAcademicYear = new Date().getFullYear();
  const catalogueGroups = user.role === "main-admin"
    ? catalogueCourses.flatMap(([courseName]) => Array.from({ length: 6 }, (_, index) => ({
      course: String(courseName || "").trim(),
      yearLevel: index + 1,
      academicYear: currentAcademicYear,
      source: "catalogue",
    }))).filter((group) => group.course)
    : [];
  const availableGroups = (canManage ? (user.role === "main-admin" ? [...allTeachingGroups, ...catalogueGroups] : teachingGroups) : []).filter(
    (group) => group && group.course && Number.isInteger(Number(group.yearLevel ?? group.year_level))
  );
  const uniqueGroups = Array.from(new Map(availableGroups.map((group) => {
    const yearLevel = Number(group.yearLevel ?? group.year_level);
    const academicYear = Number(group.academicYear ?? group.academic_year ?? new Date().getFullYear());
    return [`${group.course}::${yearLevel}::${academicYear}`, { ...group, yearLevel, academicYear }];
  })).values()).sort((a, b) =>
    `${a.course}-${a.yearLevel}-${a.academicYear}`.localeCompare(`${b.course}-${b.yearLevel}-${b.academicYear}`)
  );
  const groupKey = (group) => `${group.course}::${Number(group.yearLevel)}::${Number(group.academicYear)}`;
  const groupForAssignment = (assignment) => groupKey({
    course: assignment.course,
    yearLevel: assignment.yearLevel,
    academicYear: assignment.academicYear,
  });
  const groupLabel = (group) => `${group.course} · Year ${group.yearLevel} · ${group.academicYear}`;

  const creationGroups = uniqueGroups.filter((group) => Number(group.academicYear) === currentAcademicYear);
  const assignmentEditorGroups = editingAssignment
    ? Array.from(new Map([...uniqueGroups, {
      course: editingAssignment.course,
      yearLevel: Number(editingAssignment.yearLevel),
      academicYear: Number(editingAssignment.academicYear || currentAcademicYear),
      source: "existing-record",
    }].map((group) => [groupKey(group), group])).values())
    : uniqueGroups;

  const normalizeComparableCourse = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  const matchesStudent = (assignment) =>
    !canManage &&
    normalizeComparableCourse(assignment.course) === normalizeComparableCourse(user.course) &&
    Number(assignment.yearLevel) === Number(user.yearLevel);

  const visibleAssignments = canManage
    ? assignments
    : assignments.filter(matchesStudent);
  const currentAssignments = [...visibleAssignments].sort(
    (a, b) => new Date(`${a.due || "9999-12-31"}T${a.dueTime || "23:59"}`).getTime() - new Date(`${b.due || "9999-12-31"}T${b.dueTime || "23:59"}`).getTime()
  );

  const ownSubmission = (assignment) => submissions?.[`${assignment.id}-${user.username}`] || null;
  const submissionRows = canManage
    ? Object.values(submissions || {}).filter((submission) =>
      assignments.some((assignment) => String(assignment.id) === String(submission.assignmentId))
    )
    : [];

  const deadlineOf = assignmentDeadlineOf;
  const assignmentIsOpen = assignmentOpen;
  const isNotOpenYet = assignmentNotOpenYet;
  const isPastDue = (assignment) => {
    const deadline = deadlineOf(assignment);
    return Boolean(deadline && !Number.isNaN(deadline.getTime()) && deadline < new Date() && !assignment.completed && !assignment.openOverride);
  };
  const isAtRisk = (assignment) => {
    const deadline = deadlineOf(assignment);
    if (!deadline || deadline < new Date()) return false;
    return (deadline.getTime() - Date.now()) / 3600000 <= 72 && !ownSubmission(assignment);
  };

  const toggleAgreement = (assignmentId, value) =>
    setConductAgreed((current) => ({ ...current, [assignmentId]: value }));

  const openDownload = async (url, fallbackName, message) => {
    if (!url) {
      setNotice("This file is not available in SQLite storage.");
      return;
    }
    const resolvedUrl = /^(https?:|blob:|data:)/i.test(url) ? url : `${API_BASE}${url}`;
    const operationId = portalBusyStart(`Downloading ${fallbackName || "file"}…`);
    try {
      const response = await fetch(resolvedUrl, { credentials: "include" });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || `Download request returned HTTP ${response.status}.`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fallbackName || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (message) setNotice(message);
      return true;
    } catch (error) {
      setNotice(`Could not download the file: ${error.message}`);
      return false;
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const [reflectionDrafts, setReflectionDrafts] = useState({});
  const [reflectionSavingId, setReflectionSavingId] = useState(null);
  const submissionKey = (submission) => `${submission.assignmentId}-${submission.studentUsername || user.username}`;

  const downloadMarkedCopy = async (submission) => {
    const ok = await openDownload(submission.markedFileUrl, submission.markedFileName, "Marked copy downloaded. Compare it with your submission and note what to improve.");
    if (ok && !canManage && !submission.markedDownloadedAt) {
      setSubmissions((current) => ({ ...current, [submissionKey(submission)]: { ...submission, markedDownloadedAt: new Date().toISOString() } }));
    }
  };

  const saveReflection = async (submission) => {
    if (!apiConnected) return setNotice("Reconnect the backend before saving your reflection.");
    const text = String(reflectionDrafts[submission.id] ?? submission.reflection ?? "").trim();
    if (text.length > 4000) return setNotice("Keep your reflection under 4000 characters.");
    setReflectionSavingId(submission.id);
    try {
      const updated = await apiRequest(`/student/assignment-submissions/${submission.id}/reflection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection: text }),
      });
      setSubmissions((current) => ({ ...current, [submissionKey(submission)]: updated }));
      setReflectionDrafts((current) => { const next = { ...current }; delete next[submission.id]; return next; });
      setNotice(text ? "Reflection saved. Your lecturer can read it when planning support." : "Reflection cleared.");
    } catch (error) {
      setNotice(`Could not save your reflection: ${error.message}`);
    } finally {
      setReflectionSavingId(null);
    }
  };

  const removeMarkedFile = async (submission) => {
    if (!apiConnected) return setNotice("Reconnect the backend before removing a marked copy.");
    if (!window.confirm(`Remove the marked copy "${submission.markedFileName}" from ${submission.studentName}'s submission? The learner will no longer be able to download it.`)) return;
    try {
      const updated = await apiRequest(`/admin/assignment-submissions/${submission.id}/marked-file`, { method: "DELETE" });
      setSubmissions((current) => ({ ...current, [submissionKey(submission)]: updated }));
      setNotice(`Marked copy removed for ${submission.studentName}.`);
    } catch (error) {
      setNotice(`Could not remove the marked copy: ${error.message}`);
    }
  };

  const submit = async (assignment, file) => {
    if (!apiConnected) return setNotice("SQLite is not connected. Reconnect the backend before submitting work.");
    if (!conductAgreed[assignment.id]) return setNotice("Please acknowledge the academic-integrity statement before submitting.");
    if (!file || !/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) {
      return setNotice("Assignments must be submitted as one ZIP file up to 25 MB.");
    }
    const own = ownSubmission(assignment);
    if (own?.closed) {
      return setNotice("Your submission has been closed by staff and cannot be replaced.");
    }
    if (!assignmentIsOpen(assignment)) {
      if (isNotOpenYet(assignment)) return setNotice(`This assignment opens on ${new Date(assignment.start).toLocaleString()}.`);
      return setNotice("This assignment is closed. Ask the lecturer about a remediation workflow.");
    }
    if (!window.confirm(`Upload “${file.name}” for ${assignment.title}?`)) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conductAcknowledged", "true");
    setSaving(true);
    try {
      const response = await apiRequest(`/student/assignments/${assignment.id}/submit`, {
        method: "POST",
        body: formData,
      });
      const saved = response;
      setSubmissions((current) => ({ ...current, [`${assignment.id}-${user.username}`]: saved }));
      setConductAgreed((current) => ({ ...current, [assignment.id]: false }));
      setNotice(`“${file.name}” was saved to SQLite for ${assignment.title}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setNotice(`Could not submit the assignment: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeSubmission = async (assignment) => {
    if (!apiConnected) return setNotice("Reconnect the backend before removing a submission.");
    const own = ownSubmission(assignment);
    if (!own) return;
    if (!assignmentIsOpen(assignment) || own.closed) {
      return setNotice("This submission cannot be removed because the assignment or submission is closed.");
    }
    try {
      await apiRequest(`/student/assignments/${assignment.id}/submission`, { method: "DELETE" });
      setSubmissions((current) => {
        const next = { ...current };
        delete next[`${assignment.id}-${user.username}`];
        return next;
      });
      setNotice("Your submission was removed.");
    } catch (error) {
      setNotice(`Could not remove the submission: ${error.message}`);
    }
  };

  const createMissedRemediation = async (assignment) => {
    if (!canManage || !isPastDue(assignment)) return;
    const eligibleStudents = accounts.filter(
      (account) =>
        account.role === "student" &&
        account.course === assignment.course &&
        Number(account.yearLevel) === Number(assignment.yearLevel) &&
        !submissions[`${assignment.id}-${account.username}`]
    );
    if (!eligibleStudents.length) return setNotice(`No missing submissions were found for "${assignment.title}".`);
    if (!window.confirm(`Create missed-deadline remediation cases for ${eligibleStudents.length} learner(s)?`)) return;
    let created = 0;
    const operationId = portalBusyStart(`Creating remediation cases for ${assignment.title}…`);
    try {
      for (const student of eligibleStudents) {
        try {
          const response = await apiRequest("/admin/remediations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: student.studentId,
              assessmentId: `ASSIGN-${assignment.id}`,
              assignmentId: String(assignment.id),
              assignmentTitle: assignment.title,
              subject: assignment.subject,
              reason: "missed_deadline",
              originalMark: null,
              passingMark: Number(passMark),
              attemptLimit: 1,
              status: "Open",
            }),
          });
          if (response.case) {
            created += 1;
            setRemediations((current) => [
              ...current.filter((item) => item.id !== response.case.id),
              normalizeRemediation(response.case),
            ]);
          }
        } catch (error) {
          setNotice(`Some remediation cases could not be created: ${error.message}`);
          break;
        }
      }
      setNotice(`${created} missed-deadline remediation case(s) created for "${assignment.title}".`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const saveMark = async (submission, value) => {
    if (!apiConnected) return setNotice("Reconnect the backend before recording a final mark.");
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return setNotice("Marks must be between 0 and 100.");
    }
    const operationId = portalBusyStart("Saving assignment mark…");
    try {
      const isFinal = user.role === "main-admin";
      const response = await apiRequest("/admin/marking/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: submission.studentId,
          assessmentId: `ASSIGN-${submission.assignmentId}`,
          assessmentName: submission.assignmentTitle,
          mark: score,
          passingMark: Number(passMark),
          status: isFinal ? "Published" : "Approved",
          feedback: score < passMark
            ? `Remediation is required below ${passMark}%.`
            : `Assignment completed at the ${passMark}% passing threshold.`,
        }),
      });
      if (response.ok) {
        const released = response.release;
        setSubmissions((current) => {
          const key = `${submission.assignmentId}-${submission.studentUsername}`;
          const existing = current[key] || submission;
          return {
            ...current,
            [key]: {
              ...existing,
              mark: released?.mark ?? score,
              markPublishedAt: isFinal ? (released?.updated_at || new Date().toISOString()) : existing.markPublishedAt,
              closed: isFinal ? true : existing.closed,
              closedAt: isFinal ? (existing.closedAt || new Date().toISOString()) : existing.closedAt,
            },
          };
        });
        setNotice(isFinal
          ? `Final mark ${score}% published for ${submission.studentName}.`
          : `Mark ${score}% recorded for ${submission.studentName}; the main administrator can publish it as final.`);
        window.dispatchEvent(new Event("portal-sync-now"));
      }
    } catch (error) {
      setNotice(`The mark could not be saved: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const closeSubmission = async (submission) => {
    if (!apiConnected) return setNotice("Reconnect the backend before closing submissions.");
    const operationId = portalBusyStart(`Closing ${submission.studentName} submission…`);
    try {
      const updated = await apiRequest(`/admin/assignment-submissions/${submission.id}/close`, { method: "PATCH" });
      setSubmissions((current) => ({
        ...current,
        [`${updated.assignmentId}-${updated.studentUsername}`]: updated,
      }));
      setNotice(`Submission closed for ${submission.studentName}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setNotice(`Could not close the submission: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const uploadMarkedFile = async (submission, file) => {
    if (!file) return;
    if (!apiConnected) return setNotice("Reconnect the backend before uploading marked feedback.");
    if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) return setNotice("Marked feedback must be a ZIP file up to 25 MB.");
    const formData = new FormData();
    formData.append("file", file);
    const operationId = portalBusyStart(`Uploading marked feedback ${file.name}…`);
    try {
      const updated = await apiRequest(`/admin/assignment-submissions/${submission.id}/marked-file`, {
        method: "POST",
        body: formData,
      });
      setNotice(`Marked copy returned to ${submission.studentName}. ${updated.markStatus && !["Published", "Locked"].includes(updated.markStatus) ? "They will see it once the mark is published." : "They have been notified."}`);
      setSubmissions((current) => ({ ...current, [`${submission.assignmentId}-${submission.studentUsername}`]: updated }));
    } catch (error) {
      setNotice(`Could not upload marked feedback: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const downloadAllSubmissions = async (assignment, related) => {
    const withFiles = related.filter((submission) => submission.fileUrl);
    if (!withFiles.length) return setNotice("No downloadable submissions are available.");
    const operationId = portalBusyStart(`Preparing ${assignment.title} submissions ZIP…`);
    try {
      const zip = new JSZip();
      let added = 0;
      for (const submission of withFiles) {
        const response = await fetch(`${API_BASE}${submission.fileUrl}`, { credentials: "include" });
        if (!response.ok) continue;
        zip.file(`${submission.studentId}-${submission.fileName}`, await response.blob());
        added += 1;
      }
      if (!added) return setNotice("No submission files could be downloaded.");
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${assignment.title.replace(/[^a-z0-9_-]+/gi, "-")}-submissions.zip`;
      link.click();
      setNotice(`Downloaded ${added} submission(s) for ${assignment.title}.`);
    } catch (error) {
      setNotice(`Could not build the ZIP: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const addAssignment = async (event) => {
    event.preventDefault();
    if (!apiConnected) return setNotice("Reconnect the backend before publishing an assignment.");
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const groupValue = String(data.get("group") || "");
    const group = (editingAssignment ? assignmentEditorGroups : creationGroups).find((item) => groupKey(item) === groupValue);
    if (!group) return setNotice("Select one of the teaching course/year groups assigned in the system.");
    if (!(file instanceof File) || !file.name) return setNotice("Choose the assignment file.");
    const payload = new FormData();
    ["title", "subject", "term", "start", "due", "dueTime", "duration"].forEach((field) => payload.append(field, String(data.get(field) || "")));
    payload.append("course", group.course);
    payload.append("yearLevel", String(group.yearLevel));
    payload.append("academicYear", String(group.academicYear));
    payload.append("file", file);
    setSaving(true);
    try {
      const created = await apiRequest("/admin/assignments", { method: "POST", body: payload });
      setAssignments((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      form.reset();
      setNotice(`Assignment published to ${groupLabel(group)}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setNotice(`Could not publish assignment: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const modifyAssignment = async (event) => {
    event.preventDefault();
    if (!editingAssignment) return;
    if (!apiConnected) return setNotice("Reconnect the backend before modifying assignments.");
    const data = new FormData(event.currentTarget);
    const groupValue = String(data.get("group") || "");
    const group = (editingAssignment ? assignmentEditorGroups : creationGroups).find((item) => groupKey(item) === groupValue);
    if (!group) return setNotice("Select a valid assigned teaching group.");
    const payload = new FormData();
    ["title", "subject", "term", "start", "due", "dueTime", "duration"].forEach((field) => payload.append(field, String(data.get(field) || "")));
    payload.append("course", group.course);
    payload.append("yearLevel", String(group.yearLevel));
    payload.append("academicYear", String(group.academicYear));
    const replacement = data.get("file");
    if (replacement instanceof File && replacement.name) payload.append("file", replacement);
    setSaving(true);
    try {
      const updated = await apiRequest(`/admin/assignments/${editingAssignment.id}`, { method: "PATCH", body: payload });
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingAssignment(null);
      setNotice(`Assignment updated for ${groupLabel(group)}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setNotice(`Could not update assignment: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleted = async (assignment) => {
    if (!apiConnected) return setNotice("Reconnect the backend before changing assignment status.");
    const nextCompleted = !assignment.completed;
    try {
      const updated = await apiRequest(`/admin/assignments/${assignment.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(nextCompleted
        ? "Assignment marked completed and closed to learners."
        : "Assignment reopened for learners; the reopening overrides its original due-date window.");
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setNotice(`Could not update assignment status: ${error.message}`);
    }
  };

  const deleteAssignment = async (assignment) => {
    if (!apiConnected || !window.confirm(`Delete “${assignment.title}” and its submissions?`)) return;
    try {
      await apiRequest(`/admin/assignments/${assignment.id}`, { method: "DELETE" });
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      setSubmissions((current) =>
        Object.fromEntries(Object.entries(current).filter(([, submission]) => String(submission.assignmentId) !== String(assignment.id)))
      );
      setNotice("Assignment deleted.");
    } catch (error) {
      setNotice(`Could not delete assignment: ${error.message}`);
    }
  };

  const studentRemediationCases = !canManage
    ? remediations.filter((item) => item.studentId === user.studentId && !["Completed", "Resolved", "Cancelled"].includes(item.status))
    : [];

  const submitRemediationWork = async (remediation, file) => {
    if (!file) return;
    if (!apiConnected) return setNotice("Reconnect the backend before submitting remediation work.");
    if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) return setNotice("Remediation work must be a ZIP file up to 25 MB.");
    if (remediation.remediationDate) {
      const scheduled = new Date(`${remediation.remediationDate}T${remediation.remediationTime || "00:00"}`).getTime();
      if (Number.isFinite(scheduled) && Date.now() < scheduled) return setNotice(`Your remediation opens on ${new Date(scheduled).toLocaleString()}.`);
    }
    const operationId = portalBusyStart(`Uploading remediation work ${file.name}…`);
    setRemediationSavingId(remediation.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest(`/student/remediations/${remediation.id}/submit`, { method: "POST", body: formData });
      const savedCase = normalizeRemediation(response.case);
      setRemediations((current) => current.map((item) => item.id === savedCase.id ? savedCase : item));
      setNotice(`Remediation work uploaded for ${remediation.assignmentTitle}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setNotice(`Could not submit remediation work: ${error.message}`);
    } finally {
      setRemediationSavingId(null);
      portalBusyEnd(operationId);
    }
  };

  const filteredSubmissions = submissionRows.filter((submission) => {
    const query = subSearch.trim().toLowerCase();
    return (
      (!query || submission.studentName?.toLowerCase().includes(query) || submission.studentId?.toLowerCase().includes(query) || submission.assignmentTitle?.toLowerCase().includes(query)) &&
      (subAssignmentFilter === "all" || String(submission.assignmentId) === String(subAssignmentFilter)) &&
      (subCourseFilter === "all" || submission.course === subCourseFilter) &&
      (subYearFilter === "all" || String(submission.yearLevel) === String(subYearFilter)) &&
      (subStatusFilter === "all" ||
        (subStatusFilter === "Open" && !submission.closed) ||
        (subStatusFilter === "Closed" && submission.closed))
    );
  });

  return (
    <section className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Assignments</p><h2>{canManage ? "Assigned student work" : "Your assignments"}</h2></div>
          <span className="count">{currentAssignments.length}</span>
        </div>

        {!canManage && currentAssignments.length > 0 && (() => {
          const rows = currentAssignments.map((assignment) => ({ assignment, own: ownSubmission(assignment) }));
          const toDo = rows.filter(({ assignment, own }) => !own && assignmentIsOpen(assignment)).length;
          const awaiting = rows.filter(({ own }) => own && own.mark === undefined && !own.markedFileUrl).length;
          const returned = rows.filter(({ own }) => own && (own.mark !== undefined || own.markedFileUrl)).length;
          const unopened = rows.filter(({ own }) => own?.markedFileUrl && !own.markedDownloadedAt).length;
          return (
            <div className="assignment-summary" role="status">
              <span className="summary-chip"><strong>{toDo}</strong> to submit</span>
              <span className="summary-chip"><strong>{awaiting}</strong> awaiting marking</span>
              <span className="summary-chip summary-chip-good"><strong>{returned}</strong> marked &amp; returned</span>
              {unopened > 0 && <span className="summary-chip summary-chip-new"><strong>{unopened}</strong> new marked {unopened === 1 ? "copy" : "copies"} to review</span>}
            </div>
          );
        })()}
        {!currentAssignments.length && (
          <div className="empty-state">
            <p className="muted">{canManage ? "No assignments exist for your assigned teaching groups yet." : "No assignments have been allocated to your course and year group yet."}</p>
            {!canManage && (!String(user.course || "").trim() || !Number.isInteger(Number(user.yearLevel))) && (
              <p className="warning-text">Your student profile is missing a course or year-of-study value. Ask the administrator to update your account; assignments are matched to those two fields.</p>
            )}
          </div>
        )}

        {currentAssignments.map((assignment) => {
          const own = ownSubmission(assignment);
          const related = submissionRows.filter((submission) => String(submission.assignmentId) === String(assignment.id));
          return (
            <div className={`list-row${assignment.completed ? " assignment-completed" : ""}`} key={assignment.id}>
              <div className="file-icon">▣</div>
              <div>
                <strong>{assignment.title}</strong>
                <small>{assignment.subject} · {assignment.course} · Year {assignment.yearLevel} · {assignment.academicYear} · {assignment.term || "—"}</small>
                <small>Due: {assignment.due || "—"} {assignment.dueTime || ""} · {assignment.duration || 60} min</small>
                {isNotOpenYet(assignment) && <small className="warning">Opens: {new Date(assignment.start).toLocaleString()}</small>}
                {assignment.openOverride && !assignment.completed && (canManage || !own?.closed) && <small className="submission">Reopened by staff — learner submission window is active.</small>}
                {assignment.completed && <small className="warning">Closed by staff.</small>}
                {isAtRisk(assignment) && <small className="warning">Due within 72 hours and no submission has been recorded.</small>}
                {isPastDue(assignment) && <small className="warning">Deadline passed; staff can schedule remediation.</small>}
                {own && <small className="submission">Submitted {own.fileName}{own.mark !== undefined ? ` · ${own.mark}%` : ""}{own.closed ? " · Closed" : ""}</small>}
                {canManage && <small className="submission">{related.length} submission(s) · {assignment.completed ? "Completed" : "Open"}</small>}

                <div className="actions">
                  {assignment.downloadUrl && (canManage || assignmentIsOpen(assignment)) && <button className="secondary" type="button" onClick={() => {
                    // Learners may only download the brief while the window is open. Staff keep
                    // access at all times so they can mark and re-issue closed work.
                    if (!canManage && !assignmentIsOpen(assignment)) {
                      return setNotice(isNotOpenYet(assignment)
                        ? `This assignment opens on ${new Date(assignment.start).toLocaleString()}.`
                        : "This assignment is closed, so its brief is no longer available to download.");
                    }
                    openDownload(assignment.downloadUrl, assignment.file, "Assignment file downloaded.");
                  }}>Download assignment</button>}
                  {!canManage && assignment.downloadUrl && !assignmentIsOpen(assignment) && (
                    <span className="muted small-print">{isNotOpenYet(assignment)
                      ? "The brief becomes available when the assignment opens."
                      : "The brief is no longer available because this assignment is closed."}</span>
                  )}

                  {canManage && (
                    <>
                      <button className="secondary" onClick={() => setEditingAssignment(assignment)}>Modify</button>
                      <button className="secondary" onClick={() => toggleCompleted(assignment)}>{assignment.completed ? "Reopen" : "Mark completed"}</button>
                      {isPastDue(assignment) && <button className="secondary" onClick={() => createMissedRemediation(assignment)}>Create missed remediation</button>}
                      {related.some((submission) => submission.fileUrl) && <button className="secondary" onClick={() => downloadAllSubmissions(assignment, related)}>Download submissions ZIP</button>}
                      <button className="text-button danger" onClick={() => deleteAssignment(assignment)}>Delete</button>
                    </>
                  )}

                  {!canManage && !own && assignmentIsOpen(assignment) && (
                    <>
                      <label className="conduct-box">
                        <input type="checkbox" checked={Boolean(conductAgreed[assignment.id])} onChange={(e) => toggleAgreement(assignment.id, e.target.checked)} />
                        I confirm this is my own work.
                      </label>
                      <label className="secondary upload-button">
                        {saving ? "Uploading…" : "Upload ZIP"}
                        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={saving} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; submit(assignment, file); }} />
                      </label>
                    </>
                  )}
                  {!canManage && own && !own.closed && assignmentIsOpen(assignment) && (
                    <button className="text-button danger" onClick={() => removeSubmission(assignment)}>Remove submission</button>
                  )}
                  {!canManage && own?.fileUrl && (
                    <button className="secondary" onClick={() => openDownload(own.fileUrl, own.fileName, "Your submission downloaded.")}>My submission</button>
                  )}
                </div>

                {!canManage && own && (() => {
                  const hasResult = own.mark !== undefined;
                  if (!hasResult && !own.markedFileUrl) {
                    return <p className="feedback-pending">{own.closed
                      ? "Submitted and with your lecturer for marking. You will be notified when your result and marked copy are returned."
                      : "Submitted. Marking starts after the submission window closes."}</p>;
                  }
                  const { criteria, comment } = parseMarkFeedback(own.markFeedback);
                  const passLine = Number(own.passingMark ?? passMark);
                  const passed = hasResult ? (own.passed ?? Number(own.mark) >= passLine) : null;
                  const weak = criteria.filter((criterion) => criterion.max && criterion.score / criterion.max < 0.5);
                  const draftText = reflectionDrafts[own.id] ?? own.reflection ?? "";
                  const dirty = draftText.trim() !== String(own.reflection || "").trim();
                  return (
                    <section className={`feedback-card${passed === false ? " feedback-card-fail" : passed ? " feedback-card-pass" : ""}`} aria-label={`Feedback for ${assignment.title}`}>
                      <header className="feedback-card-head">
                        {hasResult && <span className="feedback-score">{own.mark}%</span>}
                        <div>
                          <strong>{!hasResult ? "Marked work returned" : passed ? "Passed" : `Below the ${passLine}% pass mark`}</strong>
                          <small>{own.markPublishedAt ? `Released ${serverTimeText(own.markPublishedAt)}` : own.markedUploadedAt ? `Returned ${serverTimeText(own.markedUploadedAt)}` : ""}</small>
                        </div>
                      </header>
                      {criteria.length > 0 && (
                        <ul className="feedback-criteria">
                          {criteria.map((criterion) => {
                            const percent = criterion.max ? Math.round((criterion.score / criterion.max) * 100) : 0;
                            return (
                              <li key={criterion.label} className={percent < 50 ? "criterion-weak" : ""}>
                                <span className="criterion-label">{criterion.label}</span>
                                <span className="criterion-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, percent)}%` }} /></span>
                                <strong>{criterion.score}/{criterion.max}</strong>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {comment && <blockquote className="feedback-comment">{comment}</blockquote>}
                      {weak.length > 0 && <p className="feedback-focus">Focus first on: <strong>{weak.map((criterion) => criterion.label).join(", ")}</strong>.</p>}
                      {passed === false && (studentRemediationCases.some((item) => item.assessmentId === `ASSIGN-${assignment.id}`)
                        ? <p className="feedback-focus">Your remediation task is ready under <strong>Remediation assignments</strong> below.</p>
                        : <p className="feedback-focus">A remediation task will appear under <strong>Remediation assignments</strong> below once your lecturer schedules it.</p>)}
                      <div className="actions">
                        {own.markedFileUrl
                          ? <button className="primary" onClick={() => downloadMarkedCopy(own)}>Download marked copy{!own.markedDownloadedAt && <span className="badge-new">New</span>}</button>
                          : <span className="muted small-print">No annotated copy was attached; the feedback above is your full result.</span>}
                      </div>
                      <label className="reflection-field">
                        My reflection: what went wrong and what will I do differently?
                        <textarea rows={3} maxLength={4000} value={draftText} placeholder="e.g. I lost marks on referencing. Next time I will check the citation guide before submitting."
                          onChange={(e) => setReflectionDrafts((current) => ({ ...current, [own.id]: e.target.value }))} />
                      </label>
                      <div className="actions">
                        <button className="secondary" disabled={!dirty || reflectionSavingId === own.id} onClick={() => saveReflection(own)}>{reflectionSavingId === own.id ? "Saving…" : "Save reflection"}</button>
                        {own.reflectionUpdatedAt && !dirty && <small className="muted">Saved {serverTimeText(own.reflectionUpdatedAt)}</small>}
                        {dirty && <small className="muted">Unsaved changes</small>}
                      </div>
                    </section>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </section>

      {!canManage && studentRemediationCases.length > 0 && <section className="panel remediation-assignment-panel">
        <div className="panel-heading"><div><p className="eyebrow">Academic recovery</p><h3>Remediation assignments</h3><p className="muted">These tasks are created by your lecturer/administrator after a failed or missed assessment. Read the instructions before uploading your replacement work.</p></div><span className="count">{studentRemediationCases.length}</span></div>
        <div className="remediation-assignment-list">
          {studentRemediationCases.map((remediation) => {
            const attemptsUsed = Number(remediation.attempts || 0);
            const attemptLimit = Number(remediation.attemptLimit || 1);
            const submitDisabled = !["Open", "Scheduled"].includes(remediation.status) || attemptsUsed >= attemptLimit;
            const scheduledText = remediation.remediationDate ? `${remediation.remediationDate}${remediation.remediationTime ? ` at ${remediation.remediationTime}` : ""}` : "Date to be confirmed";
            return <article className="remediation-assignment-card" key={remediation.id}>
              <div className="remediation-assignment-heading"><div><strong>{remediation.assignmentTitle}</strong><small>{remediation.subject || "Assessment"} · Original mark {remediation.originalMark ?? "—"}% · Passing requirement {remediation.passingMark}%</small></div><span className="status-pill">{remediation.status}</span></div>
              <div className="remediation-assignment-details"><span><b>Scheduled:</b> {scheduledText}</span><span><b>Venue:</b> {remediation.venue || "To be confirmed"}</span><span><b>Attempts used:</b> {remediation.attempts || 0}/{remediation.attemptLimit || 1}</span><span><b>Attempts remaining:</b> {Math.max((remediation.attemptLimit || 1) - (remediation.attempts || 0), 0)}</span></div>
              {remediation.instructions && <div className="remediation-instructions-box"><strong>Instructions</strong><p>{remediation.instructions}</p></div>}
              {remediation.feedback && <div className="remediation-feedback-box"><strong>Staff feedback</strong><p>{remediation.feedback}</p></div>}
              <div className="actions">
                <label className="secondary upload-button">{remediationSavingId === remediation.id ? "Uploading…" : "Upload remediation ZIP"}<input type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={submitDisabled || remediationSavingId === remediation.id} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; submitRemediationWork(remediation, file); }} /></label>
                {remediation.downloadUrl && <button type="button" className="secondary" onClick={() => openDownload(remediation.downloadUrl, remediation.fileName || "remediation-work.zip", "Submitted remediation work downloaded.")}>Download submitted work</button>}
              </div>
              {attemptsUsed >= attemptLimit
                ? <p className="muted small-print">All allowed attempts have been used. Submitted files remain available according to the staff review history.</p>
                : submitDisabled
                  ? <p className="muted small-print">This remediation case is currently {String(remediation.status || "unavailable").toLowerCase()}. Staff must mark the previous attempt before another upload can be opened.</p>
                  : <p className="muted small-print">You may submit attempt {attemptsUsed + 1} of {attemptLimit}. After staff marks a failed first attempt, the next attempt can be opened; attempt files are permanently locked once a second attempt exists.</p>}
            </article>;
          })}
        </div>
      </section>}

      {canManage && (
        editingAssignment ? (
          <form className="panel form-panel" onSubmit={modifyAssignment}>
            <p className="eyebrow">Edit assignment</p>
            <h3>{editingAssignment.title}</h3>
            <label>Title<input name="title" required defaultValue={editingAssignment.title} /></label>
            <label>Subject<input name="subject" required defaultValue={editingAssignment.subject} /></label>
            <label>Teaching group
              <select name="group" required defaultValue={groupForAssignment(editingAssignment)}>
                <option value="">Select an assigned course/year</option>
                {assignmentEditorGroups.map((group) => <option key={groupKey(group)} value={groupKey(group)}>{groupLabel(group)}</option>)}
              </select>
            </label>
            <label>Academic work label<input name="term" defaultValue={editingAssignment.term || ""} placeholder="e.g. Term 3 / Semester 2" /></label>
            <label>Start<input name="start" required type="datetime-local" defaultValue={editingAssignment.start} /></label>
            <label>Due date<input name="due" required type="date" defaultValue={editingAssignment.due} /></label>
            <label>Due time<input name="dueTime" required type="time" defaultValue={editingAssignment.dueTime || "23:59"} /></label>
            <label>Duration (minutes)<input name="duration" required type="number" min="1" defaultValue={editingAssignment.duration || 60} /></label>
            <label>Replace assignment file<input name="file" type="file" /></label>
            <div className="actions">
              <button className="primary" type="submit" disabled={saving}>Save changes</button>
              <button className="text-button" type="button" onClick={() => setEditingAssignment(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <form className="panel form-panel" onSubmit={addAssignment}>
            <p className="eyebrow">Publish work</p>
            <h3>Create an assignment for one teaching group</h3>
            {creationGroups.length === 0
              ? <p className="error">No course/year groups are available for new assignments in the current academic year.</p>
              : <>
                <label>Title<input name="title" required placeholder="e.g. Week 3 essay" /></label>
                <label>Subject<input name="subject" required placeholder="e.g. Programming" /></label>
                <label>Teaching group
                  <select name="group" required defaultValue="">
                    <option value="">Select an assigned course/year</option>
                    {creationGroups.map((group) => <option key={groupKey(group)} value={groupKey(group)}>{groupLabel(group)}</option>)}
                  </select>
                  <small className="muted">The selected teaching group is the only student audience for this assignment.</small>
                </label>
                <label>Term or semester<input name="term" placeholder="e.g. Term 3 / Semester 2" /></label>
                <label>Start<input name="start" required type="datetime-local" /></label>
                <label>Due date<input name="due" required type="date" /></label>
                <label>Due time<input name="dueTime" required type="time" defaultValue="23:59" /></label>
                <label>Duration (minutes)<input name="duration" required type="number" min="1" defaultValue="60" /></label>
                <label>Assignment file<input name="file" required type="file" /></label>
                <button className="primary" type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish assignment"}</button>
              </>}
          </form>
        )
      )}

      {canManage && (
        <section className="panel wide-panel">
          <div className="panel-heading"><div><p className="eyebrow">Submissions</p><h3>Search and mark student work</h3></div><span className="count">{filteredSubmissions.length}</span></div>
          <div className="filter-bar">
            <input className="search-input" placeholder="Search learner, ID or assignment…" value={subSearch} onChange={(e) => setSubSearch(e.target.value)} />
            <select value={subAssignmentFilter} onChange={(e) => setSubAssignmentFilter(e.target.value)}><option value="all">All assignments</option>{assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
            <select value={subCourseFilter} onChange={(e) => setSubCourseFilter(e.target.value)}><option value="all">All courses</option>{[...new Set(submissionRows.map((s) => s.course).filter(Boolean))].sort().map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select value={subYearFilter} onChange={(e) => setSubYearFilter(e.target.value)}><option value="all">All years</option>{[...new Set(submissionRows.map((s) => s.yearLevel).filter(Boolean))].sort((a, b) => a - b).map((y) => <option key={y} value={y}>{`Year ${y}`}</option>)}</select>
            <select value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="Open">Open</option><option value="Closed">Closed</option></select>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Learner</th><th>Course</th><th>Year</th><th>Assignment</th><th>File</th><th>Status</th><th>Mark</th><th>Actions</th></tr></thead>
              <tbody>
                {!filteredSubmissions.length && <tr><td colSpan="8" className="muted">No submissions match the filters.</td></tr>}
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.studentName}<small> ({submission.studentId})</small></td>
                    <td>{submission.course}</td>
                    <td>{submission.yearLevel}</td>
                    <td>{submission.assignmentTitle}</td>
                    <td>{submission.fileName}</td>
                    <td>{submission.closed ? "Closed" : "Open"}
                      {submission.markedFileUrl && <small className="returned-status">{submission.markedDownloadedAt ? `Marked copy opened ${serverTime(submission.markedDownloadedAt)?.toLocaleDateString()}` : "Marked copy not opened yet"}</small>}
                      {submission.reflection && <details className="reflection-peek"><summary>Learner reflection</summary><p>{submission.reflection}</p></details>}
                    </td>
                    <td>{submission.closed
                      ? <input type="number" min="0" max="100" defaultValue={submission.mark ?? ""} aria-label={`Mark for ${submission.studentName}`} onBlur={(e) => { if (e.target.value === "" || Number(e.target.value) === Number(submission.mark)) return; saveMark(submission, e.target.value); }} />
                      : "—"}</td>
                    <td className="table-actions">
                      <button className="secondary" onClick={() => openDownload(submission.fileUrl, submission.fileName, "Submission opened.")}>Download</button>
                      {!submission.closed && <button className="secondary" onClick={() => closeSubmission(submission)}>Close</button>}
                      <label className="secondary upload-button" title="Upload the annotated work as a ZIP. This also closes the submission.">{submission.markedFileUrl ? "Replace marked copy" : "Return marked copy"}<input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; uploadMarkedFile(submission, file); }} /></label>
                      {submission.markedFileUrl && <button className="secondary" onClick={() => openDownload(submission.markedFileUrl, submission.markedFileName, "Marked copy opened.")}>View marked copy</button>}
                      {submission.markedFileUrl && <button className="text-button danger" onClick={() => removeMarkedFile(submission)}>Remove marked copy</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small-print">Administrators record marks; the main administrator can publish them as final results. All assignment and submission files are stored by the server, not in browser localStorage.</p>
        </section>
      )}
    </section>
  );
}

// Test/exam question import. The import is deliberately client-side: the selected question file is
// parsed into the same validated question objects used by the editor, then persisted when the staff
// member saves the test. Supported formats: JSON, CSV and a simple labelled TXT template.
function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') { current += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { values.push(current.trim()); current = ""; continue; }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function normalizeImportedQuestion(raw, index) {
  const rawType = raw.type ?? raw.questiontype ?? raw.question_type ?? "mcq";
  const type = String(rawType).toLowerCase().includes("essay") || String(rawType).toLowerCase().includes("long") ? "essay" : "mcq";
  const question = String(raw.question ?? raw.questiontext ?? raw.prompt ?? raw.q ?? "").trim();
  if (!question) throw new Error(`Question ${index + 1} is missing its question text.`);
  const pointsValue = raw.points ?? raw.marks ?? raw.mark ?? 1;
  const points = Number(pointsValue);
  if (!Number.isFinite(points) || points <= 0) throw new Error(`Question ${index + 1} has an invalid mark allocation.`);
  if (type === "essay") {
    return { type, question, points, modelAnswer: String(raw.modelAnswer ?? raw.modelanswer ?? raw.model_answer ?? raw.guidance ?? "").trim() };
  }
  const csvOptions = [raw.option1, raw.option2, raw.option3, raw.option4].filter((value) => value !== undefined);
  const letterOptions = [raw.a, raw.b, raw.c, raw.d].filter((value) => value !== undefined);
  if (Array.isArray(raw.options) && raw.options.length > 4) throw new Error(`Question ${index + 1} has more than four MCQ options.`);
  const options = Array.isArray(raw.options)
    ? raw.options.slice(0, 4).map((value) => String(value || "").trim())
    : (csvOptions.length ? csvOptions : letterOptions).map((value) => String(value || "").trim());
  const correctRaw = raw.correct ?? raw.answer ?? raw.correctAnswer ?? raw.correctanswer ?? 0;
  let correct;
  if (/^[0-9]+$/.test(String(correctRaw).trim())) correct = Number(correctRaw);
  else {
    const letter = String(correctRaw).trim().toUpperCase();
    correct = ["A", "B", "C", "D"].indexOf(letter);
  }
  if (options.length < 2 || options.some((option) => !option)) throw new Error(`Question ${index + 1} needs at least two non-empty MCQ options.`);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new Error(`Question ${index + 1} has an invalid correct answer. Use 0–${options.length - 1} or A–${String.fromCharCode(64 + options.length)}.`);
  return { type, question, points, options, correct };
}

function parseQuestionImport(text, fileName = "questions.txt") {
  const rawText = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!rawText) throw new Error("The question file is empty.");
  const extension = String(fileName).split(".").pop().toLowerCase();
  try {
    if (extension === "json" || rawText.startsWith("[") || rawText.startsWith("{")) {
      const parsed = JSON.parse(rawText);
      const rows = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(rows)) throw new Error("JSON must contain an array of questions or a { questions: [...] } object.");
      return rows.map(normalizeImportedQuestion);
    }
    const lines = rawText.split(/\r?\n/).filter((line) => line.trim());
    if (extension === "csv" || ((lines[0] || "").toLowerCase().includes("question") && (lines[0] || "").toLowerCase().includes("option"))) {
      const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase().replace(/\s+/g, ""));
      return lines.slice(1).map((line, index) => {
        const values = parseCsvLine(line);
        const row = {};
        headers.forEach((header, column) => { row[header] = values[column] ?? ""; });
        return normalizeImportedQuestion(row, index);
      });
    }
    const blocks = rawText.split(/\n\s*\n|\n---+\s*\n/).map((block) => block.trim()).filter(Boolean);
    return blocks.map((block, index) => {
      const row = {};
      const optionMap = { a: "option1", b: "option2", c: "option3", d: "option4" };
      block.split(/\r?\n/).forEach((line) => {
        const match = /^\s*(Q(?:uestion)?\s*\d*|Type|Marks?|A|B|C|D|Answer|Correct(?: answer)?|Model answer|Guidance)\s*:\s*(.*)$/i.exec(line);
        if (!match) return;
        const key = match[1].toLowerCase().replace(/\s+/g, "");
        const value = match[2].trim();
        if (/^q/.test(key)) row.question = value;
        else if (key === "type") row.type = value;
        else if (/^marks?$/.test(key)) row.points = value;
        else if (optionMap[key]) row[optionMap[key]] = value;
        else if (/^(answer|correctanswer)$/.test(key)) row.correct = value;
        else if (/^(modelanswer|guidance)$/.test(key)) row.modelAnswer = value;
      });
      return normalizeImportedQuestion(row, index);
    });
  } catch (error) {
    throw new Error(`Could not import questions: ${error.message}`);
  }
}

// Tests & Exams — auto-marked multiple-choice assessments scoped to a course and year level,
// separate from file-based Assignments. Students attempt a test (up to maxAttempts); each
// attempt is scored instantly against the answer key, and the best score feeds the same
// pass/remediation notification pattern used for marks/assignments.
const testVersionKey = (test) => `${test?.updatedAt || ""}|${JSON.stringify(test?.questions || [])}`;

function TestsExams({
  user,
  tests,
  setTests,
  attempts,
  setAttempts,
  accounts,
  setMarks,
  passMark,
  notify,
  apiConnected,
  teachingGroups = [],
  allTeachingGroups = [],
  remediations = [],
  catalogueCourses = [],
}) {
  const canManage = user.role !== "student";
  const [editing, setEditing] = useState(null);
  const [taking, setTaking] = useState(null);
  const [takingMode, setTakingMode] = useState("normal");
  const [answers, setAnswers] = useState({});
  const [courseFilter, setCourseFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [reviewMarks, setReviewMarks] = useState([]);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewQuestionFeedback, setReviewQuestionFeedback] = useState([]);
  const [questionImportMode, setQuestionImportMode] = useState("append");
  const [questionImporting, setQuestionImporting] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [testRevisionNotice, setTestRevisionNotice] = useState("");

  const currentAcademicYear = new Date().getFullYear();
  const catalogueGroups = user.role === "main-admin"
    ? catalogueCourses.flatMap(([courseName]) => Array.from({ length: 6 }, (_, index) => ({
      course: String(courseName || "").trim(),
      yearLevel: index + 1,
      academicYear: currentAcademicYear,
      source: "catalogue",
    }))).filter((group) => group.course)
    : [];
  const availableGroups = (user.role === "main-admin" ? [...allTeachingGroups, ...catalogueGroups] : teachingGroups)
    .filter((group) => group?.course && Number.isInteger(Number(group.yearLevel ?? group.year_level)))
    .map((group) => ({
      ...group,
      yearLevel: Number(group.yearLevel ?? group.year_level),
      academicYear: Number(group.academicYear ?? group.academic_year ?? currentAcademicYear),
    }));

  const uniqueGroups = Array.from(new Map(availableGroups.map((group) => [
    `${group.course}::${group.yearLevel}::${group.academicYear}`,
    group,
  ])).values());

  const groupKey = (group) =>
    `${group.course || ""}::${Number(group.yearLevel || 0)}::${Number(group.academicYear || new Date().getFullYear())}`;

  const groupLabel = (group) =>
    `${group.course} · Year ${group.yearLevel} · ${group.academicYear}`;

  const creationGroups = uniqueGroups.filter((group) => Number(group.academicYear) === currentAcademicYear);
  const testEditorGroups = editing
    ? Array.from(new Map([...uniqueGroups, {
      course: editing.course,
      yearLevel: Number(editing.yearLevel),
      academicYear: Number(editing.academicYear || currentAcademicYear),
      source: "existing-record",
    }].map((group) => [groupKey(group), group])).values())
    : uniqueGroups;

  const totalPoints = (test) => (test.questions || []).reduce(
    (sum, question) => sum + Math.max(0.01, Number(question.points ?? 1) || 1),
    0
  );

  const testWindow = (test) => {
    const now = Date.now();
    if (test.completed) return { open: false, state: "closed", label: "Closed by staff" };
    if (test.openOverride) return { open: true, state: "open", label: "Open now (staff override)" };
    const start = testStartDate(test);
    const due = testDueDate(test);
    if (!start || !due) return { open: false, state: "invalid", label: "Schedule needs attention" };
    if (now < start.getTime()) return { open: false, state: "scheduled", label: `Opens ${start.toLocaleString()}` };
    if (now > due.getTime()) return { open: false, state: "closed", label: `Closed ${due.toLocaleString()}` };
    return { open: true, state: "open", label: `Open until ${due.toLocaleString()}` };
  };

  const visibleTests = tests.filter((test) => user.role === "main-admin"
    ? true
    : canManage
      ? uniqueGroups.some((group) =>
        group.course === test.course &&
        Number(group.yearLevel) === Number(test.yearLevel) &&
        Number(group.academicYear) === Number(test.academicYear)
      )
      : test.course === user.course && Number(test.yearLevel) === Number(user.yearLevel)
  );

  const filteredTests = visibleTests
    .filter((test) =>
      (courseFilter === "all" || test.course === courseFilter) &&
      (yearFilter === "all" || String(test.yearLevel) === yearFilter) &&
      (statusFilter === "all" || testWindow(test).state === statusFilter)
    )
    .sort((a, b) => {
      const order = { invalid: 0, open: 1, scheduled: 2, closed: 3 };
      const byState = order[testWindow(a).state] - order[testWindow(b).state];
      if (byState) return byState;
      const aDate = testStartDate(a);
      const bDate = testStartDate(b);
      return (bDate ? bDate.getTime() : 0) - (aDate ? aDate.getTime() : 0);
    });

  const statusCounts = visibleTests.reduce((acc, test) => {
    const { state } = testWindow(test);
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, { open: 0, scheduled: 0, closed: 0, invalid: 0 });

  const testCourses = [...new Set(visibleTests.map((test) => test.course).filter(Boolean))].sort();
  const testYears = [...new Set(visibleTests.map((test) => String(test.yearLevel)).filter(Boolean))].sort();

  const attemptsFor = (testId, studentId) => attempts[`${testId}-${studentId}`] || [];
  const remediationForTest = (testId, studentId) =>
    remediations.find((item) => item.studentId === studentId && item.assessmentId === `TEST-${testId}`);
  const normalAttemptsFor = (testId, studentId) =>
    attemptsFor(testId, studentId).filter((attempt) => !attempt.isRemediation);
  const remediationAttemptsFor = (testId, studentId) =>
    attemptsFor(testId, studentId).filter((attempt) => Boolean(attempt.isRemediation));

  const bestScore = (testId, studentId) => {
    const list = normalAttemptsFor(testId, studentId).filter((item) => !item.needsReview);
    return list.length ? Math.max(...list.map((item) => Number(item.score))) : null;
  };

  const studentsForTest = (test) => accounts
    .filter((account) =>
      account.role === "student" &&
      account.course === test.course &&
      Number(account.yearLevel) === Number(test.yearLevel)
    )
    .filter((account) => user.role === "main-admin" || teachingGroups.some((group) =>
      group.course === account.course &&
      Number(group.yearLevel) === Number(account.yearLevel) &&
      Number(group.academicYear ?? new Date().getFullYear()) === Number(test.academicYear)
    ))
    .filter((account) =>
      !search ||
      account.name.toLowerCase().includes(search.toLowerCase()) ||
      (account.studentId || "").toLowerCase().includes(search.toLowerCase())
    );

  const draftKeyFor = useCallback((test, mode) => `portal-test-draft-${user.id}-${test.id}-${mode}`, [user.id]);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const saveDraftNow = useCallback(() => {
    if (!taking || !activeSession?.id || user.role !== "student") return false;
    const payload = {
      testId: String(taking.id),
      mode: takingMode,
      sessionId: activeSession.id,
      versionKey: activeSession.versionKey || testVersionKey(taking),
      answers,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKeyFor(taking, takingMode), JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
    return true;
  }, [taking, activeSession, user.role, takingMode, answers, draftKeyFor]);

  useEffect(() => {
    if (!taking || !activeSession?.id || user.role !== "student") return undefined;
    saveDraftNow();
    return undefined;
  }, [taking, activeSession?.id, user.role, saveDraftNow]);

  useEffect(() => {
    if (!taking || !activeSession?.id || user.role !== "student") return undefined;
    const timer = setInterval(() => { saveDraftNow(); }, 15000);
    return () => clearInterval(timer);
  }, [taking, activeSession?.id, user.role, saveDraftNow]);

  useEffect(() => {
    if (!taking || !activeSession?.id || user.role !== "student") return undefined;
    const handleBeforeUnload = () => { saveDraftNow(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [taking, activeSession?.id, user.role, saveDraftNow]);

  useEffect(() => {
    if (!activeSession?.expiresAt) { setRemainingSeconds(null); return undefined; }
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(activeSession.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) notifyRef.current("This test session has reached its time limit. Your saved browser draft remains available, but the server will reject a late submission.");
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeSession?.expiresAt]);

  useEffect(() => {
    if (!taking || !activeSession?.versionKey) return;
    const currentTest = tests.find((item) => String(item.id) === String(taking.id));
    if (currentTest && testVersionKey(currentTest) !== activeSession.versionKey) {
      setTestRevisionNotice("Staff have updated this test since you started. Your current attempt remains on the version you started; the new version will apply to future attempts.");
    } else {
      setTestRevisionNotice("");
    }
  }, [tests, taking, activeSession?.versionKey]);

  const importQuestions = async (event, current) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = String(file.name).split(".").pop().toLowerCase();
    if (!["json", "csv", "txt"].includes(extension)) return notify("Question files must be JSON, CSV or TXT.");
    if (file.size > 2 * 1024 * 1024) return notify("Question files are limited to 2 MB to keep the editor responsive.");
    setQuestionImporting(true);
    const operationId = portalBusyStart(`Importing questions from ${file.name}…`);
    try {
      const imported = parseQuestionImport(await file.text(), file.name);
      const nextQuestions = questionImportMode === "replace" ? imported : [...(current.questions || []), ...imported];
      setEditing({ ...current, questions: nextQuestions });
      notify(`${imported.length} question(s) imported from ${file.name}. Review them before saving the test.`);
    } catch (error) {
      notify(error.message);
    } finally {
      setQuestionImporting(false);
      portalBusyEnd(operationId);
    }
  };

  const openReview = (student, test, attempt) => {
    if (!attempt) return;
    const reviewQuestions = Array.isArray(attempt.questionSnapshot) && attempt.questionSnapshot.length ? attempt.questionSnapshot : (test.questions || []);
    const marks = reviewQuestions.map((question, index) => {
      const saved = Array.isArray(attempt.questionMarks) ? attempt.questionMarks[index] : null;
      const max = Math.max(0.01, Number(question.points ?? 1) || 1);
      const fallbackAuto = question.type === "essay"
        ? ""
        : (Number(attempt.answers?.[index]) === Number(question.correct) ? max : 0);
      const auto = question.type === "essay" ? "" : Number(saved?.awarded ?? saved?.score ?? fallbackAuto);
      return auto === "" || auto == null ? "" : Number(auto);
    });
    setReviewMarks(marks);
    setReviewQuestionFeedback(Array.isArray(attempt.questionFeedback) ? [...attempt.questionFeedback] : reviewQuestions.map((_, index) => String(attempt.questionMarks?.[index]?.feedback || "")));
    setReviewFeedback(attempt.reviewFeedback || "");
    setReviewing({ student, test: { ...test, questions: reviewQuestions }, attempt });
  };

  const startTest = async (test, mode = "normal") => {
    const list = attemptsFor(test.id, user.studentId);
    const normalAttempts = normalAttemptsFor(test.id, user.studentId);
    const remediationAttempts = remediationAttemptsFor(test.id, user.studentId);
    const windowState = testWindow(test);
    if (mode === "remediation") {
      const remediation = remediationForTest(test.id, user.studentId);
      if (!remediation || !["Open", "Scheduled", "Marked"].includes(remediation.status)) return notify("The remediation test is not currently available.");
      if (remediation.remediationDate) {
        const scheduled = new Date(`${remediation.remediationDate}T${remediation.remediationTime || "00:00"}`).getTime();
        if (Number.isFinite(scheduled) && Date.now() < scheduled) return notify(`Your remediation test opens on ${new Date(scheduled).toLocaleString()}.`);
      }
      if (remediationAttempts.length >= Number(remediation.attemptLimit || 1)) return notify("The allowed remediation attempt has already been used.");
    } else {
      if (!windowState.open) return notify(`This test is not open yet. ${windowState.label}`);
      if (normalAttempts.length >= Number(test.maxAttempts)) return notify(`No normal attempts remain for ${test.title}.`);
    }
    if (list.length >= 10) return notify(`No more stored attempts are available for ${test.title}.`);
    if (!apiConnected) return notify("Reconnect the backend before starting this test.");

    const operationId = portalBusyStart(mode === "remediation" ? "Preparing remediation test…" : "Preparing test / exam…");
    try {
      const draftKey = draftKeyFor(test, mode);
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch (_) { draft = null; }

      if (draft?.sessionId) {
        try {
          const resumed = await apiRequest(`/student/test-attempt-sessions/${encodeURIComponent(draft.sessionId)}`);
          if (resumed?.session) {
            const session = resumed.session;
            const takingTest = { ...test, questions: session.questions, _versionKey: draft.versionKey || testVersionKey(test) };
            setTakingMode(mode);
            setActiveSession({ ...session, versionKey: draft.versionKey || testVersionKey(test) });
            setTaking(takingTest);
            setAnswers(draft.answers && typeof draft.answers === "object" ? draft.answers : {});
            setDraftSavedAt(draft.savedAt || null);
            notify("Your saved test work has been restored.");
            return;
          }
        } catch (_) {
          return notify("The saved test session could not be restored right now. Your answers remain saved in this browser. Please retry before starting a new attempt.");
        }
      }

      const response = await apiRequest("/student/test-attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: String(test.id), isRemediation: mode === "remediation" }),
      });
      const session = response.session;
      const takingTest = { ...test, questions: session.questions || [], _versionKey: testVersionKey(test) };
      setTakingMode(mode);
      setActiveSession({ ...session, versionKey: testVersionKey(test) });
      setTaking(takingTest);
      setAnswers({});
      setDraftSavedAt(null);
    } catch (error) {
      notify(`Could not start the test: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const downloadDraftRecoveryCopy = () => {
    if (!taking || user.role !== "student") return;
    const payload = {
      portal: "Meridian Learning Hub",
      testId: String(taking.id),
      testTitle: taking.title,
      sessionId: activeSession?.id || null,
      mode: takingMode,
      savedAt: new Date().toISOString(),
      answers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `meridian-${String(taking.title || "test").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-recovery.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    notify("A recovery copy of your answers has been downloaded.");
  };

  const submitTestNow = async (saveBeforeSubmit = false) => {
    if (!taking || !activeSession?.id) return;
    if (!apiConnected) return notify("Reconnect the backend before submitting a test. Your local draft remains saved.");
    if (saveBeforeSubmit) saveDraftNow();
    const operationId = portalBusyStart(takingMode === "remediation" ? "Submitting remediation attempt…" : "Submitting test / exam…");
    try {
      const response = await apiRequest("/student/test-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: String(taking.id),
          sessionId: activeSession.id,
          isRemediation: takingMode === "remediation",
          answers,
        }),
      });
      const key = `${taking.id}-${user.studentId}`;
      const savedAttempt = response.attempt;
      setAttempts((current) => ({
        ...current,
        [key]: [...(current[key] || []).filter((item) => Number(item.id) !== Number(savedAttempt?.id)), savedAttempt],
      }));
      if (response.mark) {
        const mark = response.mark;
        const nextMark = {
          id: mark.id, studentId: mark.studentId, assessmentId: mark.assessmentId, student: user.name,
          subject: taking.subject, score: Number(mark.mark), weighting: Number(mark.weighting ?? 100),
          passingMark: Number(mark.passingMark ?? taking.passingMark ?? passMark),
          grade: gradeFor(mark.mark, Number(mark.passingMark ?? taking.passingMark ?? passMark)),
          status: mark.status, feedback: mark.feedback || "", publishedAt: new Date().toISOString().slice(0, 10),
        };
        setMarks((current) => {
          const found = current.findIndex((item) => item.studentId === nextMark.studentId && item.assessmentId === nextMark.assessmentId);
          return found >= 0 ? current.map((item, index) => index === found ? { ...item, ...nextMark } : item) : [...current, nextMark];
        });
      }
      localStorage.removeItem(draftKeyFor(taking, takingMode));
      setTaking(null); setActiveSession(null); setAnswers({}); setTakingMode("normal"); setDraftSavedAt(null); setRemainingSeconds(null); setShowSubmitConfirm(false);
      notify(response.needsReview
        ? `${taking.title} submitted. Staff marking is required before the final result is published.`
        : response.remediation
          ? `${taking.title} submitted. You need remediation because the result is below the pass mark.`
          : `${taking.title} submitted and saved to SQLite.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      // Keep taking + answers intact so a server outage never destroys the student's unsent work.
      saveDraftNow();
      notify(`Could not submit the test: ${error.message}. Your work remains saved in this browser.`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const submitTest = () => {
    if (!taking) return;
    saveDraftNow();
    setShowSubmitConfirm(true);
  };

  const saveTest = async (test) => {
    if (!apiConnected) return notify("Reconnect the backend before saving a test.");
    // The editor offers testEditorGroups, which also contains the group an existing test
    // already belongs to. Looking the selection up in uniqueGroups alone meant any test
    // outside the current teaching scope (for example one from a previous academic year)
    // failed to save with a misleading "needs a teaching group" message.
    const group = testEditorGroups.find((item) => groupKey(item) === groupKey(test));
    const questions = (test.questions || []).map((question) => ({
      type: question.type === "essay" ? "essay" : "mcq",
      question: String(question.question || "").trim(),
      points: Number(question.points),
      options: Array.isArray(question.options)
        ? question.options.map((option) => String(option || "").trim())
        : undefined,
      correct: question.type === "essay" ? undefined : Number(question.correct ?? 0),
      modelAnswer: question.type === "essay" ? String(question.modelAnswer || "").trim() : undefined,
    }));

    const cleanTest = {
      ...test,
      title: String(test.title || "").trim(),
      subject: String(test.subject || "").trim(),
      passingMark: Number(test.passingMark),
      maxAttempts: Number(test.maxAttempts),
      durationMinutes: Number(test.durationMinutes),
      questions,
    };

    const sum = questions.reduce((value, question) => value + Math.max(0.01, Number(question.points) || 0), 0);
    const hasInvalidPoints = questions.some((question) =>
      !Number.isFinite(Number(question.points)) || Number(question.points) <= 0 || Number(question.points) > 1000
    );
    const invalidQuestionIndex = questions.findIndex((question) => {
      if (!question.question) return true;
      if (question.type === "essay") return false;
      return !Array.isArray(question.options) || question.options.length < 2 || question.options.some((option) => !option) ||
        !Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length;
    });

    if (!group || !cleanTest.title || !cleanTest.subject || !questions.length) {
      return notify("A test needs a title, subject, assigned teaching group and at least one question.");
    }
    const startDate = testStartDate(cleanTest);
    const dueDateValue = testDueDate(cleanTest);
    if (!startDate) return notify("Set a valid opening date and time for this test.");
    if (!dueDateValue) return notify("Set a valid closing date for this test.");
    if (dueDateValue <= startDate) return notify("The test closing date/time must be after its opening date/time.");
    if (invalidQuestionIndex >= 0) return notify(`Question ${invalidQuestionIndex + 1} is incomplete. Add question text and, for MCQs, complete at least two options and choose the correct answer.`);
    if (hasInvalidPoints || sum <= 0) return notify("Every test question must have a mark allocation greater than 0 and no more than 1000 points.");
    if (!Number.isFinite(cleanTest.passingMark) || cleanTest.passingMark < 0 || cleanTest.passingMark > 100) return notify("Passing mark must be between 0 and 100.");
    if (!Number.isInteger(cleanTest.maxAttempts) || cleanTest.maxAttempts < 1 || cleanTest.maxAttempts > 10) return notify("Maximum attempts must be a whole number from 1 to 10.");
    if (!Number.isFinite(cleanTest.durationMinutes) || cleanTest.durationMinutes < 1 || cleanTest.durationMinutes > 1440) return notify("Duration must be between 1 and 1440 minutes.");

    const operationId = portalBusyStart("Saving test / exam…");
    try {
      const method = test.id && tests.some((item) => item.id === test.id) ? "PATCH" : "POST";
      const path = method === "PATCH" ? `/admin/tests/${test.id}` : "/admin/tests";
      const saved = await apiRequest(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTest.title,
          subject: cleanTest.subject,
          course: group.course,
          yearLevel: group.yearLevel,
          academicYear: group.academicYear,
          startAt: normalizeLocalDateTime(cleanTest.startAt),
          dueDate: toLocalWallClock(dueDateValue).slice(0, 10),
          dueTime: String(cleanTest.dueTime || "23:59").slice(0, 5),
          completed: Boolean(cleanTest.completed),
          openOverride: Boolean(cleanTest.openOverride),
          passingMark: cleanTest.passingMark,
          maxAttempts: cleanTest.maxAttempts,
          durationMinutes: cleanTest.durationMinutes,
          questions,
        }),
      });
      setTests((current) => method === "POST"
        ? [saved, ...current]
        : current.map((item) => item.id === saved.id ? saved : item));
      setEditing(null);
      notify(`${saved.title} saved for ${groupLabel(group)}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      notify(`Could not save the test: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const setTestStatus = async (test, completed) => {
    if (!apiConnected) return notify("Reconnect the backend before changing a test status.");
    const operationId = portalBusyStart(`${completed ? "Closing" : "Reopening"} ${test.title}…`);
    try {
      const saved = await apiRequest(`/admin/tests/${test.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      setTests((current) => current.map((item) => item.id === saved.id ? saved : item));
      notify(completed ? `${test.title} has been closed.` : `${test.title} has been reopened now.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      notify(`Could not change the test status: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const removeTest = async (test) => {
    if (!apiConnected || !window.confirm(`Delete ${test.title}? This hides the test from the portal but keeps its history.`)) return;
    const operationId = portalBusyStart(`Deleting ${test.title}…`);
    try {
      await apiRequest(`/admin/tests/${test.id}`, { method: "DELETE" });
      setTests((current) => current.filter((item) => item.id !== test.id));
      notify(`${test.title} deleted.`);
    } catch (error) {
      notify(`Could not delete the test: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const markAttempt = async () => {
    if (!reviewing || !apiConnected) return;
    const incomplete = reviewMarks.some((value) => value === "" || value == null || !Number.isFinite(Number(value)));
    if (incomplete) return notify("Enter a mark for every question before saving the reviewed attempt.");

    const operationId = portalBusyStart("Saving test / exam marking…");
    try {
      const response = await apiRequest(`/admin/test-attempts/${reviewing.attempt.id}/mark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionMarks: reviewMarks.map((value) => Number(value)),
          questionFeedback: reviewQuestionFeedback,
          feedback: reviewFeedback,
        }),
      });

      const key = `${reviewing.test.id}-${reviewing.student.studentId}`;
      const updatedAttempt = response.attempt;
      setAttempts((current) => ({
        ...current,
        [key]: [...(current[key] || []).map((item) =>
          Number(item.id) === Number(updatedAttempt.id) ? updatedAttempt : item
        )],
      }));

      if (response.mark) {
        const mark = response.mark;
        setMarks((current) => {
          const next = {
            id: mark.id,
            studentId: mark.studentId,
            assessmentId: mark.assessmentId,
            student: reviewing.student.name,
            subject: reviewing.test.subject,
            score: Number(mark.mark),
            weighting: Number(mark.weighting ?? 100),
            passingMark: Number(mark.passingMark ?? reviewing.test.passingMark),
            grade: gradeFor(mark.mark, Number(mark.passingMark ?? reviewing.test.passingMark)),
            status: mark.status,
            feedback: mark.feedback || "",
            publishedAt: new Date().toISOString().slice(0, 10),
          };
          const found = current.findIndex((item) => item.id && Number(item.id) === Number(next.id));
          return found >= 0 ? current.map((item, index) => index === found ? { ...item, ...next } : item) : [...current, next];
        });
      }

      setReviewing(null);
      setReviewMarks([]);
      setReviewFeedback("");
      setReviewQuestionFeedback([]);
      notify(response.remediation
        ? `The reviewed result for ${reviewing.student.name} is below the pass mark. A remediation case was created.`
        : `${reviewing.student.name}'s test has been marked at ${Number(response.mark?.mark ?? updatedAttempt.score)}%.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      notify(`Could not save the test marking: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  if (reviewing) {
    const { student, test, attempt } = reviewing;
    const studentAnswers = attempt.answers || {};
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Staff marking</p>
            <h2>Review test attempt</h2>
            <p className="muted">{student.name} ({student.studentId}) · {test.title} · Attempt {attempt.attemptNumber} · {new Date(attempt.takenAt).toLocaleString()}</p>
          </div>
          <div className="test-review-total">
            {reviewMarks.filter((value) => value !== "").reduce((sum, value) => sum + Number(value), 0).toFixed(2)} / {totalPoints(test).toFixed(2)} marks
          </div>
        </div>

        <div className="test-review-grid">
          {(test.questions || []).map((question, index) => {
            const answer = studentAnswers[index];
            const selected = question.type === "essay"
              ? String(answer || "")
              : (Array.isArray(question.options) ? question.options[Number(answer)] || "No answer" : "No answer");
            const correctAnswer = question.type === "essay"
              ? question.modelAnswer || "No model answer supplied."
              : (Array.isArray(question.options) ? question.options[Number(question.correct)] || "No correct answer supplied." : "No correct answer supplied.");
            const max = Number(question.points || 1);
            return (
              <article className="question-block test-review-question" key={index}>
                <div className="review-question-head">
                  <strong>Q{index + 1}. {question.question}</strong>
                  <span>Max {max} mark{max === 1 ? "" : "s"}</span>
                </div>
                <p><b>Student answer:</b> {selected || "No answer provided"}</p>
                <p className="muted"><b>{question.type === "essay" ? "Model answer / marking guidance" : "Correct answer"}:</b> {correctAnswer}</p>
                <label>
                  Awarded marks
                  <input
                    type="number"
                    min="0"
                    max={max}
                    step="0.01"
                    value={reviewMarks[index] ?? ""}
                    onChange={(event) => {
                      const next = [...reviewMarks];
                      next[index] = event.target.value === "" ? "" : Number(event.target.value);
                      setReviewMarks(next);
                    }}
                  />
                </label>
                <label className="test-review-feedback-field">
                  Feedback for this question
                  <textarea
                    rows={3}
                    value={reviewQuestionFeedback[index] || ""}
                    onChange={(event) => {
                      const next = [...reviewQuestionFeedback];
                      next[index] = event.target.value;
                      setReviewQuestionFeedback(next);
                    }}
                    placeholder="Explain why marks were awarded or lost…"
                  />
                </label>
              </article>
            );
          })}
        </div>

        <label>
          Staff feedback
          <textarea rows={5} value={reviewFeedback} onChange={(event) => setReviewFeedback(event.target.value)} placeholder="Explain corrections, long-answer marking and anything the learner should improve." />
        </label>

        <div className="actions">
          <button onClick={markAttempt}>{user.role === "main-admin" ? "Publish final mark" : "Save reviewed mark"}</button>
          <button className="secondary" onClick={() => { setReviewing(null); setReviewMarks([]); setReviewFeedback(""); setReviewQuestionFeedback([]); }}>Cancel</button>
        </div>
      </section>
    );
  }

  if (taking) {
    const allAnswered = taking.questions.every((question, index) =>
      question.type === "essay"
        ? String(answers[index] || "").trim()
        : answers[index] !== undefined
    );
    return (
      <>
        <section className="panel">
          <h2>{taking.title}</h2>
          <p className="muted">{taking.subject} · {taking.questions.length} question(s) · {totalPoints(taking).toFixed(2)} total marks · Pass {taking.passingMark}%</p>
          <div className="test-taking-bar"><strong>{remainingSeconds == null ? "Time remaining: —" : `Time remaining: ${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`}</strong><span>{draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : "Draft not saved yet"}</span><button className="secondary" onClick={saveDraftNow}>Save work locally</button><button className="text-button" onClick={() => { saveDraftNow(); notify("Your work was saved locally. You can return to this test while its session remains active."); }}>Leave and keep draft</button></div>
          {testRevisionNotice && <div className="warning-box">{testRevisionNotice}</div>}
          {taking.questions.map((question, index) => (
            <div className="question-block" key={index}>
              <div className="review-question-head">
                <strong>Q{index + 1}. {question.question}</strong>
                <span>{Number(question.points || 1)} mark{Number(question.points || 1) === 1 ? "" : "s"}</span>
              </div>
              {question.type === "essay"
                ? <textarea className="essay-answer" rows={7} value={answers[index] || ""} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} placeholder="Write your full answer…" />
                : (question.options || []).map((option, optionIndex) => (
                  <label className="option-row" key={optionIndex}>
                    <input type="radio" name={`q-${index}`} checked={Number(answers[index]) === optionIndex} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} />
                    {option}
                  </label>
                ))}
            </div>
          ))}
          <div className="actions">
            <button disabled={!allAnswered} onClick={submitTest}>{takingMode === "remediation" ? "Submit remediation test" : "Submit test"}</button>
            <button className="secondary" onClick={() => { saveDraftNow(); setTaking(null); setActiveSession(null); setTakingMode("normal"); notify("Your work was saved locally. You can resume this test while the active session remains valid."); }}>Leave test</button>
          </div>
        </section>
        {showSubmitConfirm && <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="test-submit-title">
            <h3 id="test-submit-title">Submit test / exam?</h3>
            <p>Your work is currently saved in this browser. Saving again before submission gives you a recovery copy if the server request fails.</p>
            <div className="actions"><button onClick={() => submitTestNow(true)}>Save work &amp; submit</button><button className="secondary" onClick={() => submitTestNow(false)}>Submit now</button><button className="secondary" onClick={downloadDraftRecoveryCopy}>Download recovery copy</button><button className="text-button" onClick={() => setShowSubmitConfirm(false)}>Cancel</button></div>
          </div>
        </div>}
      </>
    );
  }

  if (editing) {
    const current = editing;
    const setField = (field, value) => setEditing({ ...current, [field]: value });
    const setQuestion = (index, field, value) => {
      const nextQuestions = [...current.questions];
      nextQuestions[index] = { ...nextQuestions[index], [field]: value };
      setEditing({ ...current, questions: nextQuestions });
    };
    const setOption = (index, optionIndex, value) => {
      const nextQuestions = [...current.questions];
      const options = [...(nextQuestions[index].options || [])];
      options[optionIndex] = value;
      nextQuestions[index] = { ...nextQuestions[index], options };
      setEditing({ ...current, questions: nextQuestions });
    };
    const addMcq = () => setEditing({
      ...current,
      questions: [...current.questions, { type: "mcq", question: "", options: ["", "", "", ""], correct: 0, points: 1 }],
    });
    const addEssay = () => setEditing({
      ...current,
      questions: [...current.questions, { type: "essay", question: "", modelAnswer: "", points: 5 }],
    });
    const removeQuestion = (index) => setEditing({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
    });
    const total = totalPoints(current);
    const editorDueDay = (() => {
      const day = String(current.dueDate || "").slice(0, 10);
      return day === TEST_DUE_SENTINEL ? "" : day;
    })();
    const editorStart = testStartDate(current);
    const editorDue = testDueDate(current);
    const editorWindow = testWindow(current);
    const scheduleIssue = !editorStart
      ? "Set an opening date and time before saving."
      : !editorDue
        ? "Set a closing date before saving."
        : editorDue <= editorStart
          ? "The closing date/time must be after the opening date/time."
          : "";
    const scheduleSpan = editorStart && editorDue && editorDue > editorStart
      ? `window ${formatDurationBetween(editorStart, editorDue)}`
      : "";

    return (
      <section className="panel test-editor">
        <div className="test-editor-heading"><div><p className="eyebrow">Test &amp; Exam setup</p><h2>{current.id && tests.some((item) => item.id === current.id) ? "Edit test / exam" : "New test / exam"}</h2><p className="muted">Set the opening window, attempt limit and question mark allocation. Existing active student attempts keep the version they started.</p></div></div>
        <div className="test-editor-grid">
          <label className="test-field">Title<input value={current.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Mid-year programming test" /></label>
          <label className="test-field">Subject / course topic<input value={current.subject} onChange={(event) => setField("subject", event.target.value)} placeholder="e.g. Programming Fundamentals" /></label>
          <label className="test-field test-field-wide">Teaching group
            <select value={groupKey(current)} onChange={(event) => {
              const group = testEditorGroups.find((item) => groupKey(item) === event.target.value);
              if (group) setEditing({ ...current, course: group.course, yearLevel: group.yearLevel, academicYear: group.academicYear });
            }}>
              <option value="">Select an assigned course/year</option>
              {testEditorGroups.map((group) => <option key={groupKey(group)} value={groupKey(group)}>{groupLabel(group)}</option>)}
            </select>
          </label>
        </div>

        <div className="test-schedule-card">
          <div className="test-schedule-heading"><strong>Availability and marking rules</strong><span>Students can only start inside this window.</span></div>
          <div className="test-editor-grid test-editor-grid-compact">
            <label className="test-field">Opens<input type="datetime-local" value={normalizeLocalDateTime(current.startAt)} onChange={(event) => setField("startAt", event.target.value)} /></label>
            <label className="test-field">Closes<input type="date" min={String(normalizeLocalDateTime(current.startAt)).slice(0, 10) || undefined} value={editorDueDay} onChange={(event) => setField("dueDate", event.target.value)} /></label>
            <label className="test-field">Closing time<input type="time" value={String(current.dueTime || "23:59").slice(0, 5)} onChange={(event) => setField("dueTime", event.target.value)} /></label>
            <label className="test-field">Passing mark %<input type="number" min="0" max="100" step="0.01" value={current.passingMark ?? ""} onChange={(event) => setField("passingMark", event.target.value)} placeholder="60" /></label>
            <label className="test-field">Max attempts<input type="number" min="1" max="10" value={current.maxAttempts ?? ""} onChange={(event) => setField("maxAttempts", event.target.value)} placeholder="2" /></label>
            <label className="test-field">Duration (minutes)<input type="number" min="1" max="1440" value={current.durationMinutes ?? ""} onChange={(event) => setField("durationMinutes", event.target.value)} placeholder="20" /></label>
          </div>
          {scheduleIssue
            ? <p className="test-schedule-status is-invalid" role="alert">{scheduleIssue}</p>
            : <p className={`test-schedule-status is-${editorWindow.state}`}>{editorWindow.label}{scheduleSpan ? ` · ${scheduleSpan}` : ""}</p>}
        </div>

        <div className="test-import-box">
          <div><strong>Import pre-written questions</strong><p className="muted small-print">Upload JSON, CSV or TXT. Imported questions are added to this editor; nothing is saved until you click Save test / exam.</p></div>
          <div className="test-import-controls">
            <select value={questionImportMode} onChange={(event) => setQuestionImportMode(event.target.value)}><option value="append">Add to current questions</option><option value="replace">Replace current questions</option></select>
            <label className="secondary upload-button">{questionImporting ? "Importing…" : "Choose question file"}<input type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" disabled={questionImporting} onChange={(event) => importQuestions(event, current)} /></label>
          </div>
        </div>

        <div className="test-mark-summary">
          <strong>Total allocated marks: {total.toFixed(2)}</strong>
          <span>Questions: {current.questions.length}</span>
        </div>

        <div className="test-questions-heading"><div><h3>Questions and mark allocation</h3><p className="muted small-print">Give every question a clear point value. MCQs are auto-marked; essays are reviewed by staff.</p></div><strong>{current.questions.length} question(s)</strong></div>
        {current.questions.map((question, index) => (
          <article className="test-editor-question" key={index}>
            <div className="test-question-head">
              <label className="test-question-text">Question {index + 1}<textarea rows={4} value={question.question} onChange={(event) => setQuestion(index, "question", event.target.value)} placeholder="Enter the full question here…" /></label>
              <label className="test-question-marks">Marks<input type="number" min="0.01" max="1000" step="0.01" value={question.points ?? ""} onChange={(event) => setQuestion(index, "points", event.target.value)} placeholder="1" /></label>
            </div>

            <label className="test-field test-field-wide">Question type
              <select value={question.type === "essay" ? "essay" : "mcq"} onChange={(event) => setQuestion(index, "type", event.target.value === "essay" ? "essay" : "mcq")}>
                <option value="mcq">Multiple choice — auto marked</option>
                <option value="essay">Long answer / essay — staff marked</option>
              </select>
            </label>

            {question.type === "essay"
              ? <label className="test-answer-box">Model answer / marking guidance<textarea rows={5} value={question.modelAnswer || ""} onChange={(event) => setQuestion(index, "modelAnswer", event.target.value)} placeholder="Add the expected answer, key points, or marking guidance. Students cannot see this." /></label>
              : <div className="test-choice-box">
                <div className="test-choice-heading"><strong>Answer options</strong><span className="muted small-print">Select the correct option.</span></div>
                {(question.options || []).map((option, optionIndex) => (
                  <label className="test-option-row" key={optionIndex}>
                    <input type="radio" checked={Number(question.correct) === optionIndex} onChange={() => setQuestion(index, "correct", optionIndex)} aria-label={`Correct answer for option ${optionIndex + 1}`} />
                    <span className="test-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <input type="text" value={option} placeholder={`Option ${optionIndex + 1}`} onChange={(event) => setOption(index, optionIndex, event.target.value)} />
                  </label>
                ))}
              </div>}

            <button className="text-button danger" onClick={() => removeQuestion(index)}>Remove question</button>
          </article>
        ))}

        <div className="test-editor-actions">
          <button className="secondary" onClick={addMcq}>Add multiple-choice question</button>
          <button className="secondary" onClick={addEssay}>Add long-answer question</button>
          <button onClick={() => saveTest(current)}>Save test / exam</button>
          <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </section>
    );
  }

  const newTest = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    const start = new Date(now.getTime() + 5 * 60 * 1000);
    const due = new Date(start.getTime() + 60 * 60 * 1000);
    const isoLocal = (date) => {
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      return date.toISOString().slice(0, 16);
    };
    const startLocal = isoLocal(new Date(start));
    const dueLocal = isoLocal(new Date(due));
    setEditing({
      id: 0,
      title: "",
      subject: "",
      ...(creationGroups[0] || { course: "", yearLevel: "", academicYear: currentAcademicYear }),
      startAt: startLocal,
      dueDate: dueLocal.slice(0, 10),
      dueTime: dueLocal.slice(11, 16),
      completed: false,
      openOverride: false,
      passingMark: passMark,
      maxAttempts: 2,
      durationMinutes: 20,
      questions: [{ type: "mcq", question: "", options: ["", "", "", ""], correct: 0, points: 1 }],
    });
  };

  const duplicateTest = (test) => {
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(start.getMinutes() + 5);
    const due = new Date(start.getTime() + 60 * 60 * 1000);
    setEditing({
      ...test,
      id: 0,
      title: `${test.title} (copy)`,
      completed: false,
      openOverride: false,
      startAt: toLocalWallClock(start),
      dueDate: toLocalWallClock(due).slice(0, 10),
      dueTime: toLocalWallClock(due).slice(11, 16),
      questions: (test.questions || []).map((question) => ({ ...question, options: [...(question.options || [])] })),
    });
  };

  return (
    <section className="panel">
      <div className="card-header">
        <div>
          <h2>Tests &amp; Exams</h2>
          <p className="muted">Students enter during the scheduled window. Staff can edit, reopen, close, mark, correct and schedule remediation from the same page.</p>
        </div>
        {canManage && <button disabled={!creationGroups.length} onClick={newTest}>Add test / exam</button>}
      </div>

      <div className="filters">
        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}><option value="all">All courses</option>{testCourses.map((course) => <option key={course} value={course}>{course}</option>)}</select>
        <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">All years</option>{testYears.map((year) => <option key={year} value={year}>Year {year}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by availability">
          <option value="all">All statuses</option>
          <option value="open">Open now</option>
          <option value="scheduled">Scheduled</option>
          <option value="closed">Closed</option>
          <option value="invalid">Needs attention</option>
        </select>
        {canManage && <input placeholder="Search students by name or ID…" value={search} onChange={(event) => setSearch(event.target.value)} />}
      </div>

      {canManage && statusCounts.invalid > 0 && statusFilter !== "invalid" && (
        <p className="test-schedule-status is-invalid" role="status">
          {statusCounts.invalid} test{statusCounts.invalid === 1 ? " has" : "s have"} an unusable schedule and cannot open for learners. Filter by “Needs attention” to correct them.
        </p>
      )}

      {!filteredTests.length && <p className="muted">No tests or exams are available for the selected teaching scope.</p>}

      {filteredTests.map((test) => {
        const availability = testWindow(test);
        const total = totalPoints(test);
        return (
          <div className="test-card" key={test.id}>
            <div className="test-card-head">
              <div>
                <div className="test-card-title">
                  <strong>{test.title}</strong>
                  <span className={`test-status-pill is-${availability.state}`}>{TEST_STATUS_LABELS[availability.state]}</span>
                </div>
                <small>{test.subject} · {test.course} · Year {test.yearLevel} · {test.academicYear} · {total.toFixed(2)} marks · Pass {test.passingMark}% · {test.durationMinutes} min · {test.questions.length} question(s)</small>
                <small>{testStartDate(test) ? `Opens ${testStartDate(test).toLocaleString()}` : "No opening date"} · {testDueDate(test) ? `closes ${testDueDate(test).toLocaleString()}` : "closing date not set"}</small>
              </div>
              {canManage && (
                <div className="actions">
                  <button className="secondary" onClick={() => setEditing(test)}>Edit test</button>
                  <button className="secondary" onClick={() => duplicateTest(test)}>Duplicate</button>
                  <button className="secondary" onClick={() => setTestStatus(test, !test.completed)}>
                    {test.completed ? "Reopen now" : "Close test"}
                  </button>
                  <button className="secondary" onClick={() => removeTest(test)}>Delete</button>
                </div>
              )}
            </div>

            {user.role === "student" && (
              <div className="test-card-body">
                {(() => {
                  const list = attemptsFor(test.id, user.studentId);
                  const normalAttempts = normalAttemptsFor(test.id, user.studentId);
                  const remediationAttempts = remediationAttemptsFor(test.id, user.studentId);
                  const remediation = remediationForTest(test.id, user.studentId);
                  const best = bestScore(test.id, user.studentId);
                  const latest = list[list.length - 1];
                  const remediationAvailable = remediation &&
                    ["Open", "Scheduled"].includes(remediation.status) &&
                    remediationAttempts.length < Number(remediation.attemptLimit || 1);

                  return <>
                    <p className="test-availability"><strong>{availability.label}</strong></p>
                    <p>Normal attempts used: {normalAttempts.length}/{test.maxAttempts}{best !== null ? ` · Best ${best}%` : latest?.needsReview ? " · Awaiting staff marking" : ""}</p>

                    {remediation && <div className="test-remediation-box">
                      <strong>Remediation: {remediation.status}</strong>
                      <span>Original mark: {remediation.originalMark ?? best ?? "—"}%</span>
                      {remediation.remediationDate && <span>Scheduled: {remediation.remediationDate}{remediation.remediationTime ? ` at ${remediation.remediationTime}` : ""}</span>}
                      {remediation.instructions && <span>Instructions: {remediation.instructions}</span>}
                      {remediation.feedback && <span>Staff feedback: {remediation.feedback}</span>}
                    </div>}

                    {latest?.needsReview && <p className="warning-text">This attempt has long-answer questions and is waiting for staff marking.</p>}

                    <div className="actions">
                      <button disabled={!availability.open || normalAttempts.length >= Number(test.maxAttempts)} onClick={() => startTest(test)}>
                        {normalAttempts.length ? "Retake test" : "Start test"}
                      </button>
                      {remediationAvailable && <button className="secondary" onClick={() => startTest(test, "remediation")}>Start remediation test</button>}
                    </div>
                    {list.length > 0 && <p className="muted small-print">Attempts and staff corrections are stored in SQLite and remain after refresh.</p>}
                  </>;
                })()}
              </div>
            )}

            {canManage && (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Student</th><th>Attempts</th><th>Best / latest</th><th>Status</th><th>Review</th><th>Remediation</th></tr>
                  </thead>
                  <tbody>
                    {studentsForTest(test).map((student) => {
                      const list = attemptsFor(test.id, student.studentId);
                      const normal = normalAttemptsFor(test.id, student.studentId);
                      const latest = list[list.length - 1];
                      const best = bestScore(test.id, student.studentId);
                      const remediation = remediationForTest(test.id, student.studentId);
                      const status = latest?.needsReview
                        ? "Awaiting staff marking"
                        : best == null
                          ? "Pending"
                          : best >= test.passingMark
                            ? "Passed"
                            : normal.length >= Number(test.maxAttempts)
                              ? "Remediation needed"
                              : "Below pass — another attempt available";
                      return (
                        <tr key={student.studentId}>
                          <td>{student.name} ({student.studentId})</td>
                          <td>{normal.length}/{test.maxAttempts}</td>
                          <td>{best == null ? (latest?.needsReview ? `Pending review · ${Number(latest.score).toFixed(2)}%` : "Not attempted") : `${best}%`}</td>
                          <td>{status}</td>
                          <td>
                            {latest
                              ? <button className="text-button" onClick={() => openReview(student, test, latest)}>Review / correct</button>
                              : "—"}
                          </td>
                          <td>
                            {remediation
                              ? `${remediation.status}${remediation.remediationDate ? ` · ${remediation.remediationDate}` : ""}`
                              : best != null && best < test.passingMark && normal.length >= Number(test.maxAttempts) ? "Required" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}


function normalizeCalendarGroups(groups, currentYear = new Date().getFullYear()) {
  return (Array.isArray(groups) ? groups : [])
    .filter((group) => group?.course && Number.isInteger(Number(group.yearLevel ?? group.year_level)))
    .map((group) => ({
      ...group,
      yearLevel: Number(group.yearLevel ?? group.year_level),
      academicYear: Number(group.academicYear ?? group.academic_year ?? currentYear),
    }));
}

function Calendar({ user, events, setEvents, teachingGroups = [], allTeachingGroups = [], notify }) {
  const canManage = user.role !== "student";
  const currentYear = new Date().getFullYear();
  const [editing, setEditing] = useState(null);
  const [calendarView, setCalendarView] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches ? "agenda" : "month"
  ));
  const [viewMonth, setViewMonth] = useState(() => new Date(currentYear, new Date().getMonth(), 1));
  const [academicYearView, setAcademicYearView] = useState(currentYear);
  const [calendarGroups, setCalendarGroups] = useState([]);

  const fallbackGroups = normalizeCalendarGroups(user.role === "main-admin" ? allTeachingGroups : teachingGroups, currentYear)
    .filter((group) => Number(group.academicYear) === Number(academicYearView));

  useEffect(() => {
    if (!canManage) return undefined;
    let cancelled = false;
    const fallback = normalizeCalendarGroups(user.role === "main-admin" ? allTeachingGroups : teachingGroups, currentYear)
      .filter((group) => Number(group.academicYear) === Number(academicYearView));
    const loadYearGroups = async () => {
      try {
        const response = await apiRequest(`/admin/teaching-courses?academicYear=${encodeURIComponent(academicYearView)}`);
        if (cancelled) return;
        const groups = normalizeCalendarGroups(
          user.role === "main-admin" ? (response.allTeachingGroups || []) : (response.teachingGroups || []),
          currentYear,
        );
        setCalendarGroups(groups);
      } catch (_) {
        if (!cancelled) setCalendarGroups(fallback);
      }
    };
    loadYearGroups();
    return () => { cancelled = true; };
  }, [academicYearView, allTeachingGroups, canManage, currentYear, teachingGroups, user.role]);

  useEffect(() => {
    setViewMonth((current) => new Date(academicYearView, current.getMonth(), 1));
  }, [academicYearView]);

  const availableGroups = calendarGroups.length ? calendarGroups : fallbackGroups;
  const uniqueGroups = Array.from(new Map(availableGroups.map((group) => [
    `${group.course}::${group.yearLevel}::${group.academicYear}`, group
  ])).values());
  const groupKey = (group) => `${group.course}::${Number(group.yearLevel)}::${Number(group.academicYear)}`;
  const groupLabel = (group) => `${group.course} · Year ${group.yearLevel} · ${group.academicYear}`;
  const visibleEvents = events.filter((item) => Number(item.academicYear || new Date(item.startAt).getFullYear()) === Number(academicYearView));

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0, 23, 59, 59, 999);
  const days = Array.from({ length: firstDay.getDay() + lastDay.getDate() }, (_, index) =>
    index < firstDay.getDay() ? null : new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index - firstDay.getDay() + 1)
  );

  const eventsForDay = (day) => {
    if (!day) return [];
    const check = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    return visibleEvents.filter((item) => {
      const startDate = new Date(item.startAt);
      const endDate = new Date(item.endAt);
      const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      return check >= startDay && check <= endDay;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  };

  const agendaEvents = visibleEvents.filter((item) => {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    return end >= monthStart && start <= monthEnd;
  }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const formatEventRange = (item) => {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    const datePart = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const startTime = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${datePart} · ${startTime}–${endTime}`;
  };

  const yearChoices = Array.from(new Set([
    currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5,
    ...events.map((item) => Number(item.academicYear || new Date(item.startAt).getFullYear())),
    ...normalizeCalendarGroups(user.role === "main-admin" ? allTeachingGroups : teachingGroups, currentYear).map((group) => Number(group.academicYear)),
  ].filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100))).sort((a, b) => a - b);

  const save = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const groupValue = String(data.get("group") || "");
    const selectedGroup = uniqueGroups.find((group) => groupKey(group) === groupValue);
    const institutionWide = user.role === "main-admin" && groupValue === "institution";
    const requestedYear = Number.parseInt(String(data.get("academicYear") || ""), 10);
    const payload = {
      title: String(data.get("title") || "").trim(),
      description: String(data.get("description") || "").trim(),
      eventType: String(data.get("eventType") || "event"),
      startAt: String(data.get("startAt") || ""),
      endAt: String(data.get("endAt") || ""),
      academicYear: institutionWide ? requestedYear : selectedGroup?.academicYear,
      course: institutionWide ? "" : selectedGroup?.course || "",
      yearLevel: institutionWide ? null : selectedGroup?.yearLevel,
    };
    if (!payload.title || !payload.startAt || !payload.endAt) return notify("Title and start/end dates are required.");
    if (!Number.isInteger(payload.academicYear) || payload.academicYear < 2000 || payload.academicYear > 2100) return notify("Choose a valid academic year between 2000 and 2100.");
    if (new Date(payload.endAt) <= new Date(payload.startAt)) return notify("The end must be after the start.");
    if (!institutionWide && !selectedGroup) return notify("Select an assigned teaching group for the selected academic year.");
    try {
      const method = editing ? "PATCH" : "POST";
      const path = editing ? `/admin/calendar/${editing.id}` : "/admin/calendar";
      const saved = await apiRequest(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEvents((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      form.reset();
      setEditing(null);
      notify(`${payload.eventType === "remediation-week" ? "Remediation week" : "Event"} saved for ${payload.academicYear}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      notify(`Could not save calendar item: ${error.message}`);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}" from the institution calendar?`)) return;
    try {
      await apiRequest(`/admin/calendar/${item.id}`, { method: "DELETE" });
      setEvents((current) => current.filter((entry) => entry.id !== item.id));
      if (editing?.id === item.id) setEditing(null);
      notify(`Calendar item deleted: ${item.title}.`);
    } catch (error) {
      notify(`Could not delete calendar item: ${error.message}`);
    }
  };

  const editEvent = (item) => {
    setAcademicYearView(Number(item.academicYear || new Date(item.startAt).getFullYear()));
    setEditing({ ...item, groupValue: item.course ? `${item.course}::${Number(item.yearLevel)}::${Number(item.academicYear)}` : "institution" });
    setCalendarView("agenda");
  };

  return (
    <section className="calendar-page">
      <section className="panel">
        <div className="panel-heading calendar-toolbar">
          <div>
            <p className="eyebrow">Academic calendar</p>
            <h2>{viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <p className="muted small-print">Viewing academic year {academicYearView}. {visibleEvents.length} item{visibleEvents.length === 1 ? "" : "s"} available.</p>
          </div>
          <div className="calendar-controls">
            <div className="calendar-year-picker">
              <button className="secondary" type="button" onClick={() => setAcademicYearView((year) => Math.max(2000, year - 1))}>Previous year</button>
              <label>Academic year<select value={academicYearView} onChange={(e) => setAcademicYearView(Number(e.target.value))}>{yearChoices.map((year) => <option key={year} value={year}>{year}{year === currentYear ? " (current)" : ""}</option>)}</select></label>
              <button className="secondary" type="button" onClick={() => setAcademicYearView((year) => Math.min(2100, year + 1))}>Next year</button>
            </div>
            <div className="actions calendar-nav-actions">
              <button className="secondary" type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>Previous month</button>
              <button className="secondary" type="button" onClick={() => setViewMonth(new Date(academicYearView, new Date().getMonth(), 1))}>This month</button>
              <button className="secondary" type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>Next month</button>
            </div>
            <div className="calendar-view-switch" role="group" aria-label="Calendar view">
              <button className={calendarView === "month" ? "primary" : "secondary"} type="button" onClick={() => setCalendarView("month")}>Month</button>
              <button className={calendarView === "agenda" ? "primary" : "secondary"} type="button" onClick={() => setCalendarView("agenda")}>Agenda</button>
            </div>
          </div>
          {canManage && (
            <div className="calendar-teaching-summary" aria-label={`Teaching assignments for academic year ${academicYearView}`}>
              <div>
                <strong>Teaching assignments for {academicYearView}</strong>
                <span>{uniqueGroups.length ? `${uniqueGroups.length} assigned course/year group${uniqueGroups.length === 1 ? "" : "s"}` : "No teaching groups allocated for this year"}</span>
              </div>
              {uniqueGroups.length > 0 && (
                <div className="calendar-teaching-chips">
                  {uniqueGroups.map((group) => <span className="calendar-teaching-chip" key={groupKey(group)}>{group.course} · Year {group.yearLevel}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
        {calendarView === "month" ? (
          <div className="calendar-scroll" aria-label="Monthly academic calendar">
            <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}</div>
            <div className="calendar-grid">
              {days.map((day, index) => (
                <div className="calendar-day" key={day ? day.toISOString() : `blank-${index}`}>
                  {day && <><span className={day.toDateString() === new Date().toDateString() ? "calendar-day-number today" : "calendar-day-number"}>{day.getDate()}</span>
                    {eventsForDay(day).map((item) => (
                      <button key={item.id} type="button" className={`calendar-event calendar-event-${item.eventType || "event"}${item.eventType === "remediation-week" ? " remediation-week" : ""}`} onClick={() => canManage ? editEvent(item) : null} aria-label={`${item.title}, ${formatEventRange(item)}`}>
                        <strong>{item.title}</strong><small>{new Date(item.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small><small>{item.course ? `${item.course} · Year ${item.yearLevel}` : "Institution-wide"}</small>
                        {item.eventType === "assignment" && <small>Assignment</small>}
                        {item.eventType === "test" && <small>Test / exam</small>}
                      </button>
                    ))}
                  </>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="calendar-agenda" aria-label="Academic calendar agenda">
            {agendaEvents.length === 0 ? <p className="muted">No events, tests, exams or assignments are scheduled in this month.</p> : agendaEvents.map((item) => (
              <article className={`calendar-agenda-item calendar-agenda-${item.eventType || "event"}${item.eventType === "remediation-week" ? " remediation-week" : ""}`} key={`${item.eventType || "event"}-${item.id}`}>
                <div className="calendar-agenda-date"><strong>{new Date(item.startAt).getDate()}</strong><span>{new Date(item.startAt).toLocaleDateString(undefined, { weekday: "short", month: "short" })}</span></div>
                <div className="calendar-agenda-main"><strong>{item.title}</strong><span>{formatEventRange(item)}</span><span>{item.course ? `${item.course} · Year ${item.yearLevel}` : "Institution-wide"}</span>{item.eventType === "assignment" && <span className="calendar-type-badge">Assignment</span>}{item.eventType === "test" && <span className="calendar-type-badge">Test / exam</span>}{item.description && <p>{item.description}</p>}</div>
                {canManage && !["assignment", "test"].includes(item.eventType) && <div className="actions calendar-agenda-actions"><button className="secondary" type="button" onClick={() => editEvent(item)}>Edit</button><button className="text-button danger" type="button" onClick={() => remove(item)}>Delete</button></div>}
              </article>
            ))}
          </div>
        )}
      </section>
      {canManage && <form key={editing ? `calendar-edit-${editing.id}` : `calendar-new-${academicYearView}`} className="panel form-panel" onSubmit={save}>
        <p className="eyebrow">{editing ? "Edit calendar item" : "Add to calendar"}</p>
        <h3>{editing ? editing.title : `Schedule an event for ${academicYearView}`}</h3>
        <label>Title<input name="title" required defaultValue={editing?.title || ""} /></label>
        <label>Description<textarea name="description" rows="3" defaultValue={editing?.description || ""} /></label>
        <label>Type<select name="eventType" defaultValue={editing?.eventType || "event"}><option value="event">Institution/course event</option><option value="remediation-week">Remediation week</option></select></label>
        <label>Audience<select name="group" required defaultValue={editing?.groupValue || ""}>{user.role === "main-admin" && <option value="institution">Whole institution</option>}<option value="">Select assigned course/year</option>{uniqueGroups.map((group) => <option key={groupKey(group)} value={groupKey(group)}>{groupLabel(group)}</option>)}</select></label>
        {user.role === "main-admin" ? <label>Calendar academic year<input name="academicYear" type="number" min="2000" max="2100" value={academicYearView} onChange={(e) => setAcademicYearView(Number(e.target.value) || currentYear)} /></label> : <input type="hidden" name="academicYear" value={academicYearView} />}
        <label>Start<input required name="startAt" type="datetime-local" defaultValue={editing?.startAt?.slice(0, 16) || ""} /></label>
        <label>End<input required name="endAt" type="datetime-local" defaultValue={editing?.endAt?.slice(0, 16) || ""} /></label>
        <div className="actions"><button className="primary" type="submit">{editing ? "Save changes" : "Add calendar item"}</button>{editing && <><button className="text-button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="text-button danger" type="button" onClick={() => remove(editing)}>Delete</button></>}</div>
      </form>}
      {!canManage && <p className="muted small-print">Students can browse previous and future academic years. Calendar history includes institution events plus tests, exams and assignments from previous academic years in the course, while current-year assessment entries are limited to the student's own year. These assessment entries are read-only.</p>}
    </section>
  );
}

function Courses({ accounts, setAccounts, user, notify, courses, canManage, teachingGroups = [], setTeachingGroups, allTeachingGroups = [], courseGroups = [] }) {
  const [selected, setSelected] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [selectedStudentYear, setSelectedStudentYear] = useState(1);
  const [studentAcademicYear, setStudentAcademicYear] = useState(new Date().getFullYear());
  const [studentTeachingGroups, setStudentTeachingGroups] = useState([]);
  const [temporaryUsername, setTemporaryUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [error, setError] = useState("");
  const [teachingCourse, setTeachingCourse] = useState("");
  const [teachingYear, setTeachingYear] = useState(1);
  const [teachingAcademicYear, setTeachingAcademicYear] = useState(new Date().getFullYear());
  const [teachingAdminId, setTeachingAdminId] = useState(user.role === "admin" ? user.id : "");
  const [teachingError, setTeachingError] = useState("");
  const [groupView, setGroupView] = useState("all");
  const [groupCourse, setGroupCourse] = useState("all");
  const [groupYear, setGroupYear] = useState("all");
  const [groupTeacher, setGroupTeacher] = useState("all");

  const courseNames = courses.map(([name]) => name).filter(Boolean);
  // Students must never receive a course/group directory view. On the student side, keep the
  // local collection restricted to the signed-in learner's own record; staff continue to see the
  // student population allowed by their role. This is an additional UI/data guard on top of the
  // server-side admin endpoint restrictions.
  const visibleStudents = user.role === "student"
    ? accounts.filter((account) => account.role === "student" && account.id === user.id)
    : accounts.filter((account) => account.role === "student");
  const visibleTeachingGroups = useMemo(
    () => user.role === "main-admin" ? allTeachingGroups : teachingGroups,
    [user.role, allTeachingGroups, teachingGroups]
  );
  useEffect(() => {
    if (user.role === "student") return undefined;
    let cancelled = false;
    const fallback = normalizeCalendarGroups(visibleTeachingGroups, new Date().getFullYear())
      .filter((group) => Number(group.academicYear) === Number(studentAcademicYear));
    const loadStudentYearGroups = async () => {
      try {
        const response = await apiRequest(`/admin/teaching-courses?academicYear=${encodeURIComponent(studentAcademicYear)}`);
        if (cancelled) return;
        const groups = normalizeCalendarGroups(
          user.role === "main-admin" ? (response.allTeachingGroups || []) : (response.teachingGroups || []),
          studentAcademicYear,
        );
        setStudentTeachingGroups(groups);
      } catch (_) {
        if (!cancelled) setStudentTeachingGroups(fallback);
      }
    };
    loadStudentYearGroups();
    return () => { cancelled = true; };
  }, [studentAcademicYear, user.role, allTeachingGroups, teachingGroups, visibleTeachingGroups]);
  const studentYearGroups = studentTeachingGroups.length ? studentTeachingGroups : visibleTeachingGroups.filter((group) => Number(group.academicYear) === Number(studentAcademicYear));
  const staffById = new Map(
    accounts.filter((account) => account.role === "admin").map((account) => [String(account.id), account])
  );
  const teacherChoices = studentYearGroups
    .filter((group) => group.course === selected && Number(group.yearLevel) === Number(selectedStudentYear) && Number(group.academicYear) === Number(studentAcademicYear))
    .map((group) => {
      const teacher = staffById.get(String(group.userId));
      return {
        id: Number(group.userId),
        name: group.staffName || teacher?.name || `Staff #${group.userId}`,
        username: group.staffUsername || teacher?.username || "",
        course: group.course,
        yearLevel: Number(group.yearLevel),
      };
    })
    .filter((teacher, index, array) => array.findIndex((item) => item.id === teacher.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name));

  const groupCourses = [...new Set(courseNames)].sort();
  const groupYears = [...new Set(visibleTeachingGroups.map((group) => Number(group.yearLevel)).filter((year) => Number.isInteger(year)))].sort((a, b) => a - b);
  const groupTeachers = [...new Map(
    visibleTeachingGroups
      .map((group) => [String(group.userId), { id: group.userId, name: group.staffName || staffById.get(String(group.userId))?.name || `Staff #${group.userId}` }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  const filteredGroupTeachingGroups = visibleTeachingGroups
    .filter((group) =>
      (groupCourse === "all" || group.course === groupCourse) &&
      (groupYear === "all" || Number(group.yearLevel) === Number(groupYear)) &&
      (groupTeacher === "all" || String(group.userId) === String(groupTeacher))
    )
    .sort((a, b) => {
      if (groupView === "year") return Number(a.yearLevel) - Number(b.yearLevel) || a.course.localeCompare(b.course) || String(a.staffName || "").localeCompare(String(b.staffName || ""));
      if (groupView === "teacher") return String(a.staffName || "").localeCompare(String(b.staffName || "")) || a.course.localeCompare(b.course) || Number(a.yearLevel) - Number(b.yearLevel);
      if (groupView === "course") return a.course.localeCompare(b.course) || Number(a.yearLevel) - Number(b.yearLevel) || String(a.staffName || "").localeCompare(String(b.staffName || ""));
      return a.course.localeCompare(b.course) || Number(a.yearLevel) - Number(b.yearLevel) || String(a.staffName || "").localeCompare(String(b.staffName || ""));
    });

  const groupRows = filteredGroupTeachingGroups.map((group) => {
    const students = visibleStudents.filter((student) =>
      student.course === group.course &&
      Number(student.yearLevel) === Number(group.yearLevel) &&
      String(student.teacherId || "") === String(group.userId)
    );
    return { ...group, students };
  });

  // Learners with no row in student_teacher_assignments. /admin/data leaves teacherId null for
  // them, so they silently rely on the course/year fallback — surfacing them lets staff fix the
  // allocation rather than discover it from a confused learner.
  const unallocatedLearners = visibleStudents
    .filter((student) => !student.teacherId)
    .map((student) => {
      const covering = visibleTeachingGroups.find((group) =>
        group.course === student.course && Number(group.yearLevel) === Number(student.yearLevel)
      );
      return {
        ...student,
        fallbackStaff: covering
          ? (covering.staffName || staffById.get(String(covering.userId))?.name || `Staff #${covering.userId}`)
          : "",
      };
    })
    .sort((a, b) => String(a.course || "").localeCompare(String(b.course || ""))
      || Number(a.yearLevel || 0) - Number(b.yearLevel || 0)
      || String(a.name || "").localeCompare(String(b.name || "")));

  const resetLearnerForm = () => {
    setStudentName("");
    setStudentId("");
    setStudentEmail("");
    setTemporaryUsername("");
    setSelected("");
    setSelectedStudentYear(1);
    setStudentAcademicYear(new Date().getFullYear());
    setSelectedTeacherId("");
  };

  const enroll = async (event) => {
    event.preventDefault();
    setError("");

    const name = studentName.trim();
    const username = temporaryUsername.trim().toLowerCase();
    const password = temporaryPassword;
    const normalizedId = studentId.trim();
    const yearLevel = Number(selectedStudentYear);
    const teacherId = Number.parseInt(selectedTeacherId, 10);

    if (!name || !username || !password || !normalizedId || !selected || !studentEmail.trim()) {
      setError("Complete all required learner fields, including the trusted email address and temporary password.");
      return;
    }
    if (password.length < 8) { setError("Temporary password must be at least 8 characters."); return; }
    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      setError("Choose the teacher/lecturer responsible for this course and year before creating the learner.");
      return;
    }
    if (accounts.some((account) => String(account.studentId || "").toLowerCase() === normalizedId.toLowerCase())) {
      setError("That student ID is already registered.");
      return;
    }
    if (accounts.some((account) => String(account.username || "").toLowerCase() === username)) {
      setError("That username is already in use.");
      return;
    }

    const chosenTeacher = teacherChoices.find((teacher) => Number(teacher.id) === teacherId);
    if (!chosenTeacher) {
      setError("The selected teacher is not assigned to that course/year group. Choose another lecturer or check the teaching allocation first.");
      return;
    }

    try {
      const created = await apiRequest("/admin/accounts/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, studentId: normalizedId, course: selected, yearLevel, academicYear: studentAcademicYear, teacherId, trustedEmail: studentEmail.trim() }),
      });

      setAccounts([...accounts, { ...created, teacherId, teacherName: chosenTeacher.name, teacherUsername: chosenTeacher.username, academicYear: studentAcademicYear }]);
      resetLearnerForm();
      window.dispatchEvent(new Event("portal-sync-now"));
      notify(`Student account created for ${created.name} and assigned to ${chosenTeacher.name}.`);
    } catch (error) {
      setError(error.message || "Could not create the student account.");
    }
  };

  const saveTeachingGroup = async (event) => {
    event.preventDefault();
    setTeachingError("");
    if (!teachingCourse) { setTeachingError("Choose a course."); return; }
    if (user.role === "main-admin" && !teachingAdminId) { setTeachingError("Choose the teacher/administrator who will teach this group."); return; }
    try {
      const response = await apiRequest('/admin/teaching-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: teachingCourse, yearLevel: Number(teachingYear), academicYear: Number(teachingAcademicYear), ...(user.role === 'main-admin' && teachingAdminId ? { adminUserId: Number(teachingAdminId) } : {}) })
      });
      setTeachingGroups(response.teachingGroups || teachingGroups);
      setTeachingCourse('');
      setTeachingError('');
      notify(`Teaching group saved: ${teachingCourse}, Year ${teachingYear}.`);
      window.dispatchEvent(new Event('portal-sync-now'));
    } catch (error) {
      setTeachingError(error.message || 'Could not save teaching group.');
    }
  };

  const removeTeachingGroup = async (group) => {
    if (!window.confirm(`Remove ${group.course}, Year ${group.yearLevel} from this teaching group?`)) return;
    try {
      await apiRequest(`/admin/teaching-courses/${group.id}`, { method: 'DELETE' });
      setTeachingGroups(teachingGroups.filter((item) => item.id !== group.id));
      notify(`Removed ${group.course}, Year ${group.yearLevel}.`);
      window.dispatchEvent(new Event('portal-sync-now'));
    } catch (error) {
      setTeachingError(error.message || 'Could not remove teaching group.');
    }
  };

  return (
    <div className="courses-workspace">
      {canManage && (
        <section className="panel staff-allocation-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Staff allocation</p><h3>{user.role === "main-admin" ? "Manage teaching groups" : "My teaching groups"}</h3></div>
            <span className="count">{visibleTeachingGroups.length} active group(s)</span>
          </div>
          <p className="muted">Assign teachers/lecturers to a course and year first. Learner enrolment then uses these allocations so every new student has a responsible lecturer.</p>
          <form className="group-form" onSubmit={saveTeachingGroup}>
            {user.role === "main-admin" && (
              <label>Teacher / administrator
                <select required value={teachingAdminId} onChange={(e) => setTeachingAdminId(e.target.value)}>
                  <option value="">Choose a teacher</option>
                  {accounts.filter((account) => account.role === "admin").map((account) => <option key={account.id} value={account.id}>{account.name} ({account.username})</option>)}
                </select>
              </label>
            )}
            <label>Course<select required value={teachingCourse} onChange={(e) => setTeachingCourse(e.target.value)}><option value="">Choose a course</option>{courseNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Year of study<select value={teachingYear} onChange={(e) => setTeachingYear(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label>
            <label>Academic year<input type="number" min="2000" max="2100" value={teachingAcademicYear} onChange={(e) => setTeachingAcademicYear(Number(e.target.value))} /></label>
            {teachingError && <p className="error">{teachingError}</p>}
            <button className="primary" type="submit">Save teaching group</button>
          </form>
          {!!teachingGroups.length && <div className="allocation-list">{teachingGroups.map((group) => <div className="allocation-card" key={group.id}><div><strong>{group.course}</strong><small>Year {group.yearLevel} · Academic year {group.academicYear} · {group.staffName || user.name}</small></div><button className="text-button danger" type="button" onClick={() => removeTeachingGroup(group)}>Remove</button></div>)}</div>}
          {!!courseGroups.length && <div className="course-count-strip">{courseGroups.map((group) => <div className="course-count-chip" key={`${group.course}-${group.yearLevel}`}><strong>{group.course}</strong><span>Year {group.yearLevel} · {group.studentCount} student{Number(group.studentCount) === 1 ? '' : 's'}</span></div>)}</div>}
        </section>
      )}

      {canManage ? (
        <>
          {unallocatedLearners.length > 0 && (
            <section className="panel unallocated-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Needs attention</p>
                  <h3>Learners without a responsible lecturer</h3>
                  <p className="muted">These learners have no entry in the staff allocation table. They currently fall back to whoever teaches their course and year, and see "allocation pending" if nobody does.</p>
                </div>
                <span className="count">{unallocatedLearners.length}</span>
              </div>
              <div className="table-scroll">
                <table className="data-table ruled-table">
                  <thead><tr><th>Student</th><th>Student ID</th><th>Course</th><th>Year</th><th>Course team</th></tr></thead>
                  <tbody>{unallocatedLearners.map((learner) => (
                    <tr key={learner.id}>
                      <td><strong>{learner.name}</strong></td>
                      <td>{learner.studentId || "—"}</td>
                      <td>{learner.course || <span className="warning">No course</span>}</td>
                      <td>{learner.yearLevel ? `Year ${learner.yearLevel}` : "—"}</td>
                      <td>{learner.fallbackStaff
                        ? <span className="muted">{learner.fallbackStaff} (provisional)</span>
                        : <span className="warning">Nobody teaches this group</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="muted small-print">Allocate a lecturer by creating the learner through the enrolment form below, or by importing a CSV that includes a <code>teacherUsername</code> column.</p>
            </section>
          )}
          <section className="panel course-directory-panel">
            <div className="panel-heading"><div><p className="eyebrow">Student groups</p><h3>{user.role === "main-admin" ? "Institute course directory" : "My student groups"}</h3></div><span className="count">{groupRows.length} matching group(s)</span></div>
            <p className="muted">Switch between a whole-group view or separate pages by course, year, or lecturer. The filters can be combined.</p>
            <div className="group-view-tabs" role="tablist" aria-label="Student group display">
              {[['all', user.role === 'main-admin' ? 'Whole institute' : 'All visible'], ['course', 'Separate by course'], ['year', 'Separate by year'], ['teacher', 'Separate by lecturer']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={groupView === value} className={groupView === value ? 'group-tab active' : 'group-tab'} onClick={() => setGroupView(value)}>{label}</button>)}
            </div>
            <div className="filter-bar group-filter-bar">
              <label>Course<select value={groupCourse} onChange={(e) => setGroupCourse(e.target.value)}><option value="all">All courses</option>{groupCourses.map((course) => <option key={course} value={course}>{course}</option>)}</select></label>
              <label>Year<select value={groupYear} onChange={(e) => setGroupYear(e.target.value)}><option value="all">All years</option>{groupYears.map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label>
              <label>Teacher / lecturer<select value={groupTeacher} onChange={(e) => setGroupTeacher(e.target.value)}><option value="all">All teachers</option>{groupTeachers.map((teacher) => <option key={String(teacher.id || teacher.name)} value={teacher.id || teacher.name}>{teacher.name}</option>)}</select></label>
              <button className="secondary" type="button" onClick={() => { setGroupCourse('all'); setGroupYear('all'); setGroupTeacher('all'); }}>Clear filters</button>
            </div>
            {groupRows.length === 0 ? <p className="muted">No teaching groups match the current filters. Create a teaching group above, then assign learners to it.</p> : <div className="table-scroll">
              <table className="data-table ruled-table group-table">
                <thead><tr><th>Course</th><th>Year</th><th>Academic year</th><th>Teacher / lecturer</th><th>Students</th><th>Student names</th></tr></thead>
                <tbody>{groupRows.map((group) => { const names = group.students.map((student) => student.name); return <tr key={group.id}><td><strong>{group.course}</strong></td><td>Year {group.yearLevel}</td><td>{group.academicYear}</td><td>{group.staffName || staffById.get(String(group.userId))?.name || "Not assigned"}</td><td>{group.students.length}</td><td>{names.length ? `${names.slice(0, 5).join(", ")}${names.length > 5 ? ` +${names.length - 5} more` : ""}` : "No students assigned"}</td></tr>; })}</tbody>
              </table>
            </div>}
          </section>
        </>
      ) : (
        <section className="panel student-course-profile-panel">
          <div className="panel-heading"><div><p className="eyebrow">My academic profile</p><h3>My course and year</h3></div><span className="count">Student view</span></div>
          <p className="muted">Your course page only shows information belonging to your own student account. Student group directories and other learners are hidden.</p>
          <div className="student-course-summary">
            <div><span>Current course</span><strong>{user.course || "Not assigned"}</strong></div>
            <div><span>Year of study</span><strong>{user.yearLevel ? `Year ${user.yearLevel}` : "Not assigned"}</strong></div>
            <div><span>Lecturer</span><strong>{user.teacherName || "Staff allocation pending"}</strong></div>
          </div>
          <p className="muted small-print">Your course and year are stored with your student account. Lecturer/group allocation is managed by staff.</p>
        </section>
      )}

      {user.role !== "student" && (
        <form className="panel form-panel learner-enrolment-panel" onSubmit={enroll}>
          <div className="panel-heading"><div><p className="eyebrow">Learner details</p><h3>Register or assign a learner</h3></div><span className="count">Teacher assignment required</span></div>
          <p className="muted">Choose the course and year first. Only teachers/lecturers allocated to that group can be selected.</p>
          <div className="form-grid">
            <label>Full name<input required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="New learner name" /></label>
            <label>Student ID<input required value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="STU-002" /></label>
            <label>Temporary username<input required value={temporaryUsername} onChange={(e) => setTemporaryUsername(e.target.value)} placeholder="learner.temp" /></label>
            <label>Temporary password<input required type="password" minLength="8" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} placeholder="At least 8 characters" /></label>
            <label>Trusted email<input required type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="learner@example.com" /></label>
            <label>Course<select required value={selected} onChange={(e) => { setSelected(e.target.value); setSelectedTeacherId(''); }}><option value="">Choose a course</option>{courseNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Year of study<select value={selectedStudentYear} onChange={(e) => { setSelectedStudentYear(Number(e.target.value)); setSelectedTeacherId(''); }}>{[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label>
            <label>Academic year<input type="number" min="2000" max="2100" value={studentAcademicYear} onChange={(e) => { setStudentAcademicYear(Number(e.target.value) || new Date().getFullYear()); setSelectedTeacherId(''); }} /></label>
            <label className="form-grid-wide">Teacher / lecturer<select required value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} disabled={!selected || teacherChoices.length === 0}><option value="">{selected ? (teacherChoices.length ? 'Choose responsible lecturer' : 'No lecturer allocated to this course/year in the selected academic year') : 'Choose course and year first'}</option>{teacherChoices.map((teacher) => <option key={`${teacher.id}-${teacher.academicYear || studentAcademicYear}`} value={teacher.id}>{teacher.name}{teacher.username ? ` (${teacher.username})` : ''}</option>)}</select></label>
          </div>
          {selected && teacherChoices.length === 0 && <p className="error">No teacher/lecturer is currently assigned to {selected}, Year {selectedStudentYear}, academic year {studentAcademicYear}. The main administrator must allocate the teaching group for that academic year before this learner can be registered here.</p>}
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={!selected || teacherChoices.length === 0}>Create learner profile</button>
          <p className="muted small-print">Record the temporary username/password through your institution's approved onboarding process. The learner is stored with the selected course, year, academic year and lecturer.</p>
        </form>
      )}

    </div>
  );
}

function CourseManager({ courses, courseRecords = [], setCustomCourses, canManage, apiConnected, notify }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!canManage) return null;

  const add = async (event) => {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const requirement = String(data.get("requirement") || "").trim();

    if (!name || !requirement) {
      setError("Course name and entry requirements are required.");
      return;
    }
    if (courses.some(([courseName]) => courseName.toLowerCase() === name.toLowerCase())) {
      setError("That course already exists in the catalogue.");
      return;
    }
    if (!apiConnected) {
      setError("The SQLite API is not connected. Start the backend before creating a course.");
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest("/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, requirement }),
      });

      setCustomCourses((current) => [
        ...current.filter((course) => course.id !== created.id),
        created,
      ]);
      form.reset();
      notify(`Course created: ${created.name}. It is now available to all course selectors.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setError(error.message || "Could not create the course.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (course) => {
    if (!course?.id) return;
    if (!window.confirm(`Remove the course "${course.name}" from the catalogue?`)) return;
    setError("");
    try {
      await apiRequest(`/admin/courses/${course.id}`, { method: "DELETE" });
      setCustomCourses((current) => current.filter((item) => item.id !== course.id));
      notify(`Course removed: ${course.name}.`);
      window.dispatchEvent(new Event("portal-sync-now"));
    } catch (error) {
      setError(error.message || "Could not remove the course.");
    }
  };

  const rows = (courseRecords || []).filter((course) => course && course.name && course.active !== false);

  return <>
    <form className="panel form-panel course-manager" onSubmit={add}>
      <div className="panel-heading"><div><p className="eyebrow">Course administration</p><h3>Create a course</h3></div><span className="count">{courseRecords.length} created</span></div>
      <p className="muted">Courses are stored in SQLite, then pushed into every course selector for students, administrators and main administrators. They remain available after refresh and on another browser connected to the same database.</p>
      <div className="form-grid">
        <label>Course name<input name="name" required placeholder="e.g. History" /></label>
        <label>Entry requirements<input name="requirement" required placeholder="Required subjects or experience" /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={saving}>{saving ? "Creating course…" : "Create course"}</button>
    </form>

    <section className="panel course-catalog-panel">
      <div className="panel-heading"><div><p className="eyebrow">Course catalogue</p><h3>Available and created courses</h3></div><span className="count">{rows.length} total</span></div>
      {rows.length === 0 ? <p className="muted">No courses are currently available. Create the first course above.</p> : <div className="table-scroll"><table className="data-table ruled-table course-catalog-table"><thead><tr><th>Course</th><th>Entry requirements</th><th>Source</th><th>Action</th></tr></thead><tbody>{rows.map((course) => <tr key={course.id}><td><strong>{course.name}</strong></td><td>{course.requirement || "—"}</td><td>{course.isDefault ? "Showcase example" : "Created in SQLite"}</td><td>{course.isDefault ? <span className="muted small-print">Built-in</span> : <button className="text-button danger" type="button" onClick={() => remove(course)}>Remove</button>}</td></tr>)}</tbody></table></div>}
      <p className="muted small-print">Only active courses created in SQLite are shown here and are used by all course dropdowns.</p>
    </section>
  </>;
}

// Main administrator institutional oversight. This is deliberately separate from the learner
// report card: the main administrator can inspect the whole student population, released marks,
// remediation cases and centrally stored test/exam attempts, then print one consolidated report.
function InstitutionReport({ marks, accounts, tests, testAttempts, remediations = [], passMark, institution, notify, courses = [] }) {
  const [courseFilter, setCourseFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [markStatus, setMarkStatus] = useState("released");

  const students = accounts.filter((account) => account.role === "student");
  const reportCourses = courses.map(([name]) => name).filter(Boolean).sort();
  const years = [...new Set(students.map((student) => Number(student.yearLevel)).filter((year) => Number.isInteger(year)))].sort((a, b) => a - b);
  const visibleStudents = students.filter((student) =>
    (courseFilter === "all" || student.course === courseFilter) &&
    (yearFilter === "all" || Number(student.yearLevel) === Number(yearFilter))
  );
  const visibleIds = new Set(visibleStudents.map((student) => student.studentId));

  const visibleMarks = marks.filter((mark) => {
    if (!visibleIds.has(mark.studentId)) return false;
    if (markStatus === "released") return ["Published", "Locked"].includes(mark.status || "Published");
    if (markStatus === "all") return true;
    return mark.status === markStatus;
  });

  const visibleRemediations = remediations.filter((item) => visibleIds.has(item.studentId));
  const testDefinitions = Array.isArray(tests) ? tests : [];
  const attemptRows = Object.values(testAttempts || {}).flatMap((list) =>
    (Array.isArray(list) ? list : []).map((attempt) => {
      const definition = testDefinitions.find((test) => String(test.id) === String(attempt.testId));
      const student = visibleStudents.find((entry) => entry.studentId === attempt.studentId);
      const passing = Number(definition?.passingMark ?? passMark);
      return {
        testId: String(attempt.testId || definition?.id || "—"),
        testTitle: definition?.title || String(attempt.testId || "Test / exam"),
        course: attempt.course || student?.course || definition?.course || "—",
        yearLevel: attempt.yearLevel || student?.yearLevel || definition?.yearLevel || null,
        studentId: attempt.studentId || student?.studentId || "—",
        studentName: attempt.studentName || student?.name || "—",
        attemptNumber: Number(attempt.attemptNumber || 0),
        score: Number(attempt.score || 0),
        status: attempt.needsReview ? "Needs staff review" : (attempt.passed == null ? (Number(attempt.score) >= passing ? "Passed" : "Below pass mark") : (attempt.passed ? "Passed" : "Below pass mark")),
        takenAt: attempt.takenAt,
      };
    }).filter((attempt) => visibleIds.has(attempt.studentId))
  );
  attemptRows.sort((a, b) => String(b.takenAt || "").localeCompare(String(a.takenAt || "")));


  const scoreOf = (mark) => {
    const remediation = remediations.find((item) => item.studentId === mark.studentId && item.assessmentId === mark.assessmentId);
    const final = remediation && ["Completed", "Resolved"].includes(remediation.status) && remediation.score !== "" && remediation.score != null;
    return Number(final ? remediation.score : (mark.score ?? mark.mark ?? 0));
  };
  const averageFor = (studentId) => {
    const own = visibleMarks.filter((mark) => mark.studentId === studentId);
    const weight = own.reduce((sum, mark) => sum + Number(mark.weighting || 100), 0);
    return weight ? own.reduce((sum, mark) => sum + scoreOf(mark) * Number(mark.weighting || 100), 0) / weight : null;
  };

  const summary = visibleStudents.map((student) => {
    const ownMarks = visibleMarks.filter((mark) => mark.studentId === student.studentId);
    const average = averageFor(student.studentId);
    const passed = ownMarks.filter((mark) => scoreOf(mark) >= Number(mark.passingMark ?? passMark)).length;
    const remediationCount = visibleRemediations.filter((item) => item.studentId === student.studentId && !["Cancelled", "Resolved"].includes(item.status)).length;
    const ownAttempts = attemptRows.filter((attempt) => attempt.studentId === student.studentId);
    const bestTest = ownAttempts.length ? Math.max(...ownAttempts.map((attempt) => attempt.score)) : null;
    return { student, average, markCount: ownMarks.length, passed, remediationCount, testAttempts: ownAttempts.length, bestTest };
  }).sort((a, b) => a.student.name.localeCompare(b.student.name));

  const releasedCount = visibleMarks.filter((mark) => ["Published", "Locked"].includes(mark.status || "Published")).length;
  const remediationOpen = visibleRemediations.filter((item) => !["Cancelled", "Resolved"].includes(item.status)).length;
  const passingMarks = visibleMarks.filter((mark) => scoreOf(mark) >= Number(mark.passingMark ?? passMark)).length;
  const printedDate = new Date().toLocaleString();

  const printInstitutionReport = () => {
    const escape = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
    const studentRows = summary.map((entry) => `<tr><td>${escape(entry.student.studentId)}</td><td>${escape(entry.student.name)}</td><td>${escape(entry.student.course || "—")}</td><td>${entry.student.yearLevel || "—"}</td><td>${entry.average == null ? "—" : `${Math.round(entry.average)}%`}</td><td>${entry.markCount}</td><td>${entry.remediationCount}</td><td>${entry.testAttempts}</td><td>${entry.bestTest == null ? "—" : `${Math.round(entry.bestTest)}%`}</td></tr>`).join("");
    const markRows = visibleMarks.map((mark) => `<tr><td>${escape(mark.studentId)}</td><td>${escape(mark.student || accounts.find((a) => a.studentId === mark.studentId)?.name || "—")}</td><td>${escape(mark.subject || "—")}</td><td>${escape(mark.assessmentId || "—")}</td><td>${scoreOf(mark)}%</td><td>${escape(mark.status || "—")}</td></tr>`).join("");
    const testRows = attemptRows.map((attempt) => `<tr><td>${escape(attempt.studentId)}</td><td>${escape(attempt.studentName)}</td><td>${escape(attempt.testTitle)}</td><td>${attempt.attemptNumber}</td><td>${Math.round(attempt.score)}%</td><td>${escape(attempt.status)}</td><td>${escape(attempt.takenAt ? new Date(attempt.takenAt).toLocaleString() : "—")}</td></tr>`).join("");
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) { notify("Please allow pop-ups to print the institutional oversight report."); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${escape(institution)} — Institutional Oversight Report</title><style>body{font-family:Arial,sans-serif;color:#17211f;padding:30px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}th,td{border:1px solid #7d918c;padding:6px;text-align:left}th{background:#0f766e;color:#fff}.stats{display:flex;gap:12px;margin:18px 0}.stat{border:1px solid #cad7d2;padding:10px 14px}.note{font-size:11px;color:#5f6e6a}@media print{button{display:none}}</style></head><body><h1>${escape(institution)} — Institutional Oversight Report</h1><p><strong>Scope:</strong> ${escape(courseFilter === "all" ? "All courses" : courseFilter)} · ${escape(yearFilter === "all" ? "All years" : `Year ${yearFilter}`)} · <strong>Generated:</strong> ${escape(printedDate)}</p><div class="stats"><div class="stat"><strong>${summary.length}</strong><br>Students</div><div class="stat"><strong>${releasedCount}</strong><br>Released marks</div><div class="stat"><strong>${passingMarks}</strong><br>Passing results</div><div class="stat"><strong>${remediationOpen}</strong><br>Open remediation cases</div><div class="stat"><strong>${attemptRows.length}</strong><br>Test/exam attempts</div></div><h2>Student overview</h2><table><thead><tr><th>Student ID</th><th>Name</th><th>Course</th><th>Year</th><th>Average</th><th>Marks</th><th>Remediation</th><th>Test attempts</th><th>Best test</th></tr></thead><tbody>${studentRows}</tbody></table><h2>Detailed released mark register</h2><table><thead><tr><th>Student ID</th><th>Name</th><th>Subject</th><th>Assessment</th><th>Mark</th><th>Status</th></tr></thead><tbody>${markRows || '<tr><td colspan="6">No marks in this scope.</td></tr>'}</tbody></table><h2>Test and exam attempts</h2><table><thead><tr><th>Student ID</th><th>Name</th><th>Test/Exam</th><th>Attempt</th><th>Score</th><th>Status</th><th>Taken</th></tr></thead><tbody>${testRows || '<tr><td colspan="7">No stored test/exam attempts in this scope.</td></tr>'}</tbody></table><p class="note">Only the main administrator can open this institutional oversight report. Released-mark totals use Published/Locked results; test/exam attempt history is read from SQLite when available.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    printWindow.document.close();
  };

  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">Main administrator · institutional oversight</p><h3>Whole-institute academic report</h3></div><span className="count">{summary.length} student(s)</span></div>
    <p className="muted">This view gives the main administrator an institute-wide register of students, released marks, remediation workload and stored test/exam attempts. It is not restricted by teaching groups.</p>
    <div className="stats"><div className="stat-card"><small>Students in scope</small><strong>{summary.length}</strong></div><div className="stat-card"><small>Released marks</small><strong>{releasedCount}</strong></div><div className="stat-card"><small>Passing results</small><strong>{passingMarks}</strong></div><div className="stat-card"><small>Open remediation</small><strong>{remediationOpen}</strong></div><div className="stat-card"><small>Test/exam attempts</small><strong>{attemptRows.length}</strong></div></div>
    <div className="filter-bar"><select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}><option value="all">All courses</option>{reportCourses.map((course) => <option key={course} value={course}>{course}</option>)}</select><select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}><option value="all">All years</option>{years.map((year) => <option key={year} value={year}>Year {year}</option>)}</select><select value={markStatus} onChange={(e) => setMarkStatus(e.target.value)}><option value="released">Published + Locked</option><option value="all">All mark statuses</option>{["Draft", "Submitted", "Approved"].map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="primary" onClick={printInstitutionReport}>Print full institute report</button></div>
    <div className="table-scroll"><table className="data-table ruled-table"><thead><tr><th>Student</th><th>Course</th><th>Year</th><th>Average</th><th>Marks</th><th>Passing</th><th>Remediation</th><th>Test attempts</th><th>Best test</th></tr></thead><tbody>{summary.length === 0 ? <tr><td colSpan={9} className="muted">No students match this course/year filter.</td></tr> : summary.map((entry) => <tr key={entry.student.studentId}><td><strong>{entry.student.name}</strong><br /><small>{entry.student.studentId}</small></td><td>{entry.student.course || "—"}</td><td>{entry.student.yearLevel || "—"}</td><td>{entry.average == null ? "—" : `${Math.round(entry.average)}%`}</td><td>{entry.markCount}</td><td>{entry.passed}</td><td>{entry.remediationCount}</td><td>{entry.testAttempts}</td><td>{entry.bestTest == null ? "—" : `${Math.round(entry.bestTest)}%`}</td></tr>)}</tbody></table></div>
    <p className="muted small-print">The detailed register is included in the printable report. Normal administrators do not receive this institute-wide view; their database results remain restricted to assigned course/year groups.</p>
  </section>;
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
//  3. **Release outbox.** "Release to student" writes the finished mark to a marker-scoped
//     outbox first, then tries to send it. If the API is down the entry stays queued and is retried
//     automatically when the connection returns. Scoping by the signed-in marker prevents one
//     user's queued marks from ever being sent under another account in the same browser.
// ---------------------------------------------------------------------------------------------

function MarkingRoom({ user, submissions, setSubmissions, memos, setMemos, passMark, apiConnected, notify, setNotice, teachingGroups = [], courses = [], remediations = [], setRemediations }) {
  const draftsKey = "portal-marking-drafts";
  const markerStorageKey = String(user?.username || "unknown").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_") || "unknown";
  const outboxKey = `portal-marking-outbox-${markerStorageKey}`;
  const [drafts, setDrafts] = useState(() => load(draftsKey, {}));
  const [outbox, setOutbox] = useState(() => {
    const scoped = load(outboxKey, null);
    if (Array.isArray(scoped)) return scoped;
    const legacy = load("portal-marking-outbox", []);
    if (!Array.isArray(legacy)) return [];
    return legacy.filter((entry) => String(entry.marker || "").trim().toLowerCase() === String(user?.username || "").trim().toLowerCase());
  });
  const [openKey, setOpenKey] = useState("");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState(null);
  const [memoBusy, setMemoBusy] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [returningCopy, setReturningCopy] = useState(false);

  const downloadProtectedFile = async (url, fallbackName) => {
    if (!url) return;
    const resolvedUrl = /^(https?:|blob:|data:)/i.test(url) ? url : `${API_BASE}${url}`;
    const operationId = portalBusyStart(`Downloading ${fallbackName || "file"}…`);
    try {
      const response = await fetch(resolvedUrl, { credentials: "include" });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || `Download request returned HTTP ${response.status}.`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fallbackName || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      notify(`Downloaded ${fallbackName || "file"}.`);
    } catch (error) {
      setNotice(`Could not download the file: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const queue = Object.entries(submissions).map(([key, submission]) => ({ ...submission, key })).filter((item) => user.role === 'main-admin' || (teachingGroups.length > 0 && teachingGroups.some((group) => (!item.course || item.course === group.course) && (!item.yearLevel || Number(item.yearLevel) === Number(group.yearLevel)))));
  // A result counts as released when SQLite says so (Published/Locked), not only when this browser
  // performed the release, so approval-workflow releases and other markers' work are included.
  const isReleased = (item) => item.releaseStatus === "Released" || ["Published", "Locked"].includes(String(item.markStatus || ""));
  const releaseHistory = queue
    .filter(isReleased)
    .map((item) => ({
      id: item.key,
      studentId: item.studentId,
      studentName: item.studentName,
      assignmentTitle: item.assignmentTitle,
      mark: item.mark,
      releasedAt: item.markPublishedAt || item.markedAt,
      releasedBy: item.markedBy || "—",
      returnedFileName: item.markedFileName || null,
      studentDownloadedAt: item.markedDownloadedAt || item.studentDownloadedAt || null,
      studentViewedAt: item.studentViewedAt || null,
      status: "Released",
    }))
    .sort((a, b) => (serverTime(b.releasedAt)?.getTime() || 0) - (serverTime(a.releasedAt)?.getTime() || 0));
  const recentReleaseCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentReleases = releaseHistory.filter((item) => (serverTime(item.releasedAt)?.getTime() || 0) >= recentReleaseCutoff);
  const draftFor = (key) => drafts[`${key}::${user.username}`];
  const stateOf = (item) => {
    const persisted = String(item.markStatus || item.releaseStatus || "");
    if (persisted === "Locked" || persisted === "Published" || item.releaseStatus === "Released") return "released";
    if (persisted === "Approved" || item.releaseStatus === "Approved") return "approved";
    if (persisted === "Submitted" || item.releaseStatus === "Awaiting Approval") return "awaiting-approval";
    if (persisted === "Returned to Marker" || item.releaseStatus === "Returned to Marker") return "returned-to-marker";
    if (draftFor(item.key)) return "in-progress";
    return "not-started";
  };
  const markingCourses = courses.map(([name]) => name).filter(Boolean).sort();
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

  const returnMarkedCopy = async (file) => {
    if (!open || !file) return;
    if (!apiConnected) return setNotice("Marked copies are stored by the server. Reconnect the local API to upload one.");
    if (!open.id) return setNotice("This submission has not synced from SQLite yet. Refresh and try again.");
    if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) return setNotice("The marked copy must be one ZIP file up to 25 MB.");
    const formData = new FormData();
    formData.append("file", file);
    setReturningCopy(true);
    const operationId = portalBusyStart(`Returning ${file.name} to ${open.studentName}…`);
    try {
      const updated = await apiRequest(`/admin/assignment-submissions/${open.id}/marked-file`, { method: "POST", body: formData });
      // Keep the locally recorded marking state (release status, breakdown) and take the file fields from SQLite.
      setSubmissions({ ...submissions, [open.key]: { ...open, ...updated, mark: open.mark ?? updated.mark } });
      setNotice(`Marked copy returned to ${open.studentName}. ${updated.markStatus && !["Published", "Locked"].includes(updated.markStatus) ? "They will see it once the mark is published." : "They have been notified."}`);
    } catch (error) {
      setNotice(`Could not upload the marked copy: ${error.message}`);
    } finally {
      setReturningCopy(false);
      portalBusyEnd(operationId);
    }
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
  }, [outboxKey, setNotice, notify]);
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
    setSubmissions({
      ...submissions, [open.key]: {
        ...open,
        mark: percentage,
        markStatus: user.role === "main-admin" ? "Published" : "Submitted",
        markFeedback: feedback,
        markingStatus: user.role === "main-admin" ? "Released" : "Awaiting Approval",
        markedBy: user.name,
        markedByUsername: user.username,
        markedAt: publishedAt,
        markBreakdown: breakdown,
        markComment: draft?.comment || "",
        remediationOpen: percentage < passMark,
        releaseStatus: user.role === "main-admin" ? "Released" : "Awaiting Approval",
        markPublishedAt: user.role === "main-admin" ? publishedAt : null,
      }
    });
    const entry = {
      id: `${open.key}-${Date.now()}`, queuedAt: publishedAt, marker: user.username, student: open.studentName, payload: {
        studentId: open.studentId,
        assessmentId: `ASSIGN-${open.assignmentId}`,
        assessmentName: open.assignmentTitle,
        mark: percentage,
        passingMark: Number(passMark),
        status: user.role === "main-admin" ? "Published" : "Submitted",
        override: isRemark,
        reason: reason || undefined,
        feedback: feedback
      }
    };
    const nextOutbox = [...outbox, entry];
    setOutbox(nextOutbox); localStorage.setItem(outboxKey, JSON.stringify(nextOutbox));
    const nextDrafts = { ...drafts }; delete nextDrafts[`${open.key}::${user.username}`];
    setDrafts(nextDrafts); localStorage.setItem(draftsKey, JSON.stringify(nextDrafts));
    notify(user.role === "main-admin"
      ? `${open.studentName} — ${open.assignmentTitle}: ${percentage}% released. ${percentage < passMark ? `Below the ${passMark}% requirement, so remediation has been opened.` : "Passing requirement met."} ${feedback}`
      : `${open.studentName} — ${open.assignmentTitle}: ${percentage}% submitted for final approval by the main administrator. ${feedback}`);
    setNotice(`${isRemark ? "Re-marked" : user.role === "main-admin" ? "Released" : "Submitted for final approval"} ${percentage}% ${isRemark && previousMark !== undefined ? `(was ${previousMark}%) ` : ""}to ${open.studentName}.${apiConnected ? "" : " You are offline, so it is queued and will sync automatically when the API returns."}`);
    setOpenKey("");
  };

  // Memos are shared by every marker, so they are written to SQLite first and only then shown as
  // saved. Editing works on a local copy (memoDraft) so criteria can be added and removed freely
  // before anything is committed, and Cancel genuinely discards the changes.
  const blankCriterion = () => ({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: "", max: 10, guidance: "" });
  const startEditingMemo = (source) => {
    setMemoDraft({ title: source.title, criteria: source.criteria.map((criterion) => ({ ...criterion })) });
    setEditingMemo(true);
  };
  const cancelEditingMemo = () => { setEditingMemo(false); setMemoDraft(null); };
  const updateDraftCriterion = (index, patch) => setMemoDraft((current) => ({ ...current, criteria: current.criteria.map((criterion, position) => (position === index ? { ...criterion, ...patch } : criterion)) }));
  const addDraftCriterion = () => setMemoDraft((current) => ({ ...current, criteria: [...current.criteria, blankCriterion()] }));
  const removeDraftCriterion = (index) => setMemoDraft((current) => (current.criteria.length <= 1 ? current : { ...current, criteria: current.criteria.filter((_, position) => position !== index) }));
  const draftTotal = memoDraft ? memoDraft.criteria.reduce((sum, criterion) => sum + (Number(criterion.max) || 0), 0) : 0;

  const saveMemo = async (event) => {
    event.preventDefault();
    if (!open || !memoDraft) return;
    if (!apiConnected) return setNotice("Memos are shared with every marker and are stored in SQLite. Reconnect to the local API before saving.");
    const criteria = memoDraft.criteria.map((criterion) => ({ ...criterion, label: String(criterion.label || "").trim(), guidance: String(criterion.guidance || "").trim(), max: Number(criterion.max) }));
    const blank = criteria.findIndex((criterion) => !criterion.label);
    if (blank !== -1) return setNotice(`Criterion ${blank + 1} needs a description.`);
    const invalid = criteria.find((criterion) => !Number.isFinite(criterion.max) || criterion.max <= 0 || criterion.max > 1000);
    if (invalid) return setNotice(`"${invalid.label}" must be out of a number between 1 and 1000.`);
    setMemoBusy(true);
    try {
      const saved = await apiRequest(`/admin/memos/${open.assignmentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: String(memoDraft.title || "").trim() || `${open.assignmentTitle} memo`, criteria }) });
      setMemos({ ...memos, [open.assignmentId]: saved });
      setEditingMemo(false); setMemoDraft(null);
      setNotice("Memo saved to SQLite. It applies to every marker and every learner on this assignment.");
    } catch (error) {
      setNotice(`Could not save the memo: ${error.message}`);
    } finally { setMemoBusy(false); }
  };
  const createMemo = () => {
    if (!open) return;
    if (!apiConnected) return setNotice("Reconnect to the local API before adding a memo — memos are stored in SQLite so every marker sees them.");
    startEditingMemo({ title: `${open.assignmentTitle} memo`, criteria: [{ ...blankCriterion(), label: "Meets the brief", max: 100 }] });
  };
  const deleteMemo = async () => {
    if (!open || !memo) return;
    if (!apiConnected) return setNotice("Reconnect to the local API before deleting a memo.");
    if (!window.confirm(`Delete the memo for "${open.assignmentTitle}"? Every marker loses this rubric. Marks already released are not changed.`)) return;
    setMemoBusy(true);
    try {
      await apiRequest(`/admin/memos/${open.assignmentId}`, { method: "DELETE" });
      const { [open.assignmentId]: _removed, ...remainingMemos } = memos;
      setMemos(remainingMemos);
      setEditingMemo(false); setMemoDraft(null);
      setNotice("Memo deleted.");
    } catch (error) {
      setNotice(`Could not delete the memo: ${error.message}`);
    } finally { setMemoBusy(false); }
  };

  const counts = { total: queue.length, released: queue.filter((item) => stateOf(item) === "released").length, inProgress: queue.filter((item) => stateOf(item) === "in-progress").length };

  return <>
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Marking room</p><h3>Mark submissions against the memo</h3></div><span className="count">{counts.total} in queue · {counts.inProgress} in progress · {counts.released} released</span></div>
      <p className="muted">Your scores and comments autosave to this browser as you type, so nothing is lost if you close the tab, refresh, or lose your connection. Marking works completely offline — released marks are queued and sync to SQLite on their own once the API is back.</p>
      {outbox.length > 0 && <div className="outbox-banner" role="status"><strong>{outbox.length} released mark(s) waiting to sync.</strong> They are saved safely in this browser and will be sent automatically when the local API is reachable. {outbox[0].lastError && <span className="small-print"> Last attempt: {outbox[0].lastError}.</span>} {apiConnected && <button className="link-button" onClick={() => flushOutbox(outbox)}>Retry now</button>}</div>}
      <div className="filter-bar">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, ID or assignment…" aria-label="Search the marking queue" />
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter by course"><option value="all">All courses</option>{markingCourses.map((course) => <option key={course} value={course}>{course}</option>)}</select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          aria-label="Filter by marking state"
        >
          <option value="all">All states</option>
          <option value="not-started">Not started</option>
          <option value="in-progress">In progress</option>
          <option value="awaiting-approval">Awaiting approval</option>
          <option value="returned-to-marker">Returned to marker</option>
          <option value="approved">Approved</option>
          <option value="released">Released</option>
        </select>
      </div>
      <div className="table-scroll"><table className="data-table ruled-table"><thead><tr><th>Student</th><th>Student ID</th><th>Assignment</th><th>Course</th><th>Year</th><th>Submitted</th><th>State</th><th>Mark</th><th>Action</th></tr></thead><tbody>
        {visible.length === 0 && <tr><td colSpan={9} className="muted">No submissions match this search or filter.</td></tr>}
        {visible.map((item) => {
          const state = stateOf(item); const saved = draftFor(item.key); return <tr key={item.key} className={openKey === item.key ? "own-row" : ""}>
            <td>{item.studentName}</td><td>{item.studentId}</td><td>{item.assignmentTitle}</td><td>{item.course || "—"}</td><td>{item.yearLevel ? `Year ${item.yearLevel}` : "—"}</td>
            <td>{item.submittedAt ? serverTime(item.submittedAt)?.toLocaleDateString() : "—"}</td>
            <td><span className={`state-chip state-${state}`}>{state === "in-progress" ? `Saved ${saved?.savedAt ? new Date(saved.savedAt).toLocaleTimeString() : ""}` : ({ released: "Released", approved: "Approved", "awaiting-approval": "Awaiting approval", "returned-to-marker": "Returned to marker", "not-started": "Not started" }[state] || "Not started")}</span>{item.markedFileUrl && <small className="returned-status">Marked copy attached</small>}</td>
            <td>{item.mark !== undefined ? `${item.mark}%` : "—"}</td>
            <td><button className="link-button" onClick={() => { setOpenKey(openKey === item.key ? "" : item.key); setEditingMemo(false); setMemoDraft(null); }}>{openKey === item.key ? "Close" : state === "released" ? "Re-mark" : state === "in-progress" ? "Resume marking" : "Open"}</button></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>

    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Recently released</p>
          <h3>Marks returned to students</h3>
        </div>

        <span className="count">
          {recentReleases.length} released in the last 7 days
        </span>
      </div>

      {recentReleases.length === 0 ? (
        <p className="muted">
          No marks have been released in the last 7 days.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table ruled-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Assignment</th>
                <th>Mark</th>
                <th>Released</th>
                <th>Returned Work</th>
                <th>Student Status</th>
              </tr>
            </thead>

            <tbody>
              {recentReleases.map((release) => (
                <tr key={release.id}>
                  <td>
                    <strong>{release.studentName}</strong>
                    <small>{release.studentId}</small>
                  </td>

                  <td>{release.assignmentTitle}</td>

                  <td>
                    <strong>{release.mark}%</strong>
                  </td>

                  <td>
                    {release.releasedAt
                      ? serverTimeText(release.releasedAt)
                      : "—"}
                  </td>

                  <td>
                    {release.returnedFileName
                      ? "Available"
                      : "Not attached"}
                  </td>

                  <td>
                    {release.studentDownloadedAt
                      ? "Downloaded"
                      : release.studentViewedAt
                        ? "Viewed"
                        : "Not viewed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>

    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Release history</p>
          <h3>Previous released results</h3>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table ruled-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Assignment</th>
              <th>Mark</th>
              <th>Released</th>
              <th>Released By</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {releaseHistory.map((release) => (
              <tr key={release.id}>
                <td>{release.studentName}</td>
                <td>{release.assignmentTitle}</td>
                <td>{release.mark}%</td>
                <td>
                  {release.releasedAt
                    ? serverTimeText(release.releasedAt)
                    : "—"}
                </td>
                <td>{release.releasedBy || "—"}</td>
                <td>{release.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {open && <section className="panel wide-panel">
      <div className="panel-heading"><div><p className="eyebrow">Marking {open.studentName} · {open.studentId}</p><h3>{open.assignmentTitle}</h3></div><span className="count">{savedAt ? `Autosaved ${savedAt}` : draft ? `Restored a saved sheet from ${new Date(draft.savedAt).toLocaleString()}` : "Nothing entered yet"}</span></div>
      <div className="marking-grid">
        <div className="marking-pane">
          <h4>The learner's submission</h4>
          <p className="muted">{open.fileName || "No file recorded"}{open.submittedAt ? ` · submitted ${serverTimeText(open.submittedAt)}` : ""}</p>
          {open.fileUrl
            ? <button type="button" className="button-link" onClick={() => downloadProtectedFile(open.fileUrl, open.fileName)}>Download submission</button>
            : <p className="warning-text">No file is attached to this submission.</p>}
          <div className="return-copy">
            <h4>Return the marked copy</h4>
            <p className="muted small-print">Upload the annotated work as one ZIP (up to 25 MB). The learner can download it once the mark is published, and the submission is closed so it cannot be overwritten.</p>
            {open.markedFileUrl
              ? <p className="small-print"><strong>{open.markedFileName}</strong>{open.markedUploadedAt ? ` · uploaded ${serverTimeText(open.markedUploadedAt)}` : ""} · {open.markedDownloadedAt ? `opened by the learner ${serverTimeText(open.markedDownloadedAt)}` : "not opened by the learner yet"}</p>
              : <p className="small-print muted">No marked copy attached yet.</p>}
            <div className="actions">
              <label className={`secondary upload-button${!apiConnected || returningCopy ? " disabled" : ""}`}>
                {returningCopy ? "Uploading…" : open.markedFileUrl ? "Replace marked copy" : "Upload marked copy"}
                <input type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={!apiConnected || returningCopy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; returnMarkedCopy(file); }} />
              </label>
              {open.markedFileUrl && <button type="button" className="secondary" onClick={() => downloadProtectedFile(open.markedFileUrl, open.markedFileName)}>View marked copy</button>}
            </div>
            {!apiConnected && <p className="warning-text small-print">Marked copies are stored by the server. Reconnect the local API to upload one.</p>}
          </div>
          {open.reflection && <div className="reflection-peek-open"><h4>Learner reflection</h4><p>{open.reflection}</p></div>}
          {(() => {
            const remediation = remediations.find((item) => item.studentId === open.studentId && item.assessmentId === `ASSIGN-${open.assignmentId}`);
            return remediation ? <RemediationAttemptFiles remediation={remediation} apiConnected={apiConnected} notify={notify} setNotice={setNotice} onCaseUpdated={(updatedCase) => setRemediations?.((items) => [...items.filter((item) => item.id !== updatedCase.id), updatedCase])} compact /> : null;
          })()}
          <p className="muted small-print">Downloads use the authenticated local API so the staff member receives the stored submission without exposing a raw file path in the browser.</p>
          <div className="memo-heading"><h4>Memo</h4>
            {!editingMemo && <div className="memo-actions">
              {!memo && <button type="button" className="primary" onClick={createMemo} disabled={memoBusy || !apiConnected}>Add memo</button>}
              {memo && <button type="button" className="secondary" onClick={() => startEditingMemo(memo)} disabled={memoBusy || !apiConnected}>Edit memo</button>}
              {memo && <button type="button" className="danger-button" onClick={deleteMemo} disabled={memoBusy || !apiConnected}>Delete memo</button>}
            </div>}
          </div>
          {!apiConnected && <p className="warning-text small-print">Offline — showing the last memo cached in this browser. Adding, editing and deleting memos needs the local API.</p>}
          {!memo && !editingMemo && <p className="warning-text">No memo exists for this assignment yet. Add one so every marker scores against the same rubric.</p>}
          {memo && !editingMemo && <>
            <p className="muted">{memo.title} · {memoTotal} marks total · {memo.criteria.length} criteria{memo.updatedBy ? ` · last saved by ${memo.updatedBy}` : ""}. Each criterion and its guidance is shown on the marking sheet beside this, so you can read the learner's file here and score it there.</p>
          </>}
          {editingMemo && memoDraft && <form className="memo-form" onSubmit={saveMemo}>
            <label className="stacked">Memo title<input value={memoDraft.title} onChange={(e) => setMemoDraft({ ...memoDraft, title: e.target.value })} maxLength={200} required /></label>
            {memoDraft.criteria.map((criterion, index) => <div key={criterion.id} className="memo-edit-row">
              <label>Criterion {index + 1}<input value={criterion.label} onChange={(e) => updateDraftCriterion(index, { label: e.target.value })} placeholder="What earns these marks?" maxLength={200} required /></label>
              <label>Out of<input type="number" min="1" max="1000" value={criterion.max} onChange={(e) => updateDraftCriterion(index, { max: e.target.value })} aria-label={`Criterion ${index + 1} out of`} required /></label>
              <label>Marking guidance<input value={criterion.guidance || ""} onChange={(e) => updateDraftCriterion(index, { guidance: e.target.value })} maxLength={1000} aria-label={`Criterion ${index + 1} marking guidance`} /></label>
              <button type="button" className="memo-remove" onClick={() => removeDraftCriterion(index)} disabled={memoDraft.criteria.length <= 1} aria-label={`Delete criterion ${index + 1}`} title={memoDraft.criteria.length <= 1 ? "A memo needs at least one criterion" : "Delete this criterion"}>Delete</button>
            </div>)}
            <div className="memo-form-footer">
              <button type="button" className="secondary" onClick={addDraftCriterion}>+ Add criterion</button>
              <span className="muted small-print">{memoDraft.criteria.length} criteria · {draftTotal} marks total</span>
            </div>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={memoBusy}>{memoBusy ? "Saving…" : "Save memo"}</button>
              <button type="button" className="link-button" onClick={cancelEditingMemo} disabled={memoBusy}>Cancel</button>
              {memo && <button type="button" className="danger-button" onClick={deleteMemo} disabled={memoBusy}>Delete memo</button>}
            </div>
          </form>}
        </div>
        <div className="marking-pane">
          <h4>Your marking sheet</h4>
          {open.mark !== undefined && <p className="warning-text">This submission was already released at <strong>{open.mark}%</strong>{open.markPublishedAt ? ` on ${serverTimeText(open.markPublishedAt)}` : ""}{open.markedBy ? ` by ${open.markedBy}` : ""}. You can re-mark it — you will be asked for a reason, the learner is notified that the mark changed, and the correction is written to the audit log.</p>}
          {!memo ? <p className="muted">Add a memo first so there is a rubric to mark against.</p> : <>
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
              <button className="primary" onClick={release}>{open.mark !== undefined ? (user.role === "main-admin" ? "Re-mark and re-release" : "Submit re-mark for approval") : (user.role === "main-admin" ? "Release to student" : "Submit mark for approval")}</button>
              <button className="link-button" onClick={discardDraft} disabled={!draft}>Discard sheet</button>
            </div>
            <p className="muted small-print">Releasing saves the mark in this browser immediately and queues it for SQLite. {apiConnected ? "The API is connected, so it will sync straight away." : "You are offline — it will sync by itself once the local API is running again."}</p>
          </>}
        </div>
      </div>
    </section>}
  </>;
}

function RemediationAttemptFiles({ remediation, apiConnected, notify, setNotice, onCaseUpdated, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (!expanded || !remediation?.id || !apiConnected) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiRequest(`/admin/remediations/${remediation.id}/attempts`);
        if (!cancelled) setAttempts(Array.isArray(response?.attempts) ? response.attempts : []);
      } catch (_) {
        // The explicit refresh button still reports errors; a background refresh should not
        // interrupt marking when the network briefly drops.
      }
    })();
    return () => { cancelled = true; };
  }, [apiConnected, expanded, remediation?.id, remediation?.updatedAt]);

  const loadAttempts = async () => {
    if (!remediation?.id || !apiConnected) {
      setNotice?.('Reconnect SQLite before loading remediation attempt files.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest(`/admin/remediations/${remediation.id}/attempts`);
      setAttempts(Array.isArray(response?.attempts) ? response.attempts : []);
      setExpanded(true);
    } catch (error) {
      setNotice?.(`Could not load remediation attempts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadAttempt = async (attempt) => {
    if (!attempt?.canDownload) return;
    const operationId = portalBusyStart(`Downloading remediation attempt ${attempt.attemptNumber}…`);
    try {
      const response = await fetch(`${API_BASE}/admin/remediations/${remediation.id}/attempts/${attempt.id}/download`, { credentials: 'include' });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || `Download request returned HTTP ${response.status}.`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attempt.fileName || `remediation-attempt-${attempt.attemptNumber}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      notify?.(`Downloaded remediation attempt ${attempt.attemptNumber}.`);
    } catch (error) {
      setNotice?.(`Could not download remediation attempt: ${error.message}`);
    } finally {
      portalBusyEnd(operationId);
    }
  };

  const deleteFirstFailedAttempt = async (attempt) => {
    if (!attempt?.canDelete) return;
    if (!window.confirm('Remove the first failed remediation file? The attempt count stays used and the file will no longer be downloadable. This action cannot be undone.')) return;
    try {
      const response = await apiRequest(`/admin/remediations/${remediation.id}/attempts/${attempt.id}`, { method: 'DELETE' });
      const updatedCase = response?.case;
      if (updatedCase) onCaseUpdated?.(updatedCase);
      await loadAttempts();
      setNotice?.('The first failed remediation file was removed. The attempt remains recorded for audit purposes.');
    } catch (error) {
      setNotice?.(`Could not remove remediation file: ${error.message}`);
    }
  };

  const latest = attempts.length ? attempts[attempts.length - 1] : null;
  return <div className={`remediation-attempts${compact ? ' compact' : ''}`}>
    <div className="remediation-attempts-head">
      <div>
        <strong>Remediation attempts</strong>
        <small>{Number(remediation.attempts || 0)} used of {Number(remediation.attemptLimit || 1)} allowed{latest?.status ? ` · latest ${latest.status.toLowerCase()}` : ''}</small>
      </div>
      <button type="button" className="button-link" onClick={expanded ? () => setExpanded(false) : loadAttempts} disabled={loading}>
        {loading ? 'Loading…' : expanded ? 'Hide attempts' : 'View attempt files'}
      </button>
    </div>
    {expanded && (attempts.length === 0
      ? <p className="muted small-print">No separately stored remediation attempt files are available yet.</p>
      : <div className="remediation-attempt-list">
        {attempts.map((attempt) => <article className={`remediation-attempt-row${attempt.locked ? ' locked' : ''}${attempt.status === 'Deleted' ? ' deleted' : ''}`} key={attempt.id}>
          <div className="remediation-attempt-meta">
            <strong>Attempt {attempt.attemptNumber}</strong>
            <span>{attempt.status}</span>
            <small>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Submission time unavailable'}{attempt.mark != null ? ` · ${attempt.mark}%` : ''}</small>
            {attempt.feedback && <small>{attempt.feedback}</small>}
          </div>
          <div className="remediation-attempt-actions">
            {attempt.canDownload ? <button type="button" className="secondary" onClick={() => downloadAttempt(attempt)}>Download</button> : <span className="muted small-print">File removed</span>}
            {attempt.canDelete ? <button type="button" className="danger-button" onClick={() => deleteFirstFailedAttempt(attempt)}>Remove first failed file</button> : attempt.locked ? <span className="muted small-print">Locked after next attempt</span> : null}
          </div>
        </article>)}
      </div>)}
  </div>;
}

function studentCardPreviewVars(widthMm, heightMm) {
  const scale = studentCardContentScale(widthMm, heightMm);
  const mm = (value) => scaledStudentCardMm(value, scale);
  return {
    "--card-photo-column": mm(STUDENT_CARD_LAYOUT.photoColumnMm),
    "--card-photo-width": mm(STUDENT_CARD_LAYOUT.photoWidthMm),
    "--card-photo-height": mm(STUDENT_CARD_LAYOUT.photoHeightMm),
    "--card-photo-pad-right": mm(2),
    "--card-photo-radius": mm(2),
    "--card-accent-height": mm(STUDENT_CARD_LAYOUT.accentHeightMm),
    "--card-pad-top": mm(STUDENT_CARD_LAYOUT.mainPaddingTopMm),
    "--card-pad-right": mm(STUDENT_CARD_LAYOUT.mainPaddingRightMm),
    "--card-pad-bottom": mm(STUDENT_CARD_LAYOUT.mainPaddingBottomMm),
    "--card-pad-left": mm(STUDENT_CARD_LAYOUT.mainPaddingLeftMm),
    "--card-field-label": mm(STUDENT_CARD_LAYOUT.fieldLabelMm),
    "--card-field-gap": mm(STUDENT_CARD_LAYOUT.fieldGapMm),
    "--card-title-margin": mm(1),
    "--card-subtitle-margin": mm(2),
    "--card-field-margin": mm(1),
    "--card-footer-bottom": mm(2),
    "--card-footer-right": mm(4),
    "--card-radius": mm(4),
    "--card-title-font": `${12 * scale}pt`,
    "--card-subtitle-font": `${7 * scale}pt`,
    "--card-field-font": `${7 * scale}pt`,
    "--card-placeholder-font": `${8 * scale}pt`,
    "--card-footer-font": `${6 * scale}pt`,
  };
}

// Shared on-screen card: the admin live preview and the learner's own profile preview both use it,
// so what a learner sees is exactly the approved design the main administrator prints.
function StudentCardPreview({ template, student, institution, photoSrc = "", compact = false }) {
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);
  const widthMm = Math.min(200, Math.max(40, Number(template?.widthMm) || DEFAULT_STUDENT_CARD_TEMPLATE.widthMm));
  const heightMm = Math.min(200, Math.max(40, Number(template?.heightMm) || DEFAULT_STUDENT_CARD_TEMPLATE.heightMm));

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const update = () => {
      const styles = window.getComputedStyle ? window.getComputedStyle(stage) : null;
      const padding = (side) => (styles ? parseFloat(styles.getPropertyValue(`padding-${side}`)) || 0 : 0);
      const availableWidth = Math.max(0, stage.clientWidth - padding("left") - padding("right"));
      const availableHeight = Math.max(0, stage.clientHeight - padding("top") - padding("bottom"));
      const rawWidth = widthMm * CSS_PX_PER_MM;
      const rawHeight = heightMm * CSS_PX_PER_MM;
      const next = availableWidth > 0 && availableHeight > 0 ? Math.min(1, availableWidth / rawWidth, availableHeight / rawHeight) : 1;
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [widthMm, heightMm]);

  const safeTemplate = template || DEFAULT_STUDENT_CARD_TEMPLATE;
  const fields = Array.isArray(safeTemplate.fields) && safeTemplate.fields.length ? safeTemplate.fields : DEFAULT_STUDENT_CARD_TEMPLATE.fields;
  return <div className={`student-card-stage${compact ? " compact" : ""}`} ref={stageRef}>
    <div className="student-card-preview-shell" style={{ width: `${Math.max(1, widthMm * CSS_PX_PER_MM * scale)}px`, height: `${Math.max(1, heightMm * CSS_PX_PER_MM * scale)}px` }}>
      <div
        className={`student-card-preview ${safeTemplate.showPhoto ? "with-photo" : "without-photo"}`}
        style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, transform: `scale(${scale})`, background: safeTemplate.background || "#fff", color: safeTemplate.textColor || "#17211f", borderColor: safeTemplate.accent || "#0f766e", ...studentCardPreviewVars(widthMm, heightMm) }}
      >
        <div className="student-card-accent-preview" style={{ background: safeTemplate.accent || "#0f766e" }} />
        {safeTemplate.showPhoto && <div className="student-card-preview-photo"><div className="student-card-preview-photo-frame">{photoSrc ? <img src={photoSrc} crossOrigin="use-credentials" alt={`${student.name || "Learner"} on student card`} /> : <span>Photo</span>}</div></div>}
        <div className="student-card-preview-main">
          <p className="student-card-title">{safeTemplate.title || "Student Card"}</p>
          <p className="student-card-subtitle">{safeTemplate.subtitle || ""}</p>
          <div className="student-card-preview-fields">{fields.map((field) => {
            const label = STUDENT_CARD_FIELDS.find(([key]) => key === field)?.[1] || field;
            return <div className="student-card-preview-field" key={field}><span>{label}</span><b>{studentCardFieldValue(student, field)}</b></div>;
          })}</div>
        </div>
        <div className="student-card-preview-footer">{institution}</div>
      </div>
    </div>
  </div>;
}

const STUDENT_CARD_TEMPLATE_KEYS = ["name", "title", "subtitle", "widthMm", "heightMm", "background", "accent", "textColor", "showPhoto", "fields"];
const studentCardTemplateSignature = (template) => JSON.stringify(STUDENT_CARD_TEMPLATE_KEYS.map((key) => key === "widthMm" || key === "heightMm" ? Number(template?.[key]) : key === "showPhoto" ? Boolean(template?.[key]) : template?.[key] ?? ""));

function StudentCards({ institution, notify }) {
  const [templates, setTemplates] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [photoFilter, setPhotoFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [editing, setEditing] = useState({ ...DEFAULT_STUDENT_CARD_TEMPLATE });
  const [savedSignature, setSavedSignature] = useState(() => studentCardTemplateSignature(DEFAULT_STUDENT_CARD_TEMPLATE));
  const [printTemplateId, setPrintTemplateId] = useState("");
  const [previewStudentId, setPreviewStudentId] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busyStudentId, setBusyStudentId] = useState("");
  // Inline form instead of window.prompt(), which some browsers and embedded webviews block.
  const [rejecting, setRejecting] = useState(null);

  const isDirty = studentCardTemplateSignature(editing) !== savedSignature;
  const confirmDiscard = () => !isDirty || window.confirm("You have unsaved changes to this template. Discard them?");
  const loadIntoEditor = (template) => {
    setEditing({ ...template, fields: [...(template.fields || [])] });
    setSavedSignature(studentCardTemplateSignature(template));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const operationId = portalBusyStart("Loading student-card templates and learner photos…");
    try {
      const [templateRows, studentRows] = await Promise.all([
        apiRequest("/admin/student-cards/templates"),
        apiRequest("/admin/student-cards/students"),
      ]);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
      setStudents(Array.isArray(studentRows) ? studentRows : []);
    } catch (requestError) {
      setError(requestError.message || "Could not load student-card data.");
    } finally {
      setLoading(false);
      portalBusyEnd(operationId);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Printing uses an explicitly chosen template. It defaults to the approved (default) design rather
  // than whatever happens to be open in the editor, which previously decided the printed layout.
  const defaultTemplate = templates.find((item) => item.isDefault) || templates[0] || null;
  const printTemplate = templates.find((item) => String(item.id) === String(printTemplateId)) || defaultTemplate;

  const setField = (field, value) => setEditing((current) => ({ ...current, [field]: value }));
  const toggleCardField = (field) => setEditing((current) => ({ ...current, fields: current.fields.includes(field) ? current.fields.filter((item) => item !== field) : [...current.fields, field] }));

  const saveTemplate = async (event) => {
    event.preventDefault();
    setError("");
    const payload = {
      name: String(editing.name || "").trim(), title: String(editing.title || "").trim(), subtitle: String(editing.subtitle || "").trim(),
      widthMm: Number(editing.widthMm), heightMm: Number(editing.heightMm), background: editing.background, accent: editing.accent, textColor: editing.textColor,
      showPhoto: Boolean(editing.showPhoto), fields: STUDENT_CARD_FIELDS.map(([key]) => key).filter((key) => editing.fields?.includes(key)),
    };
    if (!payload.name || !payload.title) { setError("Template name and card title are required."); return; }
    if (!payload.fields.length) { setError("Choose at least one learner field to display."); return; }
    if (![payload.widthMm, payload.heightMm].every((value) => Number.isFinite(value) && value >= 40 && value <= 200)) { setError("Card width and height must be between 40 mm and 200 mm."); return; }
    if (templates.some((item) => item.id !== editing.id && String(item.name).toLowerCase() === payload.name.toLowerCase())) { setError(`A template called “${payload.name}” already exists. Choose another name.`); return; }
    setSaving(true);
    const operationId = portalBusyStart("Saving student-card template…");
    try {
      const response = editing.id
        ? await apiRequest(`/admin/student-cards/templates/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await apiRequest("/admin/student-cards/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const saved = response.template || response;
      setTemplates((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      loadIntoEditor(saved);
      notify(editing.id ? "Student-card template changes saved." : "Student-card template created.");
    } catch (requestError) {
      setError(requestError.message || "Could not save the student-card template.");
    } finally {
      setSaving(false);
      portalBusyEnd(operationId);
    }
  };

  const newTemplate = () => {
    if (!confirmDiscard()) return;
    loadIntoEditor({ ...DEFAULT_STUDENT_CARD_TEMPLATE });
  };
  const editTemplate = (template) => {
    if (template.id === editing.id || !confirmDiscard()) return;
    loadIntoEditor(template);
  };
  const duplicateTemplate = (template) => {
    if (!confirmDiscard()) return;
    const names = new Set(templates.map((item) => String(item.name).toLowerCase()));
    let name = `${template.name} (copy)`;
    for (let index = 2; names.has(name.toLowerCase()); index += 1) name = `${template.name} (copy ${index})`;
    const { id, isDefault, createdAt, updatedAt, createdBy, ...design } = template;
    setEditing({ ...design, fields: [...(template.fields || [])], name });
    setSavedSignature("");
    notify(`Copied “${template.name}”. Adjust it, then select Create template to save the copy.`);
  };
  const cancelEdits = () => {
    const original = templates.find((item) => item.id === editing.id);
    loadIntoEditor(original || { ...DEFAULT_STUDENT_CARD_TEMPLATE });
  };

  const deleteTemplate = async (template) => {
    if (!window.confirm(`Delete the student-card template “${template.name}”?${template.isDefault ? " It is the default design, so another template will become the default." : ""}`)) return;
    const operationId = portalBusyStart("Deleting student-card template…");
    try {
      await apiRequest(`/admin/student-cards/templates/${template.id}`, { method: "DELETE" });
      if (editing.id === template.id) loadIntoEditor({ ...DEFAULT_STUDENT_CARD_TEMPLATE });
      if (String(printTemplateId) === String(template.id)) setPrintTemplateId("");
      // Reload so a promoted default template is reflected.
      const rows = await apiRequest("/admin/student-cards/templates");
      setTemplates(Array.isArray(rows) ? rows : []);
      notify("Student-card template deleted.");
    } catch (requestError) {
      setError(requestError.message || "Could not delete the student-card template.");
    } finally { portalBusyEnd(operationId); }
  };

  const makeDefault = async (template) => {
    const operationId = portalBusyStart("Setting the default student-card template…");
    try {
      const response = await apiRequest(`/admin/student-cards/templates/${template.id}/default`, { method: "POST" });
      setTemplates(Array.isArray(response.templates) ? response.templates : templates);
      setPrintTemplateId("");
      notify(`“${template.name}” is now the default card. Learners see this design on their profile.`);
    } catch (requestError) {
      setError(requestError.message || "Could not set the default template.");
    } finally { portalBusyEnd(operationId); }
  };

  const downloadReusableTemplate = (template, format = "html") => {
    // Reusable design exports must never contain a real learner's personal information.
    const sample = { name: "Example Student", studentId: "STU-000", course: "Example Course", yearLevel: 1, academicYear: new Date().getFullYear() };
    const fileBase = String(template.name || "student-card").replace(/[^a-z0-9_-]+/gi, "-");
    if (format === "json") {
      const { id, isDefault, createdAt, updatedAt, createdBy, ...design } = template;
      downloadText(JSON.stringify(design, null, 2), `${fileBase}.json`, "application/json");
      notify("Student-card design JSON downloaded.");
      return;
    }
    downloadText(buildStudentCardHtml(sample, template, institution), `${fileBase}.html`, "text/html");
    notify("Reusable student-card HTML template downloaded.");
  };

  const photoAsDataUrl = async (photoUrl) => {
    if (!photoUrl) return "";
    const response = await fetch(`${API_BASE}${photoUrl}`, { credentials: "include" });
    if (!response.ok) throw new Error(`Photo download failed with HTTP ${response.status}.`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const printCards = async (learners) => {
    setError("");
    if (!printTemplate) { setError("Create a student-card template before printing."); return; }
    if (!learners.length) { setError("Select at least one learner to print."); return; }
    // Open the window synchronously, inside the click, so pop-up blockers allow it.
    const printWindow = window.open("", "_blank", "width=820,height=640");
    if (!printWindow) { setError("Please allow pop-ups for student-card printing."); return; }
    printWindow.document.write("<p style=\"font-family:Arial,sans-serif;padding:24px\">Preparing student cards…</p>");
    const operationId = portalBusyStart(learners.length === 1 ? `Preparing ${learners[0].name}'s student card…` : `Preparing ${learners.length} student cards…`);
    try {
      let failedPhotos = 0;
      const entries = await Promise.all(learners.map(async (student) => {
        if (!printTemplate.showPhoto || !student.photoUrl) return { student, photoDataUrl: "" };
        try { return { student, photoDataUrl: await photoAsDataUrl(student.photoUrl) }; } catch (_) { failedPhotos += 1; return { student, photoDataUrl: "" }; }
      }));
      const heading = learners.length === 1 ? `${learners[0].name} · ${printTemplate.name}` : `${learners.length} student cards · ${printTemplate.name}`;
      printWindow.document.open();
      printWindow.document.write(buildStudentCardsHtml(entries, printTemplate, institution, heading));
      printWindow.document.close();
      const missing = printTemplate.showPhoto ? learners.filter((student) => !student.photoUrl).length : 0;
      notify(`${learners.length === 1 ? `Student card prepared for ${learners[0].name}` : `${learners.length} student cards prepared`} using “${printTemplate.name}”.${missing ? ` ${missing} without a photo show a placeholder.` : ""}${failedPhotos ? ` ${failedPhotos} photo(s) could not be loaded.` : ""}`);
    } catch (requestError) {
      printWindow.close();
      setError(requestError.message || "Could not prepare the student cards.");
    } finally { portalBusyEnd(operationId); }
  };

  const rejectPhoto = async (event) => {
    event.preventDefault();
    if (!rejecting) return;
    const student = rejecting.student;
    const reason = rejecting.reason.trim();
    setBusyStudentId(student.studentId);
    const operationId = portalBusyStart(`Removing ${student.name}'s photo…`);
    try {
      const updated = await apiRequest(`/admin/student-cards/students/${encodeURIComponent(student.studentId)}/photo`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      setStudents((current) => current.map((item) => item.studentId === student.studentId ? { ...item, ...updated } : item));
      setRejecting(null);
      notify(`${student.name}'s photo was removed and they were notified to upload a new one.`);
    } catch (requestError) {
      setError(requestError.message || "Could not remove the learner's photo.");
    } finally {
      setBusyStudentId("");
      portalBusyEnd(operationId);
    }
  };

  const courseOptions = useMemo(() => [...new Set(students.map((student) => student.course).filter(Boolean))].sort(), [students]);
  const filteredStudents = students.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    if (query && !`${student.name} ${student.studentId} ${student.course}`.toLowerCase().includes(query)) return false;
    if (courseFilter && student.course !== courseFilter) return false;
    if (photoFilter === "uploaded" && !student.photoUrl) return false;
    if (photoFilter === "missing" && student.photoUrl) return false;
    return true;
  });
  const photoCount = students.filter((student) => student.photoUrl).length;
  const selectedVisible = filteredStudents.filter((student) => selectedIds.has(student.studentId));
  const allVisibleSelected = filteredStudents.length > 0 && selectedVisible.length === filteredStudents.length;
  const toggleSelected = (studentId) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds((current) => {
    const next = new Set(current);
    filteredStudents.forEach((student) => { if (allVisibleSelected) next.delete(student.studentId); else next.add(student.studentId); });
    return next;
  });
  const downloadMissingPhotoList = () => {
    const missing = students.filter((student) => !student.photoUrl);
    if (!missing.length) { notify("Every learner has uploaded a photo."); return; }
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [["Student ID", "Name", "Username", "Course", "Year"].map(quote).join(","), ...missing.map((student) => [student.studentId, student.name, student.username, student.course, student.yearLevel || ""].map(quote).join(","))].join("\r\n");
    downloadText(csv, "student-card-photos-missing.csv", "text/csv");
    notify(`${missing.length} learner(s) still need a photo. CSV downloaded.`);
  };

  const previewStudent = students.find((student) => student.studentId === previewStudentId) || filteredStudents[0] || students[0] || { name: "Example Student", studentId: "STU-001", course: "Computer Science", yearLevel: 1, academicYear: new Date().getFullYear() };
  const formatPhotoDate = (value) => {
    if (!value) return "";
    const date = new Date(String(value).includes("T") ? value : `${String(value).replace(" ", "T")}Z`);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  };

  return <section className="student-cards-page">
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Main administrator</p><h2>Student card templates</h2><p className="muted">Design the approved learner card, preview it with any learner, choose the default design, and print one card or a whole class at once.</p></div><button type="button" className="secondary" onClick={newTemplate}>New template</button></div>
      <div className="student-card-stats" aria-label="Student card summary">
        <div><span>Learners</span><strong>{students.length}</strong></div>
        <div><span>Photos uploaded</span><strong>{photoCount}</strong></div>
        <div><span>Photos missing</span><strong>{students.length - photoCount}</strong></div>
        <div><span>Default design</span><strong>{defaultTemplate ? defaultTemplate.name : "None yet"}</strong></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="student-card-editor-layout">
        <form className="student-card-editor" onSubmit={saveTemplate}>
          <p className="student-card-editing-status">{editing.id ? <>Editing <strong>{editing.name || "template"}</strong>{editing.isDefault && <span className="status-pill">Default</span>}</> : <>New template</>}{isDirty && <span className="student-card-dirty">Unsaved changes</span>}</p>
          <div className="student-card-editor-grid">
            <label>Template name<input value={editing.name || ""} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. 2026 Standard ID" maxLength={120} required /></label>
            <label>Card title<input value={editing.title || ""} onChange={(e) => setField("title", e.target.value)} placeholder="Student Card" maxLength={80} required /></label>
            <label className="student-card-field-wide">Subtitle<input value={editing.subtitle || ""} onChange={(e) => setField("subtitle", e.target.value)} placeholder="Learner identification" /></label>
            <label>Width (mm)<input type="number" min="40" max="200" step="0.1" value={editing.widthMm ?? 85.6} onChange={(e) => setField("widthMm", e.target.value)} /></label>
            <label>Height (mm)<input type="number" min="40" max="200" step="0.1" value={editing.heightMm ?? 54} onChange={(e) => setField("heightMm", e.target.value)} /></label>
          </div>
          <div className="student-card-size-presets" role="group" aria-label="Card size presets">
            <span>Size presets</span>
            <button type="button" className="secondary" onClick={() => setEditing((current) => ({ ...current, widthMm: 85.6, heightMm: 54 }))}>ID card (85.6 × 54)</button>
            <button type="button" className="secondary" onClick={() => setEditing((current) => ({ ...current, widthMm: 54, heightMm: 85.6 }))}>Portrait (54 × 85.6)</button>
            <button type="button" className="secondary" onClick={() => setEditing((current) => ({ ...current, widthMm: 100, heightMm: 70 }))}>Large badge (100 × 70)</button>
          </div>
          <div className="student-card-colour-grid"><label>Background<input type="color" value={editing.background || "#ffffff"} onChange={(e) => setField("background", e.target.value)} /></label><label>Accent<input type="color" value={editing.accent || "#0f766e"} onChange={(e) => setField("accent", e.target.value)} /></label><label>Text<input type="color" value={editing.textColor || "#17211f"} onChange={(e) => setField("textColor", e.target.value)} /></label></div>
          <label className="checkbox-line"><input type="checkbox" checked={Boolean(editing.showPhoto)} onChange={(e) => setField("showPhoto", e.target.checked)} />Show learner photo</label>
          <div className="student-card-field-picker"><strong>Information displayed on the card</strong><div className="student-card-field-options">{STUDENT_CARD_FIELDS.map(([key, label]) => <label key={key} className="checkbox-line"><input type="checkbox" checked={Boolean(editing.fields?.includes(key))} onChange={() => toggleCardField(key)} />{label}</label>)}</div></div>
          <div className="actions">
            <button className="primary" type="submit" disabled={saving || (editing.id && !isDirty)}>{saving ? "Saving template…" : editing.id ? "Save changes" : "Create template"}</button>
            {isDirty && <button className="secondary" type="button" onClick={cancelEdits}>{editing.id ? "Undo changes" : "Reset"}</button>}
            {editing.id && !editing.isDefault && <button className="secondary" type="button" disabled={isDirty} title={isDirty ? "Save your changes first" : undefined} onClick={() => makeDefault(editing)}>Set as default</button>}
            {editing.id && <button className="text-button danger" type="button" onClick={() => deleteTemplate(editing)}>Delete</button>}
          </div>
          <p className="muted small-print">The default design is used for printing and is what learners see on their profile.</p>
        </form>
        <div className="student-card-live-preview">
          <div className="preview-heading"><strong>Live preview</strong>
            <label className="student-card-preview-picker">Learner<select value={previewStudent.studentId && students.some((student) => student.studentId === previewStudent.studentId) ? previewStudent.studentId : ""} onChange={(e) => setPreviewStudentId(e.target.value)} disabled={!students.length}>{!students.length && <option value="">Example Student</option>}{students.map((student) => <option key={student.studentId} value={student.studentId}>{student.name} ({student.studentId}){student.photoUrl ? "" : " · no photo"}</option>)}</select></label>
          </div>
          <StudentCardPreview template={editing} student={previewStudent} institution={institution} photoSrc={previewStudent.photoUrl ? `${API_BASE}${previewStudent.photoUrl}` : ""} />
          <p className="muted small-print">Shows unsaved edits. Pick any learner to check how long names, courses and their photo fit.</p>
        </div>
      </div>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Saved designs</p><h3>Approved templates</h3></div><span className="count">{templates.length}</span></div>
      {loading ? <p className="muted">Loading templates…</p> : templates.length ? <div className="student-card-template-list">{templates.map((template) => <article className={`student-card-template-row${template.id === editing.id ? " is-editing" : ""}`} key={template.id}>
        <span className="student-card-swatch" aria-hidden="true" style={{ background: template.background, borderColor: template.accent, boxShadow: `inset 0 6px 0 ${template.accent}` }} />
        <div className="student-card-template-info"><strong>{template.name}{template.isDefault && <span className="status-pill">Default</span>}{template.id === editing.id && <span className="status-pill subtle">Editing</span>}</strong><small>{template.widthMm} × {template.heightMm} mm · {template.showPhoto ? "Photo enabled" : "No photo"} · {template.fields?.length || 0} fields</small></div>
        <div className="actions">
          <button type="button" className="secondary" disabled={template.id === editing.id} onClick={() => editTemplate(template)}>Edit</button>
          <button type="button" className="secondary" onClick={() => duplicateTemplate(template)}>Duplicate</button>
          {!template.isDefault && <button type="button" className="secondary" onClick={() => makeDefault(template)}>Set default</button>}
          <button type="button" className="secondary" onClick={() => downloadReusableTemplate(template, "html")}>HTML</button>
          <button type="button" className="secondary" onClick={() => downloadReusableTemplate(template, "json")}>JSON</button>
          <button type="button" className="text-button danger" onClick={() => deleteTemplate(template)}>Delete</button>
        </div>
      </article>)}</div> : <p className="muted">No card templates saved yet. Create the first approved design above. It automatically becomes the default.</p>}
      <p className="muted small-print">HTML is useful for an offline redesign/print workflow. The JSON file stores only the design settings, with no learner data or passwords.</p>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Learner cards</p><h3>Print student cards</h3></div><span className="count">{filteredStudents.length} of {students.length}</span></div>
      <div className="filter-bar student-card-filter-bar">
        <input className="search-input" type="search" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search learner name, ID or course…" aria-label="Search learners" />
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter by course"><option value="">All courses</option>{courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}</select>
        <select value={photoFilter} onChange={(e) => setPhotoFilter(e.target.value)} aria-label="Filter by photo status"><option value="all">All photo states</option><option value="uploaded">Photo uploaded</option><option value="missing">Photo missing</option></select>
        <button type="button" className="secondary" onClick={refresh}>Refresh</button>
      </div>
      <div className="student-card-print-bar">
        <label>Print using<select value={printTemplate ? String(printTemplate.id) : ""} onChange={(e) => setPrintTemplateId(e.target.value)} disabled={!templates.length}>{!templates.length && <option value="">No templates yet</option>}{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " (default)" : ""}</option>)}</select></label>
        <button type="button" className="primary" disabled={!selectedVisible.length || !printTemplate} onClick={() => printCards(selectedVisible)}>Print selected ({selectedVisible.length})</button>
        <button type="button" className="secondary" disabled={!filteredStudents.length || !printTemplate} onClick={() => printCards(filteredStudents)}>Print all shown ({filteredStudents.length})</button>
        <button type="button" className="secondary" onClick={downloadMissingPhotoList}>Missing-photo list (CSV)</button>
      </div>
      {rejecting && <form className="student-card-reject-form" onSubmit={rejectPhoto} aria-label={`Reject ${rejecting.student.name}'s photo`}>
        <p><strong>Reject {rejecting.student.name}'s photo?</strong> The photo is deleted and the learner is notified to upload a new one.</p>
        <label>Reason shown to the learner (optional)<input type="text" maxLength={300} autoFocus value={rejecting.reason} placeholder="e.g. Face not clearly visible" onChange={(e) => setRejecting((current) => current && { ...current, reason: e.target.value })} /></label>
        <div className="form-actions">
          <button type="submit" className="danger-button" disabled={busyStudentId === rejecting.student.studentId}>Remove photo and notify</button>
          <button type="button" className="secondary" onClick={() => setRejecting(null)}>Cancel</button>
        </div>
      </form>}
      {loading ? <p className="muted">Loading learner photos…</p> : <div className="table-scroll"><table className="data-table ruled-table student-card-student-table"><thead><tr><th><input type="checkbox" aria-label="Select all shown learners" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!filteredStudents.length} /></th><th>Photo</th><th>Student</th><th>Course</th><th>Year</th><th>Photo status</th><th>Actions</th></tr></thead><tbody>{filteredStudents.length ? filteredStudents.map((student) => <tr key={student.studentId} className={student.studentId === previewStudent.studentId ? "is-previewing" : undefined}>
        <td><input type="checkbox" aria-label={`Select ${student.name}`} checked={selectedIds.has(student.studentId)} onChange={() => toggleSelected(student.studentId)} /></td>
        <td>{student.photoUrl ? <img className="student-card-thumb" src={`${API_BASE}${student.photoUrl}`} crossOrigin="use-credentials" alt={student.name} /> : <span className="student-card-thumb placeholder" aria-hidden="true">—</span>}</td>
        <td className="student-card-learner-cell"><strong>{student.name}</strong><small>{student.studentId}</small></td>
        <td>{student.course || "—"}</td>
        <td>{student.yearLevel ? `Year ${student.yearLevel}` : "—"}</td>
        <td>{student.photoUrl ? <span className="status-pill ok">Uploaded{formatPhotoDate(student.photoUpdatedAt) ? ` ${formatPhotoDate(student.photoUpdatedAt)}` : ""}</span> : <span className="status-pill warn">Photo required</span>}</td>
        <td className="table-actions">
          <button type="button" className="secondary" onClick={() => setPreviewStudentId(student.studentId)}>Preview</button>
          <button type="button" className="secondary" disabled={!printTemplate} onClick={() => printCards([student])}>Print card</button>
          {student.photoUrl && <button type="button" className="text-button danger" disabled={busyStudentId === student.studentId} onClick={() => setRejecting({ student, reason: "" })}>Reject photo</button>}
        </td>
      </tr>) : <tr><td colSpan={7} className="muted">No learners match the filters.</td></tr>}</tbody></table></div>}
    </section>
  </section>;
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
