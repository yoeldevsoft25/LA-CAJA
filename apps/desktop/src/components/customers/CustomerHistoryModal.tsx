import { useQuery } from '@tanstack/react-query'
import { customersService, Customer } from '@/services/customers.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ShoppingBag, 
  DollarSign, 
  Calendar,
  TrendingUp,
  Receipt,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface CustomerHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
}

export default function CustomerHistoryModal({
  isOpen,
  onClose,
  customer,
}: CustomerHistoryModalProps) {
  const { data: history, isLoading, isError } = useQuery({
    queryKey: ['customer-history', customer?.id],
    queryFn: () => customersService.getPurchaseHistory(customer!.id, 15),
    enabled: isOpen && !!customer,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-xl">
            Historial de Compras
          </DialogTitle>
          <DialogDescription>
            {customer.name} {customer.document_id && `(${customer.document_id})`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Cargando historial...</p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-destructive mb-3" />
              <p className="text-destructive font-medium">Error al cargar el historial</p>
              <p className="text-sm text-muted-foreground">Intente nuevamente más tarde</p>
            </div>
          )}

          {history && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={ShoppingBag}
                  label="Total Compras"
                  value={history.total_purchases.toString()}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <StatCard
                  icon={DollarSign}
                  label="Total USD"
                  value={`$${history.total_amount_usd.toFixed(2)}`}
                  color="text-green-600"
                  bgColor="bg-green-100"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Promedio"
                  value={`$${history.average_purchase_usd.toFixed(2)}`}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <StatCard
                  icon={Calendar}
                  label="Total Bs"
                  value={`Bs ${history.total_amount_bs.toFixed(2)}`}
                  color="text-orange-600"
                  bgColor="bg-orange-100"
                />
              </div>

              {/* Período de actividad */}
              {history.first_purchase_at && (
                <div className="text-sm text-muted-foreground text-center">
                  Cliente desde{' '}
                  <span className="font-medium">
                    {format(new Date(history.first_purchase_at), 'dd/MM/yyyy', { locale: es })}
                  </span>
                  {history.last_purchase_at && (
                    <>
                      {' '}• Última compra{' '}
                      <span className="font-medium">
                        {formatDistanceToNow(new Date(history.last_purchase_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Recent Sales */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Compras Recientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {history.recent_sales.length === 0 ? (
                    <div className="px-4 pb-4 text-center text-muted-foreground">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No hay compras registradas</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {history.recent_sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {sale.sale_number ? `#${sale.sale_number}` : 'Venta'}
                              </span>
                              <PaymentMethodBadge method={sale.payment_method} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(sale.sold_at), "dd/MM/yyyy 'a las' HH:mm", {
                                locale: es,
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
                              ${sale.total_usd.toFixed(2)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Bs {sale.total_bs.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  bgColor: string
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

function PaymentMethodBadge({ method }: { method: string }) {
  const methods: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    CASH_USD: { label: 'Efectivo $', variant: 'default' },
    CASH_BS: { label: 'Efectivo Bs', variant: 'secondary' },
    CARD: { label: 'Tarjeta', variant: 'outline' },
    TRANSFER: { label: 'Transferencia', variant: 'outline' },
    PAGO_MOVIL: { label: 'Pago Móvil', variant: 'outline' },
    ZELLE: { label: 'Zelle', variant: 'outline' },
    MIXED: { label: 'Mixto', variant: 'secondary' },
    CREDIT: { label: 'FIAO', variant: 'secondary' },
  }

  const config = methods[method] || { label: method, variant: 'outline' as const }

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  )
}
