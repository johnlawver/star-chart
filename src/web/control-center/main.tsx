import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { stored } from "../shared/api.js";
import { Icon, IconPicker } from "../shared/icons.js";
import { ConstellationList, type Constellation } from "../shared/constellation.js";

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

// Opened on an observatory (after a grown-up's PIN) rather than on a phone or computer.
const onObservatory = new URLSearchParams(location.search).get("on") === "observatory";
const observatoryTokenKey = "star-chart.observatory.deviceToken";
const idleLockMs = 90_000;

/** Signs out and goes back to the children's view of the observatory. */
async function lockObservatory() {
  await api("POST", "/api/sign-out");
  location.href = "/observatory.html";
}

function ControlCenter() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  // On the observatory, the Control Center locks itself after a short while untouched.
  useEffect(() => {
    if (!onObservatory) return;
    let timer = setTimeout(lockObservatory, idleLockMs);
    const touched = () => {
      clearTimeout(timer);
      timer = setTimeout(lockObservatory, idleLockMs);
    };
    for (const event of ["pointerdown", "keydown"]) window.addEventListener(event, touched);
    return () => {
      clearTimeout(timer);
      for (const event of ["pointerdown", "keydown"]) window.removeEventListener(event, touched);
    };
  }, []);

  const refresh = async () => {
    const result = await api("GET", "/api/me");
    setMe(result.ok ? result.data : null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (me === undefined) return <p>Loading…</p>;
  if (me === null) {
    if (onObservatory) {
      location.href = "/observatory.html";
      return null;
    }
    return <SignedOut onSignedIn={refresh} />;
  }
  return (
    <main>
      <h1>{me.chart.name}</h1>
      <p>
        Signed in as {me.grownUp.email} ({me.grownUp.role}). Time zone: {me.chart.timeZone}.
      </p>
      {onObservatory ? (
        <button onClick={lockObservatory}>Lock</button>
      ) : (
        <button onClick={async () => (await api("POST", "/api/sign-out"), refresh())}>Sign out</button>
      )}
      {onObservatory && <ObservatoryTools />}
      <WaitingSection />
      <StarsSection />
      <ChildrenSection />
      <PinSection />
      <ChoresSection />
      {me.grownUp.role === "owner" && <ObservatoriesSection />}
    </main>
  );
}

interface Child {
  id: string;
  nickname: string;
  displayStyle: "pictures" | "words";
}

function ChildrenSection() {
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", "/api/children");
    if (result.ok) setChildren(result.data.children);
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (request: Promise<{ ok: boolean; data: any }>) => {
    const result = await request;
    setError(result.ok ? undefined : (result.data?.error ?? "Something went wrong."));
    await load();
  };

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { nickname, displayStyle } = Object.fromEntries(new FormData(form));
    await run(api("POST", "/api/children", { nickname, displayStyle }));
    form.reset();
  };

  return (
    <section>
      <h2>Children</h2>
      {children.length === 0 && <p>No children yet.</p>}
      <ul>
        {children.map((child) => (
          <li key={child.id}>
            <strong>{child.nickname}</strong> sees{" "}
            <select
              value={child.displayStyle}
              onChange={(e) => run(api("PATCH", `/api/children/${child.id}`, { displayStyle: e.target.value }))}
            >
              <option value="pictures">pictures</option>
              <option value="words">words</option>
            </select>{" "}
            <button
              onClick={() => {
                const nickname = window.prompt("New nickname", child.nickname);
                if (nickname) void run(api("PATCH", `/api/children/${child.id}`, { nickname }));
              }}
            >
              Rename
            </button>{" "}
            <button
              onClick={() => {
                if (window.confirm(`Remove ${child.nickname}? This can't be undone.`)) {
                  void run(api("DELETE", `/api/children/${child.id}`));
                }
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add}>
        <label>
          Nickname <input name="nickname" maxLength={40} required />
        </label>{" "}
        <label>
          Sees{" "}
          <select name="displayStyle" defaultValue="words">
            <option value="pictures">pictures</option>
            <option value="words">words</option>
          </select>
        </label>{" "}
        <button type="submit">Add child</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
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


interface ObservatorySummary {
  id: string;
  parts: { kind: "screen" | "printer" | "scanner"; online: boolean }[];
}

function ObservatoriesSection() {
  const [observatories, setObservatories] = useState<ObservatorySummary[]>([]);

  const load = async () => {
    const result = await api("GET", "/api/observatories");
    if (result.ok) setObservatories(result.data.observatories);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section>
      <h2>Observatories</h2>
      {observatories.length === 0 && (
        <p>
          None yet. Open <code>/observatory.html</code> on the observatory's screen and sign in there to pair it.
        </p>
      )}
      <ul>
        {observatories.map((observatory, index) => (
          <li key={observatory.id}>
            Observatory {index + 1}:{" "}
            {observatory.parts.map((part) => `${part.online ? "🟢" : "⚪"} ${part.kind}`).join(", ")}{" "}
            <button
              onClick={async () => {
                if (window.confirm("Unpair this observatory? Its screen, printer and scanner will all need pairing again.")) {
                  await api("DELETE", `/api/observatories/${observatory.id}`);
                  await load();
                }
              }}
            >
              Unpair
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface CategoryWithChores {
  id: string;
  name: string;
  kind: "chore" | "quiz";
  icon: string | null;
  chores: {
    id: string;
    name: string;
    stars: number;
    icon: string | null;
    frequency: { times: number; per: "day" | "week" };
    childIds: string[];
  }[];
}

function ChoresSection() {
  const [categories, setCategories] = useState<CategoryWithChores[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const [categoryResult, childResult] = await Promise.all([api("GET", "/api/categories"), api("GET", "/api/children")]);
    if (categoryResult.ok) setCategories(categoryResult.data.categories);
    if (childResult.ok) setChildren(childResult.data.children);
  };

  useEffect(() => {
    void load();
  }, []);

  const nicknameOf = (id: string) => children.find((child) => child.id === id)?.nickname ?? "?";

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { name, icon } = Object.fromEntries(new FormData(form));
    const result = await api("POST", "/api/categories", { name, kind: "chore", ...(icon ? { icon } : {}) });
    setError(result.ok ? undefined : result.data?.error);
    form.reset();
    await load();
  };

  const addChore = async (event: FormEvent<HTMLFormElement>, categoryId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await api("POST", "/api/chores", {
      categoryId,
      name: data.get("name"),
      stars: Number(data.get("stars")),
      childIds: data.getAll("childIds"),
      frequency: { times: Number(data.get("times")), per: data.get("per") },
      ...(data.get("icon") ? { icon: data.get("icon") } : {}),
    });
    setError(result.ok ? undefined : result.data?.error);
    form.reset();
    await load();
  };

  return (
    <section>
      <h2>Chores</h2>
      {categories.map((category) => (
        <div key={category.id}>
          <h3>
            <Icon id={category.icon} size={24} /> {category.name}
          </h3>
          <ul>
            {category.chores.map((chore) => (
              <li key={chore.id}>
                <Icon id={chore.icon} size={20} /> {chore.name}: {chore.stars} ★, {chore.frequency.times === 1 ? "once" : `${chore.frequency.times} times`} a{" "}
                {chore.frequency.per}, for {chore.childIds.map(nicknameOf).join(", ") || "nobody yet"}
              </li>
            ))}
          </ul>
          <form onSubmit={(event) => addChore(event, category.id)}>
            <label>
              Chore <input name="name" maxLength={60} required />
            </label>{" "}
            <label>
              Stars <input name="stars" type="number" min={0} max={100} defaultValue={1} required />
            </label>{" "}
            <label>
              <input name="times" type="number" min={1} max={10} defaultValue={1} required style={{ width: "3em" }} /> times
              a{" "}
              <select name="per" defaultValue="day">
                <option value="day">day</option>
                <option value="week">week</option>
              </select>
            </label>{" "}
            <IconPicker />{" "}
            {children.map((child) => (
              <label key={child.id}>
                <input type="checkbox" name="childIds" value={child.id} /> {child.nickname}
              </label>
            ))}{" "}
            <button type="submit">Add chore</button>
          </form>
        </div>
      ))}
      <form onSubmit={addCategory}>
        <label>
          New chore category <input name="name" placeholder="Chores" maxLength={60} required />
        </label>{" "}
        <IconPicker />{" "}
        <button type="submit">Add category</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

interface WaitingTicket {
  id: string;
  childNickname: string;
  title: string;
  stars: number;
}

function WaitingSection() {
  const [waiting, setWaiting] = useState<WaitingTicket[]>([]);
  const [open, setOpen] = useState<WaitingTicket[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const [handedIn, stillOpen] = await Promise.all([
      api("GET", "/api/tickets?state=handed-in"),
      api("GET", "/api/tickets?state=open"),
    ]);
    if (handedIn.ok) setWaiting(handedIn.data.tickets);
    if (stillOpen.ok) setOpen(stillOpen.data.tickets);
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(load, 10_000);
    return () => clearInterval(refresh);
  }, []);

  const act = async (request: Promise<{ ok: boolean; data: any }>) => {
    const result = await request;
    setError(result.ok ? undefined : result.data?.error);
    await load();
  };

  const approve = (event: FormEvent<HTMLFormElement>, ticket: WaitingTicket) => {
    event.preventDefault();
    const stars = Number(new FormData(event.currentTarget).get("stars"));
    return act(api("POST", `/api/tickets/${ticket.id}/approve`, stars === ticket.stars ? {} : { stars }));
  };

  const reject = (ticket: WaitingTicket) => {
    const note = window.prompt(`Why isn't "${ticket.title}" done yet? (optional)`);
    if (note === null) return;
    return act(api("POST", `/api/tickets/${ticket.id}/reject`, note.trim() ? { note } : {}));
  };

  const dismiss = (ticket: WaitingTicket) => {
    if (!window.confirm(`Dismiss ${ticket.childNickname}'s "${ticket.title}" ticket? No stars will be given.`)) return;
    return act(api("POST", `/api/tickets/${ticket.id}/dismiss`, {}));
  };

  const row = (ticket: WaitingTicket, handedIn: boolean) => (
    <li key={ticket.id}>
      <form onSubmit={(event) => approve(event, ticket)}>
        <strong>{ticket.childNickname}</strong>: {ticket.title}{" "}
        <input name="stars" type="number" min={0} max={100} defaultValue={ticket.stars} style={{ width: "4em" }} /> ★{" "}
        <button type="submit">Approve</button>{" "}
        {handedIn && (
          <button type="button" onClick={() => reject(ticket)}>
            Not yet
          </button>
        )}{" "}
        <button type="button" onClick={() => dismiss(ticket)}>
          Dismiss
        </button>
      </form>
    </li>
  );

  return (
    <section>
      <h2>Waiting for you</h2>
      {waiting.length === 0 && <p>Nothing to check right now.</p>}
      <ul>{waiting.map((ticket) => row(ticket, true))}</ul>
      <h3>Still open</h3>
      {open.length === 0 && <p>No open tickets.</p>}
      <ul>{open.map((ticket) => row(ticket, false))}</ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function StarsSection() {
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    void (async () => {
      const result = await api("GET", "/api/children");
      if (result.ok) setChildren(result.data.children);
    })();
  }, []);

  return (
    <section>
      <h2>Stars</h2>
      {children.map((child) => (
        <ChildStars key={child.id} child={child} />
      ))}
    </section>
  );
}

function ChildStars({ child }: { child: Child }) {
  const [constellation, setConstellation] = useState<Constellation | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", `/api/children/${child.id}/constellation`);
    if (result.ok) setConstellation(result.data);
  };

  useEffect(() => {
    void load();
  }, [child.id]);

  const spend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await api("POST", `/api/children/${child.id}/redemptions`, {
      amount: Number(data.get("amount")),
      note: data.get("note"),
    });
    setError(result.ok ? undefined : result.data?.error);
    if (result.ok) form.reset();
    await load();
  };

  return (
    <div>
      <h3>
        {child.nickname}: {constellation?.balance ?? "…"} ★
      </h3>
      <form onSubmit={spend}>
        <label>
          Spend <input name="amount" type="number" min={1} max={constellation?.balance ?? 0} required style={{ width: "4em" }} /> ★
        </label>{" "}
        <label>
          on <input name="note" placeholder="Ice cream" maxLength={100} required />
        </label>{" "}
        <button type="submit">Record</button>{" "}
        <button type="button" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Hide" : "Show"} constellation
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {showHistory && constellation && <ConstellationList constellation={constellation} />}
    </div>
  );
}

function PinSection() {
  const [message, setMessage] = useState<string | undefined>();

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { pin } = Object.fromEntries(new FormData(form));
    const result = await api("PUT", "/api/me/pin", { pin });
    setMessage(result.ok ? "PIN saved. Use it on the observatory." : "A PIN is 4 to 8 digits.");
    form.reset();
  };

  return (
    <section>
      <h2>My PIN</h2>
      <p>Your PIN opens this Control Center on the observatory.</p>
      <form onSubmit={save}>
        <label>
          New PIN <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" required autoComplete="off" />
        </label>{" "}
        <button type="submit">Save</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

/** Things a grown-up can only do standing at the observatory: set up their phone, and pair parts. */
function ObservatoryTools() {
  const [phoneQr, setPhoneQr] = useState<string | undefined>();
  const [pairingCode, setPairingCode] = useState<string | undefined>();

  const showPhoneQr = async () => {
    const result = await api("POST", "/api/phone-setup");
    if (!result.ok) return;
    // The code goes after "#", so it never reaches a server or its logs.
    const link = `${location.origin}/phone-setup.html#code=${encodeURIComponent(result.data.code)}`;
    setPhoneQr(await QRCode.toDataURL(link, { margin: 1, width: 256 }));
  };

  const showPairingCode = async () => {
    const deviceToken = stored.get(observatoryTokenKey);
    const result = await fetch("/api/observatory/pairing-codes", {
      method: "POST",
      headers: { authorization: `Bearer ${deviceToken}` },
    });
    if (result.ok) setPairingCode((await result.json()).code);
  };

  return (
    <section>
      <button onClick={showPhoneQr}>Set up my phone</button>{" "}
      <button onClick={showPairingCode}>Pair a printer or scanner</button>
      {phoneQr && (
        <p>
          Scan this with your phone's camera. It works once, for 5 minutes.
          <br />
          <img src={phoneQr} alt="QR code for setting up your phone" width={256} height={256} />
        </p>
      )}
      {pairingCode && (
        <p>
          Pairing code: <strong>{pairingCode}</strong> (works once, for 10 minutes)
        </p>
      )}
    </section>
  );
}

// Lets the Control Center be installed on a phone's home screen.
if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ControlCenter />
  </StrictMode>,
);
