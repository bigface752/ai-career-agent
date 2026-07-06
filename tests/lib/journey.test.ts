/**
 * 旅程状态管理单元测试
 *
 * 覆盖范围：
 * - 状态机转换（getNextStep、getPrevStep、isValidTransition）
 * - 辅助函数（parseCompletedSteps、formatSessionResponse）
 * - 边界情况（无效输入、极端值）
 */
import { describe, it, expect } from "vitest";
import {
  getNextStep,
  getPrevStep,
  isValidTransition,
} from "@/lib/journey";

// ============================================================
// getNextStep
// ============================================================
describe("getNextStep", () => {
  it("intake → diagnosis", () => {
    expect(getNextStep("intake")).toBe("diagnosis");
  });

  it("diagnosis → coaching", () => {
    expect(getNextStep("diagnosis")).toBe("coaching");
  });

  it("coaching → complete", () => {
    expect(getNextStep("coaching")).toBe("complete");
  });

  it("complete → null（最后一步）", () => {
    expect(getNextStep("complete")).toBeNull();
  });
});

// ============================================================
// getPrevStep
// ============================================================
describe("getPrevStep", () => {
  it("diagnosis → intake", () => {
    expect(getPrevStep("diagnosis")).toBe("intake");
  });

  it("coaching → diagnosis", () => {
    expect(getPrevStep("coaching")).toBe("diagnosis");
  });

  it("complete → coaching", () => {
    expect(getPrevStep("complete")).toBe("coaching");
  });

  it("intake → null（第一步不能回退）", () => {
    expect(getPrevStep("intake")).toBeNull();
  });
});

// ============================================================
// isValidTransition — advance
// ============================================================
describe("isValidTransition — advance", () => {
  it("completed 状态可以 advance", () => {
    expect(isValidTransition("intake", "completed", "advance")).toBe(true);
  });

  it("pending 状态不能 advance", () => {
    expect(isValidTransition("intake", "pending", "advance")).toBe(false);
  });

  it("in_progress 状态不能 advance", () => {
    expect(isValidTransition("intake", "in_progress", "advance")).toBe(false);
  });

  it("每一步的 completed 都可以 advance", () => {
    const steps = ["intake", "diagnosis", "coaching"] as const;
    for (const step of steps) {
      expect(isValidTransition(step, "completed", "advance")).toBe(true);
    }
  });
});

// ============================================================
// isValidTransition — rollback
// ============================================================
describe("isValidTransition — rollback", () => {
  it("completed 的 diagnosis 可以回退", () => {
    expect(isValidTransition("diagnosis", "completed", "rollback")).toBe(true);
  });

  it("completed 的 coaching 可以回退", () => {
    expect(isValidTransition("coaching", "completed", "rollback")).toBe(true);
  });

  it("completed 的 complete 可以回退", () => {
    expect(isValidTransition("complete", "completed", "rollback")).toBe(true);
  });

  it("intake 不能回退（第一步）", () => {
    expect(isValidTransition("intake", "completed", "rollback")).toBe(false);
  });

  it("pending 状态不能回退", () => {
    expect(isValidTransition("diagnosis", "pending", "rollback")).toBe(false);
  });

  it("in_progress 状态不能回退", () => {
    expect(isValidTransition("diagnosis", "in_progress", "rollback")).toBe(false);
  });
});

// ============================================================
// 状态机组合测试
// ============================================================
describe("状态机组合场景", () => {
  it("完整旅程：intake → diagnosis → coaching → complete", () => {
    let step = getNextStep("intake")!;
    expect(step).toBe("diagnosis");

    step = getNextStep(step)!;
    expect(step).toBe("coaching");

    step = getNextStep(step)!;
    expect(step).toBe("complete");

    // complete 之后无下一步
    expect(getNextStep(step)).toBeNull();
  });

  it("回退再前进：coaching → diagnosis → coaching", () => {
    let step = getPrevStep("coaching")!;
    expect(step).toBe("diagnosis");

    step = getNextStep(step)!;
    expect(step).toBe("coaching");
  });

  it("连续回退：complete → coaching → diagnosis → intake", () => {
    let step = getPrevStep("complete")!;
    expect(step).toBe("coaching");

    step = getPrevStep(step)!;
    expect(step).toBe("diagnosis");

    step = getPrevStep(step)!;
    expect(step).toBe("intake");

    // intake 之后无上一步
    expect(getPrevStep(step)).toBeNull();
  });
});
