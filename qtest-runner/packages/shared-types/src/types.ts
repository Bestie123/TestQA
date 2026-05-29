// ── Test Case ──
export interface ITestCase {
  id: string;
  key: string;
  name: string;
  status: TestCaseStatus;
  precondition: string;
  objective: string;
  folder: string;
  priority: TestCasePriority;
  component: string;
  labels: string;
  owner: string;
  estimatedTime: string;
  coverageIssues: string;
  coveragePages: string;
  steps: ITestStep[];
  createdAt: string;
  updatedAt: string;
}

export enum TestCaseStatus {
  Approved = 'Approved',
  Deprecated = 'Deprecated',
}

export enum TestCasePriority {
  High = 'High',
  Normal = 'Normal',
  Low = 'Low',
}

// ── Test Step ──
export interface ITestStep {
  id: string;
  testCaseId: string;
  index: number;
  action: string;
  testData: string;
  expectedResult: string;
}

// ── Execution ──
export enum StepStatus {
  Pending = 'pending',
  Running = 'running',
  Passed = 'passed',
  Failed = 'failed',
  Skipped = 'skipped',
  Blocked = 'blocked',
}

export enum ExecutionStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Passed = 'passed',
  Failed = 'failed',
  Blocked = 'blocked',
}

export interface ITestExecution {
  id: string;
  testCaseId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string;
  steps: IStepResult[];
}

export interface IStepResult {
  stepId: string;
  index: number;
  status: StepStatus;
  screenshot: string;
  notes: string;
  startedAt: string;
  completedAt: string;
}

// ── Step Library ──
export interface ILibraryStep {
  id: string;
  name: string;
  description: string;
  category: string;
  action: string;
  parameters: IStepParameter[];
}

export interface IStepParameter {
  name: string;
  label: string;
  type: 'string' | 'select' | 'boolean' | 'url';
  options: string[];
  required: boolean;
  defaultValue: string;
}

// ── Import Result ──
export interface IImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ── Recording ──
export interface IRecordedAction {
  id: string;
  type: RecordedActionType;
  timestamp: string;
  selector?: string;
  selectorText?: string;
  value?: string;
  url?: string;
  pageTitle?: string;
  tabId?: string;
  screenshot?: string;
  // HTTP request/response
  method?: string;
  resourceType?: string;
  postData?: string;
  headers?: Record<string, string>;
  status?: number;
  body?: string;
  error?: string;
  // DOM mutations
  level?: string;
  role?: string;
  path?: string;
  oldValue?: string;
  inputType?: string;
  // User interaction modifiers
  combo?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  checked?: boolean;
  optionIndex?: number;
  scrollY?: number;
  scrollMax?: number;
  x?: number;
  y?: number;
  result?: string;
  shadowDom?: boolean;
}

export type RecordedActionType =
  // User actions
  'click' | 'dblclick' | 'fill' | 'select' | 'keypress' | 'check' |
  'contextmenu' | 'dragstart' | 'dragend' | 'drop' | 'submit' |
  'hover' | 'focus' | 'scroll' | 'resize' | 'clipboard' |
  // Navigation
  'navigate' | 'page_load' |
  // HTTP
  'request' | 'response' | 'request_failed' |
  // DOM
  'element_appear' | 'element_remove' | 'attr_change' | 'text_change' |
  // System
  'dialog' | 'console' | 'screenshot' | 'switch_user' | 'ime_composition';

export interface IRecordingSession {
  id: string;
  name: string;
  status: 'recording' | 'stopped' | 'converted';
  actions: IRecordedAction[];
  startedAt: string;
  stoppedAt?: string;
  profileId?: string;
}

// ── Composite Step ──
export interface ICompositeStep {
  id: string;
  name: string;
  description: string;
  steps: ICompositeStepItem[];
  parameters: IStepParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface ICompositeStepItem {
  libraryStepId?: string;
  action: string;
  selector?: string;
  value?: string;
  url?: string;
  text?: string;
  parameterBindings: Record<string, string>;
}

// ── User Switch Config ──
export interface IUserSwitchConfig {
  hotkey: string;
  enabled: boolean;
  profiles: IUserProfile[];
}

export interface IUserProfile {
  id: string;
  name: string;
  login: string;
  userDataDir: string;
}

// ── Diff ──
export interface ITestCaseDiff {
  key: string;
  name: string;
  localVersion: ITestCase;
  remoteVersion: ITestCase;
  differences: IDiffEntry[];
}

export interface IDiffEntry {
  field: string;
  localValue: string;
  remoteValue: string;
}
