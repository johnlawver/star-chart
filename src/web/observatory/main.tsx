import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, stored } from "../shared/api.js";

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
  const [pairingCode, setPairingCode] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const result = await api("GET", "/api/observatory/children", undefined, deviceToken);
      if (result.status === 401) return onUnpaired();
      if (result.ok) setChildren(result.data.children);
    })();
  }, [deviceToken]);

  if (chosen) return <ChildView child={chosen} deviceToken={deviceToken} onDone={() => setChosen(undefined)} />;

  const showPairingCode = async () => {
    const result = await api("POST", "/api/observatory/pairing-codes", undefined, deviceToken);
    if (result.ok) setPairingCode(result.data.code);
  };

  return (
    <main>
      <h1>Who are you?</h1>
      {children.length === 0 && <p>No children yet. A grown-up can add them in the Control Center.</p>}
      {children.map((child) => (
        <button key={child.id} onClick={() => setChosen(child)}>
          {child.nickname}
        </button>
      ))}
      <footer>
        <button onClick={showPairingCode}>Pair a printer or scanner</button>
        {pairingCode && (
          <p>
            Pairing code: <strong>{pairingCode}</strong> (works once, for 10 minutes)
          </p>
        )}
      </footer>
    </main>
  );
}

interface MenuCategory {
  id: string;
  name: string;
  kind: "chore" | "quiz";
  choices: { id: string; name: string; stars: number }[];
}

function ChildView({ child, deviceToken, onDone }: { child: Child; deviceToken: string; onDone: () => void }) {
  const [menu, setMenu] = useState<MenuCategory[] | undefined>();
  const [category, setCategory] = useState<MenuCategory | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const result = await api("GET", `/api/observatory/children/${child.id}/menu`, undefined, deviceToken);
      if (result.ok) setMenu(result.data.categories);
    })();
  }, [child.id]);

  const print = async (choiceId: string) => {
    if (!category) return;
    const result = await api(
      "POST",
      `/api/observatory/children/${child.id}/tickets`,
      { categoryId: category.id, choiceId },
      deviceToken,
    );
    setMessage(result.ok ? "Printing your ticket!" : (result.data?.error ?? "That didn't work. Ask a grown-up."));
    setTimeout(onDone, 3000);
  };

  if (message) return <main><h1>{message}</h1></main>;

  return (
    <main>
      <h1>Hi, {child.nickname}!</h1>
      {menu === undefined && <p>Loading…</p>}
      {menu?.length === 0 && <p>Nothing to do right now.</p>}
      {!category &&
        menu?.map((c) => (
          <button key={c.id} onClick={() => setCategory(c)}>
            {c.name}
          </button>
        ))}
      {category &&
        category.choices.map((choice) => (
          <button key={choice.id} onClick={() => print(choice.id)}>
            {choice.name} ({choice.stars} ★)
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
