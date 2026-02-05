# Guía Completa: Compilar APK y Configurar TWA (Trusted Web Activity)

**Última actualización:** 2025-12-31
**Versión APK:** 4.0.1
**Para:** Desarrolladores del equipo LA CAJA

---

## 🚨 Problema: "Paquete no es válido" en Android

### Causa

El APK estaba firmado **solo con jarsigner** o sin firmar correctamente con **apksigner**.

**Android moderno (API 24+) REQUIERE:**
- APK Signature Scheme v2
- APK Signature Scheme v3

**Solo `apksigner` puede crear estas firmas.** `jarsigner` solo crea v1 (JAR signing), que Android rechaza con el error "paquete no es válido".

---

## ✅ Proceso Correcto: Build + Firma (Release)

### Paso 1: Build APK Unsigned

```bash
cd /Users/yoeldev/Documents/GitHub/LA-CAJA

# Usar Java 21 (si usas SDKMAN)
source ~/.sdkman/bin/sdkman-init.sh
sdk use java 21.0.9-amzn

# Compilar APK sin firmar
./gradlew clean assembleRelease
```

**Resultado:**
`app/build/outputs/apk/release/app-release-unsigned.apk` (2.6 MB)

---

### Paso 2: Alinear APK

```bash
~/Library/Android/sdk/build-tools/35.0.0/zipalign -v -p 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  LA-CAJA-aligned.apk
```

**Verifica:**
Debe mostrar "Verification succesful" al final.

---

### Paso 3: Firmar con apksigner (OBLIGATORIO)

```bash
~/Library/Android/sdk/build-tools/35.0.0/apksigner sign \
  --ks lacaja-release.keystore \
  --ks-key-alias lacajakey \
  --ks-pass pass:lacaja2024 \
  --key-pass pass:lacaja2024 \
  --out LA-CAJA-release-signed.apk \
  LA-CAJA-aligned.apk
```

**Resultado:**
`LA-CAJA-release-signed.apk` (2.7 MB)

---

### Paso 4: Verificar Firma

```bash
~/Library/Android/sdk/build-tools/35.0.0/apksigner verify --verbose LA-CAJA-release-signed.apk
```

**DEBE mostrar:**
```
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true  ✅
Verified using v3 scheme (APK Signature Scheme v3): true  ✅
```

Si **v2 o v3 = false**, el APK NO INSTALARÁ en Android moderno.

---

## 🔐 Keystore: Información Crítica

### Archivo Keystore

**Ubicación:** `/Users/yoeldev/Documents/GitHub/LA-CAJA/lacaja-release.keystore`

**Credenciales:**
```
Keystore password: lacaja2024
Key alias: lacajakey
Key password: lacaja2024
```

**SHA256 Fingerprint:**
```
30:58:70:2E:F7:0D:46:C6:D8:D0:5C:63:52:FC:0F:14:3F:D9:97:60:AE:54:14:D4:E8:FC:E3:51:C5:1B:E7:E9
```

### Obtener SHA256 del Keystore

```bash
keytool -list -v -keystore lacaja-release.keystore -alias lacajakey -storepass lacaja2024 | grep "SHA256:"
```

**⚠️ IMPORTANTE:**
- **NO SUBIR** el keystore a Git (está en `.gitignore`)
- **GUARDAR** en lugar seguro (1Password, Vault, etc.)
- Si pierdes el keystore, **NO PODRÁS actualizar la app en Google Play**

---

## 📱 Configurar TWA (Quitar Barra del Navegador)

### ¿Qué es TWA?

Trusted Web Activity permite que tu PWA se abra **SIN la barra del navegador**, como una app nativa.

**Requisito:** Publicar `assetlinks.json` en tu dominio para vincular la app con el sitio web.

---

### Paso 1: Crear assetlinks.json

**Ubicación:** `apps/pwa/public/.well-known/assetlinks.json`

