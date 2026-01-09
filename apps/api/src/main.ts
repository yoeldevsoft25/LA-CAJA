import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
import { SecretValidator } from './common/utils/secret-validator';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);

  // Validar secrets al iniciar
  SecretValidator.validateAllSecrets(configService);

  // Security Headers (debe ir ANTES de CORS)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 año
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  });

  // Validación estricta de datos
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Rechazar campos no esperados por seguridad
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS restringido a orígenes permitidos
  const nodeEnv = configService.get<string>('NODE_ENV');
  const isDevelopment = nodeEnv !== 'production';
  const allowAllOriginsLocal = configService.get<string>('ALLOW_ALL_ORIGINS_LOCAL') === 'true';
  
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  const origins = allowedOrigins
    ? allowedOrigins.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
      ]; // Defaults para desarrollo (5173) y preview (4173)

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir todas las conexiones si está en desarrollo local y se permite (útil para VPN)
      if (isDevelopment && allowAllOriginsLocal) {
        return callback(null, true);
      }

      // Permitir requests sin origin (mobile apps, Postman, etc.) solo en desarrollo
      if (!origin && isDevelopment) {
        return callback(null, true);
      }

      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqueado para origen: ${origin}`);
        callback(new Error('No permitido por CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-admin-key',
      'x-seniat-audit-key',
    ],
  });

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API listening on http://localhost:${port}`);
  
  if (isDevelopment && allowAllOriginsLocal) {
    logger.warn(`⚠️  CORS: PERMITIENDO TODOS LOS ORÍGENES (modo desarrollo + VPN)`);
  } else {
    logger.log(`📋 CORS permitido para: ${origins.join(', ')}`);
  }
}

bootstrap();
