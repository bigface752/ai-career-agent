/**
 * 验证 Turso 数据库读写
 * 用法: npx tsx prisma/verify-turso.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  // 写入测试用户
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (id, email, password_hash, name, email_verified)
          VALUES (?, ?, ?, ?, ?)`,
    args: ["test-001", "test@example.com", "hashed_pw", "测试用户", true],
  });
  console.log("✓ Write: user inserted");

  // 读取
  const result = await client.execute({
    sql: "SELECT id, email, name, email_verified FROM users WHERE id = ?",
    args: ["test-001"],
  });
  console.log("✓ Read:", result.rows[0]);

  // 写入画像
  await client.execute({
    sql: `INSERT OR IGNORE INTO portraits (id, user_id, portrait_json, completion)
          VALUES (?, ?, ?, ?)`,
    args: [
      "portrait-001",
      "test-001",
      JSON.stringify({ identity: { name: "测试用户" }, career_summary: {} }),
      0.3,
    ],
  });
  console.log("✓ Write: portrait inserted");

  // 读取画像
  const portrait = await client.execute({
    sql: "SELECT id, user_id, completion FROM portraits WHERE user_id = ?",
    args: ["test-001"],
  });
  console.log("✓ Read:", portrait.rows[0]);

  // 清理测试数据
  await client.execute({ sql: "DELETE FROM portraits WHERE id = ?", args: ["portrait-001"] });
  await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: ["test-001"] });
  console.log("✓ Cleanup done");

  // 验证表结构
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' ORDER BY name"
  );
  console.log(`\n✓ Total tables: ${tables.rows.length}`);
  tables.rows.forEach((r) => console.log(`  - ${r.name}`));

  await client.close();
}

main().catch(console.error);
