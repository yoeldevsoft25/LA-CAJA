import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Clock, CheckCircle, AlertCircle, Eye, Plus, MessageCircle, Receipt, AlertTriangle, ShieldCheck, ListChecks } from 'lucide-react'
import { Customer } from '@/services/customers.service'
import { debtsService, Debt, calculateDebtTotals } from '@/services/debts.service'
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import PayAllDebtsModal from './PayAllDebtsModal'
import PaySelectedDebtsModal from './PaySelectedDebtsModal'
import SelectDebtsForWhatsAppModal from './SelectDebtsForWhatsAppModal'
import DebtTimelineModal from './DebtTimelineModal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CustomerDebtCardProps {
  customer: Customer
  debts: Debt[]
  onViewDebt: (debt: Debt) => void
  onAddPayment: (debt: Debt) => void
  onPaymentSuccess?: () => void
}

const statusConfig = {
  open: {
    label: 'Pendiente',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    icon: AlertCircle,
    badgeVariant: 'default' as const,
    badgeClass: 'bg-warning text-white',
  },
  partial: {
    label: 'Parcial',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    icon: Clock,
    badgeVariant: 'secondary' as const,
    badgeClass: 'bg-warning/20 text-warning',
  },
  paid: {
    label: 'Pagado',
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    icon: CheckCircle,
    badgeVariant: 'default' as const,
    badgeClass: 'bg-success text-white',
  },
}

