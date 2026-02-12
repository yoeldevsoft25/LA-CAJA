import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import licensePaymentsService, {
  LicensePayment,
} from '@/services/license-payments.service';

interface PaymentVerificationFormProps {
  payment: LicensePayment;
  onSuccess: () => void;
}

export default function PaymentVerificationForm({
  payment,
  onSuccess,
}: PaymentVerificationFormProps) {
  const [verifyNotes, setVerifyNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState('');

  const verifyMutation = useMutation({
    mutationFn: (autoVerify: boolean) =>
      licensePaymentsService.verifyPayment(payment.id, {
        auto_verify: autoVerify,
        notes: verifyNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Pago verificado exitosamente');
      setVerifyNotes('');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al verificar el pago');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      licensePaymentsService.approvePayment(payment.id, {
        notes: approveNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Pago aprobado y licencia activada');
      setApproveNotes('');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al aprobar el pago');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      licensePaymentsService.rejectPayment(payment.id, {
        rejection_reason: rejectReason,
        notes: rejectNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Pago rechazado');
      setRejectReason('');
      setRejectNotes('');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al rechazar el pago');
    },
  });

  const retryVerificationMutation = useMutation({
    mutationFn: () => licensePaymentsService.retryVerification(payment.id),
    onSuccess: () => {
      toast.success('Verificación automática reintentada');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al reintentar verificación');
    },
  });

  const canVerify = payment.status === 'pending' || payment.status === 'verifying';
  const canApprove = payment.status === 'verified';
  const canReject = payment.status !== 'approved' && payment.status !== 'rejected';

  return (
    <div className="space-y-6">
      {/* Verificación Manual */}
      {canVerify && (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-2 border-[#0c81cf20]">
          <CardHeader className="bg-card border-b border-border">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0c81cf]" />
              Verificar Transacción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label htmlFor="verify-notes" className="text-slate-900 font-medium">Notas de verificación (opcional)</Label>
              <Textarea
                id="verify-notes"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Escribe detalles sobre la transacción..."
                className="mt-1.5 bg-white border-slate-200 focus:border-[#0c81cf] min-h-[80px]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => verifyMutation.mutate(false)}
                  disabled={verifyMutation.isPending}
                  className="bg-[#0c81cf] hover:bg-[#0a6fb3] text-white"
                >
                  {verifyMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Manual
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => verifyMutation.mutate(true)}
                  disabled={verifyMutation.isPending}
                  variant="outline"
                  className="border-[#0c81cf] text-[#0c81cf] hover:bg-[#0c81cf10]"
                >
                  {verifyMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Automático
                    </>
                  )}
                </Button>
              </div>
              {payment.verification_attempts > 0 && (
                <Button
                  onClick={() => retryVerificationMutation.mutate()}
                  disabled={retryVerificationMutation.isPending}
                  variant="ghost"
                  className="text-slate-500 text-xs h-8"
                >
                  Reintentar verificación automática
                </Button>
              )}
            </div>
            {payment.verification_attempts > 0 && (
              <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
                Intentos realizados: {payment.verification_attempts}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aprobar Pago */}
      {canApprove && (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-2 border-emerald-500/20">
          <CardHeader className="bg-card border-b border-border">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Aprobar y Activar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                Al aprobar, la licencia se activará inmediatamente en la tienda seleccionada.
              </p>
            </div>
            <div>
              <Label htmlFor="approve-notes" className="text-slate-900 font-medium">Notas de aprobación (opcional)</Label>
              <Textarea
                id="approve-notes"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Notas adicionales para el registro..."
                className="mt-1.5 bg-white border-slate-200 focus:border-[#0c81cf] min-h-[80px]"
              />
            </div>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 w-full text-white shadow-lg shadow-emerald-600/20"
            >
              {approveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprobar Pago y Activar Licencia
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rechazar Pago */}
      {canReject && (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-2 border-rose-500/20">
          <CardHeader className="bg-card border-b border-border">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              Rechazar Solicitud
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
              <p className="text-xs text-rose-700 leading-relaxed font-medium">
                Esta acción rechazará el pago y notificará al usuario con el motivo.
              </p>
            </div>
            <div>
              <Label htmlFor="reject-reason" className="text-rose-600 font-bold text-xs uppercase tracking-wider">
                Motivo del Rechazo *
              </Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explica detalladamente por qué se rechaza..."
                className="mt-1.5 bg-white border-rose-100 focus:border-rose-400 min-h-[80px]"
                required
              />
            </div>
            <div>
              <Label htmlFor="reject-notes" className="text-slate-900 font-medium">Notas Internas (opcional)</Label>
              <Textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Notas que el usuario NO podrá ver..."
                className="mt-1.5 bg-white border-slate-200 focus:border-rose-400 min-h-[60px]"
              />
            </div>
            <Button
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('El motivo del rechazo es requerido');
                  return;
                }
                rejectMutation.mutate();
              }}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              variant="destructive"
              className="w-full bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20 text-white"
            >
              {rejectMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar Pago
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Estado actual si no hay acciones */}
      {!canVerify && !canApprove && !canReject && (
        <Card className="bg-white border-slate-200 shadow-sm border-dashed">
          <CardContent className="pt-8 pb-8">
            <div className="text-center text-slate-400">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay acciones disponibles para este estado: <span className="text-slate-900">{payment.status}</span></p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
