import { Logger } from '@nestjs/common';

const logger = new Logger('WsCors');

const nodeEnv = process.env.NODE_ENV;
const isDevelopment = nodeEnv !== 'production';
const allowAllOriginsLocal = process.env.ALLOW_ALL_ORIGINS_LOCAL === 'true';

const allowedOrigins = process.env.ALLOWED_ORIGINS;
const origins = allowedOrigins
  ? allowedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:3000',
    ];

export const wsCorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (isDevelopment && allowAllOriginsLocal) {
      return callback(null, true);
    }

    if (!origin && isDevelopment) {
      return callback(null, true);
    }

    if (!origin || origins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked for websocket origin: ${origin}`);
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
};
