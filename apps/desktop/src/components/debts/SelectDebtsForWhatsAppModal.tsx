import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Loader2, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Customer } from '@/services/customers.service'
import { Debt, debtsService, calculateDebtTotals } from '@/services/debts.service'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import toast from '@/lib/toast'
import { whatsappTemplates } from '@/lib/whatsapp.utils'

export interface SelectDebtsForWhatsAppModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer
  openDebts: Debt[]
  onSuccess?: () => void
}

type Tone = 'friendly' | 'formal' | 'urgent'

export default function SelectDebtsForWhatsAppModal({
  isOpen,
  onClose,
  customer,
  openDebts,
  onSuccess,
}: SelectDebtsForWhatsAppModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(openDebts.map((d) => d.id)))
  const [tone, setTone] = useState<Tone>('friendly')
  const [isSending, setIsSending] = useState(false)
  const prevOpen = useRef(false)

  // Al abrir el modal, marcar todas las deudas como seleccionadas y resetear tono
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setSelectedIds(new Set(openDebts.map((d) => d.id)))
      setTone('friendly')
    }
    prevOpen.current = isOpen
  }, [isOpen, openDebts])

  const selectAll = () => setSelectedIds(new Set(openDebts.map((d) => d.id)))
  const selectNone = () => setSelectedIds(new Set())
  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedList = Array.from(selectedIds)
  const totalSelectedUsd = openDebts
    .filter((d) => selectedIds.has(d.id))
    .reduce((sum, d) => sum + calculateDebtTotals(d).remaining_usd, 0)

  // Generar preview del mensaje
  const messagePreview = whatsappTemplates.generateMessage(tone, {
    customerName: customer.name,
    totalAmount: totalSelectedUsd,
    currency: 'USD', // Por defecto USD
    storeName: 'Velox POS' // Nombre hardcoded por ahora, idealmente vendría de config
  })

  // Decodificar para vista previa (quitar %0A)
  const readablePreview = decodeURIComponent(messagePreview).replace(/%0A/g, '\n')

  const handleSend = async () => {
    if (selectedList.length === 0) {
      toast.error('Seleccione al menos una deuda')
      return
    }

    if (!customer.phone) {
      toast.error('El cliente no tiene teléfono registrado')
      return
    }

    setIsSending(true)
    try {
      // 1. Abrir WhatsApp
      const link = whatsappTemplates.generateLink(customer.phone, messagePreview)
      window.open(link, '_blank')

      // 2. Registrar en backend que se envió recordatorio (opcional, lanzamos y olvidamos)
      // No esperamos, para que la UI no se bloquee si el usuario ya se fue a WhatsApp
      debtsService.sendDebtReminder(customer.id, selectedList).catch(console.error)

      toast.success('WhatsApp abierto correctamente')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('[SelectDebtsForWhatsAppModal] Error:', error)
      toast.error('Error al abrir WhatsApp')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Enviar Recordatorio
          </DialogTitle>
          <DialogDescription>
            Personaliza el mensaje para <strong>{customer.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* 1. Selector de Tono */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">1. Elige el tono del mensaje</Label>
            <RadioGroup value={tone} onValueChange={(v) => setTone(v as Tone)} className="grid grid-cols-3 gap-2">
              <Label
                htmlFor="tone-friendly"
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50",
                  tone === 'friendly' ? "border-green-500 bg-green-50 text-green-700" : "border-border"
                )}
              >
                <RadioGroupItem value="friendly" id="tone-friendly" className="sr-only" />
                <Sparkles className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">Amable</span>
              </Label>
              <Label
                htmlFor="tone-formal"
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50",
                  tone === 'formal' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border"
                )}
              >
                <RadioGroupItem value="formal" id="tone-formal" className="sr-only" />
                <ShieldCheck className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">Formal</span>
              </Label>
              <Label
                htmlFor="tone-urgent"
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50",
                  tone === 'urgent' ? "border-orange-500 bg-orange-50 text-orange-700" : "border-border"
                )}
              >
                <RadioGroupItem value="urgent" id="tone-urgent" className="sr-only" />
                <AlertTriangle className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">Urgente</span>
              </Label>
            </RadioGroup>
          </div>

          {/* 2. Deudas Seleccionadas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">2. Deudas a incluir</Label>
              <div className="flex gap-2 text-xs text-primary">
                <button onClick={selectAll} className="hover:underline">Todas</button>
                <button onClick={selectNone} className="hover:underline">Ninguna</button>
              </div>
            </div>

            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/20">
              {openDebts.map((debt) => {
                const checked = selectedIds.has(debt.id)
                const calc = calculateDebtTotals(debt)
                return (
                  <label key={debt.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(debt.id)} className="h-4 w-4" />
                    <span className="text-xs flex-1">
                      {format(new Date(debt.created_at), "dd/MM/yy")} -
                      <span className="font-semibold ml-1">${calc.remaining_usd.toFixed(2)}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-right text-sm font-bold mt-1 text-foreground">
              Total: ${totalSelectedUsd.toFixed(2)}
            </p>
          </div>

          {/* 3. Previsualización */}
          <div className="bg-muted/50 rounded-lg p-3 border">
            <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wider">Vista Previa</p>
            <p className="text-sm whitespace-pre-wrap italic text-muted-foreground">
              "{readablePreview}"
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/10">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={selectedList.length === 0 || isSending}
            className="text-white bg-[#25D366] hover:bg-[#128C7E]"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
