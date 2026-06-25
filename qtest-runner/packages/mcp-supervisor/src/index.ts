Index: qtest-runner/packages/mcp-supervisor/src/index.ts
===================================================================
#!/usr/bin/env node

/**
 * MCP Health Supervisor
 * 
 * Background daemon that monitors MCP server health and auto-restarts
 * crashed processes with exponential backoff.
 * 
 * Usage:
 *   node packages/mcp-supervisor/dist/index.js
 *   npm run supervisor
 * 
 * API:
 *   GET  /api/mcp/status          — all servers + status
 *   GET  /api/mcp/status/:name    — single server status
 *   POST /api/mcp/restart/:name   — force restart
 *   POST /api/mcp/stop/:name      — stop server
 *   GET  /api/mcp/logs/:name      — server logs (last 100 lines)
 *   GET  /api/mcp/history         — restart history
 *   WS   /ws/mcp-status           — live status updates
 */

import { MCPHealthSupervisor } from './supervisor.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const PORT = parseInt(process.env.MCP_SUPERVISOR_PORT || '3007', 10);

async function main() {
  const logger = createLogger('mcp-supervisor');
  const config = await loadConfig();
  
  logger.info('🚀 MCP Health Supervisor starting...');
  logger.info(`   Port: ${PORT}`);
  logger.info(`   Check interval: ${config.checkIntervalMs}ms`);
  logger.info(`   Max retries: ${config.maxRetries}`);
  
  const supervisor = new MCPHealthSupervisor(config, logger);
  await supervisor.start(PORT);
  
  // Graceful shutdown
  const shutdown = async () => {
    logger.info('🛑 Shutting down MCP Health Supervisor...');
    await supervisor.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGBREAK', shutdown);
  
  logger.info('✅ MCP Health Supervisor ready');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
