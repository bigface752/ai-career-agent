/**
 * 面试辅导模块
 *
 * 对齐 SPEC.md §3.14-3.16
 */
export { generateQuestions, buildInterviewInput } from "./generator";
export type { GenerateQuestionsResult } from "./generator";
export { processAnswer } from "./answer";
export type { ProcessAnswerResult } from "./answer";
export { evaluateInterview, buildEvaluationInput } from "./evaluator";
export type { EvaluateResult } from "./evaluator";
export {
  InterviewQuestionSchema,
  GenerateQuestionsOutputSchema,
  InterviewRound,
  AnswerInputSchema,
  AiAnswerEvaluationSchema,
  AnswerQualitySchema,
  EvaluateOutputSchema,
  PerQuestionEvaluationSchema,
  EvaluateInputSchema,
  EVAL_DIMENSIONS,
} from "./schema";
export type {
  InterviewQuestion,
  GenerateQuestionsOutput,
  GenerateQuestionsInput,
  GenerateQuestionsResponse,
  AnswerInput,
  AnswerResponse,
  AiAnswerEvaluation,
  AnswerQuality,
  InterviewMessage,
  EvaluateOutput,
  EvaluateInput,
  EvaluateApiInput,
  EvaluateResponse,
  PerQuestionEvaluation,
  QuestionThread,
} from "./schema";
