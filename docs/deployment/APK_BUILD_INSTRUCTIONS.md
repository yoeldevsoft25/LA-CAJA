# Instrucciones para Compilar APK de Android

## ✅ COMPILACIÓN EXITOSA

### APK v4.0 Generado Exitosamente

**Fecha de compilación:** 2025-12-31
**Ubicación:** `app/build/outputs/apk/release/LA-CAJA-v4.0-unsigned.apk`
**Tamaño:** 2.6 MB

**Detalles del APK:**
```
Package: com.lacaja.app
Version Code: 4
Version Name: 4.0
Min SDK: 21
Target SDK: 35
```

---

## 🔧 Problemas Resueltos

### ✅ Problema 1: Java Version - RESUELTO

**Solución implementada:**
- ✅ Instalado SDKMAN para gestión de versiones Java
- ✅ Instalado Java 21.0.9 (Amazon Corretto)
- ✅ Java 21 configurado como versión por defecto

```bash
$ java -version
openjdk version "21.0.9" 2025-10-21 LTS
OpenJDK Runtime Environment Corretto-21.0.9.10.1 (build 21.0.9+10-LTS)
```

### ✅ Problema 2: Android SDK - RESUELTO

**Solución implementada:**
- ✅ Descargado Android Command Line Tools
- ✅ Instalado Android SDK Platform 35 y 36
- ✅ Instalado Build Tools 35.0.0
- ✅ Instalado Platform Tools
- ✅ Creado local.properties con SDK path
- ✅ Aceptadas todas las licencias de SDK

---

## 📦 APK Disponible

El APK ha sido compilado exitosamente con todas las nuevas características de la versión 4.0:

### Ubicaciones de los APKs:
```
app/build/outputs/apk/release/LA-CAJA-v4.0-unsigned.apk  (2.6 MB)
app/build/outputs/apk/release/app-release-unsigned.apk   (2.6 MB - copia)
```

### Verificar APK:
```bash
# Ver información completa
aapt dump badging app/build/outputs/apk/release/LA-CAJA-v4.0-unsigned.apk | head -20

# Confirmar versión
# Package: com.lacaja.app
# versionCode: 4
# versionName: 4.0
```

---

## ✅ Soluciones Disponibles

### Opción 1: Instalar Android Studio (RECOMENDADO - MÁS FÁCIL)

**¿Por qué Android Studio?**
- Incluye Android SDK completo (no requiere instalación manual)
- Incluye Java embebido (compatible con Gradle)
- Gestión automática de dependencias
- Interfaz gráfica amigable

**Pasos:**

1. **Descargar Android Studio:**
   - Ir a: https://developer.android.com/studio
   - Descargar para macOS
   - Instalar arrastrando a Applications

2. **Primera configuración:**
   - Abrir Android Studio
   - Durante el setup wizard, seleccionar "Standard" installation
   - Esto instalará automáticamente:
     - Android SDK
     - Android SDK Platform-Tools
     - Android SDK Build-Tools
     - Android Emulator

3. **Abrir el proyecto:**
   ```bash
   open -a "Android Studio" /Users/yoeldev/Documents/GitHub/LA-CAJA
   ```

4. **Compilar desde Android Studio:**
   - Menu → Build → Build Bundle(s) / APK(s) → Build APK(s)
   - O usar el terminal integrado (Terminal tab en la parte inferior):
     ```bash
     ./gradlew clean assembleRelease
     ```

5. **Ubicación del APK:**
   ```
   app/build/outputs/apk/release/app-release-unsigned.apk
   ```

---

### Opción 2: Instalar Android Command Line Tools (Sin Android Studio)

Si prefieres NO instalar Android Studio:

1. **Descargar Command Line Tools:**
   ```bash
   cd ~/Downloads
   curl -O https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip
   ```

2. **Extraer y configurar:**
   ```bash
   mkdir -p ~/Library/Android/sdk/cmdline-tools
   unzip commandlinetools-mac-11076708_latest.zip -d ~/Library/Android/sdk/cmdline-tools
   mv ~/Library/Android/sdk/cmdline-tools/cmdline-tools ~/Library/Android/sdk/cmdline-tools/latest
   ```

3. **Configurar variables de entorno:**
   ```bash
   # Agregar a ~/.zshrc o ~/.bash_profile
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools

   # Recargar
   source ~/.zshrc  # o source ~/.bash_profile
   ```

4. **Instalar componentes necesarios:**
   ```bash
   # Aceptar licencias
   sdkmanager --licenses

   # Instalar build tools y plataforma
   sdkmanager "build-tools;35.0.0" "platforms;android-35" "platform-tools"
   ```

