import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { stored } from "../shared/api.js";
import { Icon, IconPicker } from "../shared/icons.js";
import { ConstellationList, type Constellation } from "../shared/constellation.js";
import { AnswerKey, FeedKeys, QuizSettings } from "./quizzes.js";
import { TasksSection } from "./tasks.js";

// The Control Center, deliberately plain for now: sign up, sign in, and see your chart.

interface Me {
  grownUp: { id: string; email: string; role: "owner" | "admin" | "grown-up" };
  chart: { name: string; timeZone: string; quizPoolTarget: number };
}

/** A guest (a babysitter) with a Guest PIN, who can only handle tickets. */
interface GuestMe {
  guest: true;
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
  const [me, setMe] = useState<Me | GuestMe | null | undefined>(undefined);

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
  if ("guest" in me) {
    return (
      <main>
        <h1>{me.chart.name}</h1>
        <p>You're helping out as a guest: you can check and approve tickets.</p>
        <button onClick={lockObservatory}>Lock</button>
        <WaitingSection />
      </main>
    );
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
      {!onObservatory && <NotificationsSwitch />}
      <WaitingSection />
      <StarsSection />
      <ChildrenSection />
      <PinSection />
      {!onObservatory && <GuestPinsSection />}
      {me.grownUp.role === "owner" && !onObservatory && <DeleteChartSection me={me} />}
      <TasksSection />
      {me.grownUp.role !== "grown-up" && (
        <section>
          <h2>Quiz settings</h2>
          <QuizSettings quizPoolTarget={me.chart.quizPoolTarget} />
          {!onObservatory && <FeedKeys />}
        </section>
      )}
      <GrownUpsSection me={me} />
      {me.grownUp.role !== "grown-up" && <ObservatoriesSection />}
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
                if (window.confirm(`Remove ${child.nickname}? This permanently deletes their stars, tickets and history. It can't be undone.`)) {
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

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return <button onClick={() => setOpen(true)}>Forgot your password?</button>;
  if (sent) return <p role="status">If that email belongs to a Star Chart login, a link to choose a new password is on its way.</p>;

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { email } = Object.fromEntries(new FormData(event.currentTarget));
    await api("POST", "/api/password-reset", { email });
    setSent(true);
  };

  return (
    <form onSubmit={ask}>
      <label>
        Your email <input name="email" type="email" required />
      </label>{" "}
      <button type="submit">Send me a link</button>
    </form>
  );
}

function GrownUpsSection({ me }: { me: Me }) {
  const [grownUps, setGrownUps] = useState<{ id: string; email: string; role: string }[]>([]);
  const [message, setMessage] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", "/api/grown-ups");
    if (result.ok) setGrownUps(result.data.grownUps);
  };

  useEffect(() => {
    void load();
  }, []);

  const setRole = async (id: string, role: "admin" | "grown-up") => {
    const result = await api("PATCH", `/api/grown-ups/${id}`, { role });
    setMessage(result.ok ? undefined : result.data?.error);
    await load();
  };

  const mayRemove = (mine: string, theirs: string) =>
    (mine === "owner" && theirs !== "owner") || (mine === "admin" && theirs === "grown-up");

  const remove = async (grownUp: { id: string; email: string }) => {
    if (!window.confirm(`Remove ${grownUp.email}? Their login is deleted.`)) return;
    const result = await api("DELETE", `/api/grown-ups/${grownUp.id}`);
    setMessage(result.ok ? undefined : result.data?.error);
    await load();
  };

  const handOver = async (grownUp: { id: string; email: string }) => {
    if (!window.confirm(`Make ${grownUp.email} the owner? You'll become an admin.`)) return;
    const result = await api("POST", "/api/ownership", { grownUpId: grownUp.id });
    if (result.ok) location.reload();
    else setMessage(result.data?.error);
  };

