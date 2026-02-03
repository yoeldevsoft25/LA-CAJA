import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from '@/lib/toast'
import { Loader2, CheckCircle2, Store, Building2, FileText, Package, Check } from 'lucide-react'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@la-caja/ui-core'
import { setupService, SetupConfig, BusinessType } from '@/services/setup.service'
import { Progress } from '@/components/ui/progress'

// Schema de validación
const onboardingSchema = z.object({
  business_name: z.string().min(1, 'El nombre del negocio es requerido'),
  business_type: z.enum(['retail', 'services', 'restaurant', 'general']),
  fiscal_id: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  currency: z.enum(['BS', 'USD', 'MIXED']),
})

type OnboardingForm = z.infer<typeof onboardingSchema>

interface OnboardingWizardProps {
  onComplete?: () => void
  onSkip?: () => void
}

const STEPS = [
  { id: 1, title: 'Información Básica', icon: Store },
  { id: 2, title: 'Tipo de Negocio', icon: Building2 },
  { id: 3, title: 'Configuración Contable', icon: FileText },
  { id: 4, title: 'Configuración Inicial', icon: Package },
  { id: 5, title: 'Resumen', icon: Check },
] as const

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      business_name: '',
      business_type: 'general',
      fiscal_id: '',
      address: '',
      phone: '',
      email: '',
      currency: 'MIXED',
    },
  })

  const watchedValues = watch()

  // Mutación para ejecutar setup
  const setupMutation = useMutation({
    mutationFn: (config: SetupConfig) => setupService.runSetup(config),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('¡Configuración completada exitosamente!')
        onComplete?.()
      } else {
        toast.error('La configuración se completó con algunos errores')
        onComplete?.()
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al completar la configuración')
    },
  })

  const validateCurrentStep = async () => {
    if (currentStep === 1) {
      return await trigger(['business_name', 'fiscal_id', 'address', 'phone', 'email'])
    }
    if (currentStep === 2) {
      return await trigger(['business_type'])
    }
    if (currentStep === 3) {
      return true // Configuración automática
    }
    return true
  }

  const handleNext = async () => {
    const isValid = await validateCurrentStep()
    if (!isValid) return

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = async (data: OnboardingForm) => {
    setupMutation.mutate({
      business_type: data.business_type as BusinessType,
      business_name: data.business_name,
      fiscal_id: data.fiscal_id || undefined,
      address: data.address || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      currency: data.currency,
    })
  }

  const progress = (currentStep / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Configuración Inicial
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Completa estos pasos para configurar tu sistema
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 text-center">
            Paso {currentStep} de {STEPS.length}
          </p>
        </div>

        {/* Steps Indicator */}
        <div className="flex justify-center gap-4 mb-8">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5',
                      isCompleted ? 'bg-green-500' : 'bg-slate-200'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Ingresa la información básica de tu negocio'}
              {currentStep === 2 && 'Selecciona el tipo de negocio para aplicar configuraciones optimizadas'}
              {currentStep === 3 && 'Se configurará automáticamente el plan de cuentas contable'}
              {currentStep === 4 && 'Se crearán automáticamente almacenes, listas de precios y series de factura'}
              {currentStep === 5 && 'Revisa la configuración antes de finalizar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="business_name">Nombre del Negocio *</Label>
                    <Input
                      id="business_name"
                      {...register('business_name')}
                      placeholder="Ej: Mi Tienda"
                      className={cn(errors.business_name && 'border-red-500')}
                    />
                    {errors.business_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.business_name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="fiscal_id">RIF / NIT (Opcional)</Label>
                    <Input
                      id="fiscal_id"
                      {...register('fiscal_id')}
                      placeholder="Ej: J-12345678-9"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Dirección (Opcional)</Label>
                    <Input
                      id="address"
                      {...register('address')}
                      placeholder="Dirección completa"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Teléfono (Opcional)</Label>
                      <Input
                        id="phone"
                        {...register('phone')}
                        placeholder="0412-1234567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email (Opcional)</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        placeholder="email@ejemplo.com"
                        className={cn(errors.email && 'border-red-500')}
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="business_type">Tipo de Negocio *</Label>
                    <Select
                      value={watchedValues.business_type}
                      onValueChange={(value) => setValue('business_type', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de negocio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Retail / Tienda</SelectItem>
                        <SelectItem value="services">Servicios</SelectItem>
                        <SelectItem value="restaurant">Restaurante / Comida</SelectItem>
                        <SelectItem value="general">General / Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="currency">Moneda Principal</Label>
                    <Select
                      value={watchedValues.currency}
                      onValueChange={(value) => setValue('currency', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIXED">Mixta (Bs + USD)</SelectItem>
                        <SelectItem value="BS">Solo Bolívares (Bs)</SelectItem>
                        <SelectItem value="USD">Solo Dólares (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Nota:</strong> Según el tipo de negocio seleccionado, se configurará
                      automáticamente un plan de cuentas optimizado para tu industria.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Configuración Contable</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      Se creará automáticamente un plan de cuentas básico con todas las cuentas
                      necesarias para tu negocio.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-left">
                      <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Plan de cuentas básico
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Mapeos de cuentas automáticos
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Configuración según tipo de negocio
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center py-8">
                    <Package className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Configuración del Sistema</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      Se crearán automáticamente las configuraciones básicas necesarias:
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-left">
                      <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Almacén Principal
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Lista de Precios Principal
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Serie de Factura Principal
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Resumen de Configuración</h3>

                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="font-medium">Nombre del Negocio:</span>
                        <span>{watchedValues.business_name}</span>
                      </div>

                      <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="font-medium">Tipo de Negocio:</span>
                        <span className="capitalize">
                          {watchedValues.business_type === 'retail' && 'Retail / Tienda'}
                          {watchedValues.business_type === 'services' && 'Servicios'}
                          {watchedValues.business_type === 'restaurant' && 'Restaurante'}
                          {watchedValues.business_type === 'general' && 'General'}
                        </span>
                      </div>

                      {watchedValues.fiscal_id && (
                        <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                          <span className="font-medium">RIF / NIT:</span>
                          <span>{watchedValues.fiscal_id}</span>
                        </div>
                      )}

                      <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="font-medium">Moneda:</span>
                        <span>
                          {watchedValues.currency === 'MIXED' && 'Mixta (Bs + USD)'}
                          {watchedValues.currency === 'BS' && 'Solo Bolívares'}
                          {watchedValues.currency === 'USD' && 'Solo Dólares'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Al finalizar, se ejecutará la configuración automática. Esto puede tomar
                        unos segundos.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handleBack} disabled={setupMutation.isPending}>
                    Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {onSkip && (
                  <Button variant="ghost" onClick={onSkip} disabled={setupMutation.isPending}>
                    Omitir
                  </Button>
                )}
                {currentStep < STEPS.length ? (
                  <Button onClick={handleNext} disabled={setupMutation.isPending}>
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit(handleFinish)}
                    disabled={setupMutation.isPending}
                  >
                    {setupMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Configurando...
                      </>
                    ) : (
                      'Finalizar Configuración'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}