import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const student = {
  id: 1,
  name: "Sam Taylor",
  username: "student",
  role: "student",
  studentId: "STU-001",
  course: "Biology",
  yearLevel: 2,
};

const supportTeam = {
  advisor: { id: 7, name: "Dana Okafor", username: "dokafor", role: "admin", academicYear: 2025, source: "allocated" },
  courseStaff: [{ id: 8, name: "Lee Hart", username: "lhart", role: "admin", course: "Biology", yearLevel: 2, academicYear: 2025 }],
  administrators: [{ id: 9, name: "Robin Patel", username: "rpatel", role: "main-admin" }],
  course: "Biology",
  yearLevel: 2,
  academicYear: 2025,
};

const openAssignment = {
  id: 11, title: "Open Lab Report", subject: "Systems", course: "Biology", yearLevel: 2,
  academicYear: 2025, start: "2000-01-01T00:00", due: "2999-12-31", dueTime: "23:59",
  duration: 60, file: "brief.pdf", downloadUrl: "/api/assignments/11/download",
  completed: false, openOverride: false, active: true,
};

const closedAssignment = { ...openAssignment, id: 12, title: "Closed Lab Report", completed: true, downloadUrl: "/api/assignments/12/download" };

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = jest.fn(async (request) => {
    const { pathname } = new URL(request);
    if (pathname === "/api/setup/status") return response({ setupRequired: false });
    if (pathname === "/api/courses") return response({ courses: [] });
    if (pathname === "/api/accounts/me") return response({ error: "Not signed in." }, 401);
    if (pathname === "/api/accounts/sign-in") return response(student);
    if (pathname === "/api/calendar") return response([]);
    if (pathname.startsWith("/student/marks/local/")) return response([]);
    if (pathname === "/student/remediations") return response([]);
    if (pathname === "/student/test-attempts") return response([]);
    if (pathname === "/student/assignments") return response({ assignments: [], submissions: [] });
    if (pathname === "/api/accounts/support-team") return response(supportTeam);
    if (pathname === "/api/tests" || pathname === "/api/notifications") return response([]);
    return response({ error: `Unexpected test request: ${pathname}` }, 404);
  });
});

afterEach(() => {
  if (originalFetch) global.fetch = originalFetch;
  else delete global.fetch;
  localStorage.clear();
});

async function signInAsStudent() {
  render(<App />);
  expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Username"), "student");
  await userEvent.type(screen.getByLabelText("Password"), "Student123!");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

test("allows a student to sign in through the API", async () => {
  await signInAsStudent();
  expect(await screen.findByText("Good morning, Sam.")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/accounts/sign-in"),
    expect.objectContaining({ credentials: "include" })
  );
});

test("shows the student their allocated lecturer and administrators", async () => {
  await signInAsStudent();
  expect(await screen.findByText("Your academic support team")).toBeInTheDocument();
  expect(await screen.findByText("Dana Okafor")).toBeInTheDocument();
  expect(screen.getByText("Confirmed")).toBeInTheDocument();
});

test("hides the assignment brief download once the assignment is closed", async () => {
  global.fetch.mockImplementation(async (request) => {
    const { pathname } = new URL(request);
    if (pathname === "/api/setup/status") return response({ setupRequired: false });
    if (pathname === "/api/courses") return response({ courses: [] });
    if (pathname === "/api/accounts/me") return response({ error: "Not signed in." }, 401);
    if (pathname === "/api/accounts/sign-in") return response(student);
    if (pathname === "/api/calendar") return response([]);
    if (pathname === "/student/marks/local/STU-001") return response([]);
    if (pathname === "/student/remediations" || pathname === "/student/test-attempts") return response([]);
    if (pathname === "/student/assignments") return response({ assignments: [openAssignment, closedAssignment], submissions: [] });
    if (pathname === "/api/accounts/support-team") return response(supportTeam);
    if (pathname === "/api/tests" || pathname === "/api/notifications") return response([]);
    return response({ error: `Unexpected test request: ${pathname}` }, 404);
  });

  await signInAsStudent();
  expect(await screen.findByText("Good morning, Sam.")).toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "Assignments" }));

  // Assertions must be scoped to each assignment's own row, and .list-row has no accessible role.
  // eslint-disable-next-line testing-library/no-node-access
  const openRow = (await screen.findByText("Open Lab Report")).closest(".list-row");
  // eslint-disable-next-line testing-library/no-node-access
  const closedRow = (await screen.findByText("Closed Lab Report")).closest(".list-row");

  // The open assignment keeps its brief; the closed one must not expose a download control.
  expect(within(openRow).getByRole("button", { name: "Download assignment" })).toBeInTheDocument();
  expect(within(closedRow).queryByRole("button", { name: "Download assignment" })).not.toBeInTheDocument();
  expect(within(closedRow).getByText(/no longer available because this assignment is closed/i)).toBeInTheDocument();

  // Upload must be unavailable on the closed assignment too.
  expect(within(openRow).getByText("Upload ZIP")).toBeInTheDocument();
  expect(within(closedRow).queryByText("Upload ZIP")).not.toBeInTheDocument();
});

test("shows partial sync status when one student data request fails", async () => {  global.fetch.mockImplementation(async (request) => {
    const { pathname } = new URL(request);
    if (pathname === "/api/setup/status") return response({ setupRequired: false });
    if (pathname === "/api/courses") return response({ courses: [] });
    if (pathname === "/api/accounts/me") return response({ error: "Not signed in." }, 401);
    if (pathname === "/api/accounts/sign-in") return response(student);
    if (pathname === "/api/calendar") return response([]);
    if (pathname === "/student/marks/local/STU-001") return response([]);
    if (pathname === "/student/remediations" || pathname === "/student/test-attempts") return response([]);
    if (pathname === "/student/assignments") return response({ error: "Unavailable." }, 503);
    if (pathname === "/api/accounts/support-team") return response(supportTeam);
    if (pathname === "/api/tests" || pathname === "/api/notifications") return response([]);
    return response({ error: `Unexpected test request: ${pathname}` }, 404);
  });

  await signInAsStudent();
  expect(await screen.findByText("Good morning, Sam.")).toBeInTheDocument();
  expect(await screen.findByText("Partially synced")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/assignments/i);
});
