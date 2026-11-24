import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, stored } from "../shared/api.js";
import { useLiveConnection } from "../shared/live.js";
import type { StarHistory } from "../shared/star-history.js";
import { ArtStyles, NightSky } from "./art/components.js";
import { ChildScreen, CouldNotPrint, Printing, Scanned, WhoAreYou, type Child, type Menu, type MenuChoice, type ScanOutcome } from "./dome/screens.js";
import { domeCss } from "./dome/styles.js";
import { useIdle } from "./dome/use-idle.js";
import { Stage } from "./stage.js";

// The observatory screen children use: design A, "The Dome" (see .scratch/observatory-design/verdict.md). This file
// talks to the server; the screens in dome/ only draw.

const tokenKey = "star-chart.observatory.deviceToken";

/** After this long with no taps, a child's screen (or the grown-up unlock) goes back to Who are you. */
const idleMs = 60_000;
/** How long a printed ticket, or a message about one, stays up before going back to Who are you. */
const messageMs = 4_000;

function Observatory() {
  const [deviceToken, setDeviceToken] = useState(stored.get(tokenKey));

  const onPaired = (token: string | undefined) => {
    stored.set(tokenKey, token);
    setDeviceToken(token);
  };

  if (!deviceToken) return <Unpaired onPaired={onPaired} />;
  return <ChildrensView deviceToken={deviceToken} onUnpaired={() => onPaired(undefined)} />;
}

