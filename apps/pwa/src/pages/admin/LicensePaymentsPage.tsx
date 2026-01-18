import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import licensePaymentsService, {
  LicensePayment,
  LicensePaymentStatus,
} from '@/services/license-payments.service';
import { adminService } from '@/services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import {
  CreditCard,
  Search,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LicensePaymentDetailModal from '@/components/admin/LicensePaymentDetailModal';

function getStatusBadge(status: LicensePaymentStatus) {
  const variants: Record<
    LicensePaymentStatus,
    { label: string; className: string }
  > = {
    pending: { label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
    verifying: { label: 'Verificando', className: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    verified: { label: 'Verificado', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
    approved: { label: 'Aprobado', className: 'bg-green-600 text-white border-green-700' },
    rejected: { label: 'Rechazado', className: 'bg-red-500/20 text-red-400 border-red-500/50' },
    expired: { label: 'Expirado', className: 'bg-slate-500/20 text-slate-400 border-slate-500/50' },
  };

  const config = variants[status] || variants.pending;
  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  );
}

function getPlanBadge(plan: string) {
  const planNames: Record<string, string> = {
    freemium: 'Freemium',
    basico: 'Básico',
    profesional: 'Profesional',
    empresarial: 'Empresarial',
  };
  return planNames[plan] || plan;
}

export default function LicensePaymentsPage() {
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState(() => adminService.getKey() || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchRef, setSearchRef] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<LicensePayment | null>(null);

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['license-payments', statusFilter, adminKey],
    queryFn: () =>
      licensePaymentsService.listPayments({
        status: statusFilter === 'all' ? undefined : (statusFilter as LicensePaymentStatus),
        limit: 100,
      }),
    enabled: !!adminKey,
    staleTime: 1000 * 30,
  });

  const { data: stats } = useQuery({
    queryKey: ['license-payments-stats', adminKey],
    queryFn: () => licensePaymentsService.getStats(),
    enabled: !!adminKey,
    staleTime: 1000 * 60,
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      licensePaymentsService.listPayments({
        status: statusFilter === 'all' ? undefined : (statusFilter as LicensePaymentStatus),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-payments'] });
      queryClient.invalidateQueries({ queryKey: ['license-payments-stats'] });
      toast.success('Datos actualizados');
    },
  });

  const filteredPayments = paymentsData?.payments?.filter((p) => {
    if (searchRef && !p.payment_reference.toLowerCase().includes(searchRef.toLowerCase())) {
      return false;
    }
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-emerald-400" />
              Pagos de Licencias
            </h1>
            <p className="text-slate-400 mt-1">
              Gestiona y verifica las solicitudes de pago de licencias
            </p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            variant="outline"
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
            />
            Actualizar
          </Button>
        </div>

        {/* Admin Key Input */}
        <Card className="bg-slate-900/70 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Admin Key"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  if (e.target.value) {
                    adminService.setKey(e.target.value);
                  }
                }}
                className="max-w-md"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-slate-400">Total</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                <div className="text-sm text-slate-400">Pendientes</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-400">{stats.verified}</div>
                <div className="text-sm text-slate-400">Verificados</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-emerald-400">{stats.approved}</div>
                <div className="text-sm text-slate-400">Aprobados</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
                <div className="text-sm text-slate-400">Rechazados</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-slate-400">{stats.expired}</div>
                <div className="text-sm text-slate-400">Expirados</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-slate-900/70 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="verifying">Verificando</SelectItem>
                    <SelectItem value="verified">Verificado</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por referencia..."
                    value={searchRef}
                    onChange={(e) => setSearchRef(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card className="bg-slate-900/70 border-slate-800">
          <CardHeader>
            <CardTitle>Solicitudes de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-400">Cargando...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No hay solicitudes de pago
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border border-slate-800 rounded-lg p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPayment(payment)}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(payment.status)}
                          <Badge variant="outline" className="bg-slate-800">
                            {getPlanBadge(payment.plan)}
                          </Badge>
                          <Badge variant="outline" className="bg-slate-800">
                            {payment.billing_period === 'monthly' ? 'Mensual' : 'Anual'}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-300">
                          <div>Referencia: <span className="font-mono">{payment.payment_reference}</span></div>
                          <div>Monto: <span className="font-semibold">${payment.amount_usd} USD</span></div>
                          <div>
                            Tienda: {payment.store?.name || (
                              <span className="font-mono text-xs">{payment.store_id.substring(0, 8)}...</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400 text-right">
                        <div>
                          Creado: {format(parseISO(payment.created_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                        {payment.expires_at && (
                          <div className="text-yellow-400">
                            Expira: {format(parseISO(payment.expires_at), 'dd/MM/yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        {selectedPayment && (
          <LicensePaymentDetailModal
            payment={selectedPayment}
            isOpen={!!selectedPayment}
            onClose={() => setSelectedPayment(null)}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['license-payments'] });
              queryClient.invalidateQueries({ queryKey: ['license-payments-stats'] });
            }}
          />
        )}
      </div>
    </div>
  );
}
