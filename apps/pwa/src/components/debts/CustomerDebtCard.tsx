import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Phone, CreditCard, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Plus, MessageCircle } from 'lucide-react'
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
import toast from '@/lib/toast'

interface CustomerDebtCardProps {
  customer: Customer
  debts: Debt[]
  onViewDebt: (debt: Debt) => void
  onAddPayment: (debt: Debt) => void
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
}: CustomerDebtCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Obtener resumen del cliente
  const { data: summary } = useQuery({
    queryKey: ['debtSummary', customer.id],
    queryFn: () => debtsService.getCustomerSummary(customer.id),
    enabled: debts && debts.length > 0,
  })

  const debtsArray = debts || []
  const openDebts = debtsArray.filter((d) => d.status !== 'paid')
  const hasOpenDebts = openDebts.length > 0

  // Calcular totales localmente si no hay summary
  const totalRemaining = summary
    ? { usd: summary.remaining_usd, bs: summary.remaining_bs }
    : debtsArray.reduce(
        (acc, debt) => {
          const calc = calculateDebtTotals(debt)
          return {
            usd: acc.usd + calc.remaining_usd,
            bs: acc.bs + calc.remaining_bs,
          }
        },
        { usd: 0, bs: 0 }
      )

  // Handler para enviar recordatorio por WhatsApp (usando Baileys)
  const handleSendWhatsApp = async () => {
    if (!customer.phone) {
      toast.error('El cliente no tiene teléfono registrado')
      return
    }

    if (!hasOpenDebts) {
      toast.error('El cliente no tiene deudas pendientes para enviar')
      return
    }

    try {
      const result = await debtsService.sendDebtReminder(customer.id)
      if (result.success) {
        toast.success('Recordatorio de deudas enviado por WhatsApp')
      } else {
        toast.error(result.error || 'Error al enviar recordatorio')
      }
    } catch (error: any) {
      console.error('[CustomerDebtCard] Error enviando recordatorio por WhatsApp:', error)
      toast.error(error.response?.data?.message || 'Error al enviar recordatorio por WhatsApp')
    }
  }

  return (
    <Card className={cn(
      'border',
      hasOpenDebts ? 'border-warning/50' : 'border-border'
    )}>
      <Accordion type="single" collapsible value={isExpanded ? 'debt' : ''} onValueChange={(value) => setIsExpanded(value === 'debt')}>
        <AccordionItem value="debt" className="border-0">
          <AccordionTrigger className="px-4 py-4 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center flex-1 min-w-0">
                <Avatar className={cn(
                  'w-12 h-12 mr-3 flex-shrink-0',
                  hasOpenDebts ? 'bg-warning/10' : 'bg-success/10'
                )}>
                  <AvatarFallback className={cn(
                    'font-bold text-lg',
                    hasOpenDebts ? 'text-warning' : 'text-success'
                  )}>
                    {customer.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-foreground truncate">{customer.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {customer.document_id && (
                      <span className="text-xs text-muted-foreground flex items-center">
                        <CreditCard className="w-3 h-3 mr-1" />
                        {customer.document_id}
                      </span>
                    )}
                    {customer.phone && (
                      <span className="text-xs text-muted-foreground flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {customer.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-3">
                {/* Botón WhatsApp - solo si hay deudas activas y teléfono */}
                {hasOpenDebts && customer.phone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSendWhatsApp()
                    }}
                    className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    title="Enviar estado de fiados por WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Total pendiente */}
                <div className="text-right">
                  {hasOpenDebts ? (
                    <>
                      <p className="text-lg font-bold text-warning">
                        ${totalRemaining.usd.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {openDebts.length} deuda{openDebts.length !== 1 ? 's' : ''} pendiente{openDebts.length !== 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-success">$0.00</p>
                      <p className="text-xs text-muted-foreground">Sin deudas</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            {/* Resumen */}
            {summary && (
              <div className="bg-muted/50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-border">
                <div>
                  <p className="text-muted-foreground">Total Fiado</p>
                  <p className="font-semibold text-foreground">${summary.total_debt_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Pagado</p>
                  <p className="font-semibold text-success">${summary.total_paid_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pendiente</p>
                  <p className="font-semibold text-warning">${summary.remaining_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Deudas</p>
                  <p className="font-semibold text-foreground">
                    {summary.open_debts_count} abiertas / {summary.total_debts_count} total
                  </p>
                </div>
              </div>
            )}

            {/* Lista de deudas */}
            <div className="divide-y divide-border">
              {debtsArray.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm">Este cliente no tiene deudas registradas</p>
                </div>
              ) : (
                debtsArray.map((debt) => {
                  const debtCalc = calculateDebtTotals(debt)
                  const status = statusConfig[debt.status] || statusConfig.open
                  const StatusIcon = status.icon

                  return (
                    <div key={debt.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={status.badgeVariant}
                              className={status.badgeClass}
                            >
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(debt.created_at), "dd MMM yyyy", { locale: es })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Monto:</span>
                              <span className="ml-1 font-medium text-foreground">
                                ${Number(debt.amount_usd).toFixed(2)}
                              </span>
                            </div>
                            {debt.status !== 'paid' && (
                              <div>
                                <span className="text-muted-foreground">Pendiente:</span>
                                <span className="ml-1 font-medium text-warning">
                                  ${debtCalc.remaining_usd.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                          {debt.payments && debt.payments.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {debt.payments.length} pago{debt.payments.length !== 1 ? 's' : ''} registrado{debt.payments.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 ml-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewDebt(debt)
                            }}
                            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {debt.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onAddPayment(debt)
                              }}
                              className="h-8 w-8 p-0 text-success hover:bg-success/10"
                              title="Agregar abono"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
