export interface StarHistory {
  earned: number;
  spent: number;
  balance: number;
  entries: { kind: "earned" | "spent"; amount: number; what: string; at: string }[];
}

/** A child's star history as a plain list. */
export function StarHistoryList({ history }: { history: StarHistory }) {
  return (
    <div>
      <p>
        Earned {history.earned} ★ · spent {history.spent} ★ · {history.balance} ★ left
      </p>
      {history.entries.length === 0 && <p>No stars yet.</p>}
      <ul>
        {history.entries.map((entry, index) => (
          <li key={index}>
            {entry.kind === "earned" ? "+" : "−"}
            {entry.amount} ★ {entry.what}{" "}
            <small>{new Date(entry.at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
