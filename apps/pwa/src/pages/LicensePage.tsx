import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/stores/auth.store';
import { api } from '@/lib/api';
import licensePaymentsService, {
  LicensePlan,
  BillingPeriod,
  LicensePaymentMethod,
  CreatePaymentRequestDto,
} from '@/services/license-payments.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const paymentRequestSchema = z.object({
  plan: z.enum(['basico', 'profesional', 'empresarial']),
  billing_period: z.enum(['monthly', 'yearly']),
  payment_method: z.enum(['pago_movil', 'transferencia', 'zelle', 'efectivo', 'other']),
  payment_reference: z.string().min(1, 'La referencia es requerida'),
  bank_code: z.string().optional(),
  phone_number: z.string().optional(),
  account_number: z.string().optional(),
  amount_usd: z.number().positive('El monto debe ser positivo'),
  amount_bs: z.number().optional(),
  exchange_rate: z.number().optional(),
  notes: z.string().optional(),
});

type PaymentRequestForm = z.infer<typeof paymentRequestSchema>;

const PLAN_INFO: Record<
  LicensePlan,
  { name: string; monthly: number; yearly: number; description: string }
> = {
  freemium: {
    name: 'Freemium',
    monthly: 0,
    yearly: 0,
    description: 'Plan gratuito para empezar',
  },
  basico: {
    name: 'Básico',
    monthly: 29,
    yearly: 290,
    description: 'Perfecto para pequeños negocios',
  },
  profesional: {
    name: 'Profesional',
    monthly: 79,
    yearly: 790,
    description: 'Para negocios en crecimiento',
  },
  empresarial: {
    name: 'Empresarial',
    monthly: 199,
    yearly: 1990,
    description: 'Para grandes empresas',
  },
};


