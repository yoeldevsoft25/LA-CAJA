import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/stores/auth.store'
import { authService, type LoginResponse } from '@/services/auth.service'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchAllData } from '@/services/prefetch.service'
import { syncService } from '@/services/sync.service'
import { setupService } from '@/services/setup.service'
import { getDefaultRoute } from '@/lib/permissions'
import { Loader2, Lock, ChevronRight, Store, User, KeyRound, Sparkles } from 'lucide-react'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@la-caja/ui-core'
import { Card, CardContent } from '@/components/ui/card'
import { colors, motionVariants } from '@/design-system'
import ShineBorder from '@/components/magicui/shine-border'

// ============================================================================
// Schema & Types
// ============================================================================

const loginSchema = z.object({
  store_id: z.string().min(1, 'Selecciona una tienda'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 caracteres').max(8, 'El PIN debe tener máximo 8 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

// ============================================================================
// Component
// ============================================================================

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const queryClient = useQueryClient()
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedCashierId, setSelectedCashierId] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      store_id: '',
      pin: '',
    },
  })

  // Queries
  const { data: stores, isLoading: loadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: authService.getStores,
  })

  const { data: cashiers, isLoading: loadingCashiers } = useQuery({
    queryKey: ['cashiers', selectedStoreId],
    queryFn: () => authService.getCashiers(selectedStoreId),
    enabled: !!selectedStoreId,
  })

  // Login mutation
  const mutation = useMutation({
    mutationFn: (data: LoginForm) =>
      authService.login({ store_id: data.store_id, pin: data.pin }),
    onSuccess: async (response: LoginResponse) => {
      console.log('[Login] Login exitoso', response)

      const user = {
        user_id: response.user_id,
        store_id: response.store_id,
        role: response.role,
        full_name: response.full_name,
        license_status: response.license_status,
        license_expires_at: response.license_expires_at || null,
        license_plan: response.license_plan || null,
      }

      login(response.access_token, response.refresh_token, user)

      try {
        await syncService.ensureInitialized(response.store_id)
        console.log('[Login] SyncService inicializado')
      } catch (error) {
        console.warn('[Login] Error al inicializar SyncService:', error)
      }

      try {
        await prefetchAllData({
          storeId: response.store_id,
          queryClient,
          userRole: response.role,
        })
        console.log('[Prefetch] Cacheo completo')
      } catch (error) {
        console.warn('[Prefetch] Error al prefetch:', error)
      }

      // Verificar estado de configuración si es owner
      if (response.role === 'owner') {
        try {
          const setupStatus = await setupService.validateSetup()
          if (!setupStatus.is_complete) {
            console.log('[Login] Setup incompleto, redirigiendo a onboarding')
            navigate('/onboarding')
            return
          }
        } catch (error) {
          console.warn('[Login] Error al validar setup:', error)
          // Continuar al dashboard si falla la validación
        }
      }

      navigate(getDefaultRoute(response.role))
    },
    onError: (error: Error) => {
      console.error('[Login] Error en login:', error)
      toast.error(error.message || 'Error al iniciar sesión')
    },
  })

  const onSubmit = async (data: LoginForm) => {
    mutation.mutate(data)
  }

  const selectedCashierName = cashiers?.find((c) => c.user_id === selectedCashierId)?.full_name

  // Computed values
  const currentStep = useMemo(() => {
    if (!selectedStoreId) return 1
    if (!selectedCashierId) return 2
    return 3
  }, [selectedStoreId, selectedCashierId])

  return (
    <div className="min-h-[100dvh] w-full flex items-start sm:items-center justify-center bg-[#fbfaf8] relative overflow-x-hidden overflow-y-auto touch-pan-y px-6 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#d9ecfb] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#e1f2ff] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(12,129,207,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(12,129,207,0.14),transparent_40%)]" />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">

          {/* Header */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-white/70">
                <img src="/logo-velox.svg" alt="Velox POS" className="h-8 w-8" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-3xl font-heading font-semibold tracking-tight text-slate-900">
                Bienvenido de nuevo
              </h1>
              <p className="text-slate-500 mt-2 text-sm">
                Accede a tu operación con estilo y precisión.
              </p>
            </motion.div>
          </div>

          {/* Progress Steps */}
          <motion.div
            className="flex items-center justify-center gap-2 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <motion.div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-300',
                    currentStep >= step
                      ? 'text-white'
                      : 'bg-slate-200 text-slate-400'
                  )}
                  style={{
                    backgroundColor: currentStep >= step ? colors.brand.primary : undefined,
                  }}
                  animate={currentStep === step ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {step === 1 && <Store className="w-4 h-4" />}
                  {step === 2 && <User className="w-4 h-4" />}
                  {step === 3 && <KeyRound className="w-4 h-4" />}
                </motion.div>
                {step < 3 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 transition-colors duration-300',
                      currentStep > step ? '' : 'bg-slate-200'
                    )}
                    style={{
                      backgroundColor: currentStep > step ? colors.brand.primary : undefined,
                    }}
                  />
                )}
              </div>
            ))}
          </motion.div>

          {/* Main Card */}
          <ShineBorder
            className="w-full bg-transparent"
            borderRadius={28}
            borderWidth={1.6}
            duration={14}
            color={["#0C81CF", "#9ad4fb", "#0C81CF"]}
          >
            <Card className="overflow-hidden rounded-[26px] bg-white/92 border-0 shadow-[0_25px_60px_rgba(15,23,42,0.14)]">
              <CardContent className="p-9 space-y-7 bg-gradient-to-b from-white to-[#fbfaf8]">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
              {/* Store Selection */}
              <motion.div
                className="space-y-3"
                variants={motionVariants.staggerItem}
                initial="hidden"
                animate="visible"
              >
                <Label
                  htmlFor="store_id"
                  className="text-xs font-semibold tracking-[0.2em] text-slate-500 flex items-center gap-2 uppercase"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0C81CF]" />
                  Tienda
                </Label>

                <Controller
                  name="store_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        setSelectedStoreId(value)
                        setSelectedCashierId('')
                      }}
                      disabled={loadingStores}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-12 text-base border transition-all duration-200 focus:ring-0 focus:ring-offset-0 bg-white/90 shadow-sm',
                          errors.store_id
                            ? 'border-destructive focus:border-destructive'
                            : 'border-slate-200/70 focus:border-[rgba(12,129,207,0.8)] hover:border-[rgba(12,129,207,0.4)]'
                        )}
                      >
                        <SelectValue placeholder="Selecciona tu tienda" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200/60">
                        {stores?.map((store) => {
                          const expired = store.license_expires_at
                            ? new Date(store.license_expires_at).getTime() < Date.now()
                            : false
                          const blocked = store.license_status === 'suspended' || expired
                          return (
                            <SelectItem key={store.id} value={store.id} disabled={blocked}>
                              {store.name}
                              {blocked && ' (licencia vencida)'}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />

                <AnimatePresence>
                  {errors.store_id && (
                    <motion.p
                      className="text-xs text-destructive font-medium"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      {errors.store_id.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Employee Selection */}
              <AnimatePresence mode="wait">
                {selectedStoreId && (
                  <motion.div
                    key="employees"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="space-y-3 overflow-hidden"
                  >
                    <Label className="text-xs font-semibold tracking-[0.2em] text-slate-500 flex items-center gap-2 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0C81CF]" />
                      Empleado
                    </Label>

                    {loadingCashiers ? (
                      <motion.div
                        className="flex items-center justify-center py-10 text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Loader2
                          className="w-5 h-5 animate-spin mr-3"
                          style={{ color: colors.brand.primary }}
                        />
                        <span className="text-sm font-medium">Cargando empleados...</span>
                      </motion.div>
                    ) : cashiers && cashiers.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {cashiers.map((cashier, index) => {
                          const isSelected = selectedCashierId === cashier.user_id
                          return (
                            <motion.button
                              key={cashier.user_id}
                              type="button"
                              onClick={() => setSelectedCashierId(cashier.user_id)}
                              className={cn(
                                'flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 w-full',
                                isSelected
                                  ? 'border-[rgba(12,129,207,0.6)] bg-[rgba(12,129,207,0.08)] shadow-[0_12px_30px_rgba(12,129,207,0.12)]'
                                  : 'border-slate-200/70 hover:border-[rgba(12,129,207,0.35)] hover:bg-white bg-white/90 shadow-sm'
                              )}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {/* Avatar */}
                              <div
                                className={cn(
                                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200 ring-1 ring-white/70',
                                  isSelected
                                    ? 'bg-[rgb(12,129,207)] text-white'
                                    : 'bg-slate-100 text-slate-600'
                                )}
                              >
                                {cashier.full_name?.charAt(0).toUpperCase() || 'U'}
                              </div>

                              <div className="flex-1 text-left">
                                <p
                                  className={cn(
                                    'text-sm font-semibold transition-colors duration-200',
                                    isSelected ? 'text-[rgb(12,129,207)]' : 'text-slate-900'
                                  )}
                                >
                                  {cashier.full_name || 'Sin nombre'}
                                </p>
                                <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                                  {cashier.role === 'owner' && (
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                  )}
                                  {cashier.role === 'owner' ? 'Propietario' : 'Cajero'}
                                </p>
                              </div>

                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500 }}
                                >
                                  <ChevronRight
                                    className="w-5 h-5"
                                    style={{ color: colors.brand.primary }}
                                  />
                                </motion.div>
                              )}
                            </motion.button>
                          )
                        })}
                      </div>
                    ) : (
                      <motion.p
                        className="text-sm text-muted-foreground text-center py-6 font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        No hay empleados disponibles
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* PIN Input */}
              <AnimatePresence mode="wait">
                {selectedCashierId && (
                  <motion.div
                    key="pin"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="space-y-3 overflow-hidden"
                  >
                    <Label
                      htmlFor="pin"
                      className="text-xs font-semibold tracking-[0.2em] text-slate-500 flex items-center gap-2 uppercase"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0C81CF]" />
                      PIN
                      {selectedCashierName && (
                        <span className="font-normal text-slate-500">
                          de {selectedCashierName}
                        </span>
                      )}
                    </Label>

                    <Input
                      type="password"
                      id="pin"
                      placeholder="••••"
                      maxLength={8}
                      className={cn(
                        'h-14 text-center text-2xl tracking-[0.5em] font-semibold border transition-all duration-200 bg-white/90 shadow-sm',
                        'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none',
                        errors.pin
                          ? 'border-destructive focus:border-destructive'
                          : 'border-slate-200/70 hover:border-[rgba(12,129,207,0.35)] focus:border-[rgba(12,129,207,0.8)]'
                      )}
                      {...register('pin')}
                      autoFocus
                    />

                    <AnimatePresence>
                      {errors.pin && (
                        <motion.p
                          className="text-xs text-destructive font-medium"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        >
                          {errors.pin.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  className={cn(
                    'w-full h-14 text-base font-semibold shadow-lg transition-all duration-300 relative overflow-hidden',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  style={{
                    background: colors.gradients.primary,
                    boxShadow: selectedCashierId ? colors.shadows.lg : 'none',
                  }}
                  disabled={mutation.isPending || !selectedCashierId}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Iniciando sesión...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Iniciar sesión
                    </span>
                  )}

                  {/* Shimmer effect */}
                  {!mutation.isPending && selectedCashierId && (
                    <motion.span
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: '200%' }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        repeatDelay: 2,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                </Button>
              </motion.div>
                </form>
              </CardContent>
            </Card>
          </ShineBorder>

          {/* Footer hint */}
          <motion.div
            className="text-center mt-10 space-y-2 text-[#5f6b7a]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-slate-500">
              <Link
                to="/forgot-pin"
                className="font-semibold hover:underline"
                style={{ color: colors.brand.primary }}
              >
                ¿Olvidaste tu PIN?
              </Link>
            </p>
            <p className="text-sm text-slate-500">
              ¿No tienes una cuenta?{' '}
              <Link
                to="/register"
                className="font-semibold hover:underline"
                style={{ color: colors.brand.primary }}
              >
                Regístrate aquí
              </Link>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-8"
          >
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#0C81CF] font-semibold">
              Velox POS · Operación elegante
            </p>
            <p className="text-xs text-slate-400 mt-2">
              © {new Date().getFullYear()} Velox POS. Todos los derechos reservados.
            </p>
          </motion.div>
        </div>
      </div>
  )
}
