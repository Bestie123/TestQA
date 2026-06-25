Index: qtest-runner/packages/mcp-supervisor/src/supervisor.ts
===================================================================
import { spawn, ChildProcess } from 'child_process';
import Fastify from 'fastify';
import { MCPProcess, HealthCheckResult, RestartRecord, MCPStatusResponse, ServerStatus } from './types.js';
import { SupervisorConfig, MCPServerConfig } from './config.js';
import { Logger } from './logger.js';

export class MCPHealthSupervisor {
  private processes: Map<string, MCPProcess> = new Map();
  private restartHistory: RestartRecord[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private fastify: ReturnType<typeof Fastify> | null = null;
  private config: SupervisorConfig;
  private logger: Logger;
  private wsClients: Set<any> = new Set();

  constructor(config: SupervisorConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async start(port: number): Promise<void> {
    // Initialize process registry
    for (const serverConfig of this.config.servers) {
      this.processes.set(serverConfig.name, {
        name: serverConfig.name,
        command: serverConfig.command,
        args: serverConfig.args,
        process: null,
        status: 'stopped',
        pid: null,
        uptime: 0,
        restartCount: 0,
        lastHealthCheck: new Date(),
        lastError: null,
        config: serverConfig,
        logs: [],
      });
    }

    // Start all servers
    for (const [name] of this.processes) {
      await this.startServer(name);
    }

    // Start health check interval
    this.checkInterval = setInterval(() => {
      this.checkAllHealth();
    }, this.config.checkIntervalMs);

    // Start HTTP server
    this.fastify = Fastify({ logger: false });
    this.setupRoutes();
    
    await this.fastify.listen({ port, host: '0.0.0.0' });
    this.logger.info(`📡 HTTP server listening on port ${port}`);
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Stop all processes
    for (const [name, proc] of this.processes) {
      if (proc.process) {
        this.logger.info(`Stopping ${name}...`);
        proc.process.kill('SIGTERM');
      }
    }

    if (this.fastify) {
      await this.fastify.close();
    }
  }

  private async startServer(name: string): Promise<void> {
    const proc = this.processes.get(name);
    if (!proc) return;

    try {
      const child = spawn(proc.command, proc.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...proc.config.env },
        cwd: proc.config.cwd,
      });

      proc.process = child;
      proc.pid = child.pid ?? null;
      proc.status = 'running';
      proc.uptime = Date.now();
      proc.lastError = null;

      // Capture stdout/stderr
      child.stdout?.on('data', (data) => {
        const msg = data.toString().trim();
        proc.logs.push(`[STDOUT] ${msg}`);
        if (proc.logs.length > 100) proc.logs.shift();
      });

      child.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        proc.logs.push(`[STDERR] ${msg}`);
        if (proc.logs.length > 100) proc.logs.shift();
      });

      child.on('exit', (code, signal) => {
        const reason = signal ? `signal ${signal}` : `exit code ${code}`;
        this.logger.warn(`⚠️ ${name} exited: ${reason}`);
        proc.status = 'error';
        proc.lastError = `Process exited with ${reason}`;
        proc.process = null;
        proc.pid = null;
        
        this.addRestartRecord(name, reason, false, 0);
        this.broadcastStatus();
        
        // Auto-restart
        this.scheduleRestart(name);
      });

      child.on('error', (err) => {
        this.logger.error(`❌ ${name} error: ${err.message}`);
        proc.status = 'error';
        proc.lastError = err.message;
        proc.process = null;
        proc.pid = null;
        
        this.addRestartRecord(name, err.message, false, 0);
        this.broadcastStatus();
        
        this.scheduleRestart(name);
      });

