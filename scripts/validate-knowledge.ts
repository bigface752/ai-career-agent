/**
 * 验证知识卡 JSON 文件是否符合 Zod schema
 * 用法: npx tsx scripts/validate-knowledge.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  GlobalKnowledgeSchema,
  IndustryContextSchema,
  PositionKnowledgeSchema,
} from "../src/lib/knowledge/schema";

const BASE = join(
  process.cwd(),
  "kitty-specs/v1-career-cognition/agents/knowledge-base"
);

function validate(label: string, path: string, schema: { parse: (data: unknown) => unknown }) {
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    schema.parse(raw);
    console.log(`  ✓ ${label}`);
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${label}: ${msg.substring(0, 200)}`);
    return false;
  }
}

async function main() {
  let pass = 0;
  let fail = 0;

  console.log("Layer 1: global_knowledge.json");
  validate("global", join(BASE, "global_knowledge.json"), GlobalKnowledgeSchema)
    ? pass++
    : fail++;

  console.log("Layer 2: industry_context.json");
  validate("industry", join(BASE, "industry_context.json"), IndustryContextSchema)
    ? pass++
    : fail++;

  console.log("Layer 3: positions/*.json");
  const positionsDir = join(BASE, "positions");
  const files = readdirSync(positionsDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const name = file.replace(".json", "");
    validate(name, join(positionsDir, file), PositionKnowledgeSchema)
      ? pass++
      : fail++;
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
}

main();
