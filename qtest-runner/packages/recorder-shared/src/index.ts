// ══════════════════════════════════════════════════════════════
// recorder-shared — shared types, INJECT_SCRIPT, and utilities
// for recording system (browser-agent + mcp-browser)
// ══════════════════════════════════════════════════════════════

// Types
export * from './types';

// Full INJECT_SCRIPT (574 строк + 924 строки helpers = 1498 строк)
export { INJECT_SCRIPT } from './inject-script';

// All helpers (re-export for direct access if needed)
export * from './inject-helpers';

// Action Queue for programmatic recording (mcp-browser)
export {
  ActionQueue,
  buildClickAction,
  buildFillAction,
  buildKeypressAction,
  buildNavigateAction,
  buildEvaluateAction,
  buildStepMarker,
  buildManualAction,
} from './action-queue';
