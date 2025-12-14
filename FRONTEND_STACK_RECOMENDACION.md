# Frontend Stack - Recomendaciones para LA CAJA

## Análisis del Proyecto

LA CAJA es un **Sistema POS Offline-First** que requiere:
- ✅ Funcionar completamente offline
- ✅ Sincronización de eventos
- ✅ UI rápida y responsive (<15s por venta según roadmap)
- ✅ Soporte para teclado/touch
- ✅ PWA para móviles/tablets
- ✅ Desktop app (Windows) con Tauri

---

## Stack Recomendado

### 🎨 UI Components Library

#### **OPCIÓN 1: Shadcn/ui + Tailwind CSS** ⭐ **RECOMENDADO**

**Por qué:**
- ✅ Componentes accesibles y modernos
- ✅ Totalmente customizable (no es una dependencia, copias el código)
- ✅ Basado en Radix UI (accesibilidad de primera)
- ✅ Tailwind CSS para estilos rápidos y responsive
- ✅ Perfecto para aplicaciones de productividad
- ✅ Lightweight y performante

**Instalación:**
```bash
cd apps/pwa
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install class-variance-authority clsx tailwind-merge lucide-react
```

**Componentes clave para POS:**
- Button, Input, Card
- Dialog, Sheet (para modales rápidos)
- Table (para listas de productos)
- Badge, Alert
- Select, Combobox (para búsqueda rápida)

---

#### OPCIÓN 2: Ant Design (antd)

**Por qué:**
- ✅ Componentes empresariales completos
- ✅ Excelente para aplicaciones de negocio
- ✅ Tablas avanzadas
- ⚠️ Más pesado (bundle size)
- ⚠️ Menos customizable

---

#### OPCIÓN 3: Chakra UI

**Por qué:**
- ✅ Buen sistema de diseño
- ✅ Accesible
- ⚠️ Menos componentes específicos para POS

---

### 📊 State Management

#### **OPCIÓN 1: Zustand** ⭐ **RECOMENDADO**

**Por qué:**
- ✅ Extremadamente ligero (< 1KB)
- ✅ API simple e intuitiva
- ✅ Perfecto para estado global del POS
- ✅ TypeScript first
- ✅ No requiere providers ni boilerplate
- ✅ Ideal para aplicaciones offline-first

**Ejemplo de uso:**
```typescript
import create from 'zustand'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clear: () => void
}

export const useCart = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  clear: () => set({ items: [] }),
}))
```

---

#### OPCIÓN 2: Jotai

**Por qué:**
- ✅ Atomic state management
- ✅ Gran para sincronización
- ⚠️ Curva de aprendizaje mayor

---

#### OPCIÓN 3: React Context + useReducer

**Por qué:**
- ✅ Sin dependencias externas
- ✅ Nativo de React
- ⚠️ Puede ser verboso para estado complejo

---

### 🔄 HTTP Client & Sync

#### **OPCIÓN 1: TanStack Query (React Query) + Axios** ⭐ **RECOMENDADO**

**Por qué:**
- ✅ Caching automático
- ✅ Retry logic built-in
- ✅ Perfecto para sync con reintentos
- ✅ DevTools excelentes
- ✅ Optimistic updates
- ✅ Funciona offline (cache)

**Ejemplo:**
```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:3000' })

// Sync eventos
const syncEvents = async (events: Event[]) => {
  const response = await api.post('/sync/push', { events })
  return response.data
}

export const useSyncEvents = () => {
  return useMutation({
    mutationFn: syncEvents,
    retry: 3,
    retryDelay: 1000,
  })
}
```

---

#### OPCIÓN 2: SWR

**Por qué:**
- ✅ Similar a React Query
- ✅ Más ligero
- ⚠️ Menos features avanzadas

---

### 🗂️ Routing

#### **React Router v6** ⭐ **RECOMENDADO**

**Por qué:**
- ✅ Estándar de la industria
- ✅ Route-based code splitting
- ✅ Perfecto para PWA
- ✅ Nested routes para estructura compleja

**Estructura sugerida:**
```
/ (login)
/pos (punto de venta)
/products (gestión productos)
/inventory (inventario)
/sales (historial ventas)
/cash (caja)
/customers (clientes)
/debts (fiao)
/reports (reportes)
```

---

### 📝 Form Handling

#### **React Hook Form + Zod** ⭐ **RECOMENDADO**

**Por qué:**
- ✅ Performance excelente (no re-render innecesarios)
- ✅ Validación con Zod (type-safe)
- ✅ Perfecto para formularios complejos (productos, clientes, ventas)
- ✅ Integración fácil con shadcn/ui