export default function LicensePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<LicensePlan | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('monthly');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<PaymentRequestForm>({
    resolver: zodResolver(paymentRequestSchema),
    defaultValues: {
      billing_period: 'monthly',
      payment_method: 'pago_movil',
    },
  });

  const watchedPlan = watch('plan') as LicensePlan | undefined;
  const watchedPeriod = watch('billing_period') as BillingPeriod;

  // Calcular monto esperado cuando cambia plan o período
  useEffect(() => {
    if (watchedPlan && watchedPlan !== 'freemium') {
      const expectedAmount = licensePaymentsService.calculateExpectedAmount(
        watchedPlan,
        watchedPeriod
      );
      setValue('amount_usd', expectedAmount);
    }
  }, [watchedPlan, watchedPeriod, setValue]);

  // Obtener información de la tienda/licencia actual
  const { data: storeInfo } = useQuery({
    queryKey: ['current-store-license'],
    queryFn: async () => {
      // Aquí deberías tener un endpoint para obtener info de la tienda actual
      // Por ahora, usaremos la info del user
      return {
        plan: user?.license_plan || 'freemium',
        status: user?.license_status || 'active',
        expires_at: user?.license_expires_at || null,
      };
    },
    enabled: !!user,
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: CreatePaymentRequestDto) =>
      licensePaymentsService.createPaymentRequest(data),
    onSuccess: (payment) => {
      toast.success('Solicitud de pago creada exitosamente');
      reset();
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ['license-payments'] });
      // Mostrar información de la solicitud
      toast(
        `Tu solicitud #${payment.id.substring(0, 8)} está pendiente de verificación`,
        {
          duration: 5000,
          icon: '✅',
        }
      );
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la solicitud');
    },
  });

  const onSubmit = (data: PaymentRequestForm) => {
    if (!data.plan) {
      toast.error('Selecciona un plan válido');
      return;
    }

    createPaymentMutation.mutate({
      plan: data.plan,
      billing_period: data.billing_period,
      amount_usd: data.amount_usd,
      amount_bs: data.amount_bs,
      exchange_rate: data.exchange_rate,
      payment_method: data.payment_method,
      payment_reference: data.payment_reference,
      bank_code: data.bank_code,
      phone_number: data.phone_number,
      account_number: data.account_number,
      notes: data.notes,
    });
  };

  const currentPlan = (storeInfo?.plan || user?.license_plan || 'freemium') as LicensePlan;
  const currentPlanInfo = PLAN_INFO[currentPlan] || PLAN_INFO.freemium;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-primary" />
          Mi Licencia
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu suscripción y planes de LA-CAJA
        </p>
      </div>

      {/* Estado Actual de la Licencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Licencia Actual</span>
            <Badge
              variant={
                storeInfo?.status === 'active' ? 'default' : 'destructive'
              }
            >
              {storeInfo?.status === 'active' ? 'Activa' : 'Inactiva'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label className="text-muted-foreground">Plan Actual</Label>
              <div className="text-2xl font-bold mt-1">
                {currentPlanInfo.name}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {currentPlanInfo.description}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Estado</Label>
              <div className="text-lg font-semibold mt-1 capitalize">
                {storeInfo?.status || 'Activa'}
              </div>
              {storeInfo?.expires_at && (
                <p className="text-sm text-muted-foreground mt-1">
                  Expira: {format(parseISO(storeInfo.expires_at), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Próxima Renovación</Label>
              {storeInfo?.expires_at ? (
                <div className="text-lg font-semibold mt-1">
                  {format(parseISO(storeInfo.expires_at), 'dd/MM/yyyy')}
                </div>
              ) : (
                <div className="text-muted-foreground mt-1">Sin fecha definida</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planes Disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Planes Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Período de Facturación</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={selectedPeriod === 'monthly' ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod('monthly')}
                size="sm"
              >
                Mensual
              </Button>
              <Button
                variant={selectedPeriod === 'yearly' ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod('yearly')}
                size="sm"
              >
                Anual (2 meses gratis)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['basico', 'profesional', 'empresarial'] as LicensePlan[]).map(
              (plan) => {
                const info = PLAN_INFO[plan];
                const price =
                  selectedPeriod === 'monthly' ? info.monthly : info.yearly;
                const isSelected = selectedPlan === plan;
                const isCurrent = currentPlan === plan;

                return (
                  <Card
                    key={plan}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary'
                        : 'hover:border-primary/50'
                    } ${isCurrent ? 'opacity-75' : ''}`}
                    onClick={() => {
                      if (!isCurrent) {
                        setSelectedPlan(plan);
                        setValue('plan', plan as 'basico' | 'profesional' | 'empresarial');
                        setValue('billing_period', selectedPeriod);
                      }
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{info.name}</CardTitle>
                        {isCurrent && (
                          <Badge variant="outline">Plan Actual</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {info.description}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        ${price}
                        <span className="text-base font-normal text-muted-foreground">
                          /{selectedPeriod === 'monthly' ? 'mes' : 'año'}
                        </span>
                      </div>
                      {selectedPeriod === 'yearly' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ahorra 2 meses
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulario de Solicitud de Pago */}
      {selectedPlan && selectedPlan !== currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Solicitar Pago - {PLAN_INFO[selectedPlan].name} (
              {selectedPeriod === 'monthly' ? 'Mensual' : 'Anual'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Monto esperado:</strong>{' '}
                  {licensePaymentsService.calculateExpectedAmount(
                    selectedPlan,
                    selectedPeriod
                  )}{' '}
                  USD
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Realiza el pago y completa el formulario con los datos de la
                  transacción. Un administrador verificará el pago y activará tu
                  licencia.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="payment_method">Método de Pago *</Label>
                  <Select
                    value={watch('payment_method')}
                    onValueChange={(value) =>
                      setValue('payment_method', value as LicensePaymentMethod)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago_movil">Pago Móvil</SelectItem>
                      <SelectItem value="transferencia">
                        Transferencia Bancaria
                      </SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.payment_method && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.payment_method.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="payment_reference">
                    Referencia del Pago * (Nro. de transacción)
                  </Label>
                  <Input
                    id="payment_reference"
                    {...register('payment_reference')}
                    placeholder="Ej: 1234567890"
                  />
                  {errors.payment_reference && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.payment_reference.message}
                    </p>
                  )}
                </div>

                {watch('payment_method') === 'pago_movil' && (
                  <>
                    <div>
                      <Label htmlFor="bank_code">Código del Banco</Label>
                      <Input
                        id="bank_code"
                        {...register('bank_code')}
                        placeholder="Ej: 0105"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone_number">Teléfono</Label>
                      <Input
                        id="phone_number"
                        {...register('phone_number')}
                        placeholder="0412-1234567"
                      />
                    </div>
                  </>
                )}

                {watch('payment_method') === 'transferencia' && (
                  <div>
                    <Label htmlFor="account_number">Número de Cuenta</Label>
                    <Input
                      id="account_number"
                      {...register('account_number')}
                      placeholder="0000-0000-00-0000000000"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="amount_usd">Monto en USD *</Label>
                  <Input
                    id="amount_usd"
                    type="number"
                    step="0.01"
                    {...register('amount_usd', { valueAsNumber: true })}
                  />
                  {errors.amount_usd && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.amount_usd.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="amount_bs">Monto en Bs (opcional)</Label>
                  <Input
                    id="amount_bs"
                    type="number"
                    step="0.01"
                    {...register('amount_bs', { valueAsNumber: true })}
                  />
                </div>

                <div>
                  <Label htmlFor="exchange_rate">
                    Tasa de Cambio (opcional)
                  </Label>
                  <Input
                    id="exchange_rate"
                    type="number"
                    step="0.000001"
                    {...register('exchange_rate', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="Información adicional sobre el pago..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={createPaymentMutation.isPending}
                  className="flex-1"
                >
                  {createPaymentMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Enviar Solicitud de Pago
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedPlan(null);
                    reset();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mis Solicitudes de Pago */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Solicitudes de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <PendingPaymentsList />
        </CardContent>
      </Card>
    </div>
  );
}

// Componente para listar solicitudes pendientes del usuario
function PendingPaymentsList() {
  const { user } = useAuth();

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['my-license-payments', user?.store_id],
    queryFn: async () => {
      if (!user?.store_id) return { payments: [], total: 0 };
      const response = await api.get('/licenses/payments');
      return response.data;
    },
    enabled: !!user?.store_id,
  });

  const payments = paymentsData?.payments || [];

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Cargando...</div>;
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tienes solicitudes de pago pendientes
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {payments.map((payment: any) => (
        <Card key={payment.id} className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={
                      payment.status === 'approved'
                        ? 'default'
                        : payment.status === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {payment.status}
                  </Badge>
                  <span className="font-semibold">
                    {PLAN_INFO[payment.plan as LicensePlan]?.name || payment.plan || 'Desconocido'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {payment.billing_period === 'monthly' ? 'Mensual' : 'Anual'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>Referencia: {payment.payment_reference}</div>
                  <div>
                    Monto: ${payment.amount_usd} USD
                    {payment.amount_bs && ` / ${payment.amount_bs} Bs`}
                  </div>
                  <div>
                    Creado:{' '}
                    {format(parseISO(payment.created_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {payment.status === 'approved' && (
                  <Badge className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Aprobado
                  </Badge>
                )}
                {payment.status === 'pending' && (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Pendiente
                  </Badge>
                )}
                {payment.status === 'rejected' && (
                  <div>
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Rechazado
                    </Badge>
                    {payment.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        {payment.rejection_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
