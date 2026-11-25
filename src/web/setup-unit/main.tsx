import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { api } from "../shared/api.js";
import { makeHandshake, readSetupGuide } from "../shared/unit-setup.js";
import { manages, type GuestMe, type Me } from "../control-center/common.js";
import "../control-center/styles.css";

// The page a unit's Setup Guide QR opens on a grown-up's phone (.scratch/printer-unit/spec.md). The grown-up signs in,
// picks the observatory and the Wi-Fi network, types its password, and gets a Handshake QR to show the unit's camera.
// The unit's name and the networks it found come after the "#", and the Wi-Fi password goes only into the QR, made
// here in the browser: neither ever reaches the server.

const guide = readSetupGuide(location.hash);

/** How often to look for the unit coming online while the Handshake QR is showing. */
const watchEveryMs = 2000;

interface Observatory {
  id: string;
  parts: { kind: string; online: boolean }[];
}

function SetupUnit() {
  const [me, setMe] = useState<Me | GuestMe | null | undefined>();

  const loadMe = async () => {
    const result = await api("GET", "/api/me");
    setMe(result.ok ? result.data : null);
  };
  useEffect(() => {
    void loadMe();
  }, []);

  return (
    <main className="cc-main setup-unit">
      <h1>{guide.unit ? `Setting up unit ${guide.unit}` : "Setting up a unit"}</h1>
      {me === undefined && <p className="hint">Loading…</p>}
      {me === null && <SignIn onSignedIn={loadMe} />}
      {me && ("guest" in me || !manages(me)) && (
        <section>
          <p>Only the chart's owner or an admin can set up a unit. Ask one of them to scan the unit's Setup Guide.</p>
        </section>
      )}
      {me && !("guest" in me) && manages(me) && <ChooseAndShow />}
    </main>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await api("POST", "/api/sign-in", Object.fromEntries(new FormData(event.currentTarget)));
    if (result.ok) onSignedIn();
    else setError(result.data?.error ?? "Couldn't sign in.");
  };

  return (
    <section>
      <h2>Sign in to carry on</h2>
      <form onSubmit={submit} className="stack">
        <label>
          Email <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="primary">
          Sign in
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

type Made = { qr: string; handshake: string; expiresAt: number; observatoryId: string; unitsBefore: number };

/** Count of units online at an observatory, so the page can tell when this one joins. */
const unitsOnline = (observatory: Observatory | undefined) => observatory?.parts.filter((part) => part.kind === "unit" && part.online).length ?? 0;

function ChooseAndShow() {
  const [observatories, setObservatories] = useState<Observatory[] | undefined>();
  const [observatoryId, setObservatoryId] = useState<string | undefined>();
  const [network, setNetwork] = useState<string>(guide.networks[0] ?? "");
  const [typingNetwork, setTypingNetwork] = useState(guide.networks.length === 0);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [made, setMade] = useState<Made | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const result = await api("GET", "/api/observatories");
      if (!result.ok) return setError("Couldn't load your observatories.");
      setObservatories(result.data.observatories);
      if (result.data.observatories.length === 1) setObservatoryId(result.data.observatories[0].id);
    })();
  }, []);

  const makeCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!observatoryId) return setError("Choose which observatory this unit is for.");
    if (!network.trim()) return setError("Choose or type the Wi-Fi network.");
    setError(undefined);
    const [code, current] = await Promise.all([
      api("POST", `/api/observatories/${observatoryId}/pairing-codes`),
      api("GET", "/api/observatories"),
    ]);
    if (!code.ok) return setError(code.data?.error ?? "Couldn't make a code. Try again.");
    const handshake = makeHandshake({ network: network.trim(), password, server: location.origin, code: code.data.code });
    // A generous quiet zone and medium error correction, for a modest camera reading a glossy phone screen.
    const qr = await QRCode.toDataURL(handshake, { errorCorrectionLevel: "M", margin: 4, width: 320, color: { dark: "#000000", light: "#ffffff" } });
    const before = current.ok ? (current.data.observatories as Observatory[]).find((one) => one.id === observatoryId) : undefined;
    setMade({ qr, handshake, expiresAt: Date.parse(code.data.expiresAt), observatoryId, unitsBefore: unitsOnline(before) });
  };

  if (error && !observatories) return <p role="alert">{error}</p>;
  if (!observatories) return <p className="hint">Loading…</p>;
  if (observatories.length === 0) {
    return (
      <section>
        <p>This chart has no observatory yet. Set up its screen first: open /observatory.html on it and sign in there.</p>
      </section>
    );
  }
  if (made) return <ShowHandshake made={made} onAgain={() => setMade(undefined)} />;

  return (
    <form onSubmit={makeCode} className="stack setup-unit-form">
      {observatories.length > 1 && (
        <section>
          <h2>Which observatory is it for?</h2>
          {observatories.map((observatory, index) => (
            <label key={observatory.id} className="inline">
              <input type="radio" name="observatory" checked={observatoryId === observatory.id} onChange={() => setObservatoryId(observatory.id)} />
              Observatory {index + 1}
            </label>
          ))}
        </section>
      )}
      <section>
        <h2>Wi-Fi network</h2>
        <p className="hint">The unit needs a 2.4 GHz network. It can't join 5 GHz-only networks, or ones with a sign-in page.</p>
        {guide.networks.map((name) => (
          <label key={name} className="inline">
            <input
              type="radio"
              name="network"
              checked={!typingNetwork && network === name}
              onChange={() => {
                setTypingNetwork(false);
                setNetwork(name);
              }}
            />
            {name}
          </label>
        ))}
        {guide.networks.length > 0 && (
          <label className="inline">
            <input
              type="radio"
              name="network"
              checked={typingNetwork}
              onChange={() => {
                setTypingNetwork(true);
                setNetwork("");
              }}
            />
            My network isn't listed
          </label>
        )}
        {typingNetwork && (
          <label>
            Network name <input value={network} onChange={(event) => setNetwork(event.target.value)} autoCapitalize="none" autoCorrect="off" required />
          </label>
        )}
      </section>
      <section>
        <h2>Wi-Fi password</h2>
        <div className="password-row">
          <label className="grow">
            Password
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
            />
          </label>
          <button type="button" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="hint">Leave it empty for an open network. It goes only into the code on your screen, never to Star Chart.</p>
      </section>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="primary">
        Make the code
      </button>
    </form>
  );
}

