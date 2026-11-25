import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { stored } from "../shared/api.js";
import { useLiveConnection } from "../shared/live.js";
import { ask, forgetLastGood, isReachable, keepAsking, keepLoading, serverDown, useReachable } from "./connection.js";
import { useNightlyReload } from "./nightly-reload.js";
import type { StarHistory } from "../shared/star-history.js";
import { ArtStyles, NightSky } from "./art/components.js";
import {
  ChildScreen,
  CouldNotPrint,
  Printing,
  Scanned,
  WhoAreYou,
  arrivalMs,
  type Child,
  type Menu,
  type MenuChoice,
  outfitPictures,
  type ScanOutcome,
  type StoreItem,
} from "./dome/screens.js";
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
/** What a child sees if they try to print while the server can't be reached. */
const wakingUp = "The observatory is waking up. Try again in a minute!";

function Observatory() {
  const [deviceToken, setDeviceToken] = useState(stored.get(tokenKey));

  const onPaired = (token: string | undefined) => {
    if (!token) forgetLastGood();
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
    const signedIn = await ask("POST", creating ? "/api/sign-up" : "/api/sign-in", form, "");
    if (serverDown(signedIn.status)) return setError("Can't reach the server. Check the Wi-Fi and try again.");
    if (!signedIn.ok) return setError(signedIn.data?.error ?? "Couldn't sign in.");
    const paired = await ask("POST", "/api/observatories", undefined, "");
    if (!paired.ok) {
      await ask("POST", "/api/sign-out", undefined, "");
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
  const [store, setStore] = useState<StoreItem[] | undefined>();
  const [scanned, setScanned] = useState<ScanOutcome | undefined>();
  const [parts, setParts] = useState<{ printer: string; scanner: string } | undefined>();
  const backToStart = () => setShowing({ screen: "who" });

  const reachable = useReachable();

  useIdle(showing.screen !== "who", idleMs, backToStart);
  useNightlyReload(deviceToken, showing.screen === "who" && !scanned);

  // Asked every few seconds, which also notices the server going away and coming back.
  useEffect(() => {
    const check = async () => {
      const result = await ask("GET", "/api/observatory/parts", undefined, deviceToken);
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

  // Who are you is shown fresh each time, so a mascot dressed a moment ago appears dressed on its planet.
  useEffect(() => {
    // Asked until the server answers; meanwhile the children it last saw are shown, even straight after a reload.
    if (showing.screen !== "who") return;
    const stop = new AbortController();
    void keepLoading("/api/observatory/children", deviceToken, stop.signal, (data) => setChildren(data.children)).then(
      (status) => status === 401 && onUnpaired(),
    );
    void keepLoading("/api/observatory/store", deviceToken, stop.signal, (data) => setStore(data.items));
    return () => stop.abort();
  }, [deviceToken, showing.screen]);

  // Printed tickets and messages about them go back to Who are you after a moment, ready for the next child.
  useEffect(() => {
    if (showing.screen !== "printing" && !(showing.screen === "could-not-print" && !showing.lostKind)) return;
    const timer = setTimeout(backToStart, messageMs);
    return () => clearTimeout(timer);
  }, [showing]);

  // Printing is never tried again by itself (a child would get a ticket long after walking away), and isn't tried at
  // all while the server is known to be away.
  const print = async (child: Child, choice: MenuChoice) => {
    if (!isReachable()) return setShowing({ screen: "could-not-print", child, message: wakingUp });
    const result = await ask("POST", `/api/observatory/children/${child.id}/tickets`, { kind: choice.kind, taskId: choice.id }, deviceToken);
    if (result.ok) return setShowing({ screen: "printing", child, choice });
    if (serverDown(result.status)) return setShowing({ screen: "could-not-print", child, message: wakingUp });
    const message = result.data?.error ?? "That didn't work. Ask a grown-up.";
    // Already holding a ticket of this kind? Offer to ask a grown-up for a new copy, in case it's lost.
    const lostKind = result.status === 409 && /already have/i.test(message) ? choice.kind : undefined;
    setShowing({ screen: "could-not-print", child, message, lostKind });
  };

  const askForReprint = async (child: Child, kind: "chore" | "quiz") => {
    const result = await ask("POST", `/api/observatory/children/${child.id}/reprint-requests`, { kind }, deviceToken);
    setShowing({
      screen: "could-not-print",
      child,
      message: result.ok ? "OK! A grown-up will check, then print it again." : serverDown(result.status) ? wakingUp : (result.data?.error ?? "Ask a grown-up."),
    });
  };

  const napping = [parts?.printer === "offline" && "printer", parts?.scanner === "offline" && "scanner"].filter(Boolean);

  return (
    <>
      <NightSky />
      {!reachable && (
        <p className="dome-offline" role="status">
          Waking up…
        </p>
      )}
      {napping.length > 0 && (
        <p className="dome-banner" role="alert">
          The {napping.join(" and ")} {napping.length > 1 ? "are" : "is"} napping. Ask a grown-up!
        </p>
      )}
      {showing.screen === "who" && (
        <WhoAreYou children={children} pictures={outfitPictures(store)} onChoose={(child) => setShowing({ screen: "child", child })} onGrownUps={() => setShowing({ screen: "unlock" })} />
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

/**
 * Loads a child's balance, lifetime stars, new stars and menu, then shows their dome. Once their new stars have flown
 * into the jar (or straight away, if there are none) it records the visit, so they arrive only once.
 */
function ChildView({ child, deviceToken, onPrint, onLeave }: { child: Child; deviceToken: string; onPrint: (choice: MenuChoice) => void; onLeave: () => void }) {
  // `fresh` is false while showing the last good copy: new stars only fly in, and the visit is only recorded, once the
  // server has answered.
  const [totals, setTotals] = useState<{ balance: number; earned: number; newStars: number; fresh: boolean } | undefined>();
  const [arrived, setArrived] = useState(false);
  const [store, setStore] = useState<StoreItem[] | undefined>();
  const [owned, setOwned] = useState<string[]>([]);
  const [wearing, setWearing] = useState<{ hat: string | null; hair: string | null }>(child.wearing ?? { hat: null, hair: null });
  const [menu, setMenu] = useState<Menu | undefined>();
  const [history, setHistory] = useState<StarHistory | undefined>();

  useEffect(() => {
    const stop = new AbortController();
    void keepLoading(`/api/observatory/children/${child.id}`, deviceToken, stop.signal, (data, fresh) => {
      const { balance, earned, newStars, wardrobe } = data.child;
      setTotals({ balance, earned, newStars: fresh ? newStars : 0, fresh });
      setOwned(wardrobe.owned);
      setWearing(wardrobe.wearing);
    });
    void keepLoading(`/api/observatory/children/${child.id}/menu`, deviceToken, stop.signal, (data) => setMenu(data));
    void keepLoading("/api/observatory/store", deviceToken, stop.signal, (data) => setStore(data.items));
    return () => stop.abort();
  }, [child.id]);

  const arriving = totals && !arrived ? totals.newStars : 0;

  useEffect(() => {
    if (!totals?.fresh || arrived) return;
    if (totals.newStars === 0) return setArrived(true);
    // In case the frame never reports the last star landing, carry on once they should all be in.
    const timer = setTimeout(() => setArrived(true), arrivalMs(totals.newStars) + 1500);
    return () => clearTimeout(timer);
  }, [totals, arrived]);

  // Recorded even if the server blinks just then, so the same stars don't fly in again next time.
  useEffect(() => {
    if (!arrived) return;
    const stop = new AbortController();
    void keepAsking("POST", `/api/observatory/children/${child.id}/visit`, undefined, deviceToken, stop.signal);
    return () => stop.abort();
  }, [arrived]);

  // Buying needs no grown-up. Whatever the answer, the screen shows what the server says the balance is now.
  const buy = async (item: StoreItem) => {
    const result = await ask("POST", `/api/observatory/children/${child.id}/purchases`, { storeItemId: item.id }, deviceToken);
    const balance = result.data?.balance;
    if (typeof balance === "number") setTotals((current) => current && { ...current, balance });
    if (result.ok) setOwned(result.data.wardrobe.owned);
    return result.ok;
  };

  // Tapping an owned outfit puts it on (replacing whatever was in its place), or takes it off if it's being worn.
  const wear = async (item: StoreItem) => {
    if (item.kind === "sticker") return;
    const place = item.kind;
    const next = { ...wearing, [place]: wearing[place] === item.id ? null : item.id };
    const result = await ask("PUT", `/api/observatory/children/${child.id}/mascot`, next, deviceToken);
    if (result.ok) setWearing(result.data.wearing);
  };

  const showHistory = async (show: boolean) => {
    if (!show) return setHistory(undefined);
    const result = await ask("GET", `/api/observatory/children/${child.id}/star-history`, undefined, deviceToken);
    if (result.ok) setHistory(result.data);
  };

  return (
    <ChildScreen
      child={child}
      balance={totals?.balance}
      earned={totals?.earned}
      arriving={arriving}
      onArrived={() => setArrived(true)}
      store={store}
      owned={owned}
      wearing={wearing}
      onBuy={buy}
      onWear={wear}
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
      const result = await ask("GET", "/api/observatory/grown-ups", undefined, deviceToken);
      if (result.ok) setGrownUps(result.data.grownUps);
    })();
  }, [deviceToken]);

  const submit = async () => {
    if (!chosen) return;
    const result =
      chosen.id === guestChoice.id
        ? await ask("POST", "/api/observatory/unlock-guest", { pin }, deviceToken)
        : await ask("POST", "/api/observatory/unlock", { grownUpId: chosen.id, pin }, deviceToken);
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
