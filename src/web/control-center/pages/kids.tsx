// Kids: one card per child, with their stars (spend, history) and their settings (name, pictures or words, remove).
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../shared/api.js";
import { askForText, confirmFirst } from "../../shared/dialog.js";
import { StarHistoryList, type StarHistory } from "../../shared/star-history.js";
import type { Child } from "../common.js";
import { PageTitle } from "../shell.js";

function KidCard({ child, onChanged }: { child: Child; onChanged: () => Promise<void> }) {
  const [history, setHistory] = useState<StarHistory | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", `/api/children/${child.id}/star-history`);
    if (result.ok) setHistory(result.data);
  };

  useEffect(() => {
    void load();
  }, [child.id]);

  const change = async (body: object) => {
    const result = await api("PATCH", `/api/children/${child.id}`, body);
    setMessage(result.ok ? undefined : (result.data?.error ?? "Something went wrong."));
    await onChanged();
  };

  const rename = async () => {
    const nickname = await askForText("New nickname", { action: "Rename", defaultValue: child.nickname });
    if (nickname) await change({ nickname });
  };

  const remove = async () => {
    const sure = await confirmFirst(`Remove ${child.nickname}? This permanently deletes their stars, tickets and history. It can't be undone.`, {
      action: `Remove ${child.nickname}`,
    });
    if (!sure) return;
    await api("DELETE", `/api/children/${child.id}`);
    await onChanged();
  };

  const spend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await api("POST", `/api/children/${child.id}/redemptions`, { amount: Number(data.get("amount")), note: data.get("note") });
    setMessage(result.ok ? undefined : result.data?.error);
    if (result.ok) form.reset();
    await load();
  };

  return (
    <section className="kid" aria-label={child.nickname}>
      <div className="kid-head">
        <h2>{child.nickname}</h2>
        <span className="balance">{history?.balance ?? "…"} ★</span>
      </div>
      <p className="hint">
        {history ? `${history.earned} earned in all, ${history.spent} spent.` : " "}
      </p>

      <form onSubmit={spend} className="fields">
        <label>
          Spend
          <input name="amount" type="number" min={1} max={history?.balance ?? 0} required className="narrow" />
        </label>
        <label className="grow">
          On
          <input name="note" placeholder="Ice cream" maxLength={100} required />
        </label>
        <button type="submit" className="primary">
          Record
        </button>
      </form>
      {message && <p role="alert">{message}</p>}

      <div className="actions">
        <button type="button" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
          {showHistory ? "Hide" : "Show"} star history
        </button>
        <label className="inline">
          Sees
          <select value={child.displayStyle} onChange={(event) => change({ displayStyle: event.target.value })}>
            <option value="pictures">pictures</option>
            <option value="words">words</option>
          </select>
        </label>
        <button type="button" onClick={rename}>
          Rename
        </button>
        <button type="button" className="danger" onClick={remove}>
          Remove
        </button>
      </div>
      {showHistory && history && <StarHistoryList history={history} />}
    </section>
  );
}

export function KidsPage() {
  const [children, setChildren] = useState<Child[] | undefined>();
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", "/api/children");
    if (result.ok) setChildren(result.data.children);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { nickname, displayStyle } = Object.fromEntries(new FormData(form));
    const result = await api("POST", "/api/children", { nickname, displayStyle });
    setError(result.ok ? undefined : (result.data?.error ?? "Something went wrong."));
    if (result.ok) form.reset();
    await load();
  };

  return (
    <>
      <PageTitle title="Kids" />
      {children?.length === 0 && <p className="empty">No children yet.</p>}
      {children?.map((child) => <KidCard key={child.id} child={child} onChanged={load} />)}
      <section>
        <h2>Add a child</h2>
        <p className="hint">Just a nickname: Star Chart keeps as little about children as it can.</p>
        <form onSubmit={add} className="fields">
          <label className="grow">
            Nickname
            <input name="nickname" maxLength={40} required />
          </label>
          <label>
            Sees
            <select name="displayStyle" defaultValue="words">
              <option value="pictures">pictures (can't read yet)</option>
              <option value="words">words</option>
            </select>
          </label>
          <button type="submit" className="primary">
            Add child
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </section>
    </>
  );
}
