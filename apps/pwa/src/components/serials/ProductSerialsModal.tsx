import { X } from 'lucide-react'
import { Product } from '@/services/products.service'
import ProductSerialsList from './ProductSerialsList'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ProductSerialsModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
}

export default function ProductSerialsModal({
  isOpen,
  onClose,
  product,
}: ProductSerialsModalProps) {
  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl">Seriales de {product.name}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <ProductSerialsList productId={product.id} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

