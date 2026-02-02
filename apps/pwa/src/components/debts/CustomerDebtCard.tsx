import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Clock, CheckCircle, AlertCircle, MessageCircle, Receipt, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Customer } from '@/services/customers.service'
import { debtsService, Debt, calculateDebtTotals } from '@/services/debts.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import PayAllDebtsModal from './PayAllDebtsModal'
import PaySelectedDebtsModal from './PaySelectedDebtsModal'
import SelectDebtsForWhatsAppModal from './SelectDebtsForWhatsAppModal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CustomerDebtCardProps {
  customer: Customer
  debts: Debt[]
  onViewDebt: (debt: Debt) => void
  onAddPayment: (debt: Debt) => void
  onPaymentSuccess?: () => void
}

export default function CustomerDebtCard({
  customer,
  debts,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onViewDebt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAddPayment: _propOnAddPayment,
  onPaymentSuccess,
}: CustomerDebtCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPayAllModalOpen, setIsPayAllModalOpen] = useState(false)
  const [isPaySelectedModalOpen, setIsPaySelectedModalOpen] = useState(false)
  const [isSelectDebtsWhatsAppOpen, setIsSelectDebtsWhatsAppOpen] = useState(false)
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set())

  // Obtener resumen del cliente
  const { data: summary } = useQuery({
    queryKey: ['debtSummary', customer.id],
    queryFn: () => debtsService.getCustomerSummary(customer.id),
    enabled: debts && debts.length > 0,
  })

  // Obtener línea de tiempo (historial trazable)
  const { data: timelineData, isLoading: isLoadingTimeline } = useQuery({
    queryKey: ['debtTimeline', customer.id],
    queryFn: () => debtsService.getCustomerDebtTimeline(customer.id),
    enabled: isExpanded, // Solo cargar cuando se expande la tarjeta
  })

  // Totales
  const debtsArray = debts || []
  const openDebts = debtsArray.filter((d) => d.status !== 'paid')
  const hasOpenDebts = openDebts.length > 0

  const totalRemainingUsd = useMemo(
    () => openDebts.reduce((acc, debt) => acc + calculateDebtTotals(debt).remaining_usd, 0),
    [openDebts]
  )

  useEffect(() => {
    setSelectedDebtIds((prev) => {
      const openIds = new Set(openDebts.map((d) => d.id))
      const next = new Set<string>()
      prev.forEach((id) => {
        if (openIds.has(id)) next.add(id)
      })
      return next
    })
  }, [openDebts])

  const selectedDebts = useMemo(
    () => openDebts.filter((d) => selectedDebtIds.has(d.id)),
    [openDebts, selectedDebtIds]
  )

  const onAddPayment = (debt: Debt) => {
    setSelectedDebtIds(new Set([debt.id]))
    setIsPaySelectedModalOpen(true)
  }

  // --- LOGICA DE CREDIT HEALTH ---
  const creditLimit = Number(customer.credit_limit) || 0
  const hasCreditLimit = creditLimit > 0

  let creditHealth = {
    percent: 0,
    color: 'bg-blue-500',
    status: 'Sin Límite',
    textColor: 'text-muted-foreground'
  }

  if (hasCreditLimit) {
    const percent = Math.min((totalRemainingUsd / creditLimit) * 100, 100)
    creditHealth.percent = percent

    if (percent >= 100) {
      creditHealth.color = 'bg-destructive'
      creditHealth.status = 'Límite Excedido'
      creditHealth.textColor = 'text-destructive font-bold'
    } else if (percent > 80) {
      creditHealth.color = 'bg-orange-500'
      creditHealth.status = 'Crítico'
      creditHealth.textColor = 'text-orange-600 font-bold'
    } else if (percent > 50) {
      creditHealth.color = 'bg-yellow-500'
      creditHealth.status = 'Moderado'
      creditHealth.textColor = 'text-yellow-600'
    } else {
      creditHealth.color = 'bg-green-500'
      creditHealth.status = 'Saludable'
      creditHealth.textColor = 'text-green-600'
    }
  }

  return (
    <Card className={cn(
      'border shadow-sm transition-all hover:shadow-md',
      hasOpenDebts ? 'border-l-4 border-l-warning border-y-border border-r-border' : 'border-l-4 border-l-success border-y-border border-r-border'
    )}>
      <Accordion type="single" collapsible value={isExpanded ? 'debt' : ''} onValueChange={(value) => setIsExpanded(value === 'debt')}>
        <AccordionItem value="debt" className="border-0">
          <AccordionTrigger className="px-4 py-4 hover:no-underline group">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4 pr-2">

              {/* IZQUIERDA: Info Cliente + Avatar */}
              <div className="flex items-center min-w-0 flex-1">
                <div className="relative">
                  <Avatar className={cn(
                    'w-12 h-12 mr-3 flex-shrink-0 border-2',
                    hasOpenDebts ? 'border-warning/20 bg-warning/5' : 'border-success/20 bg-success/5'
                  )}>
                    <AvatarFallback className={cn(
                      'font-bold text-lg',
                      hasOpenDebts ? 'text-warning' : 'text-success'
                    )}>
                      {customer.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Badge de estado VIP o Alerta */}
                  {hasCreditLimit && totalRemainingUsd > creditLimit && (
                    <div className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" title="Límite Excedido">
                      <AlertTriangle className="w-3 h-3" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate text-lg">{customer.name}</p>
                    {hasCreditLimit && (
                      <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", creditHealth.textColor.includes('destructive') ? 'border-destructive/50 bg-destructive/10' : '')}>
                        {creditHealth.status}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-0.5">
                    {customer.document_id && (
                      <span className="text-xs text-muted-foreground flex items-center">
                        <CreditCard className="w-3 h-3 mr-1" />
                        {customer.document_id}
                      </span>
                    )}
                    {/* Barra de Crédito Mini (Solo si tiene limite) */}
                    {hasCreditLimit && (
                      <div className="hidden sm:flex items-center gap-2 flex-1 max-w-[120px]">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full transition-all", creditHealth.color)} style={{ width: `${creditHealth.percent}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {(creditHealth.percent).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DERECHA: Totales y Botones Rápidos */}
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                {/* Totales */}
                <div className="text-left sm:text-right">
                  {hasOpenDebts ? (
                    <>
                      <p className="text-xl font-bold text-warning tabular-nums">
                        ${totalRemainingUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {openDebts.length} deuda{openDebts.length !== 1 ? 's' : ''} pendiente{openDebts.length !== 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center text-success">
                        <ShieldCheck className="w-5 h-5 mr-1" />
                        <p className="text-lg font-bold">Al día</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {hasOpenDebts && customer.phone && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsSelectDebtsWhatsAppOpen(true)}
                            className="h-10 w-10 rounded-full border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cobrar por WhatsApp</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            {/* Resumen Expandido */}
            <div className="bg-muted/30 px-4 py-4 border-t border-border">
              {/* Visualización detallada del Crédito */}
              {hasCreditLimit && (
                <div className="mb-4 bg-background p-3 rounded-lg border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Salud Crediticia</span>
                      <Badge variant="secondary" className="text-xs">{creditHealth.status}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Límite: <b>${creditLimit.toFixed(2)}</b>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all", creditHealth.color)} style={{ width: `${creditHealth.percent}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Usado: ${totalRemainingUsd.toFixed(2)}</span>
                    <span>Disponible: ${Math.max(creditLimit - totalRemainingUsd, 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Grid de KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                <div className="bg-background p-3 rounded-md border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Total Fiado</p>
                  <p className="font-semibold text-foreground text-lg">${summary?.total_debt_usd.toFixed(2) ?? '0.00'}</p>
                </div>
                <div className="bg-background p-3 rounded-md border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Total Pagado</p>
                  <p className="font-semibold text-success text-lg">${summary?.total_paid_usd.toFixed(2) ?? '0.00'}</p>
                </div>
                <div className="bg-background p-3 rounded-md border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Pendiente</p>
                  <p className="font-semibold text-warning text-lg">${totalRemainingUsd.toFixed(2)}</p>
                </div>
                <div className="bg-background p-3 rounded-md border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Facturas</p>
                  <p className="font-semibold text-foreground text-lg">{summary?.open_debts_count ?? 0} <span className="text-xs font-normal text-muted-foreground">abiertas</span></p>
                </div>
              </div>

              {/* Botón de pago completo grande */}
              {hasOpenDebts && totalRemainingUsd > 0 && (
                <Button
                  onClick={() => setIsPayAllModalOpen(true)}
                  className="w-full bg-success hover:bg-success/90 text-white font-semibold h-11 shadow-sm"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Pagar Saldo Total (${totalRemainingUsd.toFixed(2)})
                </Button>
              )}
            </div>

            {/* Lista de deudas (Timeline View) */}
            <div className="divide-y divide-border border-t border-border bg-slate-50/30">
              {isLoadingTimeline ? (
                <div className="p-8 text-center text-muted-foreground">
                  Cargando historial...
                </div>
              ) : !timelineData || timelineData.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-background">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm">Historial limpio. Cliente sin deudas.</p>
                </div>
              ) : (
                <div className="p-4 space-y-6">
                  {timelineData.map((chain: any, chainIndex: number) => (
                    <div key={chainIndex} className="relative border rounded-lg bg-white shadow-sm overflow-hidden">
                      {/* Chain Header (Index or Status) */}
                      <div className="absolute top-0 left-0 w-1 h-full bg-slate-200" />

                      <div className="p-4 pl-6 space-y-6">
                        {chain.items.map((item: any, itemIndex: number) => {
                          const isDebt = item.type === 'debt'
                          const date = new Date(item.data.created_at || item.data.paid_at)
                          // Determine styling based on type
                          const iconBg = isDebt ? 'bg-orange-100 text-orange-600 border-orange-200' :
                            (item.data.method === 'ROLLOVER' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-green-100 text-green-600 border-green-200')
                          const Icon = isDebt ? CreditCard : (item.data.method === 'ROLLOVER' ? Clock : CheckCircle)

                          return (
                            <div key={itemIndex} className="relative flex gap-4">
                              {/* Connector Line */}
                              {itemIndex < chain.items.length - 1 && (
                                <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-slate-100" />
                              )}

                              <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-sm text-foreground">
                                      {isDebt ? 'Deuda' : (item.data.method === 'ROLLOVER' ? 'Corte (Rollover)' : 'Abono')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(date, "d MMM yyyy, h:mm a", { locale: es })}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={isDebt ? 'bg-orange-50' : 'bg-green-50'}>
                                    ${Number(item.data.amount_usd).toFixed(2)}
                                  </Badge>
                                </div>

                                {/* Details */}
                                {isDebt && (
                                  <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                    <div className="flex justify-between">
                                      <span>Estado: <span className="font-semibold">{item.data.status === 'open' ? 'Pendiente' : (item.data.status === 'paid' ? 'Pagada' : 'Parcial')}</span></span>
                                      {item.data.status !== 'paid' && (
                                        <span className="text-orange-600 font-bold">Saldo: ${(Number(item.data.amount_usd) - (item.data.payments?.reduce((s: number, p: any) => s + Number(p.amount_usd || 0), 0) || 0)).toFixed(2)}</span>
                                      )}
                                    </div>
                                    {item.data.note && <p className="mt-1 italic text-muted-foreground">"{item.data.note}"</p>}
                                  </div>
                                )}
                                {!isDebt && item.data.note && (
                                  <p className="mt-1 text-xs text-muted-foreground italic">
                                    "{item.data.note}"
                                  </p>
                                )}

                                {/* Action Button for specific debt */}
                                {isDebt && item.data.status !== 'paid' && (
                                  <div className="mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                                      onClick={() => onAddPayment(item.data)}
                                    >
                                      Abonar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <PayAllDebtsModal
        isOpen={isPayAllModalOpen}
        onClose={() => setIsPayAllModalOpen(false)}
        customer={customer}
        debts={openDebts}
        onSuccess={onPaymentSuccess}
      />

      <PaySelectedDebtsModal
        isOpen={isPaySelectedModalOpen}
        onClose={() => setIsPaySelectedModalOpen(false)}
        customer={customer}
        openDebts={openDebts}
        selectedDebtIds={Array.from(selectedDebtIds)}
        onSuccess={() => {
          setSelectedDebtIds(new Set())
          onPaymentSuccess?.() // Added optional chain just in case
        }}
      />

      {/* Modal para elegir deudas a enviar por WhatsApp */}
      <SelectDebtsForWhatsAppModal
        isOpen={isSelectDebtsWhatsAppOpen}
        onClose={() => setIsSelectDebtsWhatsAppOpen(false)}
        customer={customer}
        openDebts={openDebts}
        onSuccess={onPaymentSuccess}
      />
    </Card>
  )
}