export default function CustomerDebtCard({
  customer,
  debts,
  onViewDebt,
  onAddPayment,
  onPaymentSuccess,
}: CustomerDebtCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPayAllModalOpen, setIsPayAllModalOpen] = useState(false)
  const [isPaySelectedModalOpen, setIsPaySelectedModalOpen] = useState(false)
  const [isSelectDebtsWhatsAppOpen, setIsSelectDebtsWhatsAppOpen] = useState(false)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set())

  // Obtener resumen del cliente
  const { data: summary } = useQuery({
    queryKey: ['debtSummary', customer.id],
    queryFn: () => debtsService.getCustomerSummary(customer.id),
    enabled: debts && debts.length > 0,
  })

  const debtsArray = debts || []
  const openDebts = debtsArray.filter((d) => d.status !== 'paid')
  const hasOpenDebts = openDebts.length > 0

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

  // Calcular totales localmente si no hay summary
  const totalRemainingUsd = summary
    ? summary.remaining_usd
    : debtsArray.reduce(
      (acc, debt) => acc + calculateDebtTotals(debt).remaining_usd,
      0
    )

  const selectedDebts = useMemo(
    () => openDebts.filter((d) => selectedDebtIds.has(d.id)),
    [openDebts, selectedDebtIds]
  )

  const selectedTotalUsd = selectedDebts.reduce(
    (sum, debt) => sum + calculateDebtTotals(debt).remaining_usd,
    0
  )

  const toggleSelectedDebt = (id: string) => {
    setSelectedDebtIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllOpen = () => setSelectedDebtIds(new Set(openDebts.map((d) => d.id)))
  const clearSelection = () => setSelectedDebtIds(new Set())

  const selectThisWeek = () => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    const ids = openDebts
      .filter((d) => isWithinInterval(new Date(d.created_at), { start, end }))
      .map((d) => d.id)
    setSelectedDebtIds(new Set(ids))
  }

  const selectLastWeek = () => {
    const now = new Date()
    const lastWeek = subWeeks(now, 1)
    const start = startOfWeek(lastWeek, { weekStartsOn: 1 })
    const end = endOfWeek(lastWeek, { weekStartsOn: 1 })
    const ids = openDebts
      .filter((d) => isWithinInterval(new Date(d.created_at), { start, end }))
      .map((d) => d.id)
    setSelectedDebtIds(new Set(ids))
  }

  const cutoffDate = customer.debt_cutoff_at ? new Date(customer.debt_cutoff_at) : null
  const hasCutoff = cutoffDate && !isNaN(cutoffDate.getTime())
  const sortedDebts = useMemo(
    () =>
      [...debtsArray].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [debtsArray]
  )
  const currentDebts = hasCutoff
    ? sortedDebts.filter((d) => new Date(d.created_at).getTime() > cutoffDate!.getTime())
    : sortedDebts
  const pastDebts = hasCutoff
    ? sortedDebts.filter((d) => new Date(d.created_at).getTime() <= cutoffDate!.getTime())
    : []

  const renderDebtRow = (debt: Debt, isPastSection: boolean) => {
    const debtCalc = calculateDebtTotals(debt)
    const status = statusConfig[debt.status] || statusConfig.open
    const StatusIcon = status.icon

    return (
      <div key={debt.id} className="p-4 hover:bg-muted/50 transition-colors bg-background group/item">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selectedDebtIds.has(debt.id)}
            onCheckedChange={() => toggleSelectedDebt(debt.id)}
            disabled={debt.status === 'paid'}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant={status.badgeVariant}
                className={status.badgeClass}
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              {hasCutoff && isPastSection && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Pasada
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {format(new Date(debt.created_at), "dd MMM yyyy", { locale: es })}
              </span>
            </div>

            <div className="flex items-baseline gap-4 mt-2">
              <div>
                <span className="text-xs text-muted-foreground block">Monto Original</span>
                <span className="text-sm font-medium text-foreground">
                  ${Number(debt.amount_usd).toFixed(2)}
                </span>
              </div>

              {debt.status !== 'paid' && (
                <div>
                  <span className="text-xs text-muted-foreground block">Saldo</span>
                  <span className="text-sm font-bold text-warning">
                    ${debtCalc.remaining_usd.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {debt.note && (
              <p className="text-xs text-muted-foreground mt-2 italic border-l-2 pl-2 border-border">
                "{debt.note}"
              </p>
            )}
          </div>

          {/* Acciones por deuda */}
          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onViewDebt(debt)
              }}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Ver detalle"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {debt.status !== 'paid' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddPayment(debt)
                }}
                className="h-8 w-8 text-success hover:bg-success/10"
                title="Agregar abono"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setIsTimelineOpen(true)}
                          className="h-10 w-10 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                        >
                          <ListChecks className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver Historial de Pagos</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

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

            {/* Lista de deudas individual */}
            <div className="divide-y divide-border border-t border-border">
              {hasOpenDebts && (
                <div className="px-4 py-3 bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-primary">
                    <button onClick={selectAllOpen} className="hover:underline">Todas</button>
                    <button onClick={clearSelection} className="hover:underline">Ninguna</button>
                    <button onClick={selectThisWeek} className="hover:underline">Esta semana</button>
                    <button onClick={selectLastWeek} className="hover:underline">Semana pasada</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Seleccionadas: {selectedDebts.length} • ${selectedTotalUsd.toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedDebts.length === 0}
                      onClick={() => setIsPaySelectedModalOpen(true)}
                      className="h-8"
                    >
                      <ListChecks className="w-4 h-4 mr-1" />
                      Pagar/Abonar
                    </Button>
                  </div>
                </div>
              )}
              {debtsArray.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-background">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm">Historial limpio. Cliente sin deudas.</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background/80 border-b border-border">
                    Deudas actuales
                  </div>
                  {currentDebts.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground bg-background">
                      Sin deudas actuales
                    </div>
                  ) : (
                    currentDebts.map((debt) => renderDebtRow(debt, false))
                  )}

                  {hasCutoff && (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background/80 border-y border-border">
                        Deudas pasadas (corte aplicado)
                      </div>
                      {pastDebts.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground bg-background">
                          Sin deudas pasadas
                        </div>
                      ) : (
                        pastDebts.map((debt) => renderDebtRow(debt, true))
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Modal de pago completo */}
      <PayAllDebtsModal
        isOpen={isPayAllModalOpen}
        onClose={() => setIsPayAllModalOpen(false)}
        customer={customer}
        debts={debtsArray}
        onSuccess={() => {
          onPaymentSuccess?.()
          setIsPayAllModalOpen(false)
        }}
      />

      <PaySelectedDebtsModal
        isOpen={isPaySelectedModalOpen}
        onClose={() => setIsPaySelectedModalOpen(false)}
        customer={customer}
        openDebts={openDebts}
        selectedDebtIds={Array.from(selectedDebtIds)}
        onSuccess={() => {
          onPaymentSuccess?.()
          setIsPaySelectedModalOpen(false)
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

      <DebtTimelineModal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
      />
    </Card>
  )
}
