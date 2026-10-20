import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";

// The Control Center, deliberately plain for now: sign up, sign in, and see your chart.

interface Me {
  grownUp: { email: string; role: string };
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

function ControlCenter() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const refresh = async () => {
    const result = await api("GET", "/api/me");
    setMe(result.ok ? result.data : null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (me === undefined) return <p>Loading…</p>;
  if (me === null) return <SignedOut onSignedIn={refresh} />;
  return (
    <main>
      <h1>{me.chart.name}</h1>
      <p>
        Signed in as {me.grownUp.email} ({me.grownUp.role}). Time zone: {me.chart.timeZone}.
      </p>
      <button onClick={async () => (await api("POST", "/api/sign-out"), refresh())}>Sign out</button>
      <ChildrenSection />
      <ChoresSection />
      {me.grownUp.role === "owner" && <ObservatoriesSection />}
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
                if (window.confirm(`Remove ${child.nickname}? This can't be undone.`)) {
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
      <button onClick={() => (setError(undefined), setMode(mode === "sign-in" ? "sign-up" : "sign-in"))}>
        {mode === "sign-in" ? "New here? Create a chart" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}


interface ObservatorySummary {
  id: string;
  parts: { kind: "screen" | "printer" | "scanner" }[];
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
            Observatory {index + 1}: {observatory.parts.map((part) => part.kind).join(", ")}{" "}
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

interface CategoryWithChores {
  id: string;
  name: string;
  kind: "chore" | "quiz";
  chores: { id: string; name: string; stars: number; childIds: string[] }[];
}

function ChoresSection() {
  const [categories, setCategories] = useState<CategoryWithChores[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    const [categoryResult, childResult] = await Promise.all([api("GET", "/api/categories"), api("GET", "/api/children")]);
    if (categoryResult.ok) setCategories(categoryResult.data.categories);
    if (childResult.ok) setChildren(childResult.data.children);
  };

  useEffect(() => {
    void load();
  }, []);

  const nicknameOf = (id: string) => children.find((child) => child.id === id)?.nickname ?? "?";

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { name } = Object.fromEntries(new FormData(form));
    const result = await api("POST", "/api/categories", { name, kind: "chore" });
    setError(result.ok ? undefined : result.data?.error);
    form.reset();
    await load();
  };

  const addChore = async (event: FormEvent<HTMLFormElement>, categoryId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await api("POST", "/api/chores", {
      categoryId,
      name: data.get("name"),
      stars: Number(data.get("stars")),
      childIds: data.getAll("childIds"),
    });
    setError(result.ok ? undefined : result.data?.error);
    form.reset();
    await load();
  };

  return (
    <section>
      <h2>Chores</h2>
      {categories.map((category) => (
        <div key={category.id}>
          <h3>{category.name}</h3>
          <ul>
            {category.chores.map((chore) => (
              <li key={chore.id}>
                {chore.name}: {chore.stars} ★, for {chore.childIds.map(nicknameOf).join(", ") || "nobody yet"}
              </li>
            ))}
          </ul>
          <form onSubmit={(event) => addChore(event, category.id)}>
            <label>
              Chore <input name="name" maxLength={60} required />
            </label>{" "}
            <label>
              Stars <input name="stars" type="number" min={0} max={100} defaultValue={1} required />
            </label>{" "}
            {children.map((child) => (
              <label key={child.id}>
                <input type="checkbox" name="childIds" value={child.id} /> {child.nickname}
              </label>
            ))}{" "}
            <button type="submit">Add chore</button>
          </form>
        </div>
      ))}
      <form onSubmit={addCategory}>
        <label>
          New chore category <input name="name" placeholder="Chores" maxLength={60} required />
        </label>{" "}
        <button type="submit">Add category</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ControlCenter />
  </StrictMode>,
);
