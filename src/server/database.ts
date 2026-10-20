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
  sessions: {
    token_hash: string;
    grown_up_id: string;
    created_at: Date;
  };
}

export type Role = "owner" | "admin" | "grown-up";
export type DisplayStyle = "pictures" | "words";
export type DeviceKind = "screen" | "printer" | "scanner";

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
