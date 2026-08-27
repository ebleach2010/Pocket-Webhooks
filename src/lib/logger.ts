import pino, { type Logger } from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

const usePretty = process.env.NODE_ENV !== 'production' && process.stdout.isTTY;

export const logger: Logger = pino({
  level,
  ...(usePretty
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } }
    : {}),
});

export type { Logger };
