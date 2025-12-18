# 🔧 Implementación de Mejoras Críticas de Seguridad

Este documento contiene las implementaciones específicas para las vulnerabilidades críticas identificadas.

---

## 1. Security Headers (Helmet) - CRÍTICO

### Instalación

```bash
cd apps/api
npm install @fastify/helmet
npm install --save-dev @types/node
```

### Implementación

**Archivo:** `apps/api/src/main.ts`

```typescript
import helmet from '@fastify/helmet';

async function bootstrap() {
  // ... código existente ...

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

  // ... resto del código ...
}
```

---

## 2. Security Audit Service - CRÍTICO

### Migración SQL

**Archivo:** `apps/api/src/database/migrations/30_security_audit.sql`

```sql
-- Tabla de auditoría de seguridad
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  status TEXT NOT NULL, -- 'success', 'failure', 'blocked'
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_audit_store ON security_audit_log(store_id);
CREATE INDEX idx_security_audit_type ON security_audit_log(event_type);
CREATE INDEX idx_security_audit_created ON security_audit_log(created_at);
CREATE INDEX idx_security_audit_ip ON security_audit_log(ip_address);

COMMENT ON TABLE security_audit_log IS 'Registro de eventos de seguridad para auditoría';
COMMENT ON COLUMN security_audit_log.event_type IS 'Tipo de evento: login_attempt, permission_change, admin_action, etc.';
COMMENT ON COLUMN security_audit_log.status IS 'Estado: success, failure, blocked';
```

### Entity

**Archivo:** `apps/api/src/database/entities/security-audit-log.entity.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('security_audit_log')
export class SecurityAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index()
  event_type: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  store_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'inet', nullable: true })
  @Index()
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'text', nullable: true })
  request_path: string | null;

  @Column({ type: 'text', nullable: true })
  request_method: string | null;

  @Column({ type: 'text' })
  status: 'success' | 'failure' | 'blocked';

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  @Index()
  created_at: Date;
}
```

### Service

**Archivo:** `apps/api/src/security/security-audit.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityAuditLog } from '../database/entities/security-audit-log.entity';

export type AuditEventType =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'login_blocked'
  | 'permission_change'
  | 'admin_action'
  | 'sensitive_data_access'
  | 'unauthorized_access'
  | 'rate_limit_exceeded';

export interface AuditLogData {
  event_type: AuditEventType;
  store_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_path?: string;
  request_method?: string;
  status: 'success' | 'failure' | 'blocked';
  details?: Record<string, any>;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    @InjectRepository(SecurityAuditLog)
    private auditRepository: Repository<SecurityAuditLog>,
  ) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      const auditLog = this.auditRepository.create({
        event_type: data.event_type,
        store_id: data.store_id || null,
        user_id: data.user_id || null,
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
        request_path: data.request_path || null,
        request_method: data.request_method || null,
        status: data.status,
        details: data.details || null,
      });

      await this.auditRepository.save(auditLog);
    } catch (error) {
      // No fallar la aplicación si falla el logging
      this.logger.error('Error guardando audit log', error);
    }
  }

  async getFailedLoginAttempts(
    ipAddress: string,
    minutes: number = 15,
  ): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.auditRepository.count({
      where: {
        event_type: 'login_failure',
        ip_address: ipAddress,
        created_at: { $gte: since } as any,
      },
    });
  }

  async getAuditLogs(
    storeId?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: SecurityAuditLog[]; total: number }> {
    const query = this.auditRepository.createQueryBuilder('log');

    if (storeId) {
      query.where('log.store_id = :storeId', { storeId });
    }

    const total = await query.getCount();
    const logs = await query
      .orderBy('log.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    return { logs, total };
  }
}
```

### Module

**Archivo:** `apps/api/src/security/security.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAuditLog } from '../database/entities/security-audit-log.entity';
import { SecurityAuditService } from './security-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityAuditLog])],
  providers: [SecurityAuditService],
  exports: [SecurityAuditService],
})
export class SecurityModule {}
```

