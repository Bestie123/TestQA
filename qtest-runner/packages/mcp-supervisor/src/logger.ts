Index: qtest-runner/packages/mcp-supervisor/src/logger.ts
===================================================================
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export function createLogger(component: string): Logger {
  const logDir = join(process.cwd(), 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = join(logDir, `${component}.log`);
  
  const format = (level: string, message: string) => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  };
  
  const write = (level: string, message: string) => {
    const line = format(level, message);
    console.log(line);
    try {
      appendFileSync(logFile, line + '\n');
    } catch {}
  };
  
  return {
    info: (msg) => write('INFO', msg),
    warn: (msg) => write('WARN', msg),
    error: (msg) => write('ERROR', msg),
    debug: (msg) => write('DEBUG', msg),
  };
}
