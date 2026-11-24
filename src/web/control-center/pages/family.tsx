// Family: the grown-ups in this chart, your own PIN for the observatory, and Guest PINs for babysitters.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../shared/api.js";
import { confirmFirst } from "../../shared/dialog.js";
import { onObservatory, type Me } from "../common.js";

function GrownUps({ me }: { me: Me }) {
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

  const mayRemove = (mine: string, theirs: string) => (mine === "owner" && theirs !== "owner") || (mine === "admin" && theirs === "grown-up");

  const remove = async (grownUp: { id: string; email: string }) => {
    if (!(await confirmFirst(`Remove ${grownUp.email}? Their login is deleted.`, { action: "Remove" }))) return;
    const result = await api("DELETE", `/api/grown-ups/${grownUp.id}`);
    setMessage(result.ok ? undefined : result.data?.error);
    await load();
  };

  const handOver = async (grownUp: { id: string; email: string }) => {
    if (!(await confirmFirst(`Make ${grownUp.email} the owner? You'll become an admin.`, { action: "Make them the owner" }))) return;
    const result = await api("POST", "/api/ownership", { grownUpId: grownUp.id });
    if (result.ok) location.reload();
    else setMessage(result.data?.error);
  };

  const leave = async () => {
    if (!(await confirmFirst("Leave this chart? Your login is deleted.", { action: "Leave" }))) return;
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
      <ul className="rows">
        {grownUps.map((grownUp) => (
          <li key={grownUp.id}>
            <span className="row-main">
              {grownUp.email}
              {grownUp.id === me.grownUp.id ? " (you)" : ""} <span className="chip">{grownUp.role}</span>
            </span>
            <span className="row-actions">
              {me.grownUp.role === "owner" && grownUp.role === "grown-up" && <button onClick={() => setRole(grownUp.id, "admin")}>Make admin</button>}
              {me.grownUp.role === "owner" && grownUp.role === "admin" && (
                <>
                  <button onClick={() => setRole(grownUp.id, "grown-up")}>Make grown-up</button>
                  <button onClick={() => handOver(grownUp)}>Hand over the chart</button>
                </>
              )}
              {grownUp.id !== me.grownUp.id && mayRemove(me.grownUp.role, grownUp.role) && (
                <button className="danger" onClick={() => remove(grownUp)}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {me.grownUp.role !== "grown-up" && (
        <form onSubmit={invite} className="fields">
          <label className="grow">
            Invite by email
            <input name="email" type="email" required />
          </label>
          <button type="submit" className="primary">
            Send invitation
          </button>
        </form>
      )}
      {me.grownUp.role !== "owner" && (
        <div className="actions">
          <button className="danger" onClick={leave}>
            Leave this chart
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

function MyPin() {
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
      <p className="hint">Your PIN opens this Control Center on the observatory.</p>
      <form onSubmit={save} className="fields">
        <label>
          New PIN
          <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" required autoComplete="off" />
        </label>
        <button type="submit" className="primary">
          Save
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

function GuestPins() {
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
      <p className="hint">For a babysitter: a PIN that opens just the tickets on the observatory, for a few hours.</p>
      <form onSubmit={make} className="fields">
        <label className="grow">
          Who's it for?
          <input name="label" placeholder="Saturday sitter" maxLength={60} />
        </label>
        <label>
          Lasts
          <select name="hours" defaultValue="12">
            {[3, 6, 12, 24, 48].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hours
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary">
          Make a Guest PIN
        </button>
      </form>
      {madePin && (
        <p role="status">
          Their PIN is <strong className="big-code">{madePin}</strong>. Write it down now; it won't be shown again.
        </p>
      )}
      <ul className="rows">
        {pins.map((pin) => (
          <li key={pin.id}>
            <span className="row-main">
              {pin.label ?? "Guest"}, until {new Date(pin.expiresAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="row-actions">
              <button onClick={() => cancel(pin.id)}>Cancel</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FamilyPage({ me }: { me: Me }) {
  return (
    <>
      <GrownUps me={me} />
      <MyPin />
      {!onObservatory && <GuestPins />}
    </>
  );
}
