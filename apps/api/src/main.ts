import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
// import helmet = require('@fastify/helmet');
import { SecretValidator } from './common/utils/secret-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
    }),
  );

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const isDevelopment = nodeEnv !== 'production';

  // WebSocket adapter explícito para Fastify + Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

  // Validar secrets al iniciar
  SecretValidator.validateAllSecrets(configService);

  // Security Headers (debe ir ANTES de CORS)
  await app.register(helmet, {
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Permitir scripts inline para el dashboard
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
    hsts: isDevelopment
      ? false
      : {
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
    crossOriginOpenerPolicy: isDevelopment ? false : { policy: 'same-origin' },
    crossOriginEmbedderPolicy: isDevelopment ? false : true,
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
  const allowAllOriginsLocal =
    configService.get<string>('ALLOW_ALL_ORIGINS_LOCAL') === 'true';

  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  const extraOrigins = [
    configService.get<string>('PUBLIC_APP_URL'),
    configService.get<string>('APP_URL'),
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('RENDER_EXTERNAL_URL'),
    'https://veloxpos.app',
    'https://veloxpos.netlify.app',
  ].filter((origin): origin is string => Boolean(origin));

  const normalizeOrigin = (value: string): string =>
    value.trim().toLowerCase().replace(/\/+$/, '');

  const originList = allowedOrigins
    ? allowedOrigins.split(',').map((origin) => normalizeOrigin(origin))
    : [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
      ]; // Defaults para desarrollo (5173) y preview (4173)
  const origins = Array.from(
    new Set([
      ...originList,
      ...extraOrigins.map((origin) => normalizeOrigin(origin)),
    ]),
  );
  const allowedOriginSet = new Set(origins);

  const isTauriOrigin = (value: string): boolean => {
    return (
      value === 'tauri://localhost' ||
      /^https?:\/\/tauri\.localhost(?::\d+)?$/i.test(value)
    );
  };

  const isProductionDomain = (value: string): boolean => {
    return (
      value.endsWith('.netlify.app') ||
      value.endsWith('.netlify.com') ||
      value.endsWith('veloxpos.app')
    );
  };

  // Obtener puerto antes de usarlo
  const port = configService.get<number>('PORT') || 3000;

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir todas las conexiones si se permite localmente (útil para VPN/Tailscale)
      // Incluso en start:prod si estamos en local
      if (allowAllOriginsLocal) {
        return callback(null, true);
      }

      // Permitir requests sin origin (mobile apps, Postman, etc.) solo en desarrollo
      if (!origin && isDevelopment) {
        return callback(null, true);
      }

      const normalizedOrigin = origin ? normalizeOrigin(origin) : origin;

      if (
        !normalizedOrigin ||
        allowedOriginSet.has(normalizedOrigin) ||
        isTauriOrigin(normalizedOrigin) ||
        isProductionDomain(normalizedOrigin)
      ) {
        callback(null, true);
      } else {
        logger.warn(
          `CORS bloqueado para origen: ${origin} (Normalizado: ${normalizedOrigin})`,
        );
        // Bloquear sin lanzar excepción evita respuestas 500 por preflight/health checks.
        callback(null, false);
      }
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
  });

  // Configurar Swagger/OpenAPI
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED') !== 'false';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Velox POS API')
      .setDescription(
        'Velox POS Offline-First para Venezuela - Documentación completa de la API',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Ingresa el token JWT',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Autenticación y autorización')
      .addTag('products', 'Gestión de productos')
      .addTag('inventory', 'Gestión de inventario')
      .addTag('sales', 'Ventas y transacciones')
      .addTag('orders', 'Órdenes y cuentas abiertas')
      .addTag('payments', 'Métodos de pago')
      .addTag('cash', 'Gestión de caja')
      .addTag('shifts', 'Turnos de trabajo')
      .addTag('customers', 'Gestión de clientes')
      .addTag('sync', 'Sincronización offline-first')
      .addTag('realtime-analytics', 'Analíticas en tiempo real')
      .addTag('observability', 'Observabilidad y monitoreo')
      .addTag('ml', 'Machine Learning y predicciones')
      .addTag('notifications', 'Sistema de notificaciones')
      .addTag('whatsapp', 'Integración WhatsApp')
      .addTag('fiscal', 'Facturación fiscal')
      .addTag('reports', 'Reportes y análisis')
      .addTag('backup', 'Respaldo de datos')
      .addServer(
        'https://veloxpos2.share.zrok.io',
        'Servidor de desarrollo (Zrok)',
      )
      .addServer('http://localhost:3000', 'Servidor de desarrollo')
      .addServer(
        'https://la-caja-8i4h.onrender.com',
        'Servidor de Producción (Render)',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Velox POS API - Documentación',
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      },
    });
    logger.log(`📚 Swagger disponible en http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API listening on http://localhost:${port}`);

  if (isDevelopment && allowAllOriginsLocal) {
    logger.warn(
      `⚠️  CORS: PERMITIENDO TODOS LOS ORÍGENES (modo desarrollo + VPN)`,
    );
  } else {
    logger.log(`📋 CORS permitido para: ${origins.join(', ')}`);
  }
}

bootstrap();