**Contenido:**
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.lacaja.app",
      "sha256_cert_fingerprints": [
        "30:58:70:2E:F7:0D:46:C6:D8:D0:5C:63:52:FC:0F:14:3F:D9:97:60:AE:54:14:D4:E8:FC:E3:51:C5:1B:E7:E9"
      ]
    }
  }
]
```

**⚠️ CRÍTICO:** El SHA256 **DEBE coincidir** con el del keystore usado para firmar el APK.

---

### Paso 2: Publicar en Netlify

1. **Asegurar estructura de carpetas:**
   ```
   apps/pwa/public/.well-known/assetlinks.json
   ```

2. **Verificar que Netlify lo sirva:**
   ```bash
   curl -I https://la-caja.netlify.app/.well-known/assetlinks.json
   ```

   Debe devolver:
   ```
   HTTP/2 200
   content-type: application/json
   ```

3. **Si no funciona:**
   - Crear `apps/pwa/public/_headers`:
     ```
     /.well-known/assetlinks.json
       Content-Type: application/json
       Access-Control-Allow-Origin: *
     ```

   - O crear `netlify.toml` en la raíz:
     ```toml
     [[headers]]
       for = "/.well-known/assetlinks.json"
       [headers.values]
         Content-Type = "application/json"
         Access-Control-Allow-Origin = "*"
     ```

4. **Deploy a Netlify:**
   ```bash
   git add apps/pwa/public/.well-known/assetlinks.json
   git commit -m "Add assetlinks.json for TWA"
   git push
   ```

5. **Limpiar caché de Netlify:**
   - Ir a Netlify Dashboard
   - Site settings → Build & Deploy → Clear cache and deploy

---

### Paso 3: Actualizar twa-manifest.json

**Ubicación:** `config/twa-manifest.json`

**Actualizar estos campos:**

```json
{
  "signingKey": {
    "path": "/Users/yoeldev/Documents/GitHub/LA-CAJA/lacaja-release.keystore",
    "alias": "lacajakey"
  },
  "fingerprints": [
    {
      "sha256": "30:58:70:2E:F7:0D:46:C6:D8:D0:5C:63:52:FC:0F:14:3F:D9:97:60:AE:54:14:D4:E8:FC:E3:51:C5:1B:E7:E9"
    }
  ]
}
```

---

### Paso 4: Reinstalar la App

**⚠️ MUY IMPORTANTE:**

1. **Desinstalar la app vieja** del dispositivo Android:
   ```bash
   adb uninstall com.lacaja.app
   ```

   O manualmente: Settings → Apps → LA CAJA → Uninstall

2. **Instalar el nuevo APK:**
   ```bash
   adb install LA-CAJA-release-signed.apk
   ```

3. **Abrir la app y verificar:**
   - ✅ NO debe aparecer la barra del navegador
   - ✅ Debe verse como app nativa
   - ✅ URL bar oculta

---

## 🔍 Verificar que TWA Funciona

### Método 1: Chrome DevTools

1. Conectar dispositivo Android via USB
2. Abrir Chrome en desktop → `chrome://inspect`
3. Abrir la app en el dispositivo
4. En DevTools, verificar:
   ```javascript
   document.referrer
   // Debe devolver: "android-app://com.lacaja.app"
   ```

### Método 2: Verificar visualmente

- ✅ **TWA funcionando:** La app se abre SIN barra de navegación
- ❌ **TWA NO funcionando:** Se ve la barra con URL y botones de Chrome

### Método 3: Verificar assetlinks

```bash
# Debe devolver el JSON
curl https://la-caja.netlify.app/.well-known/assetlinks.json
```

---

## 🐛 Troubleshooting

### Problema 1: "Paquete no es válido"

**Causa:** APK no firmado con v2/v3 scheme.

**Solución:**
```bash
# Verificar firma
~/Library/Android/sdk/build-tools/35.0.0/apksigner verify --verbose LA-CAJA-release-signed.apk

# Si v2 o v3 = false, re-firmar con apksigner (NO jarsigner)
~/Library/Android/sdk/build-tools/35.0.0/apksigner sign --ks lacaja-release.keystore ...
```

