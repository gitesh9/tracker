/**
 * Remote Postgres (Neon) — used only when DATABASE_URL is configured.
 *
 * Everything in the app keeps working without it; this is the shared place that
 * opens the connection and makes sure the tables exist.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function getSql(): NeonQueryFunction<false, false> | null {
  const url = process.env["DATABASE_URL"];
  if (!url) return null;
  if (!cached) cached = neon(url);
  return cached;
}

export async function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        create table if not exists ascend_users (
          id uuid primary key default gen_random_uuid(),
          email text unique not null,
          password_hash text,
          display_name text,
          avatar_url text,
          google_sub text unique,
          created_at timestamptz not null default now()
        )`;
      await sql`
        create table if not exists ascend_sessions (
          token_hash text primary key,
          user_id uuid not null references ascend_users(id) on delete cascade,
          created_at timestamptz not null default now(),
          expires_at timestamptz not null
        )`;
      await sql`
        create table if not exists ascend_rows (
          account_id text not null,
          table_name text not null,
          row_id text not null,
          device_id text not null,
          data jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now(),
          deleted boolean not null default false,
          primary key (account_id, table_name, row_id)
        )`;
      // When each field was last edited (client clock, ms) — lets two devices editing
      // different fields of the same row both keep their change.
      await sql`
        alter table ascend_rows
        add column if not exists field_times jsonb not null default '{}'::jsonb`;
      // Background reminders: one row per browser that allowed notifications.
      await sql`
        create table if not exists ascend_push_subscriptions (
          endpoint text primary key,
          account_id text not null,
          timezone text not null default 'UTC',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`;
      await sql`
        create index if not exists ascend_push_subscriptions_account
        on ascend_push_subscriptions (account_id)`;
      // One send per reminder, device and local day — makes the scheduler safe to repeat.
      await sql`
        create table if not exists ascend_push_sent (
          endpoint text not null,
          reminder_id text not null,
          day text not null,
          label text not null default '',
          shown boolean not null default false,
          sent_at timestamptz not null default now(),
          primary key (endpoint, reminder_id, day)
        )`;
      // Squads shared between people: one document per squad, plus who belongs to it.
      await sql`
        create table if not exists ascend_squads (
          id text primary key,
          code text unique not null,
          data jsonb not null,
          version integer not null default 0,
          updated_at timestamptz not null default now()
        )`;
      await sql`
        create table if not exists ascend_squad_members (
          squad_id text not null references ascend_squads(id) on delete cascade,
          account_id text not null,
          joined_at timestamptz not null default now(),
          primary key (squad_id, account_id)
        )`;
      await sql`
        create index if not exists ascend_squad_members_account
        on ascend_squad_members (account_id)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export type RemoteUser = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function publicUser(row: RemoteUser) {
  return {
    id: row.id,
    email: row.email,
    name: row.display_name ?? row.email.split("@")[0],
    avatarUrl: row.avatar_url,
  };
}
