import type { Database, TaskKindName } from "../database.js";
import { isId } from "../ids.js";
import { newTicketCode } from "../tokens.js";

/** Something a child can pick at the observatory within a category, such as one chore. */
export interface Choice {
  id: string;
  name: string;
  stars: number;
}

/** What goes on a ticket when a child chooses something. */
export interface IssuedTask {
  title: string;
  stars: number;
  code: string;
  choreId: string | null;
}

/**
 * How the tasks in a category behave. Every kind (chore, quiz, and any added later) implements this one
 * interface, so the rest of the system never needs to know which kind it's dealing with.
 */
export interface TaskKind {
  name: TaskKindName;
  /** What this child can choose from this category right now. */
  choicesFor(db: Database, categoryId: string, childId: string): Promise<Choice[]>;
  /** The ticket's title, stars and code for a choice, or undefined if it isn't one this child can choose. */
  issue(db: Database, categoryId: string, childId: string, choiceId: string): Promise<IssuedTask | undefined>;
}

export const choreKind: TaskKind = {
  name: "chore",
  async choicesFor(db, categoryId, childId) {
    return db
      .selectFrom("chores")
      .innerJoin("chore_assignments", "chore_assignments.chore_id", "chores.id")
      .select(["chores.id", "chores.name", "chores.stars"])
      .where("chores.category_id", "=", categoryId)
      .where("chore_assignments.child_id", "=", childId)
      .orderBy("chores.name")
      .execute();
  },

  async issue(db, categoryId, childId, choiceId) {
    if (!isId(choiceId)) return undefined;
    const chore = (await this.choicesFor(db, categoryId, childId)).find((choice) => choice.id === choiceId);
    if (!chore) return undefined;
    // A chore's code belongs to the child and the chore, not to one printing (ADR 0001).
    await db
      .insertInto("chore_codes")
      .values({ child_id: childId, chore_id: chore.id, code: newTicketCode() })
      .onConflict((oc) => oc.columns(["child_id", "chore_id"]).doNothing())
      .execute();
    const { code } = await db
      .selectFrom("chore_codes")
      .select("code")
      .where("child_id", "=", childId)
      .where("chore_id", "=", chore.id)
      .executeTakeFirstOrThrow();
    return { title: chore.name, stars: chore.stars, code, choreId: chore.id };
  },
};

const kinds: Partial<Record<TaskKindName, TaskKind>> = { chore: choreKind };

export function taskKind(name: TaskKindName): TaskKind {
  const kind = kinds[name];
  if (!kind) throw new Error(`The ${name} task kind isn't available yet`);
  return kind;
}