5. **Crear local.properties:**
   ```bash
   echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties
   ```

6. **Compilar:**
   ```bash
   bash -c 'source ~/.sdkman/bin/sdkman-init.sh && ./gradlew clean assembleRelease'
   ```

---

### Opción 3: Usar Docker (Para CI/CD)

Crear un `Dockerfile`:
```dockerfile
FROM gradle:8.13-jdk17

WORKDIR /app
COPY . .

RUN ./gradlew clean assembleRelease

CMD ["bash"]
```

Compilar:
```bash
docker build -t lacaja-android .
docker run -v $(pwd)/app/build:/app/app/build lacaja-android
```

---

## 📱 Después de Compilar

### 1. Verificar el APK generado:
```bash
ls -lh app/build/outputs/apk/release/
```

Deberías ver:
```
app-release-unsigned.apk  (~15-20 MB)
```

### 2. Firmar el APK (Opcional para distribución):

#### Generar keystore (solo una vez):
```bash
keytool -genkey -v -keystore lacaja-release.jks \
  -alias lacaja -keyalg RSA -keysize 2048 -validity 10000
```

#### Firmar el APK:
```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore lacaja-release.jks \
  app/build/outputs/apk/release/app-release-unsigned.apk lacaja
```

#### Alinear el APK (zipalign):
```bash
zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  app/build/outputs/apk/release/LA-CAJA-v4.0.apk
```

---

## 🎯 Verificación Post-Build

### 1. Información del APK:
```bash
aapt dump badging app/build/outputs/apk/release/app-release-unsigned.apk | head -20
```

Verifica:
- `package: name='com.lacaja.app'`
- `versionCode='4'`
- `versionName='4.0'`

### 2. Instalar en dispositivo de prueba:
```bash
adb install -r app/build/outputs/apk/release/app-release-unsigned.apk
```

### 3. Probar en emulador:
```bash
# Listar emuladores
emulator -list-avds

# Iniciar emulador
emulator -avd Pixel_6_API_35 &

# Instalar
adb install -r app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 🔍 Troubleshooting

### Error: "JAVA_HOME is not set"
```bash
# Verificar JAVA_HOME
echo $JAVA_HOME

# Configurar (ejemplo con Java 17)
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
```

### Error: "SDK location not found"
Crear `local.properties`:
```properties
sdk.dir=/Users/yoeldev/Library/Android/sdk
```

### Error: "Failed to find Build Tools"
```bash
# Usando Android Studio SDK Manager, instalar:
# - Android SDK Build-Tools 35
# - Android SDK Platform 35
# - Android SDK Platform-Tools
```

### Verificar versión de Java que usa Gradle:
```bash
./gradlew --version
```

Debería mostrar:
```
Java:         17.x.x
JVM:          ...
```

---

## 📦 Distribución

### Google Play Store:
1. Firmar con keystore de producción
2. Generar Android App Bundle (AAB):
   ```bash
   ./gradlew bundleRelease
   ```
3. Subir `app/build/outputs/bundle/release/app-release.aab`

### Distribución Directa:
1. Subir APK firmado a servidor
2. Usuarios pueden instalar desde:
   ```
   https://lacaja.app/downloads/LA-CAJA-v4.0.apk
   ```

### GitHub Releases:
```bash
gh release create v4.0 \
  app/build/outputs/apk/release/LA-CAJA-v4.0.apk \
  --title "LA CAJA v4.0 - Landing Page Mejorada" \
  --notes "Nueva landing page con SEO, analytics y A/B testing"
```

---

## 📝 Changelog v4.0

### Nuevas Características:
- ✨ Landing page completamente rediseñada (12 secciones)
- 🔍 SEO optimization con Schema.org
- 📊 Analytics integration (GA4 + Mixpanel)
- 🧪 A/B testing framework
- 📧 Contact form integration
- 🎨 100+ animaciones Framer Motion
- 📱 Responsive design mejorado
- 🚀 Performance optimizations

### Mejoras Técnicas:
- Routing actualizado (/ → landing, /app/* → dashboard)
- Componente SEOHead reutilizable
- Servicios de analytics y A/B testing
- Documentación completa

---

## 🆘 Si nada funciona...

**Opción más rápida:** Usar el servicio de build en la nube de Android Studio

1. Abrir proyecto en Android Studio
2. Build → Generate Signed Bundle / APK
3. Seleccionar APK
4. Seguir el wizard

O contactar al equipo para que compile el APK en un ambiente con la configuración correcta.

---

**Última actualización:** 2025-12-31
**Versión actual:** v4.0 (versionCode: 4)