**Ejemplo:**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1),
  price_bs: z.number().min(0),
})

type ProductForm = z.infer<typeof productSchema>

export const ProductForm = () => {
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  })
  
  // ...
}
```

---

### 💾 Local Storage (IndexedDB/SQLite)

#### **PWA: Dexie.js** ✅ Ya configurado

**Por qué:**
- ✅ Wrapper moderno de IndexedDB
- ✅ API promisificada
- ✅ Queries similares a SQL
- ✅ Perfecto para eventos offline

#### **Desktop: Tauri SQL Plugin** (para SQLite)

**Por qué:**
- ✅ SQLite nativo
- ✅ Mejor performance que IndexedDB
- ✅ Acceso a archivos del sistema

---

### 🎯 Otras Utilidades Esenciales

#### 1. **date-fns** (manejo de fechas)
```bash
npm install date-fns
```
- ✅ Ligero y tree-shakeable
- ✅ TypeScript support
- ✅ Funciones útiles: format, parse, addDays, etc.

#### 2. **uuid** (generación de IDs)
```bash
npm install uuid
npm install -D @types/uuid
```
- ✅ Generar event_ids, product_ids, etc.

#### 3. **clsx** o **cn** (conditional classes)
```bash
npm install clsx
```
- ✅ Para Tailwind classes condicionales

#### 4. **react-hot-toast** (notificaciones)
```bash
npm install react-hot-toast
```
- ✅ Notificaciones elegantes
- ✅ Ligero
- ✅ Perfecto para feedback de acciones (venta exitosa, sync, etc.)

---

## Stack Final Recomendado

### PWA (React + Vite)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.12.0",
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    "dexie": "^3.2.4",
    "date-fns": "^2.30.0",
    "uuid": "^9.0.0",
    "react-hot-toast": "^2.4.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.292.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "@types/uuid": "^9.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

### Desktop (Tauri + React)

Mismo stack que PWA, más:
- `@tauri-apps/api` para acceso nativo
- Tauri SQL plugin para SQLite

---

## Estructura de Carpetas Recomendada

```
apps/pwa/src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── pos/             # Componentes específicos del POS
│   ├── products/        # Componentes de productos
│   └── layout/          # Layout components
├── pages/               # Páginas/views
├── hooks/               # Custom hooks
├── stores/              # Zustand stores
├── services/            # API services
├── lib/                 # Utilidades (api client, utils)
├── db/                  # Dexie database (ya existe)
└── types/               # TypeScript types
```

---

## Prioridades para MVP

### Fase 1: Core POS (Crítico)
1. ✅ Shadcn/ui + Tailwind
2. ✅ Zustand (carrito, estado del POS)
3. ✅ React Router
4. ✅ React Hook Form + Zod
5. ✅ TanStack Query + Axios
6. ✅ Dexie (ya configurado)

### Fase 2: Mejoras (Post-MVP)
- React Hot Toast
- date-fns
- Optimizaciones

---

## Ejemplo de Setup Inicial

### 1. Instalar dependencias base

```bash
cd apps/pwa
npm install react-router-dom @tanstack/react-query axios zustand react-hook-form @hookform/resolvers zod date-fns uuid react-hot-toast clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer @types/uuid
```

### 2. Configurar Tailwind

```bash
npx tailwindcss init -p
```

### 3. Inicializar shadcn/ui

```bash
npx shadcn-ui@latest init
```

### 4. Configurar React Query

```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 3,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

---

## Comparación Rápida

| Categoría | Opción 1 (Recomendada) | Opción 2 | Opción 3 |
|-----------|------------------------|----------|----------|
| **UI** | Shadcn/ui + Tailwind | Ant Design | Chakra UI |
| **State** | Zustand | Jotai | Context + useReducer |
| **HTTP** | TanStack Query + Axios | SWR | fetch nativo |
| **Forms** | React Hook Form + Zod | Formik + Yup | useState |
| **Routing** | React Router v6 | TanStack Router | Wouter |

---

## Recomendación Final

**Stack MVP:**
- 🎨 **Shadcn/ui + Tailwind CSS** (UI moderna y rápida)
- 📊 **Zustand** (estado ligero)
- 🔄 **TanStack Query + Axios** (sync robusto)
- 🗂️ **React Router v6** (navegación)
- 📝 **React Hook Form + Zod** (formularios)
- 💾 **Dexie** (ya configurado)

Este stack es:
- ✅ Ligero y performante
- ✅ Type-safe (TypeScript)
- ✅ Moderno y mantenible
- ✅ Perfecto para offline-first
- ✅ Escalable

¿Quieres que configure este stack ahora o prefieres otra opción?

