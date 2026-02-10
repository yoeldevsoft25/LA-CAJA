import { Product } from '@la-caja/app-core'
import ProductLotsList from './ProductLotsList'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Boxes } from 'lucide-react'

interface ProductLotsModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
}

export default function ProductLotsModal({
  isOpen,
  onClose,
  product,
}: ProductLotsModalProps) {
  if (!product) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 border-l border-border shadow-2xl">
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SheetTitle className="text-xl font-semibold flex items-center">
            <Boxes className="w-6 h-6 text-primary mr-3" />
            Lotes de {product.name}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Administra los lotes y fechas de vencimiento para este producto
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 bg-muted/5">
          <ProductLotsList productId={product.id} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

