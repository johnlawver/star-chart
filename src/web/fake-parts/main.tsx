import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, stored } from "../shared/api.js";
import { useLiveConnection } from "../shared/live.js";
import { Receipt, type PrintJob } from "./receipt.js";

// A stand-in for a real printer or scanner. It pairs and connects to the server exactly as real hardware will
// (ADR 0003): a pairing code, then a live connection opened outward, starting with a hello carrying its credential.

type Kind = "printer" | "scanner";
const kind = document.body.dataset.kind as Kind;
const tokenKey = `star-chart.fake-${kind}.deviceToken`;

function FakePart() {
  const [deviceToken, setDeviceToken] = useState(stored.get(tokenKey));
  const save = (token: string | undefined) => {
    stored.set(tokenKey, token);
    setDeviceToken(token);
  };
  return (
    <main>
      <h1>Fake {kind}</h1>
      {deviceToken ? <Connected deviceToken={deviceToken} onUnpaired={() => save(undefined)} /> : <Pair onPaired={save} />}
    </main>
  );
}

function Pair({ onPaired }: { onPaired: (token: string) => void }) {
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { code } = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api("POST", "/api/parts", { code, kind });
    if (result.ok) onPaired(result.data.deviceToken);
    else setError(result.data?.error ?? "Couldn't pair.");
  };

  return (
    <form onSubmit={submit}>
      <p>Enter the pairing code shown on the observatory.</p>
      <label>
        Pairing code <input name="code" autoComplete="off" autoCapitalize="characters" required />
      </label>
      <button type="submit">Pair</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function Connected({ deviceToken, onUnpaired }: { deviceToken: string; onUnpaired: () => void }) {
  const [printed, setPrinted] = useState<PrintJob[]>([]);
  const [lastScan, setLastScan] = useState<string | undefined>();
  const { status, send } = useLiveConnection(
    deviceToken,
    (message) => {
      if (message.type === "print" && kind === "printer") setPrinted((jobs) => [message.ticket, ...jobs]);
      if (message.type === "scan-result" && kind === "scanner") setLastScan(message.result);
    },
    onUnpaired,
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
      <p>Status: {status}</p>
      <button onClick={onUnpaired}>Forget pairing</button>
      {kind === "scanner" && (
        <form onSubmit={scan}>
          <label>
            Ticket code <input name="code" autoComplete="off" autoCapitalize="characters" required autoFocus />
          </label>
          <button type="submit">Scan</button>
          {lastScan && <p>Last scan: {lastScan}</p>}
        </form>
      )}
      {kind === "printer" && (
        <section>
          <h2>Printed tickets</h2>
          {printed.length === 0 && <p>Nothing printed yet.</p>}
          {printed.map((job) => (
            <Receipt key={`${job.id}-${printed.indexOf(job)}`} job={job} />
          ))}
        </section>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FakePart />
  </StrictMode>,
);
