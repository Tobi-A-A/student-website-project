import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("shows the local login and allows a student to sign in", async () => {
  render(<App />);
  expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Username"), "student");
  await userEvent.type(screen.getByLabelText("Password"), "Student123!");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("Good morning, Sam.")).toBeInTheDocument();
});
