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
    daily_summary_sent_on: string | null;
    created_at: Date;
  };
  grown_ups: {
    id: Generated<string>;
    chart_id: string;
    email: string;
    password_hash: string;
    pin_hash: string | null;
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
    failed_pin_attempts: Generated<number>;
    pin_locked_until: Date | null;
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
    icon: string | null;
    created_at: Date;
  };
  chores: {
    id: Generated<string>;
    category_id: string;
    name: string;
    stars: number;
    frequency_times: Generated<number>;
    frequency_per: Generated<"day" | "week">;
    icon: string | null;
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
    awarded_stars: number | null;
    note: string | null;
    icon: string | null;
    created_at: Date;
  };
  ticket_events: {
    id: Generated<string>;
    ticket_id: string;
    action: "approved" | "rejected" | "dismissed";
    grown_up_id: string | null;
    note: string | null;
    stars: number | null;
    created_at: Date;
    seq: Generated<string>;
    by_guest: Generated<boolean>;
  };
  reprint_requests: {
    id: Generated<string>;
    chart_id: string;
    ticket_id: string;
    observatory_id: string | null;
    state: "pending" | "approved" | "declined";
    decided_by_grown_up_id: string | null;
    decided_by_guest: Generated<boolean>;
    created_at: Date;
    decided_at: Date | null;
  };
  push_subscriptions: {
    id: Generated<string>;
    grown_up_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    created_at: Date;
  };
  hand_in_notices: {
    chart_id: string;
    last_sent_at: Date;
    held_back: Generated<number>;
  };
  star_movements: {
    id: Generated<string>;
    chart_id: string;
    child_id: string;
    amount: number;
    ticket_id: string | null;
    note: string | null;
    recorded_by_grown_up_id: string | null;
    created_at: Date;
    seq: Generated<string>;
  };
  invitations: {
    token_hash: string;
    chart_id: string;
    email: string;
    invited_by_grown_up_id: string | null;
    expires_at: Date;
    created_at: Date;
  };
  password_resets: {
    token_hash: string;
    grown_up_id: string;
    expires_at: Date;
  };
  phone_setup_codes: {
    code_hash: string;
    grown_up_id: string;
    expires_at: Date;
  };
  guest_pins: {
    id: Generated<string>;
    chart_id: string;
    pin_hash: string;
    label: string | null;
    created_by_grown_up_id: string | null;
    expires_at: Date;
    cancelled_at: Date | null;
    created_at: Date;
  };
  guest_sessions: {
    token_hash: string;
    guest_pin_id: string;
    expires_at: Date;
  };
  sessions: {
    token_hash: string;
    grown_up_id: string;
    created_at: Date;
    expires_at: Date | null;
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
