import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  FileText,
} from 'lucide-react';
import {
  LicensePayment,
} from '@/services/license-payments.service';
import PaymentVerificationForm from './PaymentVerificationForm';
import { format, parseISO } from 'date-fns';

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
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      icon: Clock,
    },
    verifying: {
      label: 'Verificando',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      icon: RefreshCw,
    },
    verified: {
      label: 'Verificado',
      className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      icon: CheckCircle2,
    },
    approved: {
      label: 'Aprobado',
      className: 'bg-green-600 text-white border-green-700',
      icon: CheckCircle2,
    },
    rejected: {
      label: 'Rechazado',
      className: 'bg-red-500/20 text-red-400 border-red-500/50',
      icon: XCircle,
    },
    expired: {
      label: 'Expirado',
      className: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
      icon: AlertCircle,
    },
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;
  return (
    <Badge className={config.className} variant="outline">
      <Icon className="h-3 w-3 mr-1" />
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                Detalles del Pago
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                ID: {payment.id}
              </DialogDescription>
            </div>
            {getStatusBadge(payment.status)}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 flex-shrink-0">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="actions">Acciones</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            <TabsContent value="details" className="p-6 space-y-4 mt-0">
              {/* Información General */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Plan</Label>
                      <div className="text-white font-semibold">{getPlanName(payment.plan)}</div>
                    </div>
                    <div>
                      <Label className="text-slate-400">Período</Label>
                      <div className="text-white">
                        {payment.billing_period === 'monthly' ? 'Mensual' : 'Anual'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-400">Monto USD</Label>
                      <div className="text-white font-semibold">${payment.amount_usd}</div>
                    </div>
                    {payment.amount_bs && (
                      <div>
                        <Label className="text-slate-400">Monto Bs</Label>
                        <div className="text-white">{payment.amount_bs} Bs</div>
                      </div>
                    )}
                    <div>
                      <Label className="text-slate-400">Método de Pago</Label>
                      <div className="text-white">{getPaymentMethodName(payment.payment_method)}</div>
                    </div>
                    <div>
                      <Label className="text-slate-400">Referencia</Label>
                      <div className="text-white font-mono">{payment.payment_reference}</div>
                    </div>
                    {payment.bank_code && (
                      <div>
                        <Label className="text-slate-400">Banco</Label>
                        <div className="text-white">{payment.bank_code}</div>
                      </div>
                    )}
                    {payment.phone_number && (
                      <div>
                        <Label className="text-slate-400">Teléfono</Label>
                        <div className="text-white">{payment.phone_number}</div>
                      </div>
                    )}
                    {payment.account_number && (
                      <div>
                        <Label className="text-slate-400">Número de Cuenta</Label>
                        <div className="text-white font-mono">{payment.account_number}</div>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-slate-800" />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Tienda ID</Label>
                      <div className="text-white font-mono text-sm">{payment.store_id}</div>
                    </div>
                    <div>
                      <Label className="text-slate-400">Creado</Label>
                      <div className="text-white text-sm">
                        {format(parseISO(payment.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </div>
                    </div>
                    {payment.expires_at && (
                      <div>
                        <Label className="text-slate-400">Expira</Label>
                        <div className="text-yellow-400 text-sm">
                          {format(parseISO(payment.expires_at), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </div>
                    )}
                    {payment.verified_at && (
                      <div>
                        <Label className="text-slate-400">Verificado</Label>
                        <div className="text-white text-sm">
                          {format(parseISO(payment.verified_at), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </div>
                    )}
                    {payment.approved_at && (
                      <div>
                        <Label className="text-slate-400">Aprobado</Label>
                        <div className="text-white text-sm">
                          {format(parseISO(payment.approved_at), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </div>
                    )}
                    {payment.rejected_at && (
                      <div>
                        <Label className="text-slate-400">Rechazado</Label>
                        <div className="text-white text-sm">
                          {format(parseISO(payment.rejected_at), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </div>
                    )}
                  </div>

                  {payment.auto_verified && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Verificado automáticamente</span>
                      </div>
                    </div>
                  )}

                  {payment.verification_attempts > 0 && (
                    <div className="text-sm text-slate-400">
                      Intentos de verificación: {payment.verification_attempts}
                    </div>
                  )}

                  {payment.rejection_reason && (
                    <div>
                      <Label className="text-slate-400">Motivo del Rechazo</Label>
                      <div className="text-red-400 mt-1">{payment.rejection_reason}</div>
                    </div>
                  )}

                  {payment.notes && (
                    <div>
                      <Label className="text-slate-400">Notas</Label>
                      <div className="text-white mt-1 whitespace-pre-wrap">{payment.notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documentos */}
              {payment.documents && payment.documents.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="pt-6">
                    <Label className="text-slate-400 mb-4 block">Documentos Adjuntos</Label>
                    <div className="space-y-2">
                      {payment.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="text-white text-sm">{doc.file_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {doc.file_type}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
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

            <TabsContent value="actions" className="p-6 mt-0">
              <PaymentVerificationForm
                payment={payment}
                onSuccess={() => {
                  onUpdate();
                  queryClient.invalidateQueries({ queryKey: ['license-payments'] });
                  queryClient.invalidateQueries({ queryKey: ['license-payments-stats'] });
                  toast.success('Operación realizada exitosamente');
                }}
              />
            </TabsContent>

            <TabsContent value="history" className="p-6 mt-0">
              {payment.verifications && payment.verifications.length > 0 ? (
                <div className="space-y-4">
                  {payment.verifications.map((verification) => (
                    <Card key={verification.id} className="bg-slate-900/50 border-slate-800">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-slate-800">
                            {verification.verification_method}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              verification.status === 'success'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }
                          >
                            {verification.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-400">
                          {verification.verified_at
                            ? format(parseISO(verification.verified_at), 'dd/MM/yyyy HH:mm:ss')
                            : format(parseISO(verification.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                        {verification.error_message && (
                          <div className="text-red-400 text-sm mt-2">
                            {verification.error_message}
                          </div>
                        )}
                        {verification.response_data && (
                          <details className="mt-2">
                            <summary className="text-sm text-slate-400 cursor-pointer">
                              Ver respuesta
                            </summary>
                            <pre className="text-xs bg-slate-800 p-2 rounded mt-2 overflow-auto">
                              {JSON.stringify(verification.response_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  No hay historial de verificaciones
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
