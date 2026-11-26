import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../shared/api.js";
import { manages, type GuestMe, type Me } from "../control-center/common.js";
import "../control-center/styles.css";

// The page a fresh observatory screen's QR code opens on a grown-up's phone (.scratch/easy-install/issues/01). The
// grown-up signs in (or creates a chart), checks the code matches the screen, and connects it. The code comes after
// the "#", so it never reaches the server's logs, and is taken out of the address bar straight away.

const codeFromLink = new URLSearchParams(location.hash.replace(/^#/, "")).get("c") ?? "";
history.replaceState(null, "", location.pathname);

/** The code as the screen shows it: two groups of four. */
const spacedCode = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

function ConnectScreen() {
  const [me, setMe] = useState<Me | GuestMe | null | undefined>();

  const loadMe = async () => {
    const result = await api("GET", "/api/me");
    setMe(result.ok ? result.data : null);
  };
  useEffect(() => {
    void loadMe();
  }, []);

  return (
    <main className="cc-main connect-screen">
      <h1>Connect a screen</h1>
      {me === undefined && <p className="hint">Loading…</p>}
      {me === null && <SignInOrSignUp onSignedIn={loadMe} />}
      {me && ("guest" in me || !manages(me)) && (
        <section>
          <p>Only the chart's owner or an admin can connect a screen. Ask one of them to scan the code on it.</p>
        </section>
      )}
      {me && !("guest" in me) && manages(me) && <Connect chartName={me.chart.name} />}
    </main>
  );
}

function SignInOrSignUp({ onSignedIn }: { onSignedIn: () => void }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await api("POST", creating ? "/api/sign-up" : "/api/sign-in", Object.fromEntries(new FormData(event.currentTarget)));
    if (result.ok) onSignedIn();
    else setError(result.data?.error ?? (creating ? "Couldn't create the chart." : "Couldn't sign in."));
  };

  return (
    <section>
      <h2>{creating ? "Create a chart" : "Sign in to carry on"}</h2>
      <form onSubmit={submit} className="stack">
        <label>
          Email <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password <input name="password" type="password" autoComplete={creating ? "new-password" : "current-password"} required />
        </label>
        {creating && (
          <>
            <label>
              Chart name <input name="chartName" required />
            </label>
            <label>
              Time zone <input name="timeZone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} required />
            </label>
          </>
        )}
        <button type="submit" className="primary">
          {creating ? "Create chart" : "Sign in"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button
          onClick={() => {
            setCreating(!creating);
            setError(undefined);
          }}
        >
          {creating ? "I already have a chart" : "New here? Create a chart"}
        </button>
      </div>
    </section>
  );
}

function Connect({ chartName }: { chartName: string }) {
  const [code, setCode] = useState(codeFromLink);
  const [typing, setTyping] = useState(codeFromLink === "");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    const result = await api("POST", "/api/screen-setups/approve", { code });
    if (result.ok) return setConnected(true);
    setError(result.data?.error ?? "Couldn't connect the screen. Try again.");
    setTyping(true);
    setCode("");
  };

  if (connected) {
    return (
      <section role="status">
        <h2>Connected</h2>
        <p>The screen will show {chartName} in a few seconds.</p>
        <div className="actions">
          <a className="button-link" href="/">
            Open the Control Center
          </a>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={connect} className="stack">
      <p>
        Connect a screen to <strong>{chartName}</strong>?
      </p>
      {typing ? (
        <label>
          Code on the screen{" "}
          <input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="characters" autoCorrect="off" autoComplete="off" required />
        </label>
      ) : (
        <>
          <p className="screen-code">{spacedCode(code)}</p>
          <p className="hint">Check the screen in front of you shows this code. If it doesn't, don't connect it.</p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="primary">
        Connect the screen
      </button>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConnectScreen />
  </StrictMode>,
);
