import { FileX, AlertCircle } from 'lucide-react'
import { Shift } from '@/services/shifts.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CutXModalProps {
  isOpen: boolean
  onClose: () => void
  shift: Shift
  onConfirm: () => void
  isLoading: boolean
}

export default function CutXModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: CutXModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <FileX className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Crear Corte X
          </DialogTitle>
          <DialogDescription>
            Generar un corte intermedio del turno actual
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <p className="text-sm">
                Se generará un corte X (intermedio) con los totales del turno hasta este momento.
                El turno permanecerá abierto y podrás continuar realizando ventas.
              </p>
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            <p>Este corte incluirá:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Total de ventas realizadas</li>
              <li>Totales por método de pago</li>
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
                <FileX className="w-5 h-5 mr-2" />
                Crear Corte X
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

