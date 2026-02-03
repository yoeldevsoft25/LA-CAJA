import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, AlertTriangle } from 'lucide-react'
import { fiscalConfigsService } from '@/services/fiscal-configs.service'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from '@/lib/toast'

const fiscalConfigSchema = z.object({
  tax_id: z.string().min(1, 'El RIF/Tax ID es requerido'),
  business_name: z.string().min(1, 'El nombre del negocio es requerido'),
  business_address: z.string().min(1, 'La dirección es requerida'),
  business_phone: z.string().optional().or(z.literal('')),
  business_email: z.string().email('Email inválido').optional().or(z.literal('')),
  default_tax_rate: z.number().min(0).max(100),
  fiscal_authorization_number: z.string().optional(),
  fiscal_authorization_date: z.string().optional().or(z.literal('')),
  fiscal_authorization_expiry: z.string().optional().or(z.literal('')),
  fiscal_control_system: z.string().optional().or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
})

type FiscalConfigFormData = z.infer<typeof fiscalConfigSchema>

export default function FiscalConfigPage() {
  const queryClient = useQueryClient()
  const [isExpiringSoon, setIsExpiringSoon] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey: ['fiscal-config'],
    queryFn: () => fiscalConfigsService.findOne(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FiscalConfigFormData>({
    resolver: zodResolver(fiscalConfigSchema),
    defaultValues: {
      tax_id: '',
      business_name: '',
      business_address: '',
      business_phone: '',
      business_email: '',
      default_tax_rate: 16,
      fiscal_authorization_number: '',
      fiscal_authorization_date: '',
      fiscal_authorization_expiry: '',
      fiscal_control_system: '',
      note: '',
    },
  })

  useEffect(() => {
    if (config) {
      reset({
        tax_id: config.tax_id,
        business_name: config.business_name,
        business_address: config.business_address,
        business_phone: config.business_phone || '',
        business_email: config.business_email || '',
        default_tax_rate: config.default_tax_rate,
        fiscal_authorization_number: config.fiscal_authorization_number || '',
        fiscal_authorization_date: config.fiscal_authorization_date
          ? config.fiscal_authorization_date.split('T')[0]
          : '',
        fiscal_authorization_expiry: config.fiscal_authorization_expiry
          ? config.fiscal_authorization_expiry.split('T')[0]
          : '',
        fiscal_control_system: config.fiscal_control_system || '',
        note: config.note || '',
      })

      // Verificar vencimiento de autorización
      if (config.fiscal_authorization_expiry) {
        const expiryDate = new Date(config.fiscal_authorization_expiry)
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
        setIsExpiringSoon(daysUntilExpiry <= 30 && daysUntilExpiry > 0)
        setIsExpired(daysUntilExpiry <= 0)
      }
    }
  }, [config, reset])

  const saveMutation = useMutation({
    mutationFn: (data: FiscalConfigFormData) => {
      if (config) {
        return fiscalConfigsService.update(data)
      }
      return fiscalConfigsService.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-config'] })
      toast.success('Configuración fiscal guardada correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al guardar la configuración')
    },
  })

  const onSubmit = (data: FiscalConfigFormData) => {
    saveMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="h-full max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Configuración Fiscal
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Configure los datos fiscales de su negocio
        </p>
      </div>

      {/* Alertas de vencimiento */}
      {isExpired && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Autorización Fiscal Vencida</AlertTitle>
          <AlertDescription>
            La autorización fiscal ha vencido. Por favor, actualice la información.
          </AlertDescription>
        </Alert>
      )}

      {isExpiringSoon && !isExpired && config?.fiscal_authorization_expiry && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Autorización Próxima a Vencer</AlertTitle>
          <AlertDescription className="text-yellow-700">
            La autorización fiscal vence en{' '}
            {Math.ceil(
              (new Date(config.fiscal_authorization_expiry).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            )}{' '}
            días. Por favor, renueve la autorización.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección: Datos del Emisor */}
        <Card>
          <CardHeader>
            <CardTitle>Datos del Emisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tax_id">
                  RIF/Tax ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tax_id"
                  {...register('tax_id')}
                  className="mt-2"
                  placeholder="J-12345678-9"
                />
                {errors.tax_id && (
                  <p className="text-sm text-destructive mt-1">{errors.tax_id.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="business_name">
                  Nombre del Negocio <span className="text-destructive">*</span>
                </Label>
                <Input id="business_name" {...register('business_name')} className="mt-2" />
                {errors.business_name && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.business_name.message}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="business_address">
                  Dirección <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="business_address"
                  {...register('business_address')}
                  className="mt-2"
                  rows={3}
                />
                {errors.business_address && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.business_address.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="business_phone">Teléfono</Label>
                <Input
                  id="business_phone"
                  {...register('business_phone')}
                  className="mt-2"
                  placeholder="0412-1234567"
                />
              </div>
              <div>
                <Label htmlFor="business_email">Email</Label>
                <Input
                  id="business_email"
                  type="email"
                  {...register('business_email')}
                  className="mt-2"
                  placeholder="email@ejemplo.com"
                />
                {errors.business_email && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.business_email.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sección: Configuración Fiscal */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración Fiscal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="default_tax_rate">Tasa de Impuesto por Defecto (%)</Label>
                <Input
                  id="default_tax_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('default_tax_rate', { valueAsNumber: true })}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ej: 16 para IVA del 16%
                </p>
                {errors.default_tax_rate && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.default_tax_rate.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="fiscal_control_system">Sistema de Control Fiscal</Label>
                <Input
                  id="fiscal_control_system"
                  {...register('fiscal_control_system')}
                  className="mt-2"
                  placeholder="SENIAT, etc."
                />
              </div>
              <div>
                <Label htmlFor="fiscal_authorization_number">Número de Autorización Fiscal</Label>
                <Input
                  id="fiscal_authorization_number"
                  {...register('fiscal_authorization_number')}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="fiscal_authorization_date">Fecha de Autorización</Label>
                <Input
                  id="fiscal_authorization_date"
                  type="date"
                  {...register('fiscal_authorization_date')}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="fiscal_authorization_expiry">Fecha de Vencimiento</Label>
                <Input
                  id="fiscal_authorization_expiry"
                  type="date"
                  {...register('fiscal_authorization_expiry')}
                  className="mt-2"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="note">Notas</Label>
                <Textarea id="note" {...register('note')} className="mt-2" rows={3} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="min-w-[150px]"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </form>
    </div>
  )
}