### Uso en AuthController

**Modificar:** `apps/api/src/auth/auth.controller.ts`

```typescript
import { SecurityAuditService } from '../security/security-audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: any,
    @Request() req: any,
  ): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // ... validación existente ...

    try {
      const result = await this.authService.login(dto);
      
      // ✅ Log éxito
      await this.securityAudit.log({
        event_type: 'login_success',
        store_id: dto.store_id,
        user_id: result.user_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/login',
        request_method: 'POST',
        status: 'success',
      });

      return result;
    } catch (error) {
      // ✅ Log fallo
      await this.securityAudit.log({
        event_type: 'login_failure',
        store_id: dto.store_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/login',
        request_method: 'POST',
        status: 'failure',
        details: {
          error: error.message,
        },
      });

      throw error;
    }
  }
}
```

---

## 3. Mejora AdminApiGuard - CRÍTICO

**Archivo:** `apps/api/src/admin/admin-api.guard.ts`

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SecurityAuditService } from '../security/security-audit.service';

@Injectable()
export class AdminApiGuard implements CanActivate {
  private readonly logger = new Logger(AdminApiGuard.name);

  constructor(private readonly securityAudit: SecurityAuditService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    
    // ✅ SOLO headers, NO query params
    const headerKey = req.headers['x-admin-key'] as string | undefined;
    const expected = process.env.ADMIN_SECRET;

    if (!expected) {
      throw new ForbiddenException('Admin no configurado (falta ADMIN_SECRET)');
    }

    if (!headerKey || headerKey !== expected) {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      
      // ✅ Log intento no autorizado
      this.securityAudit.log({
        event_type: 'unauthorized_access',
        ip_address: ipAddress,
        user_agent: req.headers['user-agent'] || 'unknown',
        request_path: req.url,
        request_method: req.method,
        status: 'blocked',
        details: {
          reason: 'Invalid admin key',
        },
      });

      this.logger.warn(`Intento de acceso admin no autorizado desde ${ipAddress}`);
      throw new ForbiddenException('No autorizado (admin)');
    }

    return true;
  }
}
```

---

## 4. Validación de Secrets al Iniciar - IMPORTANTE

**Archivo:** `apps/api/src/common/utils/secret-validator.ts`

```typescript
import { Logger } from '@nestjs/common';

export class SecretValidator {
  private static readonly logger = new Logger(SecretValidator.name);

  static validateJwtSecret(secret: string | undefined): void {
    if (!secret) {
      throw new Error(
        'JWT_SECRET debe estar configurado en las variables de entorno',
      );
    }

    if (secret.length < 32) {
      throw new Error(
        `JWT_SECRET debe tener al menos 32 caracteres. Actual: ${secret.length}`,
      );
    }

    // Verificar que no sea el valor por defecto
    if (secret.includes('default-secret') || secret.includes('change-in-production')) {
      throw new Error(
        'JWT_SECRET no puede contener valores por defecto. Debe ser único y seguro.',
      );
    }

    this.logger.log('✅ JWT_SECRET validado correctamente');
  }

  static validateAdminSecret(secret: string | undefined): void {
    if (!secret) {
      this.logger.warn('⚠️ ADMIN_SECRET no configurado. Endpoints admin deshabilitados.');
      return;
    }

    if (secret.length < 16) {
      throw new Error(
        `ADMIN_SECRET debe tener al menos 16 caracteres. Actual: ${secret.length}`,
      );
    }

    this.logger.log('✅ ADMIN_SECRET validado correctamente');
  }

  static validateAllSecrets(configService: any): void {
    this.validateJwtSecret(configService.get<string>('JWT_SECRET'));
    this.validateAdminSecret(configService.get<string>('ADMIN_SECRET'));
  }
}
```

**Usar en:** `apps/api/src/main.ts`

```typescript
import { SecretValidator } from './common/utils/secret-validator';

