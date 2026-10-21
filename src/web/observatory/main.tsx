import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, stored } from "../shared/api.js";
import { useLiveConnection } from "../shared/live.js";
import { Icon } from "../shared/icons.js";
import { ConstellationList, type Constellation } from "../shared/constellation.js";

// The observatory screen. Deliberately plain until its design phase (see Project conventions in CLAUDE.md).

const tokenKey = "star-chart.observatory.deviceToken";

interface Child {
  id: string;
  nickname: string;
  displayStyle: "pictures" | "words";
}

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
    <main>
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

function ChildrensView({ deviceToken, onUnpaired }: { deviceToken: string; onUnpaired: () => void }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [chosen, setChosen] = useState<Child | undefined>();
  const [unlocking, setUnlocking] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | undefined>();
  const [scanResult, setScanResult] = useState<string | undefined>();
  const [parts, setParts] = useState<{ printer: string; scanner: string } | undefined>();

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
      if (message.type !== "scan-result") return;
      const messages: Record<string, string> = {
        "handed-in": `Great job, ${message.childNickname}! "${message.title}" is waiting for a grown-up.`,
        "waiting-for-grown-up": `"${message.title}" is already waiting for a grown-up to check it.`,
        "already-done": `"${message.title}" is already done! ⭐`,
        "not-recognised": "Hmm, I don't know that ticket. Ask a grown-up.",
      };
      setScanMessage(messages[message.result] ?? messages["not-recognised"]);
      setScanResult(message.result);
      setTimeout(() => setScanMessage(undefined), 4000);
    },
    onUnpaired,
  );

  useEffect(() => {
    void (async () => {
      const result = await api("GET", "/api/observatory/children", undefined, deviceToken);
      if (result.status === 401) return onUnpaired();
      if (result.ok) setChildren(result.data.children);
    })();
  }, [deviceToken]);

  if (unlocking) return <Unlock deviceToken={deviceToken} onCancel={() => setUnlocking(false)} />;
  if (scanMessage) {
    return (
      <main>
        {scanResult === "already-done" && <SpinningStar />}
        <h1 role="status">{scanMessage}</h1>
      </main>
    );
  }
  const napping = [
    parts?.printer === "offline" && "printer",
    parts?.scanner === "offline" && "scanner",
  ].filter(Boolean);
  const banner =
    napping.length > 0 ? <p role="alert">The {napping.join(" and ")} {napping.length > 1 ? "are" : "is"} napping. Ask a grown-up!</p> : null;

  if (chosen) {
    return (
      <>
        {banner}
        <ChildView child={chosen} deviceToken={deviceToken} onDone={() => setChosen(undefined)} />
      </>
    );
  }


  return (
    <main>
      {banner}
      <h1>Who are you?</h1>
      {children.length === 0 && <p>No children yet. A grown-up can add them in the Control Center.</p>}
      {children.map((child) => (
        <button key={child.id} onClick={() => setChosen(child)}>
          {child.nickname}
        </button>
      ))}
      <footer>
        <button onClick={() => setUnlocking(true)}>Grown-ups</button>
      </footer>
    </main>
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
      <main>
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
    <main>
      <h1>Hi {chosen.name}, enter your PIN</h1>
      <p aria-live="polite">{"•".repeat(pin.length) || " "}</p>
      <div>
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

/** A little "already done!" animation. Plain for now; the observatory's design phase will replace it. */
function SpinningStar() {
  return (
    <>
      <style>{"@keyframes star-spin { from { transform: rotate(0deg) scale(1) } to { transform: rotate(360deg) scale(1.4) } }"}</style>
      <div aria-hidden style={{ fontSize: 96, display: "inline-block", animation: "star-spin 1s ease-in-out infinite alternate" }}>
        ⭐
      </div>
    </>
  );
}

interface MenuCategory {
  id: string;
  name: string;
  kind: "chore" | "quiz";
  icon: string | null;
  choices: { id: string; name: string; stars: number; icon: string | null; done: boolean }[];
}

function ChildView({ child, deviceToken, onDone }: { child: Child; deviceToken: string; onDone: () => void }) {
  const [menu, setMenu] = useState<MenuCategory[] | undefined>();
  const [category, setCategory] = useState<MenuCategory | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [balance, setBalance] = useState<number | undefined>();
  const [constellation, setConstellation] = useState<Constellation | undefined>();
  const [lostCategoryId, setLostCategoryId] = useState<string | undefined>();
  // Children who can't read yet see big icons instead of words (their display style).
  const pictures = child.displayStyle === "pictures";

  useEffect(() => {
    void (async () => {
      const result = await api("GET", `/api/observatory/children/${child.id}`, undefined, deviceToken);
      if (result.ok) setBalance(result.data.child.balance);
    })();
  }, [child.id]);

  useEffect(() => {
    void (async () => {
      const result = await api("GET", `/api/observatory/children/${child.id}/menu`, undefined, deviceToken);
      if (result.ok) setMenu(result.data.categories);
    })();
  }, [child.id]);

  const print = async (choiceId: string) => {
    if (category) await printIn(category, choiceId);
  };

  const printIn = async (category: MenuCategory, choiceId: string) => {
    const result = await api(
      "POST",
      `/api/observatory/children/${child.id}/tickets`,
      { categoryId: category.id, choiceId },
      deviceToken,
    );
    setMessage(result.ok ? "Printing your ticket!" : (result.data?.error ?? "That didn't work. Ask a grown-up."));
    // Already holding a ticket here? Offer to ask a grown-up for a new copy, in case it's lost.
    if (result.status === 409 && /already have/i.test(result.data?.error ?? "")) {
      setLostCategoryId(category.id);
      return;
    }
    setTimeout(onDone, 3000);
  };

  // A quiz category with just one topic for this child prints straight away; otherwise the child picks a topic.
  const chooseCategory = (chosen: MenuCategory) => {
    const only = chosen.choices[0];
    if (chosen.kind === "quiz" && chosen.choices.length === 1 && only) void printIn(chosen, only.id);
    else setCategory(chosen);
  };

  const askForReprint = async () => {
    const result = await api(
      "POST",
      `/api/observatory/children/${child.id}/reprint-requests`,
      { categoryId: lostCategoryId },
      deviceToken,
    );
    setLostCategoryId(undefined);
    setMessage(result.ok ? "OK! A grown-up will check, then print it again." : (result.data?.error ?? "Ask a grown-up."));
    setTimeout(onDone, 3000);
  };

  if (message) {
    return (
      <main>
        <h1>{message}</h1>
        {lostCategoryId && (
          <>
            <button onClick={askForReprint}>I lost it</button> <button onClick={onDone}>I still have it</button>
          </>
        )}
      </main>
    );
  }

  const showConstellation = async () => {
    const result = await api("GET", `/api/observatory/children/${child.id}/constellation`, undefined, deviceToken);
    if (result.ok) setConstellation(result.data);
  };

  if (constellation) {
    return (
      <main>
        <h1>{child.nickname}'s stars</h1>
        <ConstellationList constellation={constellation} />
        <button onClick={() => setConstellation(undefined)}>Back</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Hi, {child.nickname}!</h1>
      {balance !== undefined && (
        <p>
          You have {balance} ★ <button onClick={showConstellation}>My stars</button>
        </p>
      )}
      {menu === undefined && <p>Loading…</p>}
      {menu?.length === 0 && <p>Nothing to do right now.</p>}
      {!category &&
        menu?.map((c) => (
          <button key={c.id} onClick={() => chooseCategory(c)} aria-label={c.name}>
            {pictures && c.icon ? <Icon id={c.icon} size={96} /> : c.name}
          </button>
        ))}
      {category &&
        category.choices.map((choice) => (
          <button key={choice.id} onClick={() => print(choice.id)} disabled={choice.done} aria-label={choice.name}>
            {choice.done ? "✓ " : ""}
            {pictures && choice.icon ? <Icon id={choice.icon} size={96} /> : `${choice.name} (${choice.stars} ★)`}
          </button>
        ))}
      <footer>
        <button onClick={category ? () => setCategory(undefined) : onDone}>Back</button>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Observatory />
  </StrictMode>,
);
