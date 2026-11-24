// Tickets: what's waiting for a grown-up (handed in, or lost and needing a reprint), and what's still out.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../shared/api.js";
import { askForText, confirmFirst } from "../../shared/dialog.js";
import { AnswerKey } from "../quizzes.js";

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
    <section>
      <h2>Lost tickets</h2>
      <ul className="rows">
        {requests.map((request) => (
          <li key={request.id}>
            <span className="row-main">
              <strong>{request.childNickname}</strong> lost "{request.title}"
            </span>
            <span className="row-actions">
              <button className="primary" onClick={() => answer(request.id, "approve")}>
                Print again
              </button>
              <button onClick={() => answer(request.id, "decline")}>No</button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function TicketsPage() {
  const [waiting, setWaiting] = useState<WaitingTicket[]>([]);
  const [open, setOpen] = useState<WaitingTicket[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const [handedIn, stillOpen] = await Promise.all([api("GET", "/api/tickets?state=handed-in"), api("GET", "/api/tickets?state=open")]);
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

  const reject = async (ticket: WaitingTicket) => {
    const note = await askForText(`Why isn't "${ticket.title}" done yet? (optional)`, { action: "Not done yet", optional: true });
    if (note === null) return;
    return act(api("POST", `/api/tickets/${ticket.id}/reject`, note ? { note } : {}));
  };

  const dismiss = async (ticket: WaitingTicket) => {
    if (!(await confirmFirst(`Dismiss ${ticket.childNickname}'s "${ticket.title}" ticket? No stars will be given.`, { action: "Dismiss" }))) return;
    return act(api("POST", `/api/tickets/${ticket.id}/dismiss`, {}));
  };

  const row = (ticket: WaitingTicket, handedIn: boolean) => (
    <li key={ticket.id} className="ticket">
      <form onSubmit={(event) => approve(event, ticket)}>
        <span className="row-main">
          <span className="chip">{ticket.childNickname}</span> {ticket.title}
        </span>
        <span className="row-actions">
          <label className="inline">
            <input name="stars" type="number" min={0} max={100} defaultValue={ticket.stars} className="narrow" aria-label="Stars" /> ★
          </label>
          {ticket.answerKey && (
            <label className="inline">
              Score <input name="correct" type="number" min={0} max={ticket.answerKey.length} className="narrow" /> / {ticket.answerKey.length}
            </label>
          )}
          <button type="submit" className="primary">
            Approve
          </button>
          {handedIn && (
            <button type="button" onClick={() => reject(ticket)}>
              Not yet
            </button>
          )}
          <button type="button" className="quiet" onClick={() => dismiss(ticket)}>
            Dismiss
          </button>
        </span>
      </form>
      {ticket.answerKey && <AnswerKey items={ticket.answerKey} />}
    </li>
  );

  return (
    <>
      <section>
        <h2>Waiting for you</h2>
        {waiting.length === 0 && <p className="empty">Nothing to check right now.</p>}
        <ul className="rows">{waiting.map((ticket) => row(ticket, true))}</ul>
        {error && <p role="alert">{error}</p>}
      </section>
      <LostTickets onChange={load} />
      <section>
        <h2>Still open</h2>
        <p className="hint">Printed, but not handed in yet.</p>
        {open.length === 0 && <p className="empty">No open tickets.</p>}
        <ul className="rows">{open.map((ticket) => row(ticket, false))}</ul>
      </section>
    </>
  );
}
