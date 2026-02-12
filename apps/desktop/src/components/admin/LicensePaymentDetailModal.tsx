import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from '@/lib/toast';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  FileText,
  CreditCard,
  Building2,
  Phone,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  LicensePayment,
} from '@/services/license-payments.service';
import PaymentVerificationForm from './PaymentVerificationForm';
import { format, parseISO } from 'date-fns';
import BlurFade from '@/components/magicui/blur-fade';

interface LicensePaymentDetailModalProps {
  payment: LicensePayment;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function getStatusBadge(status: LicensePayment['status']) {
  const variants: Record<
    LicensePayment['status'],
    { label: string; className: string; icon: any }
  > = {
    pending: {
      label: 'Pendiente',
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
      icon: Clock,
    },
    verifying: {
      label: 'Verificando',
      className: 'bg-[#0c81cf10] text-[#0c81cf] border-[#0c81cf20]',
      icon: RefreshCw,
    },
    verified: {
      label: 'Verificado',
      className: 'bg-sky-500/10 text-sky-600 border-sky-200',
      icon: CheckCircle2,
    },
    approved: {
      label: 'Aprobado',
      className: 'bg-[#0c81cf] text-white border-[#0c81cf] shadow-md',
      icon: CheckCircle2,
    },
    rejected: {
      label: 'Rechazado',
      className: 'bg-red-500/10 text-red-600 border-red-200',
      icon: XCircle,
    },
    expired: {
      label: 'Expirado',
      className: 'bg-card text-muted-foreground border-border',
      icon: AlertCircle,
    },
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;
  return (
    <Badge className={`${config.className} px-3 py-1 text-sm font-medium transition-all`} variant="outline">
      <Icon className="h-3.5 w-3.5 mr-1.5" />
      {config.label}
    </Badge>
  );
}

function getPlanName(plan: string) {
  const names: Record<string, string> = {
    freemium: 'Freemium',
    basico: 'Básico',
    profesional: 'Profesional',
    empresarial: 'Empresarial',
  };
  return names[plan] || plan;
}

function getPaymentMethodName(method: string) {
  const names: Record<string, string> = {
    pago_movil: 'Pago Móvil',
    transferencia: 'Transferencia',
    zelle: 'Zelle',
    efectivo: 'Efectivo',
    other: 'Otro',
  };
  return names[method] || method;
}

export default function LicensePaymentDetailModal({
  payment,
  isOpen,
  onClose,
  onUpdate,
}: LicensePaymentDetailModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl p-0 flex flex-col bg-card">
        <SheetHeader className="px-6 py-6 border-b border-slate-200 bg-white shadow-sm z-10">
          <BlurFade delay={0.1}>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="bg-card text-muted-foreground border-border font-mono">
                ID: {payment.id.slice(0, 8)}...
              </Badge>
              {getStatusBadge(payment.status)}
            </div>
            <SheetTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-[#0c81cf]" />
              Detalles del Pago
            </SheetTitle>
            <SheetDescription className="text-slate-500">
              Revisa la información completa de la transacción y gestiona su estado.
            </SheetDescription>
          </BlurFade>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 bg-white border-b border-slate-200">
            <TabsList className="w-full justify-start bg-transparent p-0 gap-6">
              <TabsTrigger
                value="details"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#0c81cf] rounded-none px-0 pb-3 text-slate-500 data-[state=active]:text-[#0c81cf] transition-all"
              >
                Detalles
              </TabsTrigger>
              <TabsTrigger
                value="actions"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#0c81cf] rounded-none px-0 pb-3 text-slate-500 data-[state=active]:text-[#0c81cf] transition-all"
              >
                Acciones
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#0c81cf] rounded-none px-0 pb-3 text-slate-500 data-[state=active]:text-[#0c81cf] transition-all"
              >
                Historial
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 bg-card">
            <div className="p-6">
              <BlurFade delay={0.2} inView>
                <TabsContent value="details" className="space-y-6 mt-0">
                  {/* Información General */}
                  <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                        <div className="p-4 space-y-1">
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Plan Solicitado</Label>
                          <div className="text-lg font-semibold text-slate-900">{getPlanName(payment.plan)}</div>
                        </div>
                        <div className="p-4 space-y-1">
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Período</Label>
                          <div className="text-lg font-medium text-slate-900">
                            {payment.billing_period === 'monthly' ? 'Mensual' : 'Anual'}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                        <div className="p-4 space-y-1">
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monto USD</Label>
                          <div className="text-xl font-bold text-slate-900">${payment.amount_usd}</div>
                        </div>
                        {payment.amount_bs && (
                          <div className="p-4 space-y-1">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monto Bs</Label>
                            <div className="text-xl font-bold text-slate-700">{payment.amount_bs} Bs</div>
                          </div>
                        )}
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-slate-500 mb-1 block text-xs">Método de Pago</Label>
                            <div className="flex items-center gap-2 text-slate-900 font-medium">
                              <CreditCard className="h-4 w-4 text-[#0c81cf]" />
                              {getPaymentMethodName(payment.payment_method)}
                            </div>
                          </div>
                          {payment.bank_code && (
                            <div>
                              <Label className="text-slate-500 mb-1 block text-xs">Banco</Label>
                              <div className="flex items-center gap-2 text-slate-900">
                                <Building2 className="h-4 w-4 text-slate-400" />
                                {payment.bank_code}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label className="text-slate-500 mb-1 block text-xs">Referencia</Label>
                            <Badge variant="secondary" className="font-mono text-foreground bg-card border-border">
                              {payment.payment_reference}
                            </Badge>
                          </div>
                          {payment.phone_number && (
                            <div>
                              <Label className="text-slate-500 mb-1 block text-xs">Teléfono</Label>
                              <div className="flex items-center gap-2 text-slate-900">
                                <Phone className="h-4 w-4 text-slate-400" />
                                {payment.phone_number}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                          <Label className="text-slate-500 text-xs">Tienda ID</Label>
                          <div className="font-mono text-sm text-slate-700 mt-1">{payment.store_id}</div>
                        </div>
                        <div>
                          <Label className="text-slate-500 text-xs">Creado el</Label>
                          <div className="text-sm text-slate-900 mt-1 flex items-center gap-2">
                            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                            {format(parseISO(payment.created_at), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </div>
                        {payment.expires_at && (
                          <div>
                            <Label className="text-slate-500 text-xs">Expira el</Label>
                            <div className="text-sm text-amber-600 font-medium mt-1 flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              {format(parseISO(payment.expires_at), 'dd/MM/yyyy HH:mm')}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documentos */}
                  {payment.documents && payment.documents.length > 0 && (
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="pt-6">
                        <Label className="text-slate-900 font-medium mb-4 block flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#0c81cf]" />
                          Comprobantes Adjuntos
                        </Label>
                        <div className="space-y-2">
                          {payment.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-[#0c81cf]">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-slate-900 text-sm font-medium">{doc.file_name}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-border text-muted-foreground">
                                      {doc.file_type}
                                    </Badge>
                                    <span className="text-xs text-slate-400">
                                      {(doc.file_size / 1024).toFixed(1)} KB
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-[#0c81cf] hover:bg-blue-50"
                                onClick={() => window.open(doc.file_path, '_blank')}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-0">
                  <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="pt-6">
                      <PaymentVerificationForm
                        payment={payment}
                        onSuccess={() => {
                          onUpdate();
                          queryClient.invalidateQueries({ queryKey: ['license-payments'] });
                          queryClient.invalidateQueries({ queryKey: ['license-payments-stats'] });
                          toast.success('Operación realizada exitosamente');
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  {payment.verifications && payment.verifications.length > 0 ? (
                    <div className="space-y-4">
                      <div className="relative pl-4 border-l-2 border-slate-200 space-y-8 py-2">
                        {payment.verifications.map((verification) => (
                          <div key={verification.id} className="relative">
                            <div className={`absolute -left-[21px] top-0 h-4 w-4 rounded-full border-2 ${verification.status === 'success' ? 'bg-emerald-500 border-emerald-100' : 'bg-slate-400 border-slate-100'} ring-4 ring-white`}></div>

                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-slate-900">
                                  {verification.verification_method === 'manual' ? 'Verificación Manual' : 'Verificación Automática'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {verification.verified_at
                                    ? format(parseISO(verification.verified_at), 'dd/MM/yyyy HH:mm')
                                    : format(parseISO(verification.created_at), 'dd/MM/yyyy HH:mm')}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mb-3">
                                <Badge
                                  variant="secondary"
                                  className={
                                    verification.status === 'success'
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-red-100 text-red-700 hover:bg-red-100'
                                  }
                                >
                                  {verification.status.toUpperCase()}
                                </Badge>
                              </div>

                              {verification.error_message && (
                                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-100 mb-2">
                                  {verification.error_message}
                                </div>
                              )}

                              {verification.response_data && (
                                <details className="group">
                                  <summary className="text-xs text-[#0c81cf] cursor-pointer font-medium hover:underline flex items-center gap-1">
                                    Ver datos técnicos
                                  </summary>
                                  <div className="mt-2 text-xs bg-card border border-border text-foreground p-3 rounded-md overflow-x-auto font-mono">
                                    {JSON.stringify(verification.response_data, null, 2)}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-white rounded-lg border border-slate-200 border-dashed">
                      <Clock className="h-10 w-10 text-slate-300 mb-3" />
                      <p>No hay historial de verificaciones</p>
                    </div>
                  )}
                </TabsContent>
              </BlurFade>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
