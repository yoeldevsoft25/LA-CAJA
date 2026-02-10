import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Hash, Save, Plus, X, ListChecks } from 'lucide-react'
import {
  ProductSerial,
  CreateProductSerialRequest,
  CreateSerialsBatchRequest,
} from '@/services/product-serials.service'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const serialSchema = z.object({
  serial_number: z.string().min(1, 'El número de serie es requerido').max(200, 'Máximo 200 caracteres'),
  received_at: z.string().min(1, 'La fecha de recepción es requerida'),
  note: z.string().max(1000).nullable().optional(),
})

const batchSchema = z.object({
  serial_numbers: z.string().min(1, 'Debe ingresar al menos un número de serie'),
  received_at: z.string().min(1, 'La fecha de recepción es requerida'),
})

type SerialFormData = z.infer<typeof serialSchema>
type BatchFormData = z.infer<typeof batchSchema>

interface ProductSerialModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  serial: ProductSerial | null
  onConfirm: (data: CreateProductSerialRequest) => void
  onBatchConfirm: (data: CreateSerialsBatchRequest) => void
  isLoading: boolean
}

export default function ProductSerialModal({
  isOpen,
  onClose,
  productId,
  serial,
  onConfirm,
  onBatchConfirm,
  isLoading,
}: ProductSerialModalProps) {
  const [batchSerialNumbers, setBatchSerialNumbers] = useState<string[]>([''])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SerialFormData>({
    resolver: zodResolver(serialSchema),
    defaultValues: {
      serial_number: '',
      received_at: new Date().toISOString().slice(0, 16),
      note: null,
    },
  })

  const {
    register: registerBatch,
    handleSubmit: handleSubmitBatch,
    formState: { errors: errorsBatch },
    reset: resetBatch,
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      serial_numbers: '',
      received_at: new Date().toISOString().slice(0, 16),
    },
  })

  useEffect(() => {
    if (serial) {
      reset({
        serial_number: serial.serial_number,
        received_at: new Date(serial.received_at).toISOString().slice(0, 16),
        note: serial.note || null,
      })
    } else {
      reset({
        serial_number: '',
        received_at: new Date().toISOString().slice(0, 16),
        note: null,
      })
    }
    resetBatch({
      serial_numbers: '',
      received_at: new Date().toISOString().slice(0, 16),
    })
    setBatchSerialNumbers([''])
  }, [serial, reset, resetBatch])

  const onSubmit = (data: SerialFormData) => {
    const requestData: CreateProductSerialRequest = {
      product_id: productId,
      serial_number: data.serial_number,
      received_at: new Date(data.received_at).toISOString(),
      note: data.note || null,
    }
    onConfirm(requestData)
  }

  const onBatchSubmit = (data: BatchFormData) => {
    const validSerialNumbers = batchSerialNumbers.filter((sn) => sn.trim() !== '')
    if (validSerialNumbers.length === 0) {
      return
    }

    const requestData: CreateSerialsBatchRequest = {
      product_id: productId,
      serial_numbers: validSerialNumbers,
      received_at: new Date(data.received_at).toISOString(),
    }
    onBatchConfirm(requestData)
  }

  const addBatchSerialField = () => {
    setBatchSerialNumbers([...batchSerialNumbers, ''])
  }

  const removeBatchSerialField = (index: number) => {
    setBatchSerialNumbers(batchSerialNumbers.filter((_, i) => i !== index))
  }

  const updateBatchSerialNumber = (index: number, value: string) => {
    const updated = [...batchSerialNumbers]
    updated[index] = value
    setBatchSerialNumbers(updated)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0 border-l border-border shadow-2xl">
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SheetTitle className="text-xl font-semibold flex items-center">
            <Hash className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-3" />
            {serial ? 'Editar Serial' : 'Crear Serial'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {serial ? 'Edita los datos del serial' : 'Crea un nuevo serial para el producto'}
          </SheetDescription>
        </SheetHeader>

        {serial ? (
          // Editar serial individual
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 bg-background">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 space-y-6">
              <Alert className="bg-primary/5 border-primary/20 p-4">
                <AlertDescription className="text-sm text-foreground/90 leading-relaxed">
                  Los seriales permiten rastrear productos individuales por número de serie.
                </AlertDescription>
              </Alert>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="serial_number" className="text-sm font-medium mb-1.5 block">
                    Número de Serie <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="serial_number"
                    {...register('serial_number')}
                    className="h-10 font-mono"
                    placeholder="Ej: SN-2024-001"
                    maxLength={200}
                    disabled={isLoading || !!serial}
                  />
                  {errors.serial_number && (
                    <p className="mt-1 text-sm text-destructive">{errors.serial_number.message}</p>
                  )}
                  {serial && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      El número de serie no se puede modificar
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="received_at" className="text-sm font-medium mb-1.5 block">
                    Fecha de Recepción <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="received_at"
                    type="datetime-local"
                    {...register('received_at')}
                    className="h-10"
                    disabled={isLoading}
                  />
                  {errors.received_at && (
                    <p className="mt-1 text-sm text-destructive">{errors.received_at.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="note" className="text-sm font-medium mb-1.5 block">Nota (Opcional)</Label>
                  <Textarea
                    id="note"
                    {...register('note')}
                    rows={3}
                    className="resize-none"
                    placeholder="Notas adicionales sobre el serial..."
                    maxLength={1000}
                    disabled={isLoading}
                  />
                  {errors.note && (
                    <p className="mt-1 text-sm text-destructive">{errors.note.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-border px-5 py-4 bg-muted/10 backdrop-blur-sm">
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-11"
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Actualizar Serial
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          // Crear serial (individual o en lote)
          <Tabs defaultValue="single" className="flex-1 flex flex-col min-h-0 bg-background">
            <div className="flex-shrink-0 px-5 pt-5 pb-2">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
                <TabsTrigger value="single" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Hash className="w-4 h-4 mr-2" />
                  Individual
                </TabsTrigger>
                <TabsTrigger value="batch" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <ListChecks className="w-4 h-4 mr-2" />
                  En Lote
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="single" className="flex-1 flex flex-col min-h-0 mt-0">
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 space-y-6">
                  <Alert className="bg-primary/5 border-primary/20 p-4">
                    <AlertDescription className="text-sm text-foreground/90 leading-relaxed">
                      Crea un serial individual para el producto.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="single_serial_number" className="text-sm font-medium mb-1.5 block">
                        Número de Serie <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="single_serial_number"
                        {...register('serial_number')}
                        className="h-10 font-mono"
                        placeholder="Ej: SN-2024-001"
                        maxLength={200}
                        disabled={isLoading}
                      />
                      {errors.serial_number && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.serial_number.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="single_received_at" className="text-sm font-medium mb-1.5 block">
                        Fecha de Recepción <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="single_received_at"
                        type="datetime-local"
                        {...register('received_at')}
                        className="h-10"
                        disabled={isLoading}
                      />
                      {errors.received_at && (
                        <p className="mt-1 text-sm text-destructive">{errors.received_at.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="single_note" className="text-sm font-medium mb-1.5 block">Nota (Opcional)</Label>
                      <Textarea
                        id="single_note"
                        {...register('note')}
                        rows={3}
                        className="resize-none"
                        placeholder="Notas adicionales sobre el serial..."
                        maxLength={1000}
                        disabled={isLoading}
                      />
                      {errors.note && (
                        <p className="mt-1 text-sm text-destructive">{errors.note.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 border-t border-border px-5 py-4 bg-muted/10 backdrop-blur-sm">
                  <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      className="flex-1 h-11"
                      disabled={isLoading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Crear Serial
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="batch" className="flex-1 flex flex-col min-h-0 mt-0">
              <form onSubmit={handleSubmitBatch(onBatchSubmit)} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 space-y-6">
                  <Alert className="bg-primary/5 border-primary/20 p-4">
                    <AlertDescription className="text-sm text-foreground/90 leading-relaxed">
                      Crea múltiples seriales a la vez. Útil para recepciones de grandes lotes.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="batch_received_at" className="text-sm font-medium mb-1.5 block">
                        Fecha de Recepción <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="batch_received_at"
                        type="datetime-local"
                        {...registerBatch('received_at')}
                        className="h-10"
                        disabled={isLoading}
                      />
                      {errorsBatch.received_at && (
                        <p className="mt-1 text-sm text-destructive">
                          {errorsBatch.received_at.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Números de Serie</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addBatchSerialField}
                          disabled={isLoading}
                          className="h-8 rounded-full"
                        >
                          <Plus className="w-3 h-3 mr-1.5" />
                          Agregar Mas
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                        {batchSerialNumbers.map((serialNumber, index) => (
                          <div key={index} className="flex items-center gap-2 group">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                              {index + 1}
                            </div>
                            <Input
                              value={serialNumber}
                              onChange={(e) => updateBatchSerialNumber(index, e.target.value)}
                              placeholder="Ingrese número de serie"
                              maxLength={200}
                              disabled={isLoading}
                              className="h-9 font-mono text-sm"
                            />
                            {batchSerialNumbers.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBatchSerialField(index)}
                                disabled={isLoading}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {batchSerialNumbers.filter((sn) => sn.trim() !== '').length === 0 && (
                        <p className="mt-1 text-sm text-destructive">
                          Debe ingresar al menos un número de serie
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 border-t border-border px-5 py-4 bg-muted/10 backdrop-blur-sm">
                  <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      className="flex-1 h-11"
                      disabled={isLoading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                      disabled={
                        isLoading ||
                        batchSerialNumbers.filter((sn) => sn.trim() !== '').length === 0
                      }
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Crear {batchSerialNumbers.filter((sn) => sn.trim() !== '').length} Seriales
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
