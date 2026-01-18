# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - generic [ref=e9]: Modo Offline No Disponible en Desarrollo
  - generic [ref=e10]:
    - paragraph [ref=e11]: En modo desarrollo, Vite necesita el servidor para transformar módulos dinámicamente. Cuando estás offline, no puede cargar las páginas.
    - generic [ref=e12]:
      - paragraph [ref=e13]: "💡 Para probar offline:"
      - list [ref=e14]:
        - listitem [ref=e15]:
          - text: "Construye la app en producción:"
          - code [ref=e16]: cd apps/pwa && npm run build
        - listitem [ref=e17]:
          - text: "Ejecuta el preview:"
          - code [ref=e18]: npm run preview
        - listitem [ref=e19]:
          - text: "O usa el script:"
          - code [ref=e20]: ./scripts/test-offline.sh
    - paragraph [ref=e21]: En producción, el offline funciona perfectamente gracias al Service Worker.
    - generic [ref=e22]:
      - button "Ir al inicio" [ref=e23] [cursor=pointer]
      - button "Recargar" [ref=e24] [cursor=pointer]
```