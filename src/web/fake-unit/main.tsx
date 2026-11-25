import { StrictMode, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { stored } from "../shared/api.js";
import { useLiveConnection } from "../shared/live.js";
import { readHandshake, setupGuideLink, type Handshake } from "../shared/unit-setup.js";
import { Receipt, Slip, type PrintJob } from "../fake-parts/receipt.js";

// A stand-in for the real unit (an ESP32 with a camera and a thermal printer), for building and testing setup without
// the hardware. It does what the firmware will: print a Setup Guide, read a Handshake QR, "join" the Wi-Fi, pair as a
// unit with the code, connect to the server it was given, then print tickets and scan them. See
// .scratch/printer-unit/spec.md. Development builds only.

const savedKey = "star-chart.fake-unit";
const nameKey = "star-chart.fake-unit.name";

/** Made-up networks the unit "found", strongest first. */
const networksFound = ["HomeWiFi", "Neighbours 2.4", "Coffee Shop Guest"];

interface Saved {
  server: string;
  network: string;
  deviceToken: string;
}

/** The unit's short name: in the real unit, the last 4 hex digits of its Wi-Fi MAC address. Kept across resets. */
function unitName(): string {
  const existing = stored.get(nameKey);
  if (existing) return existing;
  const made = Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0");
  stored.set(nameKey, made);
  return made;
}

function readSaved(): Saved | undefined {
  try {
    const text = stored.get(savedKey);
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

function FakeUnit() {
  const [saved, setSaved] = useState(readSaved);
  const [justPaired, setJustPaired] = useState(false);
  const name = unitName();

  const reset = () => {
    stored.set(savedKey, undefined);
    setSaved(undefined);
    setJustPaired(false);
  };
  const paired = (now: Saved) => {
    stored.set(savedKey, JSON.stringify(now));
    setSaved(now);
    setJustPaired(true);
  };

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 760 }}>
      <h1>Fake unit {name}</h1>
      <p>
        Stands in for the printer-scanner unit. The slips below are what it would print. <button onClick={reset}>Reset</button>
      </p>
      {saved ? <AtWork saved={saved} name={name} justPaired={justPaired} onUnpaired={reset} /> : <SettingUp name={name} onPaired={paired} />}
    </main>
  );
}

type Problem = { title: string; detail: string };

