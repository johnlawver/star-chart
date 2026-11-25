// Settings: you, this observatory (when open on one), notifications, the chart's observatories, quiz feed keys, and
// deleting the chart.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import { api, stored } from "../../shared/api.js";
import { confirmFirst } from "../../shared/dialog.js";
import { manages, observatoryTokenKey, onObservatory, type Me } from "../common.js";
import { FeedKeys } from "../quizzes.js";
import { PageTitle } from "../shell.js";

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
      <p className="hint">
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
    <>
      <div className="actions">
        <span>On this device: {on === undefined ? "…" : on ? "on" : "off"}</span>
        {on !== undefined &&
          (on ? (
            <button onClick={turnOff}>Turn off</button>
          ) : (
            <button className="primary" onClick={turnOn}>
              Turn on
            </button>
          ))}
        <button onClick={sendTest}>Send me a test in 30 seconds</button>
      </div>
      {message && <p role="status">{message}</p>}
    </>
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
      <h2>This observatory</h2>
      <div className="actions">
        <button onClick={showPhoneQr}>Set up my phone</button>
        <button onClick={showPairingCode}>Pair a printer or scanner</button>
      </div>
      {phoneQr && (
        <p>
          Scan this with your phone's camera. It works once, for 5 minutes.
          <br />
          <img src={phoneQr} alt="QR code for setting up your phone" width={256} height={256} />
        </p>
      )}
      {pairingCode && (
        <p>
          Pairing code: <strong className="big-code">{pairingCode}</strong> (works once, for 10 minutes)
        </p>
      )}
    </section>
  );
}

interface ObservatorySummary {
  id: string;
  parts: { kind: "screen" | "printer" | "scanner" | "unit"; online: boolean }[];
}

function Observatories() {
  const [observatories, setObservatories] = useState<ObservatorySummary[]>([]);
  const [codes, setCodes] = useState<Record<string, { code: string; expiresAt: string } | { error: string }>>({});

  const makeCode = async (observatoryId: string) => {
    const result = await api("POST", `/api/observatories/${observatoryId}/pairing-codes`);
    setCodes({ ...codes, [observatoryId]: result.ok ? result.data : { error: result.data?.error ?? "Couldn't make a code." } });
  };

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
        <p className="empty">
          None yet. Open <code>/observatory.html</code> on the observatory's screen and sign in there to pair it.
        </p>
      )}
      <ul className="rows">
        {observatories.map((observatory, index) => (
          <li key={observatory.id}>
            <span className="row-main">
              Observatory {index + 1}:{" "}
              {observatory.parts.map((part, partIndex) => (
                <span key={partIndex} className={`chip ${part.online ? "online" : "offline"}`}>
                  {part.kind === "unit" ? "printer + scanner" : part.kind} {part.online ? "online" : "offline"}
                </span>
              ))}
            </span>
            <span className="row-actions">
              <button onClick={() => makeCode(observatory.id)}>Pair a printer or scanner</button>
              <button
                className="danger"
                onClick={async () => {
                  if (await confirmFirst("Unpair this observatory? Its screen, printer and scanner will all need pairing again.", { action: "Unpair" })) {
                    await api("DELETE", `/api/observatories/${observatory.id}`);
                    await load();
                  }
                }}
              >
                Unpair
              </button>
            </span>
            {codes[observatory.id] && <PairingCode made={codes[observatory.id]!} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A pairing code for a printer, scanner or unit to type (or read), and until when it works. */
function PairingCode({ made }: { made: { code: string; expiresAt: string } | { error: string } }) {
  if ("error" in made) return <p role="alert">{made.error}</p>;
  const until = new Date(made.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <p className="pairing-code">
      Pairing code: <strong className="big-code">{made.code}</strong> (works once, until {until})
    </p>
  );
}

function DeleteChart({ me }: { me: Me }) {
  const [error, setError] = useState<string | undefined>();

  const deleteChart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { confirmName } = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api("DELETE", "/api/chart", { confirmName });
    if (result.ok) location.reload();
    else setError(result.data?.error);
  };

  return (
    <section className="danger-zone">
      <h2>Delete this chart</h2>
      <p>
        This permanently deletes {me.chart.name}: every child, star, ticket and grown-up login, and unpairs its observatories.
        It can't be undone.
      </p>
      <form onSubmit={deleteChart} className="fields">
        <label className="grow">
          <span>
            Type <strong>{me.chart.name}</strong> to confirm
          </span>
          <input name="confirmName" autoComplete="off" required />
        </label>
        <button type="submit" className="danger">
          Delete everything
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function SettingsPage({ me, account }: { me: Me; account: ReactNode }) {
  return (
    <>
      <PageTitle title="Settings" />
      <section>
        <h2>You</h2>
        <p>
          Signed in as <strong>{me.grownUp.email}</strong> ({me.grownUp.role}). The chart's time zone is {me.chart.timeZone}.
        </p>
        <div className="actions">{account}</div>
      </section>
      {onObservatory && <ObservatoryTools />}
      {!onObservatory && (
        <section>
          <h2>Notifications</h2>
          <NotificationsSwitch />
        </section>
      )}
      {manages(me) && <Observatories />}
      {manages(me) && !onObservatory && (
        <section>
          <FeedKeys />
        </section>
      )}
      {me.grownUp.role === "owner" && !onObservatory && <DeleteChart me={me} />}
    </>
  );
}
