#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { ApiClient } from './api-client';
import { AuthClient } from './auth';
import { configStorePath, loadConfig, validateConfig } from './config';
import { createLogger, type AgentLogger } from './logger';
import { AgentApp } from './runtime';
import { FileAgentStore } from './store';

const USAGE = `screen-time agent

Usage:
  screen-time-agent login <email>    Store credentials for this machine
  screen-time-agent run              Capture + sync events until Ctrl-C
  screen-time-agent logout           Clear stored credentials/device

Environment:
  STA_API_BASE_URL      Backend base URL (default http://localhost:3000)
  STA_DEVICE_NAME       Name reported for this device
  STA_SPOOL_DIR         JSONL event spool location
  STA_CONFIG_DIR       Agent settings directory
  STA_LOCAL_SERVER_PORT  Local server port (0 = disable)`;

async function main(argv: string[]): Promise<number> {
  const logger = createLogger(process.env.STA_LOG_LEVEL === 'debug' ? 'debug' : 'info');
  const [command, ...args] = argv;

  switch (command) {
    case 'login': {
      const email = args[0];
      if (!email || !email.includes('@')) {
        logger.error('usage: screen-time-agent login <email>');
        return 1;
      }
      return runLogin(email, logger);
    }
    case 'logout': {
      const config = loadConfig();
      const store = new FileAgentStore(configStorePath(config.configDir));
      await store.save({});
      logger.info('credentials cleared');
      return 0;
    }
    case 'run':
    case undefined:
      return runAgent(logger);
    default:
      stdout.write(`${USAGE}\n`);
      return command === '--help' || command === '-h' ? 0 : 1;
  }
}

async function runLogin(email: string, logger: AgentLogger): Promise<number> {
  const config = loadConfig();
  const store = new FileAgentStore(configStorePath(config.configDir));

  const rl = createInterface({ input: stdin, output: stdout });
  const password = await rl.question(`Password for ${email}: `);
  rl.close();

  const auth = new AuthClient(new ApiClient(config.apiBaseUrl), store);
  try {
    const session = await auth.login(email, password);
    logger.info('login_ok', { email: session.user.email, userId: session.user.id });
  } catch (err) {
    logger.error('login_failed', { message: err instanceof Error ? err.message : String(err) });
    return 1;
  }
  return 0;
}

async function runAgent(logger: AgentLogger): Promise<number> {
  const config = loadConfig();
  const error = validateConfig(config);
  if (error) {
    logger.error(`invalid config: ${error}`);
    return 1;
  }

  const app = new AgentApp({ config, logger });
  try {
    const { deviceId } = await app.start();
    logger.info('agent_started', { deviceId, capture: 'x11+mpris', api: config.apiBaseUrl });
  } catch (err) {
    logger.error('startup_failed', { message: err instanceof Error ? err.message : String(err) });
    return 1;
  }

  await new Promise<void>((resolve) => {
    const shutdown = () => void app.stop().finally(resolve);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

  logger.info('agent_stopped');
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    createLogger().error('fatal', { message: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  },
);
