import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Clock, CheckCircle, MessageCircle, Receipt, AlertTriangle, ShieldCheck, ArrowUp, ShoppingBag } from 'lucide-react'
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
import DebtItemsModal from './DebtItemsModal'
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
  onViewDebt: _onViewDebt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAddPayment: _propOnAddPayment,
  onPaymentSuccess,
}: CustomerDebtCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPayAllModalOpen, setIsPayAllModalOpen] = useState(false)
  const [isPaySelectedModalOpen, setIsPaySelectedModalOpen] = useState(false)
  const [isSelectDebtsWhatsAppOpen, setIsSelectDebtsWhatsAppOpen] = useState(false)
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set())

  // Estado para el modal de artículos
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false)
  const [itemsModalTitle, setItemsModalTitle] = useState('')
  const [itemsModalItems, setItemsModalItems] = useState<any[]>([])

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
  const openDebts = useMemo(() => debtsArray.filter((d) => d.status !== 'paid'), [debtsArray])
  const hasOpenDebts = openDebts.length > 0

  const totalRemainingUsd = useMemo(
    () => openDebts.reduce((acc, debt) => acc + calculateDebtTotals(debt).remaining_usd, 0),
    [openDebts]
  )

  useEffect(() => {
    setSelectedDebtIds((prev) => {
      const openIds = new Set(openDebts.map((d) => d.id))
      const next = new Set<string>()
      let changed = false

      prev.forEach((id) => {
        if (openIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })

      if (prev.size !== next.size) changed = true

      return changed ? next : prev
    })
  }, [openDebts])


  const onAddPayment = (debt: Debt) => {
    setSelectedDebtIds(new Set([debt.id]))
    setIsPaySelectedModalOpen(true)
  }

  // Abrir modal de artículos consolidados
  const handleViewAllOpenItems = (e: React.MouseEvent) => {
    e.stopPropagation()
    const allItems = openDebts.flatMap((d: any) => d.sale?.items || [])
    setItemsModalTitle('Artículos en Deuda Actual')
    setItemsModalItems(allItems)
    setIsItemsModalOpen(true)
  }

  // Abrir modal de artículos para una deuda específica
  const handleViewDebtItems = (debt: any) => {
    const items = debt.sale?.items || []
    setItemsModalTitle('Artículos de la Deuda')
    setItemsModalItems(items)
    setIsItemsModalOpen(true)
  }

  // Abrir modal de artículos asociados a un abono (buscar la deuda raiz de la cadena)
  const handleViewPaymentItems = (_payment: any, chain: any) => {
    // Buscar cualquier deuda en la cadena que tenga items (priorizando la raiz)
    const debtWithItems = chain.items.find((i: any) => i.type === 'debt' && i.data.sale?.items?.length > 0)
    const items = debtWithItems?.data.sale?.items || []

    setItemsModalTitle('Artículos asociados al Abono')
    setItemsModalItems(items)
    setIsItemsModalOpen(true)
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

  const buildChainAudit = (chain: any) => {
    const rawItems = Array.isArray(chain?.items) ? chain.items : []
    const debtItemsInOrder = rawItems.filter((item: any) => item?.type === 'debt' && item?.data?.id)
    const paymentsByDebt = new Map<string, any[]>()
    const seenPayments = new Set<string>()

    rawItems.forEach((item: any) => {
      if (item?.type !== 'payment' || !item?.data?.id) return
      if (seenPayments.has(item.data.id)) return
      seenPayments.add(item.data.id)

      const debtId = item.debtId || item.data.debt_id
      if (!debtId) return
      const current = paymentsByDebt.get(debtId) || []
      current.push(item.data)
      paymentsByDebt.set(debtId, current)
    })

    paymentsByDebt.forEach((payments) => {
      payments.sort((a: any, b: any) => {
        const aTime = new Date(a?.paid_at || 0).getTime()
        const bTime = new Date(b?.paid_at || 0).getTime()
        return aTime - bTime
      })
    })

    const normalizedItems: any[] = []
    const seenDebts = new Set<string>()

    debtItemsInOrder.forEach((debtItem: any) => {
      const debtId = debtItem.data.id
      if (!seenDebts.has(debtId)) {
        seenDebts.add(debtId)
        normalizedItems.push({
          id: debtId,
          debtId,
          type: 'debt',
          data: debtItem.data,
          occurredAtMs: new Date(debtItem.data.created_at || 0).getTime(),
        })
      }

      const debtPayments = paymentsByDebt.get(debtId) || []
      debtPayments.forEach((payment: any) => {
        normalizedItems.push({
          id: payment.id,
          debtId,
          type: 'payment',
          data: payment,
          occurredAtMs: new Date(payment.paid_at || 0).getTime(),
        })
      })
    })

    let runningBalance = 0
    const itemsWithBalance = normalizedItems.map((item) => {
      const amountUsd = Number(item?.data?.amount_usd || 0)
      const runningBeforeUsd = runningBalance
      if (item.type === 'debt') {
        runningBalance += amountUsd
      } else {
        runningBalance -= amountUsd
      }

      return {
        ...item,
        runningBeforeUsd,
        runningAfterUsd: runningBalance,
      }
    })

    const totalDebtUsd = itemsWithBalance
      .filter((item) => item.type === 'debt')
      .reduce((sum, item) => sum + Number(item.data?.amount_usd || 0), 0)
    const totalPaidUsd = itemsWithBalance
      .filter((item) => item.type === 'payment' && item.data?.method !== 'ROLLOVER')
      .reduce((sum, item) => sum + Number(item.data?.amount_usd || 0), 0)
    const totalRolloverUsd = itemsWithBalance
      .filter((item) => item.type === 'payment' && item.data?.method === 'ROLLOVER')
      .reduce((sum, item) => sum + Number(item.data?.amount_usd || 0), 0)
    const openDebtsCount = debtItemsInOrder.filter((item: any) => item?.data?.status !== 'paid').length
    const chainStatus = openDebtsCount > 0 ? 'Activo' : 'Completado'

    return {
      items: itemsWithBalance,
      summary: {
        firstDateMs: itemsWithBalance[0]?.occurredAtMs || Date.now(),
        lastDateMs: itemsWithBalance[itemsWithBalance.length - 1]?.occurredAtMs || Date.now(),
        movementCount: itemsWithBalance.length,
        debtCount: debtItemsInOrder.length,
        totalDebtUsd,
        totalPaidUsd,
        totalRolloverUsd,
        currentBalanceUsd: Math.max(runningBalance, 0),
        chainStatus,
      },
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
                            asChild
                            variant="outline"
                            size="icon"
                            onClick={() => setIsSelectDebtsWhatsAppOpen(true)}
                            className="h-10 w-10 rounded-full border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors"
                          >
                            <div role="button">
                              <MessageCircle className="w-5 h-5" />
                            </div>
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

              {/* Botón de pago completo grande y Ver Artículos */}
              <div className="flex flex-col gap-2">
                {hasOpenDebts && (
                  <Button
                    variant="outline"
                    onClick={handleViewAllOpenItems}
                    className="w-full h-10 border-dashed text-muted-foreground hover:text-foreground"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Ver todos los artículos en deuda
                  </Button>
                )}

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
                <div className="p-4 space-y-8"> {/* Increased Space from space-y-6 to space-y-8 */}
                  {timelineData.map((chain: any, chainIndex: number) => {
                    const chainAudit = buildChainAudit(chain)
                    if (!chainAudit.items.length) return null

                    const chainItems = chainAudit.items
                    const displayItems = [...chainItems].sort((a: any, b: any) => {
                      const priority = (item: any) => {
                        if (item?.type === 'debt' && item?.data?.status !== 'paid') return 0
                        if (item?.type === 'payment' && item?.data?.method === 'ROLLOVER') return 1
                        if (item?.type === 'payment') return 2
                        if (item?.type === 'debt') return 3
                        return 4
                      }

                      // Regla visual principal: pendientes primero, completadas al final.
                      const priorityDiff = priority(a) - priority(b)
                      if (priorityDiff !== 0) return priorityDiff

                      const dateDiff = Number(b.occurredAtMs || 0) - Number(a.occurredAtMs || 0)
                      if (dateDiff !== 0) return dateDiff

                      return String(b?.id || '').localeCompare(String(a?.id || ''))
                    })
                    const chainSummary = chainAudit.summary
                    const firstItemDate = new Date(chainSummary.firstDateMs)
                    const lastItemDate = new Date(chainSummary.lastDateMs)
                    const chainStatus = chainSummary.chainStatus

                    return (
                      <div key={chainIndex} className={cn("relative border rounded-xl overflow-hidden shadow-sm", chainStatus === 'Completado' ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-blue-200 ring-1 ring-blue-50')}>
                        <div className={cn("px-4 py-2 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2", chainStatus === 'Completado' ? 'bg-slate-100' : 'bg-blue-50/50')}>
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Ciclo iniciado el {format(firstItemDate, "d MMM yyyy", { locale: es })}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              Último mov: {format(lastItemDate, "d MMM, h:mm a", { locale: es })}
                            </span>
                            <Badge variant={chainStatus === 'Completado' ? 'secondary' : 'default'} className={chainStatus === 'Completado' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none'}>
                              {chainStatus}
                            </Badge>
                          </div>
                        </div>

                        <div className="px-4 py-3 border-b bg-background/70">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            <div className="rounded-md border border-slate-200 bg-white p-2">
                              <p className="text-muted-foreground uppercase tracking-wider">Fiado ciclo</p>
                              <p className="font-semibold text-foreground text-sm">${chainSummary.totalDebtUsd.toFixed(2)}</p>
                            </div>
                            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2">
                              <p className="text-emerald-700 uppercase tracking-wider">Abonado</p>
                              <p className="font-semibold text-emerald-700 text-sm">${chainSummary.totalPaidUsd.toFixed(2)}</p>
                            </div>
                            <div className="rounded-md border border-blue-200 bg-blue-50/60 p-2">
                              <p className="text-blue-700 uppercase tracking-wider">Corte</p>
                              <p className="font-semibold text-blue-700 text-sm">${chainSummary.totalRolloverUsd.toFixed(2)}</p>
                            </div>
                            <div className="rounded-md border border-orange-200 bg-orange-50/60 p-2">
                              <p className="text-orange-700 uppercase tracking-wider">Saldo actual</p>
                              <p className="font-semibold text-orange-700 text-sm">${chainSummary.currentBalanceUsd.toFixed(2)}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-white p-2">
                              <p className="text-muted-foreground uppercase tracking-wider">Movimientos</p>
                              <p className="font-semibold text-foreground text-sm">{chainSummary.movementCount} ({chainSummary.debtCount} deudas)</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 pl-8 space-y-0">
                          {displayItems.map((item: any, itemIndex: number) => {
                            const isDebt = item.type === 'debt'
                            const date = new Date(item.occurredAtMs)
                            const isLast = itemIndex === displayItems.length - 1
                            const iconBg = isDebt ? 'bg-orange-100 text-orange-600 border-orange-200' :
                              (item.data.method === 'ROLLOVER' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-green-100 text-green-600 border-green-200')
                            const Icon = isDebt ? CreditCard : (item.data.method === 'ROLLOVER' ? Clock : CheckCircle)

                            return (
                              <div key={`${item.type}-${item.id}-${itemIndex}`} className="relative flex gap-4 pb-8 last:pb-0 group">
                                {!isLast && (
                                  <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-slate-200 group-hover:bg-slate-300 transition-colors" />
                                )}

                                <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 shadow-sm ${iconBg}`}>
                                  <Icon className="w-4 h-4" />
                                </div>

                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">
                                        {isDebt ? 'Nueva Deuda' : (item.data.method === 'ROLLOVER' ? 'Corte Automático (Rollover)' : 'Abono Recibido')}
                                      </p>
                                      <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                                        {format(date, "d MMM yyyy, h:mm a", { locale: es })}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                      "font-bold tabular-nums",
                                      isDebt ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                        (item.data.method === 'ROLLOVER' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-green-50 border-green-200 text-green-700')
                                    )}>
                                      ${Number(item.data.amount_usd).toFixed(2)}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="px-2 py-0.5 rounded border border-slate-200 bg-white">
                                      Saldo antes: ${Number(item.runningBeforeUsd).toFixed(2)}
                                    </span>
                                    <span className="px-2 py-0.5 rounded border border-slate-200 bg-white">
                                      Saldo después: ${Math.max(Number(item.runningAfterUsd), 0).toFixed(2)}
                                    </span>
                                    {!isDebt && item.data?.method && (
                                      <span className={cn(
                                        "px-2 py-0.5 rounded border",
                                        item.data.method === 'ROLLOVER'
                                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      )}>
                                        Método: {item.data.method}
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-3">
                                    {isDebt && (
                                      <div className="text-xs bg-slate-50 p-3 rounded-md border border-slate-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-muted-foreground">Estado: <span className="font-medium text-foreground">{item.data.status === 'open' ? 'Pendiente' : (item.data.status === 'paid' ? 'Pagada' : 'Parcial')}</span></span>
                                          {item.data.status !== 'paid' && (
                                            <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                              Saldo: ${(Number(item.data.amount_usd) - (item.data.payments?.reduce((s: number, p: any) => s + Number(p.amount_usd || 0), 0) || 0)).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                        {item.data.note && <p className="italic text-slate-600 border-l-2 border-slate-300 pl-2 py-1 mt-2">"{item.data.note}"</p>}

                                        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-end gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                            onClick={() => handleViewDebtItems(item.data)}
                                          >
                                            <ShoppingBag className="w-3 h-3 mr-1.5" />
                                            Ver Artículos
                                          </Button>

                                          {item.data.status !== 'paid' && (
                                            <Button
                                              size="sm"
                                              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                              onClick={() => onAddPayment(item.data)}
                                            >
                                              <Receipt className="w-3 h-3 mr-1.5" />
                                              Abonar
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {!isDebt && (
                                      <div className="text-xs text-muted-foreground">
                                        {item.data.note && <p className="italic border-l-2 border-slate-300 pl-2 mb-2">"{item.data.note}"</p>}
                                        {item.data.method === 'ROLLOVER' && (
                                          <div className="flex items-center gap-2 mt-2 text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                                            <ArrowUp className="w-3 h-3" />
                                            <span>Saldo trasladado a nueva deuda superior.</span>
                                          </div>
                                        )}
                                        <div className="flex justify-end mt-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleViewPaymentItems(item.data, chain)}
                                          >
                                            <ShoppingBag className="w-3 h-3 mr-1.5" />
                                            Ver Artículos Asociados
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
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

      {/* Modal de Items */}
      <DebtItemsModal
        isOpen={isItemsModalOpen}
        onClose={() => setIsItemsModalOpen(false)}
        title={itemsModalTitle}
        items={itemsModalItems}
      />
    </Card>
  )
}
