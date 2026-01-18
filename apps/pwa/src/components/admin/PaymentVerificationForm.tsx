import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
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
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-400" />
              Verificar Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="verify-notes">Notas (opcional)</Label>
              <Textarea
                id="verify-notes"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Agregar notas sobre la verificación..."
                className="mt-1 bg-slate-800 border-slate-700"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => verifyMutation.mutate(false)}
                disabled={verifyMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {verifyMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Verificar Manualmente
                  </>
                )}
              </Button>
              <Button
                onClick={() => verifyMutation.mutate(true)}
                disabled={verifyMutation.isPending}
                variant="outline"
              >
                {verifyMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verificar Automáticamente
                  </>
                )}
              </Button>
              {payment.verification_attempts > 0 && (
                <Button
                  onClick={() => retryVerificationMutation.mutate()}
                  disabled={retryVerificationMutation.isPending}
                  variant="outline"
                >
                  {retryVerificationMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Reintentando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reintentar Verificación
                    </>
                  )}
                </Button>
              )}
            </div>
            {payment.verification_attempts > 0 && (
              <p className="text-sm text-slate-400">
                Intentos de verificación: {payment.verification_attempts}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aprobar Pago */}
      {canApprove && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Aprobar Pago y Activar Licencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4">
              <p className="text-sm text-emerald-400">
                Al aprobar este pago, la licencia de la tienda se activará automáticamente.
              </p>
            </div>
            <div>
              <Label htmlFor="approve-notes">Notas (opcional)</Label>
              <Textarea
                id="approve-notes"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Agregar notas sobre la aprobación..."
                className="mt-1 bg-slate-800 border-slate-700"
                rows={3}
              />
            </div>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 w-full"
            >
              {approveMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Aprobando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprobar y Activar Licencia
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rechazar Pago */}
      {canReject && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Rechazar Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
              <p className="text-sm text-red-400">
                Esta acción rechazará el pago. El usuario recibirá una notificación con el motivo.
              </p>
            </div>
            <div>
              <Label htmlFor="reject-reason" className="text-red-400">
                Motivo del Rechazo *
              </Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explicar por qué se rechaza el pago..."
                className="mt-1 bg-slate-800 border-slate-700"
                rows={3}
                required
              />
            </div>
            <div>
              <Label htmlFor="reject-notes">Notas Adicionales (opcional)</Label>
              <Textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Notas internas (no se mostrarán al usuario)..."
                className="mt-1 bg-slate-800 border-slate-700"
                rows={2}
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
              className="w-full"
            >
              {rejectMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Rechazando...
                </>
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

      {/* Estado actual */}
      {!canVerify && !canApprove && !canReject && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-slate-400">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <p>
                Este pago no puede ser modificado en su estado actual (
                {payment.status}).
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
