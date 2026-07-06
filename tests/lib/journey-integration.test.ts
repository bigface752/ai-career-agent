/**
 * 旅程状态管理集成测试
 *
 * 覆盖范围：
 * - validateStepData 各步骤的校验逻辑
 * - advanceJourney / rollbackJourney 乐观锁和状态转换
 * - 错误场景（不存在、版本冲突、状态不允许）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db 模块（必须在 import 之前）
vi.mock("@/lib/db", () => ({
  db: {
    dialogueSession: { findFirst: vi.fn() },
    portrait: { findUnique: vi.fn() },
    evaluation: { findFirst: vi.fn() },
    journeySession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock Prisma client 类型
vi.mock("@/generated/prisma/client", () => ({}));

const { db } = await import("@/lib/db");
const journey = await import("@/lib/journey");

// ============================================================
// validateStepData
// ============================================================
describe("validateStepData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("intake 步骤", () => {
    it("无对话会话 → progress=0, not allowed", async () => {
      (db.dialogueSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await journey.validateStepData("user-1", "intake");
      expect(result.allowed).toBe(false);
      expect(result.progress).toBe(0);
      expect(result.missing).toContain("dialogue_session");
    });

    it("对话会话 roundNumber=0 → progress=0", async () => {
      (db.dialogueSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        roundNumber: 0,
      });

      const result = await journey.validateStepData("user-1", "intake");
      expect(result.allowed).toBe(false);
      expect(result.progress).toBe(0);
    });

    it("对话会话 roundNumber=5 → progress=1.0, allowed", async () => {
      (db.dialogueSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        roundNumber: 5,
      });

      const result = await journey.validateStepData("user-1", "intake");
      expect(result.allowed).toBe(true);
      expect(result.progress).toBe(1);
    });

    it("对话会话 roundNumber=3 → progress=0.6, not allowed", async () => {
      (db.dialogueSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        roundNumber: 3,
      });

      const result = await journey.validateStepData("user-1", "intake");
      expect(result.allowed).toBe(false);
      expect(result.progress).toBe(0.6);
    });
  });

  describe("diagnosis 步骤", () => {
    it("无画像 → progress=0, not allowed", async () => {
      (db.portrait.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await journey.validateStepData("user-1", "diagnosis");
      expect(result.allowed).toBe(false);
      expect(result.progress).toBe(0);
      expect(result.missing).toContain("portrait");
    });

    it("画像 completion=1.0 → allowed", async () => {
      (db.portrait.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        completion: 1.0,
      });

      const result = await journey.validateStepData("user-1", "diagnosis");
      expect(result.allowed).toBe(true);
      expect(result.progress).toBe(1);
    });

    it("画像 completion=0.5 → not allowed", async () => {
      (db.portrait.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        completion: 0.5,
      });

      const result = await journey.validateStepData("user-1", "diagnosis");
      expect(result.allowed).toBe(false);
      expect(result.progress).toBe(0.5);
    });
  });

  describe("coaching 步骤", () => {
    it("无评估记录 → progress=0, not allowed", async () => {
      (db.evaluation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await journey.validateStepData("user-1", "coaching");
      expect(result.allowed).toBe(false);
      expect(result.progress).toBe(0);
      expect(result.missing).toContain("evaluation");
    });

    it("有评估记录 → allowed", async () => {
      (db.evaluation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "eval-1",
      });

      const result = await journey.validateStepData("user-1", "coaching");
      expect(result.allowed).toBe(true);
      expect(result.progress).toBe(1);
    });
  });

  describe("complete 步骤", () => {
    it("始终 allowed", async () => {
      const result = await journey.validateStepData("user-1", "complete");
      expect(result.allowed).toBe(true);
      expect(result.progress).toBe(1);
      expect(result.missing).toEqual([]);
    });
  });
});

// ============================================================
// getJourneySession / createJourneySession / getOrCreateJourneySession
// ============================================================
describe("getJourneySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回 null 当无会话", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await journey.getJourneySession("user-1");
    expect(result).toBeNull();
  });

  it("返回会话当存在", async () => {
    const mockSession = { id: "s1", userId: "user-1", currentStep: "intake" };
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const result = await journey.getJourneySession("user-1");
    expect(result).toEqual(mockSession);
  });
});

describe("createJourneySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("创建新会话", async () => {
    const mockSession = { id: "s1", userId: "user-1", currentStep: "intake", stepStatus: "pending" };
    (db.journeySession.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

    const result = await journey.createJourneySession("user-1");
    expect(result).toEqual(mockSession);
    expect(db.journeySession.create).toHaveBeenCalledWith({
      data: { userId: "user-1", currentStep: "intake", stepStatus: "pending" },
    });
  });
});

describe("getOrCreateJourneySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回已有会话", async () => {
    const existing = { id: "s1", userId: "user-1" };
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const result = await journey.getOrCreateJourneySession("user-1");
    expect(result).toEqual(existing);
    expect(db.journeySession.create).not.toHaveBeenCalled();
  });

  it("创建新会话当不存在", async () => {
    const newSession = { id: "s2", userId: "user-1", currentStep: "intake" };
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.journeySession.create as ReturnType<typeof vi.fn>).mockResolvedValue(newSession);

    const result = await journey.getOrCreateJourneySession("user-1");
    expect(result).toEqual(newSession);
    expect(db.journeySession.create).toHaveBeenCalled();
  });
});

// ============================================================
// advanceJourney
// ============================================================
describe("advanceJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("会话不存在 → JOURNEY_NOT_FOUND", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await journey.advanceJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("JOURNEY_NOT_FOUND");
  });

  it("版本号不匹配 → CONFLICT", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "intake",
      stepStatus: "completed",
      version: 2, // 当前版本是 2
    });

    const result = await journey.advanceJourney("user-1", 1); // 传入版本 1
    expect(result.success).toBe(false);
    expect(result.error).toBe("CONFLICT");
  });

  it("pending 状态不能 advance → CANNOT_ADVANCE", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "intake",
      stepStatus: "pending",
      version: 0,
    });

    const result = await journey.advanceJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("CANNOT_ADVANCE");
  });

  it("步骤数据未满足 → STEP_REQUIREMENTS_NOT_MET", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "intake",
      stepStatus: "completed",
      version: 0,
      completedSteps: null,
    });
    // intake 需要 roundNumber >= 5
    (db.dialogueSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      roundNumber: 2,
    });

    const result = await journey.advanceJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("STEP_REQUIREMENTS_NOT_MET");
  });

  it("complete 步骤不能 advance → ALREADY_COMPLETE", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "complete",
      stepStatus: "completed",
      version: 0,
      completedSteps: null,
    });

    const result = await journey.advanceJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ALREADY_COMPLETE");
  });

  it("成功推进 intake → diagnosis", async () => {
    const mockSession = {
      id: "s1",
      userId: "user-1",
      currentStep: "intake",
      stepStatus: "completed",
      version: 0,
      completedSteps: null,
    };
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    // intake 校验通过
    (db.dialogueSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      roundNumber: 5,
    });
    (db.journeySession.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockSession,
      currentStep: "diagnosis",
      stepStatus: "pending",
      version: 1,
    });

    const result = await journey.advanceJourney("user-1", 0);
    expect(result.success).toBe(true);
    expect(result.session?.currentStep).toBe("diagnosis");
    expect(result.session?.stepStatus).toBe("pending");
  });
});

// ============================================================
// rollbackJourney
// ============================================================
describe("rollbackJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("会话不存在 → JOURNEY_NOT_FOUND", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await journey.rollbackJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("JOURNEY_NOT_FOUND");
  });

  it("版本号不匹配 → CONFLICT", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "diagnosis",
      stepStatus: "completed",
      version: 2,
    });

    const result = await journey.rollbackJourney("user-1", 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("CONFLICT");
  });

  it("intake 不能回退 → CANNOT_ROLLBACK", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "intake",
      stepStatus: "completed",
      version: 0,
    });

    const result = await journey.rollbackJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("CANNOT_ROLLBACK");
  });

  it("pending 状态不能回退 → CANNOT_ROLLBACK", async () => {
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s1",
      userId: "user-1",
      currentStep: "diagnosis",
      stepStatus: "pending",
      version: 0,
    });

    const result = await journey.rollbackJourney("user-1", 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("CANNOT_ROLLBACK");
  });

  it("成功回退 diagnosis → intake", async () => {
    const mockSession = {
      id: "s1",
      userId: "user-1",
      currentStep: "diagnosis",
      stepStatus: "completed",
      version: 1,
      completedSteps: '["intake"]',
    };
    (db.journeySession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (db.journeySession.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockSession,
      currentStep: "intake",
      stepStatus: "completed",
      version: 2,
    });

    const result = await journey.rollbackJourney("user-1", 1);
    expect(result.success).toBe(true);
    expect(result.session?.currentStep).toBe("intake");
  });
});

// ============================================================
// formatSessionResponse
// ============================================================
describe("formatSessionResponse", () => {
  it("格式化完整会话", () => {
    const session = {
      id: "s1",
      userId: "user-1",
      currentStep: "diagnosis",
      stepStatus: "in_progress",
      stepData: '{"key":"value"}',
      completedSteps: '["intake"]',
      version: 2,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
      expiresAt: null,
    };

    const result = journey.formatSessionResponse(session as any);
    expect(result.id).toBe("s1");
    expect(result.currentStep).toBe("diagnosis");
    expect(result.stepStatus).toBe("in_progress");
    expect(result.stepData).toEqual({ key: "value" });
    expect(result.completedSteps).toEqual(["intake"]);
    expect(result.version).toBe(2);
  });

  it("stepData 为 null 时返回 null", () => {
    const session = {
      id: "s1",
      stepData: null,
      completedSteps: null,
      currentStep: "intake",
      stepStatus: "pending",
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = journey.formatSessionResponse(session as any);
    expect(result.stepData).toBeNull();
    expect(result.completedSteps).toEqual([]);
  });

  it("completedSteps JSON 格式错误时返回空数组", () => {
    const session = {
      id: "s1",
      stepData: null,
      completedSteps: "invalid-json",
      currentStep: "intake",
      stepStatus: "pending",
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = journey.formatSessionResponse(session as any);
    expect(result.completedSteps).toEqual([]);
  });
});
