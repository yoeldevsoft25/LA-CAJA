import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hash, X, Check } from 'lucide-react'
import { productSerialsService } from '@/services/product-serials.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@la-caja/ui-core'

interface SerialSelectorProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  productName: string
  quantity: number
  onSelect: (serialNumbers: string[]) => void
}

export default function SerialSelector({
  isOpen,
  onClose,
  productId,
  productName,
  quantity,
  onSelect,
}: SerialSelectorProps) {
  const [selectedSerials, setSelectedSerials] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const { data: availableSerials, isLoading } = useQuery({
    queryKey: ['product-serials', 'available', productId, quantity],
    queryFn: () => productSerialsService.getAvailableSerials(productId, quantity),
    enabled: isOpen,
    staleTime: 1000 * 60 * 2, // 2 minutos
  })

  useEffect(() => {
    if (!isOpen) {
      setSelectedSerials([])
      setSearchQuery('')
    }
  }, [isOpen])

  const filteredSerials = availableSerials?.filter((serial) =>
    serial.serial_number.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleSerial = (serialNumber: string) => {
    if (selectedSerials.includes(serialNumber)) {
      setSelectedSerials(selectedSerials.filter((sn) => sn !== serialNumber))
    } else {
      if (selectedSerials.length < quantity) {
        setSelectedSerials([...selectedSerials, serialNumber])
      }
    }
  }

  const handleConfirm = () => {
    if (selectedSerials.length === quantity) {
      onSelect(selectedSerials)
      onClose()
    }
  }

  const handleSkip = () => {
    onSelect([])
    onClose()
  }

  if (!isOpen) return null

  const isComplete = selectedSerials.length === quantity
  const canSelectMore = selectedSerials.length < quantity

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Hash className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Seleccionar Seriales - {productName}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Selecciona los números de serie para este producto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 py-4 border-b border-border">
            <div className="space-y-3">
              <div>
                <Label htmlFor="search">Buscar Serial</Label>
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por número de serie..."
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Seleccionados: {selectedSerials.length} / {quantity}
                  </p>
                  {availableSerials && (
                    <p className="text-xs text-muted-foreground">
                      {availableSerials.length} seriales disponibles
                    </p>
                  )}
                </div>
                {!isComplete && (
                  <Alert className="bg-warning/5 border-warning/50 py-2 px-3">
                    <AlertDescription className="text-xs">
                      Debe seleccionar {quantity - selectedSerials.length} serial
                      {quantity - selectedSerials.length !== 1 ? 'es' : ''} más
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {selectedSerials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSerials.map((serialNumber) => (
                    <Badge key={serialNumber} variant="default" className="gap-1">
                      {serialNumber}
                      <button
                        onClick={() => handleToggleSerial(serialNumber)}
                        className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4 md:px-6 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSerials && filteredSerials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? 'No se encontraron seriales con ese criterio'
                  : 'No hay seriales disponibles para este producto'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSerials?.map((serial) => {
                  const isSelected = selectedSerials.includes(serial.serial_number)
                  const isDisabled = !isSelected && !canSelectMore

                  return (
                    <button
                      key={serial.id}
                      onClick={() => handleToggleSerial(serial.serial_number)}
                      disabled={isDisabled}
                      className={cn(
                        'w-full p-3 rounded-lg border transition-all text-left',
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : isDisabled
                            ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-primary hover:bg-accent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center',
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-border bg-background'
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div>
                            <p className="font-medium text-foreground font-mono">
                              {serial.serial_number}
                            </p>
                            {serial.note && (
                              <p className="text-xs text-muted-foreground">{serial.note}</p>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="ml-2">
                            Seleccionado
                          </Badge>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              className="flex-1"
              disabled={isLoading}
            >
              Omitir
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!isComplete || isLoading}
            >
              Confirmar ({selectedSerials.length}/{quantity})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

