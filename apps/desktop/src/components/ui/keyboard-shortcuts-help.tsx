import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Keyboard, Command } from 'lucide-react'

interface ShortcutProps {
  keys: string[]
  description: string
  context?: string
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts: { section: string; items: ShortcutProps[] }[] = [
  {
    section: 'Navegación General',
    items: [
      { keys: ['?'], description: 'Mostrar esta ayuda', context: 'Global' },
      { keys: ['Esc'], description: 'Cerrar modal/diálogo', context: 'Global' },
      { keys: ['Tab'], description: 'Siguiente elemento', context: 'Global' },
      { keys: ['Shift', 'Tab'], description: 'Elemento anterior', context: 'Global' },
      { keys: ['Enter'], description: 'Activar botón/enlace', context: 'Global' },
      { keys: ['Space'], description: 'Activar botón/checkbox', context: 'Global' },
    ],
  },
  {
    section: 'Punto de Venta (POS)',
    items: [
      { keys: ['/'], description: 'Enfocar búsqueda de productos', context: 'POS' },
      { keys: ['F2'], description: 'Abrir checkout / Cobrar', context: 'POS' },
      { keys: ['Alt', 'L'], description: 'Limpiar carrito', context: 'POS' },
      { keys: ['↑', '↓'], description: 'Navegar lista de productos', context: 'POS' },
      { keys: ['Enter'], description: 'Agregar producto seleccionado', context: 'POS' },
    ],
  },
  {
    section: 'Tablas y Listas',
    items: [
      { keys: ['↑', '↓'], description: 'Navegar filas', context: 'Tablas' },
      { keys: ['Enter'], description: 'Seleccionar/Abrir elemento', context: 'Tablas' },
      { keys: ['Home'], description: 'Ir al primer elemento', context: 'Tablas' },
      { keys: ['End'], description: 'Ir al último elemento', context: 'Tablas' },
    ],
  },
  {
    section: 'Formularios',
    items: [
      { keys: ['Tab'], description: 'Siguiente campo', context: 'Formularios' },
      { keys: ['Shift', 'Tab'], description: 'Campo anterior', context: 'Formularios' },
      { keys: ['Enter'], description: 'Enviar formulario', context: 'Formularios' },
      { keys: ['Esc'], description: 'Cancelar/Cerrar', context: 'Formularios' },
    ],
  },
]

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-muted border border-border rounded text-xs font-mono font-medium shadow-sm">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsHelp({ isOpen, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Atajos de Teclado
          </DialogTitle>
          <DialogDescription>
            Usa estos atajos para navegar más rápido por la aplicación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcuts.map((section) => (
            <div key={section.section}>
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Command className="w-4 h-4 text-muted-foreground" />
                {section.section}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          <KeyBadge>{key}</KeyBadge>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Presiona <KeyBadge>?</KeyBadge> en cualquier momento para mostrar esta ayuda
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hook para gestionar el estado del modal de atajos de teclado
 * Se abre automáticamente al presionar '?'
 */
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // No activar si estamos en un input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return
    }

    // Shift + ? o solo ?
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault()
      setIsOpen(true)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    isOpen,
    setIsOpen,
  }
}

export default KeyboardShortcutsHelp