/** The Handshake QR, until the unit comes online (All set) or the pairing code runs out (make a new one). */
function ShowHandshake({ made, onAgain }: { made: Made; onAgain: () => void }) {
  const [state, setState] = useState<"showing" | "all-set" | "expired">("showing");

  useEffect(() => {
    if (state !== "showing") return;
    const watch = setInterval(async () => {
      if (Date.now() >= made.expiresAt) return setState("expired");
      const result = await api("GET", "/api/observatories");
      const observatory = result.ok ? (result.data.observatories as Observatory[]).find((one) => one.id === made.observatoryId) : undefined;
      if (unitsOnline(observatory) > made.unitsBefore) setState("all-set");
    }, watchEveryMs);
    return () => clearInterval(watch);
  }, [state]);

  if (state === "all-set") {
    return (
      <section role="status">
        <h2>All set</h2>
        <p>The unit is connected. It prints "All set!" too. Tickets will print on it from now on.</p>
      </section>
    );
  }
  if (state === "expired") {
    return (
      <section>
        <h2>That code has run out</h2>
        <p>Codes work for 10 minutes. Make a new one and show it to the unit again.</p>
        <button className="primary" onClick={onAgain}>
          Make a new code
        </button>
      </section>
    );
  }
  return (
    <section className="handshake">
      <h2>Hold this up to the unit's camera</h2>
      <p className="hint">Turn your screen's brightness up. Keep the phone still, about a hand's width away.</p>
      <img src={made.qr} alt="Handshake QR for the unit" data-handshake={made.handshake} width={320} height={320} />
      <div className="actions">
        <button onClick={onAgain}>Change the network or password</button>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SetupUnit />
  </StrictMode>,
);
