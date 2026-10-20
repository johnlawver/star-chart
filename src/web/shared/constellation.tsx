export interface Constellation {
  earned: number;
  spent: number;
  balance: number;
  entries: { kind: "earned" | "spent"; amount: number; what: string; at: string }[];
}

/** A child's constellation as a plain list. The observatory's design phase will give it a proper look. */
export function ConstellationList({ constellation }: { constellation: Constellation }) {
  return (
    <div>
      <p>
        Earned {constellation.earned} ★ · spent {constellation.spent} ★ · {constellation.balance} ★ left
      </p>
      {constellation.entries.length === 0 && <p>No stars yet.</p>}
      <ul>
        {constellation.entries.map((entry, index) => (
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
