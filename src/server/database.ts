import { Kysely, PostgresDialect, type Generated } from "kysely";
import { Migrator, type Migration, type MigrationProvider } from "kysely/migration";
import pg from "pg";
import { migrations } from "./migrations/index.js";

// Table types, kept in step with the migrations.
export interface Tables {
  charts: {
    id: Generated<string>;
    name: string;
    time_zone: string;
    created_at: Date;
  };
  grown_ups: {
    id: Generated<string>;
    chart_id: string;
    email: string;
    password_hash: string;
    role: Role;
    created_at: Date;
  };
  children: {
    id: Generated<string>;
    chart_id: string;
    nickname: string;
    display_style: DisplayStyle;
    created_at: Date;
  };
  observatories: {
    id: Generated<string>;
    chart_id: string;
    created_at: Date;
  };
  devices: {
    id: Generated<string>;
    observatory_id: string;
    kind: DeviceKind;
    token_hash: string;
    created_at: Date;
  };
  pairing_codes: {
    code_hash: string;
    observatory_id: string;
    expires_at: Date;
  };
  task_categories: {
    id: Generated<string>;
    chart_id: string;
    name: string;
    kind: TaskKindName;
    created_at: Date;
  };
  chores: {
    id: Generated<string>;
    category_id: string;
    name: string;
    stars: number;
    created_at: Date;
  };
  chore_assignments: {
    chore_id: string;
    child_id: string;
  };
  chore_codes: {
    child_id: string;
    chore_id: string;
    code: string;
  };
  tickets: {
    id: Generated<string>;
    chart_id: string;
    child_id: string;
    category_id: string;
    chore_id: string | null;
    code: string;
    title: string;
    stars: number;
    state: TicketState;
    printed_by_observatory_id: string | null;
    created_at: Date;
  };
  sessions: {
    token_hash: string;
    grown_up_id: string;
    created_at: Date;
  };
}

export type Role = "owner" | "admin" | "grown-up";
export type DisplayStyle = "pictures" | "words";
export type DeviceKind = "screen" | "printer" | "scanner";
export type TaskKindName = "chore" | "quiz";
export type TicketState = "open" | "handed-in" | "approved" | "dismissed";

export type Database = Kysely<Tables>;

export function createDatabase(connectionString: string): Database {
  return new Kysely<Tables>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  });
}

const provider: MigrationProvider = {
  getMigrations: async (): Promise<Record<string, Migration>> => migrations,
};

export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  const { error, results } = await new Migrator({ db, provider }).migrateToLatest();
  const failed = results?.find((result) => result.status === "Error");
  if (error || failed) {
    throw new Error(`Migration ${failed?.migrationName ?? ""} failed`, { cause: error });
  }
}
