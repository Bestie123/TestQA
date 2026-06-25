Index: qtest-runner/packages/mcp-supervisor/src/types.ts
===================================================================
import { ChildProcess } from 'child_process';

export type ServerStatus = 'running' | 'stopped' | 'error' | 'restarting';

export interface MCPProcess {
  name: string;
  command: string;
  args: string[];
  process: ChildProcess | null;
  status: ServerStatus;
  pid: number | null;
  uptime: number;
  restartCount: number;
  lastHealthCheck: Date;
  lastError: string | null;
  config: MCPServerConfig;
  logs: string[];
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  healthTool?: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface HealthCheckResult {
  alive: boolean;
  latencyMs: number;
  error?: string;
}

export interface RestartRecord {
  serverName: string;
  timestamp: Date;
  reason: string;
  success: boolean;
  attempt: number;
}

export interface MCPStatusResponse {
  servers: Array<{
    name: string;
    status: ServerStatus;
    pid: number | null;
    uptime: number;
    restartCount: number;
    lastHealthCheck: string;
    lastError: string | null;
    tools: string[];
  }>;
  summary: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
}
