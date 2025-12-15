import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);

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
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  const origins = allowedOrigins
    ? allowedOrigins.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000']; // Defaults para desarrollo (5173) y preview (4173)

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, Postman, etc.) solo en desarrollo
      if (!origin && configService.get<string>('NODE_ENV') !== 'production') {
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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  });

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API listening on http://localhost:${port}`);
  logger.log(`📋 CORS permitido para: ${origins.join(', ')}`);
}

bootstrap();