/** Not set up yet: print the Setup Guide, then wait for a Handshake QR. */
function SettingUp({ name, onPaired }: { name: string; onPaired: (saved: Saved) => void }) {
  const [problem, setProblem] = useState<Problem | undefined>();
  const [joining, setJoining] = useState<Handshake | undefined>();

  const tryHandshake = async (text: string) => {
    const read = readHandshake(text.trim());
    if (!read.ok) {
      return setProblem(
        read.problem === "unknown-version"
          ? { title: "I need an update", detail: "That setup code is from a newer Star Chart than mine. Update me, then try again." }
          : { title: "That's not a setup code", detail: "Scan the Setup Guide below with your phone, then show me the code it makes." },
      );
    }
    setProblem(undefined);
    setJoining(read);
    // The real unit joins the Wi-Fi here. The fake one is already online, so it goes straight to pairing.
    const server = read.server.replace(/\/$/, "");
    let response: Response;
    try {
      response = await fetch(`${server}/api/parts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: read.code, kind: "unit" }),
      });
    } catch {
      setJoining(undefined);
      return setProblem({ title: "I couldn't reach the server", detail: `I joined ${read.network}, but couldn't reach ${server}. Check the network has internet.` });
    }
    setJoining(undefined);
    if (response.ok) {
      const { deviceToken } = await response.json();
      return onPaired({ server, network: read.network, deviceToken });
    }
    if (response.status === 429) return setProblem({ title: "Too many tries", detail: "Wait a few minutes, then make a new code on your phone." });
    setProblem({ title: "That code didn't work", detail: "It has expired or was already used. Make a new one on your phone." });
  };

  return (
    <>
      {problem && (
        <Slip>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>{problem.title}</div>
          <p>{problem.detail}</p>
        </Slip>
      )}
      {joining && (
        <p role="status">
          Joining {joining.network} (password {"•".repeat(joining.password.length) || "none"})…
        </p>
      )}
      <SetupGuide name={name} />
      <ReadHandshake onRead={tryHandshake} />
    </>
  );
}

/** The slip the unit prints when it isn't set up: its name, and a QR that opens the setup page on a phone. */
function SetupGuide({ name }: { name: string }) {
  const link = setupGuideLink(location.origin, name, networksFound);
  const [qr, setQr] = useState<string | undefined>();
  useEffect(() => {
    void QRCode.toDataURL(link, { margin: 2, width: 256, color: { dark: "#000000", light: "#ffffff" } }).then(setQr);
  }, [link]);

  return (
    <Slip>
      <div style={{ fontSize: 20 }}>Star Chart unit</div>
      <div style={{ fontSize: 44, fontWeight: "bold", letterSpacing: 4 }}>{name}</div>
      <p>1. Scan this with your phone.</p>
      {qr && <img src={qr} alt="Setup Guide QR" data-link={link} width={256} height={256} style={{ imageRendering: "pixelated" }} />}
      <p>2. Hold your phone's code up to my camera.</p>
      <div style={{ fontSize: 12, wordBreak: "break-all" }}>{link}</div>
    </Slip>
  );
}

/** Reads a Handshake QR: pasted as text, or with the computer's camera where the browser can read QR codes. */
function ReadHandshake({ onRead }: { onRead: (text: string) => void }) {
  const [watching, setWatching] = useState(false);
  const canUseCamera = "BarcodeDetector" in window;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { handshake } = Object.fromEntries(new FormData(event.currentTarget));
    onRead(String(handshake));
  };

  return (
    <section>
      <h2>Show me a Handshake QR</h2>
      <form onSubmit={submit}>
        <label>
          Paste its text <textarea name="handshake" rows={2} style={{ width: "100%" }} required />
        </label>
        <button type="submit">Read it</button>
      </form>
      {canUseCamera && !watching && <button onClick={() => setWatching(true)}>Use the camera</button>}
      {watching && (
        <Camera
          onRead={(text) => {
            setWatching(false);
            onRead(text);
          }}
        />
      )}
    </section>
  );
}

function Camera({ onRead }: { onRead: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        return setError("Couldn't open the camera.");
      }
      if (!video.current) return;
      video.current.srcObject = stream;
      await video.current.play();
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      timer = setInterval(async () => {
        const found = video.current && (await detector.detect(video.current).catch(() => []));
        if (found?.[0]?.rawValue) onRead(found[0].rawValue);
      }, 300);
    })();
    return () => {
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return error ? <p role="alert">{error}</p> : <video ref={video} width={320} height={240} muted playsInline />;
}

/** Paired: print what the server sends, and scan tickets by typing their code. */
function AtWork({ saved, name, justPaired, onUnpaired }: { saved: Saved; name: string; justPaired: boolean; onUnpaired: () => void }) {
  const [printed, setPrinted] = useState<PrintJob[]>([]);
  const [lastScan, setLastScan] = useState<string | undefined>();
  const { status, send } = useLiveConnection(
    saved.deviceToken,
    (message) => {
      if (message.type === "print") setPrinted((jobs) => [message.ticket, ...jobs]);
      if (message.type === "scan-result") setLastScan(message.result);
    },
    onUnpaired,
    saved.server,
  );

  const scan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { code } = Object.fromEntries(new FormData(form));
    send({ type: "scan", code: String(code).trim() });
    form.reset();
  };

  return (
    <>
      <p>
        On {saved.network}, connected to {saved.server}: <strong>{status}</strong>
      </p>
      <form onSubmit={scan}>
        <label>
          Scan a ticket: code <input name="code" autoComplete="off" autoCapitalize="characters" required />
        </label>
        <button type="submit">Scan</button>
        {lastScan && <span> Last scan: {lastScan}</span>}
      </form>
      <h2>Printed</h2>
      {printed.map((job, index) => (
        <Receipt key={`${job.id}-${index}`} job={job} />
      ))}
      {justPaired && <AllSet name={name} />}
    </>
  );
}

function AllSet({ name }: { name: string }): ReactNode {
  return (
    <Slip>
      <div style={{ fontSize: 32, fontWeight: "bold" }}>All set!</div>
      <p>Unit {name} is ready to print tickets and scan them.</p>
    </Slip>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FakeUnit />
  </StrictMode>,
);