---

### Problema 2: TWA no funciona (se ve la barra)

**Causa:** SHA256 en assetlinks.json no coincide con el del APK.

**Solución:**

1. Obtener SHA256 del keystore:
   ```bash
   keytool -list -v -keystore lacaja-release.keystore -alias lacajakey -storepass lacaja2024 | grep "SHA256:"
   ```

2. Actualizar `assetlinks.json` con el SHA256 correcto

3. Hacer deploy a Netlify y limpiar caché

4. **Desinstalar** la app del dispositivo

5. **Reinstalar** el APK

---

### Problema 3: assetlinks.json da 404

**Causa:** Netlify no encuentra el archivo o la estructura de carpetas es incorrecta.

**Solución:**

1. Verificar estructura:
   ```
   apps/pwa/public/.well-known/assetlinks.json
   ```

2. Agregar `_headers` en `apps/pwa/public/`:
   ```
   /.well-known/assetlinks.json
     Content-Type: application/json
   ```

3. Verificar build output en Netlify:
   - Deploy log debe mostrar: "Copying .well-known/assetlinks.json"

---

### Problema 4: Android dice "Firma no válida"

**Causa:** Cambiaste el keystore pero no desinstalaste la app vieja.

**Solución:**
```bash
# Desinstalar app vieja
adb uninstall com.lacaja.app

# Reinstalar con nuevo APK
adb install LA-CAJA-release-signed.apk
```

---

## 📦 Archivos Clave - Checklist

Antes de hacer deploy, verifica que estos archivos existan y estén correctos:

### En el repositorio:
- ✅ `lacaja-release.keystore` (NO subir a Git)
- ✅ `config/twa-manifest.json` (SHA256 actualizado)
- ✅ `apps/pwa/public/.well-known/assetlinks.json`
- ✅ `LA-CAJA-release-signed.apk` (APK final)

### En Netlify (después del deploy):
- ✅ `https://la-caja.netlify.app/.well-known/assetlinks.json` (accesible)
- ✅ Headers correctos (Content-Type: application/json)

---

## 🚀 Proceso Completo Resumido

### Build y Firma:
```bash
# 1. Compilar
./gradlew clean assembleRelease

# 2. Alinear
zipalign -v -p 4 app/build/outputs/apk/release/app-release-unsigned.apk LA-CAJA-aligned.apk

# 3. Firmar
apksigner sign --ks lacaja-release.keystore --ks-key-alias lacajakey \
  --ks-pass pass:lacaja2024 --key-pass pass:lacaja2024 \
  --out LA-CAJA-release-signed.apk LA-CAJA-aligned.apk

# 4. Verificar
apksigner verify --verbose LA-CAJA-release-signed.apk
```

### Configurar TWA:
```bash
# 1. Crear assetlinks.json en apps/pwa/public/.well-known/

# 2. Deploy a Netlify
git add apps/pwa/public/.well-known/assetlinks.json
git commit -m "Add assetlinks.json for TWA"
git push

# 3. Clear cache en Netlify Dashboard

# 4. Verificar
curl https://la-caja.netlify.app/.well-known/assetlinks.json

# 5. Desinstalar app vieja
adb uninstall com.lacaja.app

# 6. Instalar nuevo APK
adb install LA-CAJA-release-signed.apk
```

---

## 📞 Información de Contacto

**Keystore Password:** lacaja2024
**SHA256:** `30:58:70:2E:F7:0D:46:C6:D8:D0:5C:63:52:FC:0F:14:3F:D9:97:60:AE:54:14:D4:E8:FC:E3:51:C5:1B:E7:E9`
**Package Name:** `com.lacaja.app`
**Domain:** `https://la-caja.netlify.app`

---

**Última compilación exitosa:** 2025-12-31 16:23
**APK:** LA-CAJA-release-signed.apk (2.7 MB)
**MD5:** 683a1cc94fe47a7c255f987a55670e1e
