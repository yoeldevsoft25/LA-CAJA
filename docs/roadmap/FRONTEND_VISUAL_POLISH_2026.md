# Roadmap: Pulido Visual & Consistencia UX 2026 🎨✨

Este roadmap se enfoca exclusivamente en elevar la calidad visual de Velox POS, asegurando que cada píxel sea consistente, premium y funcional en todas las plataformas (PWA, Desktop, Mobile).

## Sprint 11: Base de Diseño & Tokens (Fundación)
> **Objetivo:** Asegurar que los cimientos visuales sean inquebrantables.

- [ ] **Estandarización de Tokens:**
  - [ ] Auditoría de `index.css` para eliminar colores hardcodeados (hex/rgb) y reemplazarlos por variables HSL.
  - [ ] Unificación de `borderRadius` (uso estricto de `--radius`).
  - [ ] Revisión de tipografía: asegurar que `Inter` (o la fuente elegida) se renderice correctamente en Windows/Mac/Android.
- [ ] **Consistencia de Sombras y Elevación:**
  - [ ] Crear sistema de `premium-shadows` (sm, md, lg, xl).
  - [ ] Aplicar efecto `glass-panel` consistente en todos los Modals y Drawers.

## Sprint 12: Componentes Core & Estados Globales
> **Objetivo:** Que los elementos repetitivos se sientan parte de una misma familia.

- [ ] **Buttons & Actions:**
  - [ ] Revisión de `Button` variants (Primary, Secondary, Ghost, Outline).
  - [ ] Agregar micro-animaciones (Framer Motion) a los clicks y hovers.
- [ ] **Empty & Loading States:**
  - [ ] Crear una librería de Skeletons para cada sección (Inventory, Sales, Reports).
  - [ ] Implementar ilustraciones premium (SVG) para estados vacíos.
- [ ] **Feedback Sistémico:**
  - [ ] Estandarizar Toasts (Sonner) con iconos y colores del tema.
  - [ ] Unificar indicadores de carga (Spinners, Pull-to-refresh).

## Sprint 13: Experiencia de Página (Layouts de Alto Impacto)
> **Objetivo:** Optimizar las vistas donde los usuarios pasan el 90% del tiempo.

- [ ] **Dashboard Maestro:**
  - [ ] Refactor de Gráficos (Recharts) para usar colores del tema Indigo.
  - [ ] Layout adaptativo real: mejorar la visibilidad en tablets industriales.
- [ ] **POS Moderno:**
  - [ ] Optimización de espacio en el Carrito de Ventas.
  - [ ] Mejora visual del Teclado Numérico (Tactilidad y feedback visual).
  - [ ] Transiciones suaves entre categorías de productos.

## Sprint 14: Modo Oscuro & Accesibilidad (A11Y)
> **Objetivo:** Un sistema inclusivo y visualmente descansado.

- [ ] **Dark Mode Audit:**
  - [ ] Corregir contrastes en tablas y reportes bajo modo oscuro.
  - [ ] Asegurar que los gradientes de `ShineBorder` no "quemen" la vista en la noche.
- [ ] **Accesibilidad Pro:**
  - [ ] Focus states visibles en navegación por teclado.
  - [ ] Soporte completo de Screen Readers en flujos de pago.

---
**Estado Actual:** 🛠️ *En fase de planificación y auditoría.*
