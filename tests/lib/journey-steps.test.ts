/**
 * 旅程步骤常量单元测试
 *
 * 覆盖范围：
 * - JOURNEY_STEP_ORDER 完整性和顺序
 * - STEP_META 所有步骤都有元数据
 * - getStepIndex / isFirstStep 边界
 */
import { describe, it, expect } from "vitest";
import {
  JOURNEY_STEP_ORDER,
  STEP_META,
  getStepIndex,
  isFirstStep,
  type JourneyStepName,
} from "@/lib/journey-steps";

// ============================================================
// JOURNEY_STEP_ORDER
// ============================================================
describe("JOURNEY_STEP_ORDER", () => {
  it("包含 4 个步骤", () => {
    expect(JOURNEY_STEP_ORDER).toHaveLength(4);
  });

  it("顺序是 intake → diagnosis → coaching → complete", () => {
    expect([...JOURNEY_STEP_ORDER]).toEqual(["intake", "diagnosis", "coaching", "complete"]);
  });

  it("每个步骤在 STEP_META 中都有对应元数据", () => {
    for (const step of JOURNEY_STEP_ORDER) {
      expect(STEP_META[step]).toBeDefined();
      expect(STEP_META[step].name).toBe(step);
      expect(STEP_META[step].label).toBeTruthy();
      expect(STEP_META[step].description).toBeTruthy();
    }
  });
});

// ============================================================
// STEP_META
// ============================================================
describe("STEP_META", () => {
  it("intake 元数据正确", () => {
    const meta = STEP_META.intake;
    expect(meta.name).toBe("intake");
    expect(meta.label).toBe("信息采集");
    expect(meta.description).toContain("职业背景");
  });

  it("diagnosis 元数据正确", () => {
    const meta = STEP_META.diagnosis;
    expect(meta.name).toBe("diagnosis");
    expect(meta.label).toBe("职业诊断");
    expect(meta.description).toContain("职业画像");
  });

  it("coaching 元数据正确", () => {
    const meta = STEP_META.coaching;
    expect(meta.name).toBe("coaching");
    expect(meta.label).toBe("行动建议");
    expect(meta.description).toContain("方案");
  });

  it("complete 元数据正确", () => {
    const meta = STEP_META.complete;
    expect(meta.name).toBe("complete");
    expect(meta.label).toBe("完成");
    expect(meta.description).toContain("报告");
  });
});

// ============================================================
// getStepIndex
// ============================================================
describe("getStepIndex", () => {
  it("intake = 0", () => {
    expect(getStepIndex("intake")).toBe(0);
  });

  it("diagnosis = 1", () => {
    expect(getStepIndex("diagnosis")).toBe(1);
  });

  it("coaching = 2", () => {
    expect(getStepIndex("coaching")).toBe(2);
  });

  it("complete = 3", () => {
    expect(getStepIndex("complete")).toBe(3);
  });
});

// ============================================================
// isFirstStep
// ============================================================
describe("isFirstStep", () => {
  it("intake 是第一步", () => {
    expect(isFirstStep("intake")).toBe(true);
  });

  it("diagnosis 不是第一步", () => {
    expect(isFirstStep("diagnosis")).toBe(false);
  });

  it("coaching 不是第一步", () => {
    expect(isFirstStep("coaching")).toBe(false);
  });

  it("complete 不是第一步", () => {
    expect(isFirstStep("complete")).toBe(false);
  });
});
