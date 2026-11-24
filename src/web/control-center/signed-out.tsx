// Signing in, creating a chart, and asking for a new password.
import { useState, type FormEvent } from "react";
import { api } from "../shared/api.js";

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        Forgot your password?
      </button>
    );
  if (sent) return <p role="status">If that email belongs to a Star Chart login, a link to choose a new password is on its way.</p>;

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { email } = Object.fromEntries(new FormData(event.currentTarget));
    await api("POST", "/api/password-reset", { email });
    setSent(true);
  };

  return (
    <form onSubmit={ask} className="stack">
      <label>
        Your email <input name="email" type="email" required />
      </label>
      <button type="submit">Send me a link</button>
    </form>
  );
}

export function SignedOut({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api("POST", mode === "sign-in" ? "/api/sign-in" : "/api/sign-up", form);
    if (result.ok) onSignedIn();
    else setError(result.data?.error ?? "Something went wrong.");
  };

  return (
    <main className="cc-signin">
      <h1>
        <span aria-hidden>★</span> Star Chart
      </h1>
      <form onSubmit={submit} className="stack">
        <label>
          Email <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password{" "}
          <input
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
          />
        </label>
        {mode === "sign-up" && (
          <>
            <label>
              Chart name <input name="chartName" required />
            </label>
            <label>
              Time zone{" "}
              <input name="timeZone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} required />
            </label>
          </>
        )}
        <button type="submit" className="primary">
          {mode === "sign-in" ? "Sign in" : "Create chart"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {mode === "sign-in" && <ForgotPassword />}
      <button className="link" onClick={() => (setError(undefined), setMode(mode === "sign-in" ? "sign-up" : "sign-in"))}>
        {mode === "sign-in" ? "New here? Create a chart" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}

