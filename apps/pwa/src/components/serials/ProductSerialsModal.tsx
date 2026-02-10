import { Product } from '@la-caja/app-core'
import ProductSerialsList from './ProductSerialsList'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Hash } from 'lucide-react'

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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 border-l border-border shadow-2xl">
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SheetTitle className="text-xl font-semibold flex items-center">
            <Hash className="w-6 h-6 text-primary mr-3" />
            Seriales de {product.name}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Administración de números de serie para {product.name}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 bg-muted/5">
          <ProductSerialsList productId={product.id} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
