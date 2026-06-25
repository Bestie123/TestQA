// ══════════════════════════════════════════════════════════════
// Shared types for recorder system
// ══════════════════════════════════════════════════════════════

export interface RecordedAction {
  actionType: string;
  selector?: string;
  selectorText?: string;
  value?: string;
  url?: string;
  pageTitle?: string;
  timestamp: string;
  tabId?: string;
  frameUrl?: string;
  frameName?: string;
  iframeAction?: boolean;
  shadowDom?: boolean;
  inputType?: string;
  checked?: boolean;
  combo?: string;
  x?: number;
  y?: number;
  scrollY?: number;
  spaMethod?: string;
  tagName?: string;
  role?: string;
  optionIndex?: number;
  displayValue?: string;
  // Programmatic action markers
  source?: 'dom' | 'programmatic' | 'manual';
  // Step marker fields
  stepNumber?: number;
  description?: string;
  expectedResult?: string;
  // Manual action fields
  actionType2?: 'verify' | 'observe' | 'note' | 'assert';
  expected?: string;
  actual?: string;
  screenshot?: string; // base64 PNG
}

export interface RecordingSettings {
  recordNetwork: boolean;
  recordConsole: boolean;
  recordHover: boolean;
  recordTransitions: boolean;
  recordResize: boolean;
  recordScroll: boolean;
  recordMutations: boolean;
  recordProgrammatic: boolean;
  recordNavigation: boolean;
  recordDialogs: boolean;
}

export const DEFAULT_SETTINGS: RecordingSettings = {
  recordNetwork: true,
  recordConsole: true,
  recordHover: false,
  recordTransitions: false,
  recordResize: false,
  recordScroll: false,
  recordMutations: true,
  recordProgrammatic: true,
  recordNavigation: true,
  recordDialogs: true,
};

export interface StepMarker {
  type: 'step_marker';
  stepNumber: number;
  description: string;
  expectedResult?: string;
  timestamp: number;
  source: 'programmatic';
}

export interface ManualAction {
  type: 'manual_action';
  action: string;
  actionType: 'verify' | 'observe' | 'note' | 'assert';
  selector?: string;
  expected?: string;
  actual?: string;
  screenshot?: string;
  timestamp: number;
  source: 'programmatic';
}
