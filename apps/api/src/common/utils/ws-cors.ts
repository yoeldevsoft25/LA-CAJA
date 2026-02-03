import { Logger } from '@nestjs/common';

const logger = new Logger('WsCors');

export const wsCorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    const nodeEnv = process.env.NODE_ENV;
    const isDevelopment = nodeEnv !== 'production';
    const allowAllOriginsLocal = process.env.ALLOW_ALL_ORIGINS_LOCAL === 'true';

    // Log the incoming origin for debugging
    if (origin) {
      logger.debug(`Incoming WebSocket origin: ${origin}`);
    }

    if (isDevelopment && allowAllOriginsLocal) {
      return callback(null, true);
    }

    if (!origin && isDevelopment) {
      return callback(null, true);
    }

    // Dynamic origin calculation to ensure env vars are loaded
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    const baseOrigins = allowedOrigins
      ? allowedOrigins
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : [
          'http://localhost:5173',
          'http://localhost:4173',
          'http://localhost:3000',
        ];

    const extraOrigins = [
      process.env.PUBLIC_APP_URL,
      process.env.APP_URL,
      process.env.RENDER_EXTERNAL_URL,
    ].filter((o): o is string => Boolean(o));

    const origins = Array.from(new Set([...baseOrigins, ...extraOrigins]));

    if (!origin || origins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(
      `CORS blocked for websocket origin: ${origin}. Allowed: ${origins.join(', ')}`,
    );
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-key',
    'x-seniat-audit-key',
    'ngrok-skip-browser-warning',
  ],
};
