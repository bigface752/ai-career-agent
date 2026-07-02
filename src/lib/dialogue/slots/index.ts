/**
 * Slot 定义导出
 */

export {
  CAREER_COGNITION_SLOTS,
  getRequiredSlots,
  getDialogueSlots,
  getSlotsByDimension,
  SLOT_LABELS,
  validateSlotValue,
} from './career-cognition';

export {
  MODULE_ZERO_SLOTS,
  getModuleZeroRequiredSlots,
} from './module-zero';

import { SlotDefinition } from '../types';
import { CAREER_COGNITION_SLOTS } from './career-cognition';
import { MODULE_ZERO_SLOTS } from './module-zero';

/**
 * 根据模块名获取对应的 Slot 定义
 *
 * @param module 模块名：career / coaching / match / interview
 * @returns Slot 定义数组
 */
export function getSlotsForModule(module: string): SlotDefinition[] {
  switch (module) {
    case 'coaching':
      return MODULE_ZERO_SLOTS;
    case 'career':
    default:
      return CAREER_COGNITION_SLOTS;
  }
}

/**
 * 根据模块名获取必填 Slot 列表
 */
export function getRequiredSlotsForModule(module: string): SlotDefinition[] {
  return getSlotsForModule(module).filter((s) => s.required);
}