async function bootstrap() {
  // ... código existente ...
  
  const configService = app.get(ConfigService);
  
  // ✅ Validar secrets al iniciar
  SecretValidator.validateAllSecrets(configService);

  // ... resto del código ...
}
```

---

## 5. SSL Verification Mejorado - CRÍTICO

**Archivo:** `apps/api/src/app.module.ts`

```typescript
// ... código existente ...

ssl: isProduction
  ? {
      rejectUnauthorized: true, // ✅ Cambiar a true
      // Si Supabase requiere certificado específico:
      // ca: fs.readFileSync('path/to/ca-cert.pem'),
    }
  : false,
```

**Nota:** Si Supabase requiere `rejectUnauthorized: false`, considerar:
- Usar certificado CA específico
- O documentar el riesgo y mitigar con otras medidas

---

## 6. Rate Limiting Mejorado con Bloqueo Progresivo

**Archivo:** `apps/api/src/auth/guards/login-rate-limit.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SecurityAuditService } from '../../security/security-audit.service';

@Injectable()
export class LoginRateLimitGuard extends ThrottlerGuard {
  constructor(
    options: any,
    private readonly securityAudit: SecurityAuditService,
  ) {
    super(options);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';

    // Verificar intentos fallidos recientes
    const failedAttempts = await this.securityAudit.getFailedLoginAttempts(
      ipAddress,
      15, // últimos 15 minutos
    );

    // Bloqueo progresivo
    if (failedAttempts >= 10) {
      await this.securityAudit.log({
        event_type: 'login_blocked',
        ip_address: ipAddress,
        request_path: request.url,
        request_method: request.method,
        status: 'blocked',
        details: {
          reason: 'Too many failed attempts',
          failedAttempts,
        },
      });

      throw new HttpException(
        {
          message: 'Demasiados intentos fallidos. Intenta más tarde.',
          retryAfter: 900, // 15 minutos
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return super.canActivate(context);
  }
}
```

---

## 7. Actualizar AppModule

**Archivo:** `apps/api/src/app.module.ts`

```typescript
// Agregar SecurityModule
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    // ... imports existentes ...
    SecurityModule, // ✅ Agregar
  ],
  // ... resto del código ...
})
export class AppModule {}
```

---

## 8. Checklist de Implementación

- [ ] Instalar `@fastify/helmet`
- [ ] Crear migración `30_security_audit.sql`
- [ ] Crear entity `SecurityAuditLog`
- [ ] Crear `SecurityModule` y `SecurityAuditService`
- [ ] Actualizar `AdminApiGuard` (remover query params)
- [ ] Agregar validación de secrets en `main.ts`
- [ ] Actualizar `AuthController` para usar auditoría
- [ ] Cambiar SSL `rejectUnauthorized: true`
- [ ] Implementar `LoginRateLimitGuard` (opcional pero recomendado)
- [ ] Ejecutar migración: `npm run migration:run`
- [ ] Probar endpoints de autenticación
- [ ] Verificar logs de auditoría

---

## 9. Pruebas

### Probar Security Headers

```bash
curl -I http://localhost:3000/auth/stores
# Debe incluir:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Probar Auditoría

```bash
# Intentar login fallido
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"store_id":"invalid","pin":"0000"}'

# Verificar en DB
psql -d la_caja -c "SELECT * FROM security_audit_log ORDER BY created_at DESC LIMIT 5;"
```

### Probar AdminApiGuard

```bash
# ❌ Debe fallar (query param removido)
curl "http://localhost:3000/admin/stores?admin_key=test"

# ✅ Debe funcionar (header)
curl -H "x-admin-key: test" http://localhost:3000/admin/stores
```

---

## 10. Notas Importantes

1. **Helmet y Fastify:** Asegurar compatibilidad de versiones
2. **Performance:** Auditoría asíncrona para no bloquear requests
3. **Privacidad:** No loguear datos sensibles (PINs, tokens)
4. **Retención:** Considerar política de retención de logs de auditoría
5. **Alertas:** Configurar alertas para múltiples fallos de login

---

**Documento generado por:** Security Engineer Agent


