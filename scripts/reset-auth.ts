import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createConnection } from "mysql2/promise";

if (process.env.RESET_AUTH_CONFIRM !== "RESET_AUTH") {
  console.error("Refusing to reset auth. Re-run with RESET_AUTH_CONFIRM=RESET_AUTH.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const url = new URL(databaseUrl);
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
const backupTable = `users_auth_backup_${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;

const connection = await createConnection({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database,
  multipleStatements: false,
});

try {
  await connection.query(`CREATE TABLE ${backupTable} AS SELECT * FROM users`);
  const [countRows] = await connection.query("SELECT COUNT(*) AS count FROM users");
  const count = Number((countRows as Array<{ count: number }>)[0]?.count ?? 0);
  await connection.query("DELETE FROM users");
  const envPath = "/opt/keira/.env";
  const envFile = await import("node:fs/promises");
  const currentEnv = await envFile.readFile(envPath, "utf8");
  const nextJwtSecret = randomBytes(32).toString("hex");
  const jwtLine = `JWT_SECRET=${nextJwtSecret}`;
  const nextEnv = /^JWT_SECRET=.*$/m.test(currentEnv)
    ? currentEnv.replace(/^JWT_SECRET=.*$/m, jwtLine)
    : `${currentEnv.trimEnd()}\n${jwtLine}\n`;
  await envFile.writeFile(envPath, nextEnv, { mode: 0o600 });
  console.log(`Reset complete: removed ${count} auth account(s).`);
  console.log(`Auth backup table: ${backupTable}`);
  console.log("JWT_SECRET rotated; all previous sessions are invalid after the app restarts.");
  console.log("Conversations, messages, memory, trajectories, receipts, and identity data were not deleted.");
} finally {
  await connection.end();
}