/** A fresh observatory: the chart's owner signs in (or creates a chart) to pair it. */
function Unpaired({ onPaired }: { onPaired: (token: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const signedIn = await api("POST", creating ? "/api/sign-up" : "/api/sign-in", form);
    if (!signedIn.ok) return setError(signedIn.data?.error ?? "Couldn't sign in.");
    const paired = await api("POST", "/api/observatories");
    if (!paired.ok) {
      await api("POST", "/api/sign-out");
      return setError(paired.data?.error ?? "Couldn't pair this observatory.");
    }
    onPaired(paired.data.deviceToken);
  };

  return (
    <main className="plain">
      <h1>Set up this observatory</h1>
      <p>A grown-up signs in to connect this observatory to their chart.</p>
      <form onSubmit={submit}>
        <label>
          Email <input name="email" type="email" required />
        </label>
        <label>
          Password <input name="password" type="password" required />
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
        <button type="submit">{creating ? "Create chart and set up" : "Sign in and set up"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => setCreating(!creating)}>
        {creating ? "I already have a chart" : "New here? Create a chart"}
      </button>
    </main>
  );
}

type Showing =
  | { screen: "who" }
  | { screen: "unlock" }
  | { screen: "child"; child: Child }
  | { screen: "printing"; child: Child; choice: MenuChoice }
  | { screen: "could-not-print"; child: Child; message: string; lostKind?: "chore" | "quiz" };

function ChildrensView({ deviceToken, onUnpaired }: { deviceToken: string; onUnpaired: () => void }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [showing, setShowing] = useState<Showing>({ screen: "who" });
  const [scanned, setScanned] = useState<ScanOutcome | undefined>();
  const [parts, setParts] = useState<{ printer: string; scanner: string } | undefined>();
  const backToStart = () => setShowing({ screen: "who" });

  useIdle(showing.screen !== "who", idleMs, backToStart);

  useEffect(() => {
    const check = async () => {
      const result = await api("GET", "/api/observatory/parts", undefined, deviceToken);
      if (result.ok) setParts(result.data);
    };
    void check();
    const every = setInterval(check, 10_000);
    return () => clearInterval(every);
  }, [deviceToken]);

  // The screen listens on its own live connection for what happened when a ticket is scanned here.
  useLiveConnection(
    deviceToken,
    (message) => {
      if (message.type === "scan-result") setScanned(message);
    },
    onUnpaired,
  );

  useEffect(() => {
    if (!scanned) return;
    const timer = setTimeout(() => setScanned(undefined), messageMs);
    return () => clearTimeout(timer);
  }, [scanned]);

  useEffect(() => {
    void (async () => {
      const result = await api("GET", "/api/observatory/children", undefined, deviceToken);
      if (result.status === 401) return onUnpaired();
      if (result.ok) setChildren(result.data.children);
    })();
  }, [deviceToken]);

  // Printed tickets and messages about them go back to Who are you after a moment, ready for the next child.
  useEffect(() => {
    if (showing.screen !== "printing" && !(showing.screen === "could-not-print" && !showing.lostKind)) return;
    const timer = setTimeout(backToStart, messageMs);
    return () => clearTimeout(timer);
  }, [showing]);

  const print = async (child: Child, choice: MenuChoice) => {
    const result = await api("POST", `/api/observatory/children/${child.id}/tickets`, { kind: choice.kind, taskId: choice.id }, deviceToken);
    if (result.ok) return setShowing({ screen: "printing", child, choice });
    const message = result.data?.error ?? "That didn't work. Ask a grown-up.";
    // Already holding a ticket of this kind? Offer to ask a grown-up for a new copy, in case it's lost.
    const lostKind = result.status === 409 && /already have/i.test(message) ? choice.kind : undefined;
    setShowing({ screen: "could-not-print", child, message, lostKind });
  };

  const askForReprint = async (child: Child, kind: "chore" | "quiz") => {
    const result = await api("POST", `/api/observatory/children/${child.id}/reprint-requests`, { kind }, deviceToken);
    setShowing({
      screen: "could-not-print",
      child,
      message: result.ok ? "OK! A grown-up will check, then print it again." : (result.data?.error ?? "Ask a grown-up."),
    });
  };

  const napping = [parts?.printer === "offline" && "printer", parts?.scanner === "offline" && "scanner"].filter(Boolean);

  return (
    <>
      <NightSky />
      {napping.length > 0 && (
        <p className="dome-banner" role="alert">
          The {napping.join(" and ")} {napping.length > 1 ? "are" : "is"} napping. Ask a grown-up!
        </p>
      )}
      {showing.screen === "who" && (
        <WhoAreYou children={children} onChoose={(child) => setShowing({ screen: "child", child })} onGrownUps={() => setShowing({ screen: "unlock" })} />
      )}
      {showing.screen === "unlock" && <Unlock deviceToken={deviceToken} onCancel={backToStart} />}
      {showing.screen === "child" && (
        <ChildView key={showing.child.id} child={showing.child} deviceToken={deviceToken} onPrint={(choice) => print(showing.child, choice)} onLeave={backToStart} />
      )}
      {showing.screen === "printing" && <Printing child={showing.child} choice={showing.choice} />}
      {showing.screen === "could-not-print" && (
        <CouldNotPrint
          message={showing.message}
          lost={Boolean(showing.lostKind)}
          onLost={() => showing.lostKind && askForReprint(showing.child, showing.lostKind)}
          onStillHaveIt={backToStart}
        />
      )}
      {scanned && <Scanned outcome={scanned} onClose={() => setScanned(undefined)} />}
    </>
  );
}

/** Loads a child's balance, lifetime stars and menu, then shows their dome. */
function ChildView({ child, deviceToken, onPrint, onLeave }: { child: Child; deviceToken: string; onPrint: (choice: MenuChoice) => void; onLeave: () => void }) {
  const [totals, setTotals] = useState<{ balance: number; earned: number } | undefined>();
  const [menu, setMenu] = useState<Menu | undefined>();
  const [history, setHistory] = useState<StarHistory | undefined>();

  useEffect(() => {
    void (async () => {
      const [view, choices] = await Promise.all([
        api("GET", `/api/observatory/children/${child.id}`, undefined, deviceToken),
        api("GET", `/api/observatory/children/${child.id}/menu`, undefined, deviceToken),
      ]);
      if (view.ok) setTotals({ balance: view.data.child.balance, earned: view.data.child.earned });
      if (choices.ok) setMenu(choices.data);
    })();
  }, [child.id]);

  const showHistory = async (show: boolean) => {
    if (!show) return setHistory(undefined);
    const result = await api("GET", `/api/observatory/children/${child.id}/star-history`, undefined, deviceToken);
    if (result.ok) setHistory(result.data);
  };

  return (
    <ChildScreen
      child={child}
      balance={totals?.balance}
      earned={totals?.earned}
      menu={menu}
      history={history}
      onPrint={onPrint}
      onShowHistory={showHistory}
      onLeave={onLeave}
    />
  );
}

/** The "Guest" button on the unlock screen, for someone with a Guest PIN. */
const guestChoice = { id: "guest", name: "guest" };

/** A grown-up taps themselves and enters their PIN to open the Control Center here. */
function Unlock({ deviceToken, onCancel }: { deviceToken: string; onCancel: () => void }) {
  const [grownUps, setGrownUps] = useState<{ id: string; name: string }[] | undefined>();
  const [chosen, setChosen] = useState<{ id: string; name: string } | undefined>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const result = await api("GET", "/api/observatory/grown-ups", undefined, deviceToken);
      if (result.ok) setGrownUps(result.data.grownUps);
    })();
  }, [deviceToken]);

  const submit = async () => {
    if (!chosen) return;
    const result =
      chosen.id === guestChoice.id
        ? await api("POST", "/api/observatory/unlock-guest", { pin }, deviceToken)
        : await api("POST", "/api/observatory/unlock", { grownUpId: chosen.id, pin }, deviceToken);
    if (result.ok) {
      location.href = "/?on=observatory";
      return;
    }
    setPin("");
    setError(result.data?.error ?? "That didn't work.");
  };

  if (!chosen) {
    return (
      <main className="plain">
        <h1>Which grown-up are you?</h1>
        {grownUps?.length === 0 && <p>No grown-up has set a PIN yet. Set one in the Control Center on your phone.</p>}
        {/* Guests (babysitters) have a Guest PIN instead. */}
        {grownUps?.map((grownUp) => (
          <button key={grownUp.id} onClick={() => setChosen(grownUp)}>
            {grownUp.name}
          </button>
        ))}
        <button onClick={() => setChosen(guestChoice)}>Guest</button>
        <footer>
          <button onClick={onCancel}>Back</button>
        </footer>
      </main>
    );
  }

  return (
    <main className="plain">
      <h1>Hi {chosen.name}, enter your PIN</h1>
      <p className="plain-pin" aria-live="polite">{"•".repeat(pin.length) || " "}</p>
      <div className="plain-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((digit) => (
          <button key={digit} onClick={() => pin.length < 8 && setPin(pin + digit)}>
            {digit}
          </button>
        ))}
        <button onClick={() => setPin(pin.slice(0, -1))}>⌫</button>
        <button onClick={submit} disabled={pin.length < 4}>
          OK
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer>
        <button onClick={onCancel}>Back</button>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Stage>
      <ArtStyles />
      <style>{domeCss}</style>
      <Observatory />
    </Stage>
  </StrictMode>,
);
