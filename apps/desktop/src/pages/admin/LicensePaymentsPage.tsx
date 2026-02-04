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
import { toast } from '@/lib/toast';
import {
  CreditCard,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LicensePaymentDetailModal from '@/components/admin/LicensePaymentDetailModal';
import BlurFade from '@/components/magicui/blur-fade';
import NumberTicker from '@/components/magicui/number-ticker';
import ShineBorder from '@/components/magicui/shine-border';
import { cn } from '@/lib/utils';

function getStatusBadge(status: LicensePaymentStatus) {
  const variants: Record<
    LicensePaymentStatus,
    { label: string; className: string; icon: any }
  > = {
    pending: {
      label: 'Pendiente',
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
      icon: Clock
    },
    verifying: {
      label: 'Verificando',
      className: 'bg-[#0c81cf10] text-[#0c81cf] border-[#0c81cf20]',
      icon: RefreshCw
    },
    verified: {
      label: 'Verificado',
      className: 'bg-sky-500/10 text-sky-600 border-sky-200',
      icon: CheckCircle2
    },
    approved: {
      label: 'Aprobado',
      className: 'bg-[#0c81cf] text-white border-[#0c81cf] shadow-md',
      icon: CheckCircle2
    },
    rejected: {
      label: 'Rechazado',
      className: 'bg-rose-500/10 text-rose-600 border-rose-200',
      icon: XCircle
    },
    expired: {
      label: 'Expirado',
      className: 'bg-slate-500/10 text-slate-600 border-slate-200',
      icon: AlertCircle
    },
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;
  return (
    <Badge className={cn(config.className, "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider")} variant="outline">
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function getPlanBadge(plan: string) {
  const planNames: Record<string, string> = {
    freemium: '🆓 Freemium',
    basico: '💼 Básico',
    profesional: '🚀 Profesional',
    empresarial: '🏢 Empresarial',
  };
  return planNames[plan] || plan;
}

export default function LicensePaymentsPage() {
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState(() => adminService.getKey() || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchRef, setSearchRef] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<LicensePayment | null>(null);

  const { data: paymentsData, isLoading, error, refetch } = useQuery({
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
    <div className="space-y-6 pb-20">
      {/* Header */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-[#0c81cf10] text-[#0c81cf]">
                <CreditCard className="h-8 w-8" />
              </div>
              Pagos & Licencias
            </h1>
            <p className="text-slate-500 mt-1">
              Verifica transacciones y gestiona el estado de las suscripciones
            </p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            variant="outline"
            disabled={refreshMutation.isPending}
            className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", refreshMutation.isPending && "animate-spin")}
            />
            Actualizar Dashboard
          </Button>
        </div>
      </BlurFade>

      {!adminKey ? (
        <BlurFade delay={0.2}>
          <ShineBorder className="w-full flex flex-col items-center justify-center p-12 text-center" color={["#0c81cf", "#0ea5e9"]}>
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-[#0c81cf]">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
            <p className="text-slate-500 mb-6 max-w-md">Esta área es para la administración financiera. Por favor ingresa tu clave maestra para continuar.</p>
            <div className="flex gap-2 max-w-sm w-full">
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
                className="bg-white"
              />
              <Button onClick={() => refetch()} disabled={!adminKey} className="bg-[#0c81cf] hover:bg-[#0a6fb3]">Ingresar</Button>
            </div>
          </ShineBorder>
        </BlurFade>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0c81cf]"></div>
        </div>
      ) : error ? (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-6 text-sm text-red-600">
            {error.message || 'Error cargando pagos'}
            <Button variant="link" onClick={() => refetch()} className="text-red-700 underline ml-2">Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
            <BlurFade delay={0.2} inView>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Total Pagos', value: stats.total, color: 'text-slate-900', icon: Building2 },
                  { label: 'Pendientes', value: stats.pending, color: 'text-amber-500', icon: Clock },
                  { label: 'Verificando', value: stats.verified, color: 'text-[#0c81cf]', icon: RefreshCw },
                  { label: 'Aprobados', value: stats.approved, color: 'text-emerald-500', icon: CheckCircle2 },
                  { label: 'Rechazados', value: stats.rejected, color: 'text-rose-500', icon: XCircle },
                  { label: 'Expirados', value: stats.expired, color: 'text-slate-400', icon: AlertCircle },
                ].map((stat, i) => (
                  <Card key={i} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <stat.icon className={cn("h-4 w-4", stat.color)} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <div className={cn("text-2xl font-bold", stat.color)}>
                        <NumberTicker value={stat.value} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          )}

          {/* Filters & Search */}
          <BlurFade delay={0.3}>
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full md:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#0c81cf] transition-colors" />
                <Input
                  placeholder="Buscar por referencia de pago..."
                  className="pl-9 bg-white border-slate-200 focus:border-[#0c81cf] transition-all rounded-xl shadow-sm"
                  value={searchRef}
                  onChange={(e) => setSearchRef(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-white border-slate-200 rounded-xl h-10 shadow-sm text-xs font-semibold">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">⏳ Pendiente</SelectItem>
                    <SelectItem value="verifying">🔄 Verificando</SelectItem>
                    <SelectItem value="verified">✅ Verificado</SelectItem>
                    <SelectItem value="approved">💎 Aprobado</SelectItem>
                    <SelectItem value="rejected">❌ Rechazado</SelectItem>
                    <SelectItem value="expired">⌛ Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </BlurFade>

          {/* Table-like List */}
          <BlurFade delay={0.4}>
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                <CardTitle className="text-base font-semibold text-slate-900">Historial de Transacciones</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tienda / Solicitante</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan & Período</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referencia / Monto</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            No se encontraron transacciones para estos filtros.
                          </td>
                        </tr>
                      ) : (
                        filteredPayments.map((payment) => (
                          <tr
                            key={payment.id}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                            onClick={() => setSelectedPayment(payment)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-lg group-hover:bg-[#0c81cf10] group-hover:text-[#0c81cf] transition-colors">
                                  {payment.store?.name?.charAt(0) || <Building2 className="h-5 w-5" />}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 group-hover:text-[#0c81cf] transition-colors leading-tight">
                                    {payment.store?.name || 'Tienda desconocida'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {payment.store_id.substring(0, 8)}...</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-slate-700 text-sm whitespace-nowrap">
                                  {getPlanBadge(payment.plan)}
                                </span>
                                <Badge variant="outline" className="w-fit text-[9px] h-4 px-1 bg-slate-50 text-slate-500 border-slate-200">
                                  {payment.billing_period === 'monthly' ? 'PAGO MENSUAL' : 'PAGO ANUAL'}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <div className="font-mono text-xs text-slate-900 flex items-center gap-1">
                                  <span className="text-slate-400">#</span>{payment.payment_reference}
                                </div>
                                <div className="font-bold text-[#0c81cf] text-base mt-0.5">
                                  ${payment.amount_usd} <span className="text-[10px] text-slate-400 font-normal">USD</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(payment.status)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <div className="text-xs font-medium text-slate-900 flex items-center gap-1.5 justify-end">
                                  <Calendar className="h-3 w-3 text-slate-400" />
                                  {format(parseISO(payment.created_at), 'dd/MM/yyyy')}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {format(parseISO(payment.created_at), 'HH:mm')} hrs
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </>
      )}

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
  );
}
