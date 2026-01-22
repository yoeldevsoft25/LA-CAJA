import { useState, useRef, useEffect } from 'react'
import { X, Plus, Minus, ShoppingCart, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useMutation } from '@tanstack/react-query'
import { publicMenuService } from '@/services/public-menu.service'
import toast from '@/lib/toast'
import type { PublicProduct } from '@/services/public-menu.service'
import { cn } from '@/lib/utils'

interface CartItem {
  product: PublicProduct
  quantity: number
}

interface OrderCartProps {
  items: CartItem[]
  onRemove: (productId: string) => void
  onUpdateQuantity: (productId: string, quantity: number) => void
  onClose: () => void
  tableId: string // TODO: Usar tableId cuando se implemente la funcionalidad
  qrCode: string
  onOrderCreated?: () => void
}

export default function OrderCart({
  items,
  onRemove,
  onUpdateQuantity,
  onClose,
  tableId: _tableId, // TODO: Usar tableId cuando se implemente la funcionalidad
  qrCode,
  onOrderCreated,
}: OrderCartProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasMoreItems, setHasMoreItems] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const total = items.reduce((sum, item) => {
    return sum + item.product.price_usd * item.quantity
  }, 0)

  const totalBs = items.reduce((sum, item) => {
    return sum + item.product.price_bs * item.quantity
  }, 0)

  // Detectar si hay más items que caben en la pantalla móvil
  useEffect(() => {
    const checkScroll = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        // Solo en móvil - verificar si hay más de 1 item
        if (items.length > 1) {
          // Esperar a que el DOM se actualice
          setTimeout(() => {
            const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
            if (scrollContainer) {
              const hasScroll = scrollContainer.scrollHeight > scrollContainer.clientHeight + 10
              setHasMoreItems(hasScroll)
            } else {
              // Fallback: si hay más de 1 item, mostrar indicador
              setHasMoreItems(items.length > 1)
            }
          }, 150)
        } else {
          setHasMoreItems(false)
        }
      } else {
        setHasMoreItems(false)
      }
    }

    checkScroll()
    window.addEventListener('resize', checkScroll)
    
    // También verificar cuando cambian los items
    const timer = setTimeout(checkScroll, 200)

    return () => {
      window.removeEventListener('resize', checkScroll)
      clearTimeout(timer)
    }
  }, [items.length, items])

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Crear orden con los items del carrito usando el servicio público
      const result = await publicMenuService.createOrder(
        qrCode,
        items.map((item) => ({
          product_id: item.product.id,
          qty: item.quantity,
        }))
      )

      return result
    },
    onSuccess: () => {
      toast.success('¡Pedido enviado! Te notificaremos cuando esté listo.')
      // Limpiar carrito
      items.forEach((item) => onRemove(item.product.id))
      onClose()
      // Notificar que se creó la orden
      if (onOrderCreated) {
        onOrderCreated()
      }
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al enviar el pedido. Intenta nuevamente.'
      )
    },
  })

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    setIsSubmitting(true)
    try {
      await createOrderMutation.mutateAsync()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="w-5 h-5 shrink-0" />
          <h2 className="font-semibold text-base sm:text-lg truncate">Mi Pedido</h2>
          {items.length > 0 && (
            <Badge variant="secondary" className="shrink-0">{items.length}</Badge>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="shrink-0 touch-manipulation min-h-[44px] min-w-[44px]"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Items con altura limitada en móvil */}
      <div className="relative flex-1 min-h-0 overflow-hidden lg:overflow-visible">
        <ScrollArea 
          ref={scrollAreaRef}
          className={cn(
            "h-full w-full",
            // En móvil, limitar altura para mostrar solo 1 producto
            "lg:max-h-none"
          )}
        >
          <div className={cn(
            "p-3 sm:p-4 lg:p-4",
            // En móvil, padding extra para que el scroll sea más visible y el contenido no se oculte
            "pb-4 sm:pb-6"
          )}>
            {items.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-sm sm:text-base">Tu carrito está vacío</p>
                <p className="text-xs sm:text-sm mt-2">Agrega productos del menú</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {items.map((item) => (
                  <div
                    key={item.product.id}
                    className={cn(
                      "flex items-start gap-2 sm:gap-3 p-4 sm:p-4 border rounded-lg bg-background",
                      // En móvil, cada item debe ocupar suficiente espacio
                      "min-h-[90px] lg:min-h-0 lg:p-3"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm sm:text-base truncate">{item.product.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        ${item.product.price_usd.toFixed(2)} c/u
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9 touch-manipulation"
                        onClick={() =>
                          onUpdateQuantity(item.product.id, item.quantity - 1)
                        }
                      >
                        <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                      <span className="w-6 sm:w-8 text-center font-medium text-sm sm:text-base">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9 touch-manipulation"
                        onClick={() =>
                          onUpdateQuantity(item.product.id, item.quantity + 1)
                        }
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>

                    <div className="text-right min-w-[60px] sm:min-w-[80px] shrink-0">
                      <p className="font-semibold text-sm sm:text-base">
                        ${(item.product.price_usd * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 touch-manipulation"
                      onClick={() => onRemove(item.product.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Indicador visual de más productos en móvil */}
        {hasMoreItems && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none lg:hidden flex items-end justify-center pb-2">
            <div className="flex flex-col items-center gap-1">
              <ChevronDown className="w-5 h-5 text-primary animate-bounce" />
              <span className="text-xs text-primary font-medium">
                {items.length - 1} más
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer con total y botón - siempre visible */}
      {items.length > 0 && (
        <div className="p-3 sm:p-4 border-t space-y-2 sm:space-y-3 shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm sm:text-base">Total:</span>
            <div className="text-right">
              <p className="text-base sm:text-lg font-bold text-primary">
                ${total.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Bs. {totalBs.toFixed(2)}
              </p>
            </div>
          </div>

          <Button
            className="w-full touch-manipulation min-h-[48px]"
            size="lg"
            onClick={handleSubmit}
            disabled={isSubmitting || createOrderMutation.isPending}
          >
            {isSubmitting || createOrderMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Pedido'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
