# Solución: Error de conexión a la base de datos

## Problema

El error `client password must be a string` indica que la contraseña en `DATABASE_URL` no está siendo parseada correctamente.

## Solución

### Opción 1: Formato estándar de DATABASE_URL

En tu archivo `apps/api/.env`, usa este formato:

```env
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/la_caja
```

**Importante:** Si tu contraseña tiene caracteres especiales, necesitas codificarlos:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- Espacios → `%20`

**Ejemplo:**
```env
# Si tu contraseña es "mi@pass123"
DATABASE_URL=postgresql://postgres:mi%40pass123@localhost:5432/la_caja
```

### Opción 2: Usar variables separadas (más seguro)

Si prefieres, puedes usar el formato con variables separadas. Modifica `apps/api/src/app.module.ts` para usar:

```typescript
{
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'la_caja',
  // ...
}
```

Y en `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_contraseña_aquí
DB_NAME=la_caja
```

### Verificar tu contraseña actual

1. Abre `apps/api/.env`
2. Verifica que `DATABASE_URL` tenga el formato correcto
3. Si tu contraseña tiene caracteres especiales, codifícalos

### Ejemplo completo

```env
PORT=3000
NODE_ENV=development

# Si tu usuario es "postgres" y contraseña es "admin123"
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/la_caja

JWT_SECRET=tu-secret-key-super-seguro-minimo-32-caracteres-cambiar-en-produccion
JWT_EXPIRES_IN=7d
```

### Prueba de conexión

Una vez corregido el `.env`, reinicia el servidor:
```powershell
npm run dev:api
```

Deberías ver:
```
[Nest] ... LOG [InstanceLoader] TypeOrmModule dependencies initialized
```

Sin errores de conexión.

