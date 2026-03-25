import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

/**
 * Remote PostgreSQL (VPS, RDS, etc.) almost always requires TLS. The `pg` client
 * does not enable SSL from the URL alone — without this, connections can fail or
 * behave inconsistently when the app runs on a server while the DB worked from localhost.
 *
 * Set DATABASE_SSL=false if your Postgres has no TLS (plain local/docker only).
 * Set DATABASE_SSL_REJECT_UNAUTHORIZED=true if you use a CA-signed cert and want strict verification.
 */
function shouldUseSsl(): boolean {
  const flag = process.env.DATABASE_SSL?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  if (/sslmode\s*=\s*disable/i.test(connectionString)) return false;
  if (/sslmode\s*=\s*(require|prefer|verify)/i.test(connectionString)) return true;
  // Typical local dev: no TLS
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return false;
  return process.env.NODE_ENV === "production";
}

const useSsl = shouldUseSsl();

export const pool = new Pool({
  connectionString,
  max: Number(process.env.PGPOOL_MAX) || 20,
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        },
      }
    : {}),
});

pool.on("error", (err) => {
  console.error("[pg] Unexpected pool error:", err);
});

export const db = drizzle(pool, { schema });
