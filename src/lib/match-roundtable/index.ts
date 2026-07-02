/**
 * 岗位匹配圆桌讨论
 *
 * 3 角色辩论式圆桌 + MiMo 综合层
 * 基于 SPEC.md §3.13
 */

export { generateMatchRoundtable } from "./generator";
export type {
  MatchRoundtableInput,
  MatchRoundtableResponse,
  RoleDiscussion,
  SynthesisOutput,
  Recommendation,
  MatchRoundtableRole,
} from "./schema";
export { RoleDiscussionSchema, SynthesisOutputSchema } from "./schema";
