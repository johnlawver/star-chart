import { sql } from "kysely";
import type { Database, TaskKindName } from "../database.js";
import { isId } from "../ids.js";
import { startOfPeriod } from "../time.js";
import { newTicketCode } from "../tokens.js";

/** Something a child can pick at the observatory within a category, such as one chore. */
export interface Choice {
  id: string;
  name: string;
  stars: number;
  /** Already done as often as it can earn stars for now (for example, once today), so it can't be printed. */
  done: boolean;
}

/** What goes on a ticket when a child chooses something. */
export interface IssuedTask {
  title: string;
  stars: number;
  code: string;
  choreId: string | null;
}

/** When a child is choosing: the moment, and the chart's time zone, which decides where days and weeks begin. */
export interface ChoosingContext {
  now: Date;
  timeZone: string;
}

/**
 * How the tasks in a category behave. Every kind (chore, quiz, and any added later) implements this one
 * interface, so the rest of the system never needs to know which kind it's dealing with.
 */
export interface TaskKind {
  name: TaskKindName;
  /** What this child can choose from this category right now. */
  choicesFor(db: Database, context: ChoosingContext, categoryId: string, childId: string): Promise<Choice[]>;
  /**
   * The ticket's title, stars and code for a choice; "done" if the child can't do it again for now;
   * or undefined if it isn't one this child can choose at all.
   */
  issue(
    db: Database,
    context: ChoosingContext,
    categoryId: string,
    childId: string,
    choiceId: string,
  ): Promise<IssuedTask | "done" | undefined>;
}

export const choreKind: TaskKind = {
  name: "chore",

  async choicesFor(db, context, categoryId, childId) {
    const chores = await db
      .selectFrom("chores")
      .innerJoin("chore_assignments", "chore_assignments.chore_id", "chores.id")
      .select(["chores.id", "chores.name", "chores.stars", "chores.frequency_times", "chores.frequency_per"])
      .where("chores.category_id", "=", categoryId)
      .where("chore_assignments.child_id", "=", childId)
      .orderBy("chores.name")
      .execute();
    const choices: Choice[] = [];
    for (const chore of chores) {
      // A chore counts against its frequency when it's approved, whenever it was printed.
      const since = startOfPeriod(context.now, context.timeZone, chore.frequency_per);
      const { approvals } = await db
        .selectFrom("ticket_events")
        .innerJoin("tickets", "tickets.id", "ticket_events.ticket_id")
        .select(sql<string>`count(*)`.as("approvals"))
        .where("tickets.chore_id", "=", chore.id)
        .where("tickets.child_id", "=", childId)
        .where("ticket_events.action", "=", "approved")
        .where("ticket_events.created_at", ">=", since)
        .executeTakeFirstOrThrow();
      choices.push({
        id: chore.id,
        name: chore.name,
        stars: chore.stars,
        done: Number(approvals) >= chore.frequency_times,
      });
    }
    return choices;
  },

  async issue(db, context, categoryId, childId, choiceId) {
    if (!isId(choiceId)) return undefined;
    const chore = (await this.choicesFor(db, context, categoryId, childId)).find((choice) => choice.id === choiceId);
    if (!chore) return undefined;
    if (chore.done) return "done";
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
