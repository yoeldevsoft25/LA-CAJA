import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { fiscalInvoicesService } from '@/services/fiscal-invoices.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, AlertCircle } from 'lucide-react'
import toast from '@/lib/toast'
import { useNavigate } from 'react-router-dom'

interface CreateFiscalInvoiceFromSaleModalProps {
  isOpen: boolean
  onClose: () => void
  saleId: string
  onSuccess?: () => void
}

export default function CreateFiscalInvoiceFromSaleModal({
  isOpen,
  onClose,
  saleId,
  onSuccess,
}: CreateFiscalInvoiceFromSaleModalProps) {
  const navigate = useNavigate()
  const [goToInvoice, setGoToInvoice] = useState(false)

  const createMutation = useMutation({
    mutationFn: () => fiscalInvoicesService.createFromSale(saleId),
    onSuccess: (invoice) => {
      toast.success('Factura fiscal creada correctamente')
      onSuccess?.()
      if (goToInvoice) {
        navigate(`/fiscal-invoices/${invoice.id}`)
      } else {
        onClose()
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la factura fiscal')
    },
  })

  const handleCreate = () => {
    createMutation.mutate()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Crear Factura Fiscal
          </DialogTitle>
          <DialogDescription>
            ¿Desea crear una factura fiscal para esta venta? La factura se creará en estado
            "Borrador" y podrá emitirla después.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Una vez creada, podrá revisar y emitir la factura fiscal desde el detalle de la
            factura.
          </AlertDescription>
        </Alert>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="goToInvoice"
            checked={goToInvoice}
            onChange={(e) => setGoToInvoice(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="goToInvoice" className="text-sm text-foreground cursor-pointer">
            Ir al detalle de la factura después de crearla
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {createMutation.isPending ? 'Creando...' : 'Crear Factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

