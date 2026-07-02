export {
  GlobalKnowledgeSchema,
  IndustryContextSchema,
  PositionKnowledgeSchema,
  CompositeProfileSchema,
  PLACEHOLDER_MAP,
} from "./schema";

export type {
  GlobalKnowledge,
  IndustryContext,
  PositionKnowledge,
  CompositeProfile,
  PlaceholderKey,
} from "./schema";

export {
  loadGlobalKnowledge,
  loadIndustryContext,
  loadPositionKnowledge,
  loadMultiPositionKnowledge,
  injectKnowledge,
  loadAndInject,
} from "./loader";

export type { KnowledgeContext } from "./loader";

export {
  findNearestPosition,
  hasPositionCard,
  getAvailablePositions,
} from "./fallback";
