# 🚀 Configuración Optimizada de Cursor para LA-CAJA
## Guía Completa para Usar Agentes de IA de Manera Eficiente

**Versión:** 1.0  
**Fecha:** Enero 2025

---

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Sistema de Prompts Modulares](#sistema-de-prompts-modulares)
3. [Uso de Roles](#uso-de-roles)
4. [Técnicas Avanzadas](#técnicas-avanzadas)
5. [Mejores Prácticas](#mejores-prácticas)
6. [Troubleshooting](#troubleshooting)

---

## 1. Configuración Inicial

### Archivos Creados

```
LA-CAJA/
├── .cursorrules                    # Reglas generales (leído automáticamente)
└── .cursor/
    ├── README.md                   # Guía de uso
    └── prompts/
        ├── backend.md              # Prompt backend
        ├── frontend.md             # Prompt frontend
        ├── ml.md                   # Prompt ML
        ├── devops.md               # Prompt DevOps
        ├── qa.md                   # Prompt QA
        ├── data.md                 # Prompt Data
        ├── security.md             # Prompt Security
        └── architect.md            # Prompt Architect
```

### Verificación

1. Abre Cursor en el proyecto
2. Verifica que `.cursorrules` esté en la raíz
3. Verifica que `.cursor/prompts/` exista con los archivos

---

## 2. Sistema de Prompts Modulares

### Ventajas del Sistema

✅ **Modular**: Cada rol tiene su propio prompt  
✅ **Reutilizable**: Fácil de actualizar y mantener  
✅ **Contextual**: Incluye contexto específico del proyecto  
✅ **Optimizado**: Usa técnicas avanzadas de prompt engineering  

### Estructura de un Prompt

Cada prompt incluye:
- **IDENTITY**: Rol y especialización
- **CONTEXT**: Proyecto y stack tecnológico
- **TASK STRUCTURE**: Pasos estructurados (Chain-of-Thought)
- **REQUIREMENTS**: Requisitos específicos
- **OUTPUT FORMAT**: Formato esperado del código

---

## 3. Uso de Roles

### Método 1: Mencionar Rol en Chat (Recomendado)

En el chat de Cursor, simplemente menciona el rol:

```
@backend Implementa un endpoint para gestionar turnos
```

```
@frontend Crea un componente de dashboard de ventas
```

```
@ml Desarrolla un modelo de predicción de demanda
```

### Método 2: Copiar Prompt Completo

1. Abre `.cursor/prompts/[rol].md`
2. Copia todo el contenido
3. Pégalo al inicio del chat
4. Agrega tu solicitud específica

### Método 3: Combinar Roles

Puedes combinar roles para tareas complejas:

```
@backend @security Implementa autenticación con 2FA
```

```
@frontend @qa Crea componente con tests completos
```

---

## 4. Técnicas Avanzadas

### Chain-of-Thought (CoT)

Los prompts incluyen estructura paso a paso:
1. ANALYZE
2. DESIGN
3. IMPLEMENT
4. VALIDATE
5. TEST/DOCUMENT

### Few-Shot Learning

Proporciona ejemplos del codebase:
```
@backend Implementa ShiftModule siguiendo el mismo patrón que CashModule
```

### Self-Criticism

Los prompts incluyen validación automática:
- Verificar eventos generados
- Verificar validaciones
- Verificar offline-first
- Verificar tests

### Context Injection

Siempre incluye contexto específico:
```
@backend En el contexto de LA-CAJA, implementa...
```

---

## 5. Mejores Prácticas

### ✅ DO (Hacer)

1. **Proporcionar Contexto Específico**
   ```
   @backend Implementa endpoint POST /shifts/open que valide store_id y genere evento
   ```

2. **Referenciar Código Existente**
   ```
   @frontend Crea componente similar a ProductsPage pero para turnos
   ```

3. **Mencionar Restricciones**
   ```
   @backend Debe funcionar offline, generar eventos y validar multi-tenant
   ```

4. **Solicitar Tests**
   ```
   @backend Implementa con unit tests y integration tests
   ```

5. **Especificar Formato**
   ```
   @frontend Usa TypeScript strict, React Query y Zustand
   ```

### ❌ DON'T (No Hacer)

1. **No ser vago**
   ```
   ❌ @backend Haz algo para turnos
   ✅ @backend Implementa módulo de turnos con apertura, cierre y cortes X/Z
   ```

2. **No olvidar contexto**
   ```
   ❌ Implementa autenticación
   ✅ @backend @security Implementa autenticación JWT con refresh tokens para LA-CAJA
   ```

3. **No ignorar patrones**
   ```
   ❌ Crea cualquier endpoint
   ✅ @backend Crea endpoint siguiendo patrón de CashModule con eventos
   ```

---

## 6. Ejemplos Prácticos

### Ejemplo 1: Feature Backend Completa

```
@backend

Implementa el módulo de turnos (shifts) con:

1. Endpoints:
   - POST /shifts/open - Abrir turno
   - POST /shifts/:id/close - Cerrar turno
   - POST /shifts/:id/cut-x - Corte X
   - POST /shifts/:id/cut-z - Corte Z
   - GET /shifts - Listar turnos

2. Eventos:
   - ShiftOpenedEvent
   - ShiftClosedEvent
   - ShiftCutCreatedEvent

3. Validaciones:
   - No puede haber dos turnos abiertos
   - Solo el cajero dueño puede cerrar
   - Validar store_id

4. Tests:
   - Unit tests para servicio
   - Integration tests para endpoints

Sigue el patrón de CashModule existente.
```

### Ejemplo 2: Componente Frontend

```
@frontend

Crea un componente ShiftManagement que:

1. Muestre el turno actual si existe
2. Permita abrir un nuevo turno (modal)
3. Muestre historial de turnos (tabla)
4. Permita cerrar turno con arqueo
5. Funcione completamente offline

Usa:
- React Query para data fetching
- Zustand para estado local
- IndexedDB para cache
- Radix UI para componentes
- Tailwind para estilos

Sigue el patrón de CashPage existente.
```

### Ejemplo 3: Modelo ML

```
@ml

Desarrolla un modelo de predicción de demanda que:

1. Use datos históricos de ventas (últimos 6 meses)
2. Prediga demanda por producto para próximos 7 días
3. Tenga latencia < 100ms para real-time
4. Sea interpretable (SHAP values)

Stack:
- Python 3.11+
- TensorFlow o scikit-learn
- FastAPI para endpoint
- PostgreSQL para datos

Integra con backend NestJS mediante REST API.
```

---

## 7. Optimización de Performance

### Reducir Tokens

1. **Usar referencias en lugar de copiar código**
   ```
   ✅ Sigue el patrón de CashModule
   ❌ [código completo de CashModule]
   ```

2. **Ser específico pero conciso**
   ```
   ✅ Implementa CRUD con eventos
   ❌ Implementa create, read, update, delete con eventos para cada operación...
   ```

3. **Usar roles en lugar de prompts largos**
   ```
   ✅ @backend Implementa endpoint
   ❌ [prompt completo de 500 palabras]
   ```

### Mejorar Calidad

1. **Iterar en pasos**
   ```
   Paso 1: @backend Diseña la estructura del módulo
   Paso 2: @backend Implementa las entidades
   Paso 3: @backend Implementa los servicios
   ```

2. **Validar incrementalmente**
   ```
   @backend @qa Implementa con tests desde el inicio
   ```

---

## 8. Troubleshooting

### Problema: Cursor no reconoce los roles

**Solución:**
1. Verifica que `.cursorrules` esté en la raíz
2. Reinicia Cursor
3. Verifica que los archivos `.cursor/prompts/` existan

### Problema: El agente no sigue el formato

**Solución:**
1. Copia el prompt completo al inicio del chat
2. Sé más específico en tu solicitud
3. Proporciona ejemplos del codebase

### Problema: Código generado no sigue patrones

**Solución:**
1. Referencia explícitamente el patrón a seguir
2. Proporciona ejemplos de código existente
3. Solicita que revise el código antes de generar

### Problema: No funciona offline-first

**Solución:**
1. Menciona explícitamente "offline-first" en la solicitud
2. Solicita que valide funcionamiento offline
3. Pide tests para escenarios offline

---

## 9. Actualización y Mantenimiento

### Actualizar Prompts

1. Edita archivos en `.cursor/prompts/[rol].md`
2. Sigue la estructura existente
3. Actualiza `.cursor/README.md` si agregas nuevos roles

### Agregar Nuevos Roles

1. Crea `.cursor/prompts/[nuevo-rol].md`
2. Sigue la estructura de prompts existentes
3. Actualiza `.cursorrules` con el nuevo rol
4. Actualiza esta documentación

### Sincronizar con Documentación

Los prompts en `.cursor/prompts/` son versiones simplificadas.  
Para prompts completos con todas las técnicas, ver:
- `docs/PROMPTS_AGENTES_DESARROLLO.md`

---

## 10. Recursos Adicionales

- **Documentación Completa de Prompts**: `docs/PROMPTS_AGENTES_DESARROLLO.md`
- **Guía de Uso Rápida**: `.cursor/README.md`
- **Reglas del Proyecto**: `.cursorrules`
- **White Paper Competitivo**: `docs/WHITE_PAPER_ROADMAP_COMPETITIVO.md`

---

## 🎯 Resumen

### Para Empezar Rápido

1. Abre Cursor en el proyecto
2. En el chat, escribe: `@backend` o `@frontend` seguido de tu solicitud
3. El agente usará el prompt optimizado automáticamente

### Para Uso Avanzado

1. Lee `.cursor/README.md` para detalles
2. Revisa `docs/PROMPTS_AGENTES_DESARROLLO.md` para técnicas avanzadas
3. Personaliza prompts según necesidades

---

**Última actualización:** Enero 2025  
**Versión:** 1.0