  const leave = async () => {
    if (!window.confirm("Leave this chart? Your login is deleted.")) return;
    const result = await api("DELETE", "/api/me");
    if (result.ok) location.reload();
    else setMessage(result.data?.error);
  };

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { email } = Object.fromEntries(new FormData(form));
    const result = await api("POST", "/api/invitations", { email });
    setMessage(result.ok ? `Invitation sent to ${email}.` : (result.data?.error ?? "Couldn't send that invitation."));
    if (result.ok) form.reset();
  };

  return (
    <section>
      <h2>Grown-ups</h2>
      <ul>
        {grownUps.map((grownUp) => (
          <li key={grownUp.id}>
            {grownUp.email} ({grownUp.role}){grownUp.id === me.grownUp.id ? " (you)" : ""}{" "}
            {me.grownUp.role === "owner" && grownUp.role === "grown-up" && (
              <button onClick={() => setRole(grownUp.id, "admin")}>Make admin</button>
            )}
            {me.grownUp.role === "owner" && grownUp.role === "admin" && (
              <>
                <button onClick={() => setRole(grownUp.id, "grown-up")}>Make grown-up</button>{" "}
                <button onClick={() => handOver(grownUp)}>Hand over the chart</button>
              </>
            )}{" "}
            {grownUp.id !== me.grownUp.id && mayRemove(me.grownUp.role, grownUp.role) && (
              <button onClick={() => remove(grownUp)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      {me.grownUp.role !== "grown-up" && (
        <form onSubmit={invite}>
          <label>
            Invite by email <input name="email" type="email" required />
          </label>{" "}
          <button type="submit">Send invitation</button>
        </form>
      )}
      {me.grownUp.role !== "owner" && <button onClick={leave}>Leave this chart</button>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

function DeleteChartSection({ me }: { me: Me }) {
  const [error, setError] = useState<string | undefined>();

  const deleteChart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { confirmName } = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api("DELETE", "/api/chart", { confirmName });
    if (result.ok) location.reload();
    else setError(result.data?.error);
  };

  return (
    <section>
      <h2>Delete this chart</h2>
      <p>
        This permanently deletes {me.chart.name}: every child, star, ticket and grown-up login, and unpairs its observatories.
        It can't be undone.
      </p>
      <form onSubmit={deleteChart}>
        <label>
          Type <strong>{me.chart.name}</strong> to confirm <input name="confirmName" autoComplete="off" required />
        </label>{" "}
        <button type="submit">Delete everything</button>
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
      {mode === "sign-in" && <ForgotPassword />}
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

interface WaitingTicket {
  id: string;
  childNickname: string;
  title: string;
  stars: number;
  answerKey: { prompt: string; answer: string }[] | null;
}

function LostTickets({ onChange }: { onChange: () => void }) {
  const [requests, setRequests] = useState<{ id: string; childNickname: string; title: string }[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", "/api/reprint-requests");
    if (result.ok) setRequests(result.data.reprintRequests);
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(load, 10_000);
    return () => clearInterval(refresh);
  }, []);

  const answer = async (id: string, decision: "approve" | "decline") => {
    const result = await api("POST", `/api/reprint-requests/${id}/${decision}`, {});
    setError(result.ok ? undefined : result.data?.error);
    await load();
    onChange();
  };

  if (requests.length === 0 && !error) return null;
  return (
    <>
      <h3>Lost tickets</h3>
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <strong>{request.childNickname}</strong> lost "{request.title}"{" "}
            <button onClick={() => answer(request.id, "approve")}>Print again</button>{" "}
            <button onClick={() => answer(request.id, "decline")}>No</button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

/** Shows how many things are waiting on the app's home-screen badge (where the browser supports it). */
function showOnAppBadge(count: number) {
  if (onObservatory || !("setAppBadge" in navigator)) return;
  const update = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  update.catch(() => {
    // Badges are a nice extra; ignore browsers that refuse.
  });
}

function WaitingSection() {
  const [waiting, setWaiting] = useState<WaitingTicket[]>([]);
  const [open, setOpen] = useState<WaitingTicket[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const [handedIn, stillOpen, lost] = await Promise.all([
      api("GET", "/api/tickets?state=handed-in"),
      api("GET", "/api/tickets?state=open"),
      api("GET", "/api/reprint-requests"),
    ]);
    if (handedIn.ok) setWaiting(handedIn.data.tickets);
    if (stillOpen.ok) setOpen(stillOpen.data.tickets);
    if (handedIn.ok && lost.ok) showOnAppBadge(handedIn.data.tickets.length + lost.data.reprintRequests.length);
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
    const data = new FormData(event.currentTarget);
    const stars = Number(data.get("stars"));
    const correct = data.get("correct");
    return act(
      api("POST", `/api/tickets/${ticket.id}/approve`, {
        ...(stars === ticket.stars ? {} : { stars }),
        ...(ticket.answerKey && correct !== null && correct !== "" ? { score: { correct: Number(correct), outOf: ticket.answerKey.length } } : {}),
      }),
    );
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
        {ticket.answerKey && (
          <label>
            Score <input name="correct" type="number" min={0} max={ticket.answerKey.length} style={{ width: "3em" }} /> /{" "}
            {ticket.answerKey.length}{" "}
          </label>
        )}
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
      {ticket.answerKey && <AnswerKey items={ticket.answerKey} />}
    </li>
  );

  return (
    <section>
      <h2>Waiting for you</h2>
      {waiting.length === 0 && <p>Nothing to check right now.</p>}
      <ul>{waiting.map((ticket) => row(ticket, true))}</ul>
      <LostTickets onChange={load} />
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

/** The browser wants the public key as bytes. */
function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** The service worker, or undefined if it hasn't started within a few seconds. */
async function serviceWorkerReady(): Promise<ServiceWorkerRegistration | undefined> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 5000)),
  ]);
}

/** Turns push notifications on or off for this device, says plainly why if that doesn't work, and can send a test. */
function NotificationsSwitch() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [on, setOn] = useState<boolean | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      const registration = await serviceWorkerReady();
      if (!registration) {
        setOn(false);
        setMessage("The app's background helper didn't start. Close Star Chart fully and open it again from the home screen.");
        return;
      }
      setOn((await registration.pushManager.getSubscription()) !== null);
      if (Notification.permission === "denied") {
        setMessage("Notifications are turned off for Star Chart in Settings → Notifications → Star Chart.");
      }
    })();
  }, []);

  if (!supported) {
    return (
      <p>
        To get notifications on an iPhone, add Star Chart to your home screen first (Share → Add to Home Screen), then open
        it from there.
      </p>
    );
  }

  const turnOn = async () => {
    setMessage("Turning on…");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notifications are turned off for Star Chart in Settings → Notifications → Star Chart.");
        return;
      }
      const registration = await serviceWorkerReady();
      if (!registration) throw new Error("the app's background helper didn't start; close and reopen Star Chart");
      const key = await api("GET", "/api/push/public-key");
      if (!key.ok) throw new Error("couldn't get the server's key");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key.data.publicKey),
      });
      const saved = await api("POST", "/api/push/subscriptions", subscription.toJSON());
      if (!saved.ok) throw new Error(saved.data?.error ?? "the server refused it");
      setOn(true);
      setMessage("On. Try “Send me a test” to check.");
    } catch (error) {
      setMessage(`Couldn't turn notifications on: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const turnOff = async () => {
    try {
      const registration = await serviceWorkerReady();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api("DELETE", "/api/push/subscriptions", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setOn(false);
      setMessage(undefined);
    } catch (error) {
      setMessage(`Couldn't turn notifications off: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Sent half a minute later: phones often don't show a notification for the app you're looking at.
  const sendTest = async () => {
    const result = await api("POST", "/api/push/test", { delaySeconds: 30 });
    setMessage(
      result.ok
        ? "Now close Star Chart (swipe it away, or go to your home screen) and wait about 30 seconds. A test notification is on its way."
        : (result.data?.error ?? "Couldn't send a test."),
    );
  };

  return (
    <p>
      Notifications on this device:{" "}
      {on === undefined ? "…" : on ? <button onClick={turnOff}>On (turn off)</button> : <button onClick={turnOn}>Off (turn on)</button>}{" "}
      <button onClick={sendTest}>Send me a test in 30 seconds</button>
      {message && <span role="status"> {message}</span>}
    </p>
  );
}

function GuestPinsSection() {
  const [pins, setPins] = useState<{ id: string; label: string | null; expiresAt: string }[]>([]);
  const [madePin, setMadePin] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", "/api/guest-pins");
    if (result.ok) setPins(result.data.guestPins);
  };

  useEffect(() => {
    void load();
  }, []);

  const make = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("label") ?? "").trim();
    const result = await api("POST", "/api/guest-pins", { ...(label ? { label } : {}), hours: Number(data.get("hours")) });
    if (result.ok) setMadePin(result.data.pin);
    form.reset();
    await load();
  };

  const cancel = async (id: string) => {
    await api("DELETE", `/api/guest-pins/${id}`);
    await load();
  };

  return (
    <section>
      <h2>Guest PINs</h2>
      <p>For a babysitter: a PIN that opens just the tickets on the observatory, for a few hours.</p>
      <form onSubmit={make}>
        <label>
          Who's it for? <input name="label" placeholder="Saturday sitter" maxLength={60} />
        </label>{" "}
        <label>
          Lasts{" "}
          <select name="hours" defaultValue="12">
            {[3, 6, 12, 24, 48].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hours
              </option>
            ))}
          </select>
        </label>{" "}
        <button type="submit">Make a Guest PIN</button>
      </form>
      {madePin && (
        <p role="status">
          Their PIN is <strong style={{ fontSize: "2em", letterSpacing: "0.2em" }}>{madePin}</strong>. Write it down now;
          it won't be shown again.
        </p>
      )}
      <ul>
        {pins.map((pin) => (
          <li key={pin.id}>
            {pin.label ?? "Guest"}, until {new Date(pin.expiresAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}{" "}
            <button onClick={() => cancel(pin.id)}>Cancel</button>
          </li>
        ))}
      </ul>
    </section>
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
