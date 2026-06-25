Index: qtest-runner/packages/mcp-supervisor/src/config.ts
===================================================================
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  healthTool?: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface SupervisorConfig {
  checkIntervalMs: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  logRetentionDays: number;
  alertOnFailure: boolean;
  servers: MCPServerConfig[];
}

const DEFAULT_CONFIG: SupervisorConfig = {
  checkIntervalMs: 10000,
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  logRetentionDays: 7,
  alertOnFailure: true,
  servers: [
    {
      name: 'chrome-devtools',
      command: 'node',
      args: ['packages/mcp-chrome-devtools/dist/index.js'],
      healthTool: 'cdp_list_tabs',
      timeoutMs: 5000,
    },
    {
      name: 'zephyr-scale',
      command: 'node',
      args: ['packages/mcp-zephyr-scale/dist/index.js'],
      healthTool: 'zephyr_list_projects',
      timeoutMs: 10000,
    },
    {
      name: 'browser-devtools',
      command: 'node',
      args: ['packages/mcp-browser-devtools/dist/index.js'],
      healthTool: 'browser_list_tabs',
      timeoutMs: 5000,
    },
    {
      name: 'regression-test',
      command: 'node',
      args: ['packages/mcp-regression-test/dist/index.js'],
      healthTool: 'get_logs',
      timeoutMs: 5000,
    },
    {
      name: 'opencode-db',
      command: 'node',
      args: ['packages/mcp-opencode-db/dist/index.js'],
      healthTool: 'oc_list_dbs',
      timeoutMs: 5000,
    },
    {
      name: 'qtest-debug',
      command: 'node',
      args: ['packages/mcp-qtest-debug/dist/index.js'],
      healthTool: 'qtest_health',
      timeoutMs: 5000,
    },
  ],
};

export async function loadConfig(): Promise<SupervisorConfig> {
  const configPath = join(process.cwd(), 'packages', 'mcp-supervisor', 'config.json');
  
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (err) {
      console.warn(`⚠️ Failed to load config from ${configPath}, using defaults`);
    }
  }
  
  return DEFAULT_CONFIG;
}
