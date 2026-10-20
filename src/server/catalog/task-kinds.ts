import type { Database, TaskKindName } from "../database.js";

/** Something a child can pick at the observatory within a category, such as one chore. */
export interface Choice {
  id: string;
  name: string;
  stars: number;
}

/**
 * How the tasks in a category behave. Every kind (chore, quiz, and any added later) implements this one
 * interface, so the rest of the system never needs to know which kind it's dealing with.
 */
export interface TaskKind {
  name: TaskKindName;
  /** What this child can choose from this category right now. */
  choicesFor(db: Database, categoryId: string, childId: string): Promise<Choice[]>;
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
};

const kinds: Partial<Record<TaskKindName, TaskKind>> = { chore: choreKind };

export function taskKind(name: TaskKindName): TaskKind {
  const kind = kinds[name];
  if (!kind) throw new Error(`The ${name} task kind isn't available yet`);
  return kind;
}
