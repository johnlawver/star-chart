import { useEffect, useState, type FormEvent } from "react";
import { api } from "../shared/api.js";
import { Icon, IconPicker } from "../shared/icons.js";
import { WriteQuiz } from "./quizzes.js";

// The Control Center's tasks, deliberately plain: categories (optional folders, which can mix chores and quizzes),
// chores, and quiz topics. Each task can be edited in place, moved between categories, or removed.

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Chore {
  id: string;
  name: string;
  stars: number;
  icon: string | null;
  categoryId: string | null;
  frequency: { times: number; per: "day" | "week" };
  childIds: string[];
}

interface Topic {
  id: string;
  name: string;
  stars: number;
  icon: string | null;
  samples: string | null;
  categoryId: string | null;
  children: { childId: string; level: number }[];
}

interface Child {
  id: string;
  nickname: string;
}

const sampleSets = [
  { id: "", label: "none: grown-ups or the quiz feed write them" },
  { id: "addition", label: "Addition" },
  { id: "subtraction", label: "Subtraction" },
  { id: "letters", label: "Letters" },
  { id: "numbers", label: "Numbers" },
  { id: "spelling", label: "Spelling" },
];

/** A category picker: "(no category)" means the task shows straight on the child's main screen. */
function CategoryPicker({ categories, initial }: { categories: Category[]; initial: string | null }) {
  return (
    <select name="categoryId" defaultValue={initial ?? ""}>
      <option value="">(no category: on the main screen)</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

const orNull = (value: FormDataEntryValue | null) => (value ? String(value) : null);

export function TasksSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [message, setMessage] = useState<string | undefined>();

  const load = async () => {
    const [listing, childList] = await Promise.all([api("GET", "/api/categories"), api("GET", "/api/children")]);
    if (listing.ok) {
      setCategories(listing.data.categories);
      setChores(listing.data.chores);
      setTopics(listing.data.topics);
    }
    if (childList.ok) setChildren(childList.data.children);
  };

  useEffect(() => {
    void load();
  }, []);

  /** Runs a change, shows its error if there is one, and reloads. */
  const run = async (request: Promise<{ ok: boolean; data: any }>, done?: string) => {
    const result = await request;
    setMessage(result.ok ? done : (result.data?.error ?? "That didn't work."));
    await load();
    return result.ok;
  };

  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? "no category";

  return (
    <section>
      <h2>Tasks</h2>
      {message && <p role="status">{message}</p>}

      <h3>Categories</h3>
      <p>Optional folders on the children's screen. Removing one keeps its tasks; they move to the main screen.</p>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(
                  api("PATCH", `/api/categories/${category.id}`, { name: data.get("name"), icon: orNull(data.get("icon")) }),
                  "Saved.",
                );
              }}
            >
              <Icon id={category.icon} size={20} /> <input name="name" defaultValue={category.name} maxLength={60} required />{" "}
              <IconPicker initial={category.icon} /> <button type="submit">Save</button>{" "}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove the ${category.name} category? Its tasks stay, on the main screen.`)) {
                    void run(api("DELETE", `/api/categories/${category.id}`), "Category removed; its tasks are on the main screen.");
                  }
                }}
              >
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void run(api("POST", "/api/categories", { name: data.get("name"), ...(data.get("icon") ? { icon: data.get("icon") } : {}) })).then(
            (ok) => ok && form.reset(),
          );
        }}
      >
        <label>
          New category <input name="name" placeholder="Morning" maxLength={60} required />
        </label>{" "}
        <IconPicker /> <button type="submit">Add category</button>
      </form>

      <h3>Chores</h3>
      <ul>
        {chores.map((chore) => (
          <li key={chore.id}>
            <ChoreForm
              chore={chore}
              categories={categories}
              children={children}
              onSave={(body) => run(api("PATCH", `/api/chores/${chore.id}`, body), "Saved.")}
            />
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remove "${chore.name}"? Stars already earned stay.`)) {
                  void run(api("DELETE", `/api/chores/${chore.id}`), "Chore removed.");
                }
              }}
            >
              Remove
            </button>{" "}
            <small>in {categoryName(chore.categoryId)}</small>
          </li>
        ))}
      </ul>
      <h4>Add a chore</h4>
      <ChoreForm categories={categories} children={children} onSave={(body) => run(api("POST", "/api/chores", body), "Chore added.")} />

      <h3>Quiz topics</h3>
      <ul>
        {topics.map((topic) => (
          <li key={topic.id}>
            <TopicForm
              topic={topic}
              categories={categories}
              onSave={(body) => run(api("PATCH", `/api/topics/${topic.id}`, body), "Saved.")}
            />
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remove the "${topic.name}" topic? Stars already earned stay.`)) {
                  void run(api("DELETE", `/api/topics/${topic.id}`), "Topic removed.");
                }
              }}
            >
              Remove
            </button>{" "}
            <small>in {categoryName(topic.categoryId)}</small>
            <TopicLevels topic={topic} children={children} onChange={(request) => run(request)} />
          </li>
        ))}
      </ul>
      <h4>Add a quiz topic</h4>
      <TopicForm categories={categories} onSave={(body) => run(api("POST", "/api/topics", body), "Topic added. Tick who it's for below.")} />

      <WriteQuiz topics={topics} children={children} />
    </section>
  );
}

/** Adding a chore (no `chore`) or editing one in place. */
function ChoreForm(props: {
  chore?: Chore;
  categories: Category[];
  children: Child[];
  onSave: (body: object) => Promise<boolean>;
}) {
  const { chore, categories, children, onSave } = props;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const categoryId = orNull(data.get("categoryId"));
        const icon = orNull(data.get("icon"));
        void onSave({
          name: data.get("name"),
          stars: Number(data.get("stars")),
          frequency: { times: Number(data.get("times")), per: data.get("per") },
          childIds: data.getAll("childIds"),
          // When adding, leave out what isn't set; when editing, null clears it.
          ...(chore ? { categoryId, icon } : { ...(categoryId ? { categoryId } : {}), ...(icon ? { icon } : {}) }),
        }).then((ok) => ok && !chore && form.reset());
      }}
      style={{ display: "inline" }}
    >
      <input name="name" defaultValue={chore?.name} placeholder="Feed the cat" maxLength={60} required />{" "}
      <input name="stars" type="number" min={0} max={100} defaultValue={chore?.stars ?? 1} required style={{ width: "3.5em" }} /> ★{" "}
      <input name="times" type="number" min={1} max={10} defaultValue={chore?.frequency.times ?? 1} required style={{ width: "3em" }} />{" "}
      a{" "}
      <select name="per" defaultValue={chore?.frequency.per ?? "day"}>
        <option value="day">day</option>
        <option value="week">week</option>
      </select>{" "}
      <IconPicker initial={chore?.icon} /> <CategoryPicker categories={categories} initial={chore?.categoryId ?? null} />{" "}
      {children.map((child) => (
        <label key={child.id}>
          <input type="checkbox" name="childIds" value={child.id} defaultChecked={chore?.childIds.includes(child.id)} />{" "}
          {child.nickname}{" "}
        </label>
      ))}
      <button type="submit">{chore ? "Save" : "Add chore"}</button>{" "}
    </form>
  );
}

/** Adding a quiz topic (no `topic`) or editing one in place. */
function TopicForm(props: { topic?: Topic; categories: Category[]; onSave: (body: object) => Promise<boolean> }) {
  const { topic, categories, onSave } = props;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const categoryId = orNull(data.get("categoryId"));
        const icon = orNull(data.get("icon"));
        const samples = orNull(data.get("samples"));
        void onSave({
          name: data.get("name"),
          stars: Number(data.get("stars")),
          ...(topic
            ? { categoryId, icon, samples }
            : { ...(categoryId ? { categoryId } : {}), ...(icon ? { icon } : {}), ...(samples ? { samples } : {}) }),
        }).then((ok) => ok && !topic && form.reset());
      }}
      style={{ display: "inline" }}
    >
      <input name="name" defaultValue={topic?.name} placeholder="Addition" maxLength={60} required />{" "}
      <input name="stars" type="number" min={0} max={100} defaultValue={topic?.stars ?? 3} required style={{ width: "3.5em" }} /> ★{" "}
      <IconPicker initial={topic?.icon} /> <CategoryPicker categories={categories} initial={topic?.categoryId ?? null} />{" "}
      <label>
        Sample quizzes{" "}
        <select name="samples" defaultValue={topic?.samples ?? ""}>
          {sampleSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="submit">{topic ? "Save" : "Add topic"}</button>{" "}
    </form>
  );
}

/** Which children have a topic switched on, and at which level. */
function TopicLevels(props: {
  topic: Topic;
  children: Child[];
  onChange: (request: Promise<{ ok: boolean; data: any }>) => void;
}) {
  const { topic, children, onChange } = props;
  const setLevel = (childId: string, level: number | null) =>
    onChange(
      level === null
        ? api("DELETE", `/api/topics/${topic.id}/children/${childId}`)
        : api("PUT", `/api/topics/${topic.id}/children/${childId}`, { level }),
    );
  return (
    <ul>
      {children.map((child) => {
        const level = topic.children.find((c) => c.childId === child.id)?.level;
        return (
          <li key={child.id}>
            <label>
              <input type="checkbox" checked={level !== undefined} onChange={(event) => setLevel(child.id, event.target.checked ? 1 : null)} />{" "}
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
                  onChange={(event) => setLevel(child.id, Number(event.target.value))}
                  style={{ width: "3em" }}
                />
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
