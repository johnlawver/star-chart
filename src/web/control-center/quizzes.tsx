import { useState, type FormEvent } from "react";
import { api } from "../shared/api.js";
import { Icon, IconPicker } from "../shared/icons.js";

// The Control Center's quiz screens, deliberately plain: topics and who has them at which level, writing a quiz,
// and the chart's quiz settings.

export interface Topic {
  id: string;
  name: string;
  stars: number;
  icon: string | null;
  samples: string | null;
  children: { childId: string; level: number }[];
}

interface Child {
  id: string;
  nickname: string;
}

const sampleSets = [
  { id: "", label: "(none: grown-ups or the quiz feed write them)" },
  { id: "addition", label: "Addition" },
  { id: "subtraction", label: "Subtraction" },
  { id: "letters", label: "Letters" },
  { id: "numbers", label: "Numbers" },
  { id: "spelling", label: "Spelling" },
];

/** A quiz category: its topics, each child's level in each, and adding topics. */
export function QuizCategory(props: {
  category: { id: string; name: string; topics: Topic[] };
  children: Child[];
  onChange: () => void;
}) {
  const { category, children, onChange } = props;
  const [error, setError] = useState<string | undefined>();

  const setLevel = async (topicId: string, childId: string, level: number | null) => {
    const result =
      level === null
        ? await api("DELETE", `/api/topics/${topicId}/children/${childId}`)
        : await api("PUT", `/api/topics/${topicId}/children/${childId}`, { level });
    setError(result.ok ? undefined : result.data?.error);
    onChange();
  };

  const addTopic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await api("POST", "/api/topics", {
      categoryId: category.id,
      name: data.get("name"),
      stars: Number(data.get("stars")),
      ...(data.get("icon") ? { icon: data.get("icon") } : {}),
      ...(data.get("samples") ? { samples: data.get("samples") } : {}),
    });
    setError(result.ok ? undefined : result.data?.error);
    if (result.ok) form.reset();
    onChange();
  };

  return (
    <div>
      <ul>
        {category.topics.map((topic) => (
          <li key={topic.id}>
            <Icon id={topic.icon} size={20} /> <strong>{topic.name}</strong>: {topic.stars} ★
            {topic.samples ? ` (built-in ${topic.samples} quizzes)` : ""}
            <ul>
              {children.map((child) => {
                const level = topic.children.find((c) => c.childId === child.id)?.level;
                return (
                  <li key={child.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={level !== undefined}
                        onChange={(event) => setLevel(topic.id, child.id, event.target.checked ? 1 : null)}
                      />{" "}
                      {child.nickname}
                    </label>
                    {level !== undefined && (
                      <>
                        {" "}
                        at level{" "}
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={level}
                          onChange={(event) => setLevel(topic.id, child.id, Number(event.target.value))}
                          style={{ width: "3em" }}
                        />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <form onSubmit={addTopic}>
        <label>
          Topic <input name="name" placeholder="Addition" maxLength={60} required />
        </label>{" "}
        <label>
          Stars <input name="stars" type="number" min={0} max={100} defaultValue={3} required style={{ width: "4em" }} />
        </label>{" "}
        <IconPicker />{" "}
        <label>
          Sample quizzes{" "}
          <select name="samples" defaultValue="">
            {sampleSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.label}
              </option>
            ))}
          </select>
        </label>{" "}
        <button type="submit">Add topic</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/**
 * Turns what a grown-up typed into quiz items: one per line, "prompt = answer". A line that's just a word is a
 * spelling word, so a pasted list of this week's words works as it is.
 */
export function parseItems(text: string): { prompt: string; answer: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const equals = line.lastIndexOf("=");
      if (equals === -1) return { prompt: `Spell: ${line}`, answer: line };
      return { prompt: `${line.slice(0, equals).trim()} =`, answer: line.slice(equals + 1).trim() };
    })
    .filter((item) => item.answer.length > 0);
}

/** A grown-up writes a quiz for a child, such as this week's spelling words. */
export function WriteQuiz(props: { topics: { id: string; name: string; children: { childId: string }[] }[]; children: Child[] }) {
  const { topics, children } = props;
  const [message, setMessage] = useState<string | undefined>();
  const [childId, setChildId] = useState("");
  const forChild = topics.filter((topic) => topic.children.some((c) => c.childId === childId));

  const write = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const items = parseItems(String(data.get("items") ?? ""));
    const result = await api("POST", "/api/quizzes", {
      childId,
      topicId: data.get("topicId"),
      title: data.get("title"),
      instructions: data.get("instructions"),
      items,
    });
    setMessage(result.ok ? `Added a quiz with ${items.length} items.` : (result.data?.error ?? "Couldn't add that quiz."));
    if (result.ok) form.reset();
  };

  return (
    <section>
      <h3>Write a quiz</h3>
      <form onSubmit={write}>
        <label>
          For{" "}
          <select value={childId} onChange={(event) => setChildId(event.target.value)} required>
            <option value="">(choose a child)</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.nickname}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          Topic{" "}
          <select name="topicId" required>
            {forChild.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Title <input name="title" defaultValue="Spelling" maxLength={60} required />
        </label>{" "}
        <label>
          Instructions <input name="instructions" defaultValue="Write each word." maxLength={200} />
        </label>
        <br />
        <label>
          One per line: <code>7 + 5 = 12</code>, or just a word to spell
          <br />
          <textarea name="items" rows={6} cols={40} required />
        </label>
        <br />
        <button type="submit" disabled={!childId || forChild.length === 0}>
          Add quiz
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

/** The chart's quiz settings: how many quizzes the quiz feed keeps in each pool. */
export function QuizSettings({ quizPoolTarget }: { quizPoolTarget: number }) {
  const [message, setMessage] = useState<string | undefined>();
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = Number(new FormData(event.currentTarget).get("target"));
    const result = await api("PATCH", "/api/chart", { quizPoolTarget: target });
    setMessage(result.ok ? "Saved." : result.data?.error);
  };
  return (
    <form onSubmit={save}>
      <label>
        Keep{" "}
        <input name="target" type="number" min={1} max={50} defaultValue={quizPoolTarget} style={{ width: "3em" }} /> quizzes
        ready for each child and topic
      </label>{" "}
      <button type="submit">Save</button> {message}
    </form>
  );
}

/** The answer key next to a handed-in quiz, with a box for the score. */
export function AnswerKey({ items }: { items: { prompt: string; answer: string }[] }) {
  return (
    <details>
      <summary>Answer key</summary>
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {item.prompt} <strong>{item.answer}</strong>
          </li>
        ))}
      </ol>
    </details>
  );
}
