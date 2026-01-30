import { usePWAInstall } from '@/hooks/usePWAInstall'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Download, X, Share, Plus, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InstallPromptProps {
  className?: string
  variant?: 'banner' | 'compact'
}

export default function InstallPrompt({ className, variant = 'banner' }: InstallPromptProps) {
  const { isInstallable, isIOS, promptInstall, dismissPrompt } = usePWAInstall()

  // Si ya está instalado o no es instalable, no mostrar nada
  if (!isInstallable && !isIOS) {
    return null
  }

  // Variante compacta (para sidebar o header)
  if (variant === 'compact') {
    if (isIOS) {
      return (
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2 text-xs border-dashed', className)}
          onClick={() => {
            // Mostrar modal con instrucciones para iOS
            alert('Para instalar: toca el botón Compartir en Safari y selecciona "Agregar a pantalla de inicio"')
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Instalar App
        </Button>
      )
    }

    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-2 text-xs border-dashed border-primary/50 text-primary hover:bg-primary/5', className)}
        onClick={promptInstall}
      >
        <Download className="w-3.5 h-3.5" />
        Instalar App
      </Button>
    )
  }

  // Variante banner (para parte superior o inferior)
  return (
    <Card className={cn(
      'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md shadow-lg border-primary/30 animate-in slide-in-from-bottom-5 duration-500',
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icono */}
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              Instalar Velox POS
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS
                ? 'Añade la app a tu pantalla de inicio para acceso rápido'
                : 'Instala la app para acceso rápido y uso offline'}
            </p>

            {/* Acciones */}
            <div className="flex items-center gap-2 mt-3">
              {isIOS ? (
                // Instrucciones para iOS
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <Share className="w-4 h-4" />
                  <span>Toca</span>
                  <Share className="w-3 h-3" />
                  <span>y luego</span>
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    Agregar a inicio
                  </span>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={promptInstall}
                  >
                    <Download className="w-4 h-4" />
                    Instalar ahora
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismissPrompt}
                  >
                    Ahora no
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Botón cerrar */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 -mt-1 -mr-1"
            onClick={dismissPrompt}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
