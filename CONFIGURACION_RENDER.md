# Configuración del Backend en Render

## Datos para el formulario de Render

### Información Básica

- **Name**: `LA-CAJA`
- **Project** (Opcional): Puedes crear un proyecto o dejarlo vacío
- **Environment**: `Production`
- **Language**: `Node`
- **Branch**: `main`
- **Region**: `Virginia (US East)` (o la región más cercana a tus usuarios)
- **Root Directory**: `apps/api` (Opcional, pero recomendado)

### Comandos

#### Build Command
```bash
npm install && npm run build
```

**Nota**: Si NO configuraste Root Directory, usa:
```bash
cd apps/api && npm install && npm run build
```

#### Start Command
```bash
npm run start:prod
```

**Nota**: Si NO configuraste Root Directory, usa:
```bash
cd apps/api && npm run start:prod
```

### Instance Type

Para producción, se recomienda al menos:
- **Starter** ($7/mes) - 512 MB RAM, 0.5 CPU
- **Standard** ($25/mes) - 2 GB RAM, 1 CPU (Recomendado para producción)

Para desarrollo/pruebas puedes usar **Free** (512 MB RAM, 0.1 CPU), pero tiene limitaciones.

### Variables de Entorno

Configura las siguientes variables de entorno en Render:

#### Variables Obligatorias

1. **DATABASE_URL**
   - Tipo: String
   - Descripción: URL de conexión a PostgreSQL
   - Formato: `postgresql://usuario:contraseña@host:puerto/nombre_base_datos`
   - Ejemplo: `postgresql://user:password@db.example.com:5432/la_caja`
   - **⚠️ IMPORTANTE**: Si la contraseña contiene caracteres especiales, deben estar URL-encoded

2. **JWT_SECRET**
   - Tipo: String
   - Descripción: Clave secreta para firmar tokens JWT
   - Recomendación: Genera una cadena aleatoria segura (mínimo 32 caracteres)
   - Ejemplo: `tu-clave-secreta-super-segura-de-al-menos-32-caracteres-123456789`
   - **⚠️ CRÍTICO**: Nunca compartas esta clave. Úsala solo en producción.

#### Variables Opcionales (con valores por defecto)

3. **PORT**
   - Tipo: Number
   - Valor por defecto: `3000`
   - Descripción: Puerto en el que escuchará la aplicación
   - **Nota**: Render asigna automáticamente un puerto, pero puedes dejarlo en 3000

4. **NODE_ENV**
   - Tipo: String
   - Valor por defecto: `development`
   - Valor recomendado para producción: `production`
   - Descripción: Entorno de ejecución

5. **ALLOWED_ORIGINS**
   - Tipo: String
   - Valor por defecto: `http://localhost:5173,http://localhost:3000`
   - Descripción: Orígenes permitidos para CORS (separados por comas)
   - Ejemplo para producción: `https://tu-dominio.com,https://www.tu-dominio.com`
   - **⚠️ IMPORTANTE**: Configura los dominios de tu frontend PWA aquí

6. **JWT_EXPIRES_IN**
   - Tipo: String
   - Valor por defecto: `7d`
   - Descripción: Tiempo de expiración de los tokens JWT
   - Ejemplos: `7d`, `24h`, `30d`

7. **THROTTLE_TTL**
   - Tipo: Number
   - Valor por defecto: `60000` (1 minuto en milisegundos)
   - Descripción: Ventana de tiempo para rate limiting

8. **THROTTLE_LIMIT**
   - Tipo: Number
   - Valor por defecto: `100`
   - Descripción: Número máximo de requests por ventana de tiempo

### Resumen de Configuración

```
Name: LA-CAJA
Environment: Production
Language: Node
Branch: main
Region: Virginia (US East) (o tu región preferida)
Root Directory: apps/api

Build Command: npm install && npm run build
Start Command: npm run start:prod

Instance Type: Standard ($25/mes) o Starter ($7/mes)

Environment Variables:
  DATABASE_URL=postgresql://...
  JWT_SECRET=tu-clave-secreta-super-segura
  NODE_ENV=production
  PORT=3000
  ALLOWED_ORIGINS=https://tu-dominio.com
  JWT_EXPIRES_IN=7d
  THROTTLE_TTL=60000
  THROTTLE_LIMIT=100
```

### Pasos Adicionales Después del Deploy

1. **Base de Datos**: Asegúrate de que tu base de datos PostgreSQL esté configurada y ejecutadas las migraciones desde `apps/api/src/database/migrations/`

2. **Verificar Health Check**: Render verificará automáticamente que el servicio esté funcionando en el puerto configurado

3. **Configurar Dominio Personalizado** (Opcional): En Render puedes configurar un dominio personalizado para tu API

4. **Actualizar Frontend**: Actualiza la variable `VITE_API_URL` en tu frontend PWA para apuntar a la URL de Render

### Generar JWT_SECRET Seguro

Puedes generar un JWT_SECRET seguro usando uno de estos métodos:

**Opción 1: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Opción 2: OpenSSL**
```bash
openssl rand -hex 32
```

**Opción 3: Online**
Usa un generador de strings aleatorios seguro (mínimo 32 caracteres)

### Notas Importantes

- ⚠️ **Nunca** subas el archivo `.env` al repositorio
- ⚠️ **Nunca** compartas tus `JWT_SECRET` o `DATABASE_URL`
- ✅ Render proporciona un entorno seguro para variables de entorno
- ✅ Las variables de entorno en Render están encriptadas
- ✅ Puedes actualizar las variables sin necesidad de redeploy

### Troubleshooting

Si el deploy falla:

1. Verifica que todas las variables obligatorias estén configuradas
2. Revisa los logs en Render para ver errores específicos
3. Asegúrate de que la base de datos sea accesible desde Render
4. Verifica que el `DATABASE_URL` esté correctamente formateado
5. Confirma que el `JWT_SECRET` tenga al menos 32 caracteres

