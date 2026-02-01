import { FileCheck, AlertCircle } from 'lucide-react'
import { Shift } from '@/services/shifts.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CutZModalProps {
  isOpen: boolean
  onClose: () => void
  shift: Shift
  onConfirm: () => void
  isLoading: boolean
}

export default function CutZModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: CutZModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <FileCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Crear Corte Z
          </DialogTitle>
          <DialogDescription>
            Generar un corte final del turno cerrado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-warning/10 border-warning/50">
            <AlertCircle className="w-4 h-4 text-warning" />
            <AlertDescription>
              <p className="text-sm font-medium text-warning mb-1">
                Corte Final del Turno
              </p>
              <p className="text-xs text-foreground">
                El corte Z solo se puede generar para turnos cerrados. Este corte incluirá
                todos los totales finales del turno, incluyendo el arqueo.
              </p>
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            <p>Este corte incluirá:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Total de ventas del turno completo</li>
              <li>Totales por método de pago</li>
              <li>Montos de apertura y cierre</li>
              <li>Diferencias de arqueo (si aplica)</li>
              <li>Fecha y hora del corte</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                Generando...
              </>
            ) : (
              <>
                <FileCheck className="w-5 h-5 mr-2" />
                Crear Corte Z
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

