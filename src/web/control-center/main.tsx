import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";

// The Control Center, deliberately plain for now: sign up, sign in, and see your chart.

interface Me {
  grownUp: { email: string; role: string };
  chart: { name: string; timeZone: string };
}

async function api(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? undefined : await response.json();
  return { ok: response.ok, data };
}

function ControlCenter() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const refresh = async () => {
    const result = await api("GET", "/api/me");
    setMe(result.ok ? result.data : null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (me === undefined) return <p>Loading…</p>;
  if (me === null) return <SignedOut onSignedIn={refresh} />;
  return (
    <main>
      <h1>{me.chart.name}</h1>
      <p>
        Signed in as {me.grownUp.email} ({me.grownUp.role}). Time zone: {me.chart.timeZone}.
      </p>
      <button onClick={async () => (await api("POST", "/api/sign-out"), refresh())}>Sign out</button>
    </main>
  );
}

function SignedOut({ onSignedIn }: { onSignedIn: () => void }) {
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
    <main>
      <h1>Star Chart</h1>
      <form onSubmit={submit}>
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
        <button type="submit">{mode === "sign-in" ? "Sign in" : "Create chart"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => (setError(undefined), setMode(mode === "sign-in" ? "sign-up" : "sign-in"))}>
        {mode === "sign-in" ? "New here? Create a chart" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ControlCenter />
  </StrictMode>,
);
