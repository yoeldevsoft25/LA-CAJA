import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/stores/auth.store'
import { authService, type LoginResponse } from '@/services/auth.service'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchAllData } from '@/services/prefetch.service'
import { syncService } from '@/services/sync.service'
import { setupService } from '@/services/setup.service'
import { getDefaultRoute } from '@/lib/permissions'
import { Loader2, Lock, ChevronRight, Store, User, KeyRound, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AuthLayout } from '@/layouts'
import { GlassCard } from '@/components/animated'
import { colors, motionVariants } from '@/design-system'

// ============================================================================
// Schema & Types
// ============================================================================

const loginSchema = z.object({
  store_id: z.string().min(1, 'Selecciona una tienda'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 dígitos').max(6, 'El PIN debe tener máximo 6 dígitos'),
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
    <AuthLayout showParticles showLogo={false}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              {/* Glow ring - sin animación flotante */}
              <div
                className="absolute -inset-3 rounded-3xl opacity-60"
                style={{
                  background: `radial-gradient(circle, ${colors.brand.primaryLight} 0%, transparent 70%)`,
                }}
              />
              <img
                src="/favicon.svg"
                alt="LA CAJA Logo"
                className="relative w-20 h-20 rounded-2xl shadow-xl"
                style={{
                  boxShadow: colors.shadows.lg,
                }}
              />
            </div>
          </div>

          <motion.h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ color: colors.brand.primary }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Bienvenido
          </motion.h1>

          <motion.p
            className="text-slate-500 text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Inicia sesión en tu punto de venta
          </motion.p>
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
                    : 'bg-slate-100 text-slate-400'
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
        <GlassCard
          className="overflow-hidden"
          hoverScale={1}
          delay={0.2}
        >
          {/* Top accent line */}
          <div
            className="h-1"
            style={{
              background: `linear-gradient(to right, ${colors.brand.primary}, ${colors.brand.primarySoft}, ${colors.brand.primary})`,
            }}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {/* Store Selection */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="store_id"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
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
                        'h-12 text-base border-2 transition-all duration-200 focus:ring-0 focus:ring-offset-0',
                        errors.store_id
                          ? 'border-destructive focus:border-destructive'
                          : 'border-slate-200 focus:border-[rgb(13,129,206)] hover:border-[rgba(13,129,206,0.5)]'
                      )}
                    >
                      <SelectValue placeholder="Selecciona tu tienda" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: colors.brand.primary }}
                    />
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
                              'flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                              isSelected
                                ? 'border-[rgb(13,129,206)] bg-[rgba(13,129,206,0.05)] shadow-md'
                                : 'border-slate-200 hover:border-[rgba(13,129,206,0.5)] hover:bg-slate-50/50'
                            )}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {/* Avatar */}
                            <div
                              className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200',
                                isSelected
                                  ? 'bg-[rgb(13,129,206)] text-white'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {cashier.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>

                            <div className="flex-1 text-left">
                              <p
                                className={cn(
                                  'text-sm font-semibold transition-colors duration-200',
                                  isSelected ? 'text-[rgb(13,129,206)]' : 'text-slate-900'
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
                    className="text-sm font-semibold text-slate-700 flex items-center gap-2"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: colors.brand.primary }}
                    />
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
                    maxLength={6}
                    className={cn(
                      'h-14 text-center text-2xl tracking-[0.5em] font-semibold border-2 transition-all duration-200',
                      'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none',
                      'focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 ring-offset-0',
                      errors.pin
                        ? 'border-destructive focus:border-destructive'
                        : 'border-slate-200 hover:border-[rgba(13,129,206,0.5)] focus:border-[rgb(13,129,206)]'
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
        </GlassCard>

        {/* Footer hint */}
        <motion.div
          className="text-center mt-6 space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-xs text-slate-400">
            ¿Problemas para acceder? Contacta al administrador.
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
      </motion.div>
    </AuthLayout>
  )
}
