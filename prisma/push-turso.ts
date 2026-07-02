/**
 * 将初始化 SQL 执行到 Turso 数据库
 * 用法: npx tsx prisma/push-turso.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  console.log("Connecting to Turso:", url);

  // 测试连接
  const test = await client.execute("SELECT 1 as test");
  console.log("✓ Connection OK:", test.rows);

  // 读取 SQL 文件
  const sqlPath = join(__dirname, "init.sql");
  const rawSql = readFileSync(sqlPath, "utf-8");

  // 去掉 Prisma 的日志行，只保留 SQL
  const sqlStatements = rawSql
    .split("\n")
    .filter((line) => !line.startsWith("Loaded Prisma"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Executing ${sqlStatements.length} SQL statements...`);

  for (let i = 0; i < sqlStatements.length; i++) {
    const stmt = sqlStatements[i];
    try {
      await client.execute(stmt);
      const preview = stmt.substring(0, 60).replace(/\n/g, " ");
      console.log(`  ✓ [${i + 1}/${sqlStatements.length}] ${preview}...`);
    } catch (err: any) {
      // 忽略 "already exists" 错误
      if (err.message?.includes("already exists")) {
        console.log(`  ⊘ [${i + 1}] Already exists, skipping`);
      } else {
        console.error(`  ✗ [${i + 1}] Error:`, err.message);
      }
    }
  }

  // 验证表创建
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' ORDER BY name"
  );
  console.log("\n✓ Tables in Turso:");
  tables.rows.forEach((r) => console.log(`  - ${r.name}`));

  await client.close();
  console.log("\nDone!");
}

main().catch(console.error);