      this.logger.info(`✅ ${name} started (PID: ${child.pid})`);
      this.broadcastStatus();
    } catch (err: any) {
      proc.status = 'error';
      proc.lastError = err.message;
      this.logger.error(`❌ Failed to start ${name}: ${err.message}`);
      this.scheduleRestart(name);
    }
  }

  private async scheduleRestart(name: string): Promise<void> {
    const proc = this.processes.get(name);
    if (!proc) return;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const delay = Math.min(
        this.config.baseDelayMs * Math.pow(2, attempt - 1),
        this.config.maxDelayMs
      );

      this.logger.info(`🔄 Restart attempt ${attempt}/${this.config.maxRetries} for ${name} (delay: ${delay}ms)`);
      proc.status = 'restarting';
      this.broadcastStatus();

      await this.sleep(delay);

      await this.startServer(name);
      
      // Check if it's running now
      if (proc.status === 'running' as ServerStatus) {
        this.addRestartRecord(name, 'Auto-restart', true, attempt);
        this.logger.info(`✅ ${name} restarted successfully (attempt ${attempt})`);
        return;
      }
    }

    this.logger.error(`❌ ${name} failed to restart after ${this.config.maxRetries} attempts`);
    proc.status = 'error';
    proc.lastError = `Failed after ${this.config.maxRetries} restart attempts`;
    this.addRestartRecord(name, `Failed after ${this.config.maxRetries} attempts`, false, this.config.maxRetries);
    this.broadcastStatus();
  }

  private async checkAllHealth(): Promise<void> {
    for (const [name] of this.processes) {
      await this.checkHealth(name);
    }
  }

  private async checkHealth(name: string): Promise<HealthCheckResult> {
    const proc = this.processes.get(name);
    if (!proc) {
      return { alive: false, latencyMs: 0, error: 'Process not found' };
    }

    proc.lastHealthCheck = new Date();

    // Simple process check
    if (proc.process && proc.pid) {
      try {
        // process.kill(pid, 0) checks if process exists without sending signal
        process.kill(proc.pid, 0);
        proc.status = 'running';
        return { alive: true, latencyMs: 0 };
      } catch {
        proc.status = 'error';
        proc.lastError = 'Process not responding';
        return { alive: false, latencyMs: 0, error: 'Process not responding' };
      }
    }

    return { alive: false, latencyMs: 0, error: 'No process' };
  }

  private addRestartRecord(serverName: string, reason: string, success: boolean, attempt: number): void {
    this.restartHistory.push({
      serverName,
      timestamp: new Date(),
      reason,
      success,
      attempt,
    });

    // Keep only last 100 records
    if (this.restartHistory.length > 100) {
      this.restartHistory = this.restartHistory.slice(-100);
    }
  }

  private broadcastStatus(): void {
    const status = this.getStatus();
    const message = JSON.stringify(status);
    
    for (const client of this.wsClients) {
      try {
        client.send(message);
      } catch {
        this.wsClients.delete(client);
      }
    }
  }

  private getStatus(): MCPStatusResponse {
    const servers = Array.from(this.processes.values()).map((proc) => ({
      name: proc.name,
      status: proc.status,
      pid: proc.pid,
      uptime: proc.pid ? Date.now() - proc.uptime : 0,
      restartCount: proc.restartCount,
      lastHealthCheck: proc.lastHealthCheck.toISOString(),
      lastError: proc.lastError,
      tools: [], // TODO: extract from config
    }));

    const summary = {
      total: servers.length,
      running: servers.filter((s) => s.status === 'running').length,
      stopped: servers.filter((s) => s.status === 'stopped').length,
      error: servers.filter((s) => s.status === 'error').length,
    };

    return { servers, summary };
  }

  private setupRoutes(): void {
    if (!this.fastify) return;

    // GET /api/mcp/status
    this.fastify.get('/api/mcp/status', async () => {
      return this.getStatus();
    });

    // GET /api/mcp/status/:name
    this.fastify.get('/api/mcp/status/:name', async (request: any, reply: any) => {
      const { name } = request.params as { name: string };
      const proc = this.processes.get(name);
      if (!proc) {
        return reply.status(404).send({ error: 'Server not found' });
      }
      return {
        name: proc.name,
        status: proc.status,
        pid: proc.pid,
        uptime: proc.pid ? Date.now() - proc.uptime : 0,
        restartCount: proc.restartCount,
        lastHealthCheck: proc.lastHealthCheck.toISOString(),
        lastError: proc.lastError,
        logs: proc.logs.slice(-50),
      };
    });

    // POST /api/mcp/restart/:name
    this.fastify.post('/api/mcp/restart/:name', async (request: any, reply: any) => {
      const { name } = request.params as { name: string };
      const proc = this.processes.get(name);
      if (!proc) {
        return reply.status(404).send({ error: 'Server not found' });
      }

      // Kill existing process
      if (proc.process) {
        proc.process.kill('SIGTERM');
        await this.sleep(1000);
      }

      // Restart
      await this.startServer(name);
      return { ok: true, message: `Restarted ${name}` };
    });

    // POST /api/mcp/stop/:name
    this.fastify.post('/api/mcp/stop/:name', async (request: any, reply: any) => {
      const { name } = request.params as { name: string };
      const proc = this.processes.get(name);
      if (!proc) {
        return reply.status(404).send({ error: 'Server not found' });
      }

      if (proc.process) {
        proc.process.kill('SIGTERM');
        proc.process = null;
        proc.pid = null;
        proc.status = 'stopped';
        this.broadcastStatus();
      }

      return { ok: true, message: `Stopped ${name}` };
    });

    // GET /api/mcp/logs/:name
    this.fastify.get('/api/mcp/logs/:name', async (request: any, reply: any) => {
      const { name } = request.params as { name: string };
      const proc = this.processes.get(name);
      if (!proc) {
        return reply.status(404).send({ error: 'Server not found' });
      }
      return { logs: proc.logs.slice(-100) };
    });

    // GET /api/mcp/history
    this.fastify.get('/api/mcp/history', async () => {
      return { history: this.restartHistory.slice(-50) };
    });

    // WebSocket /ws/mcp-status
    this.fastify.get('/ws/mcp-status', { websocket: true }, (socket: any) => {
      this.wsClients.add(socket);
      
      // Send current status immediately
      socket.send(JSON.stringify(this.getStatus()));
      
      socket.on('close', () => {
        this.wsClients.delete(socket);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
