import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { motion, AnimatePresence } from 'framer-motion'
import { authService, type RegisterResponse } from '@/services/auth.service'
import { useAuth } from '@/stores/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchAllData } from '@/services/prefetch.service'
import { syncService } from '@/services/sync.service'
import { getDefaultRoute } from '@/lib/permissions'
import { Loader2, Store, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import ShineBorder from '@/components/magicui/shine-border'
import { colors, motionVariants } from '@/design-system'
import { LicenseInfoCard } from '@/components/auth/LicenseInfoCard'

// ============================================================================
// Schema & Types
// ============================================================================

const registerSchema = z.object({
  store_name: z.string().min(2, 'El nombre de la tienda debe tener al menos 2 caracteres'),
  owner_name: z.string().min(2, 'El nombre del dueño debe tener al menos 2 caracteres'),
  owner_email: z.string().email('El email debe ser válido'),
  owner_pin: z
    .string()
    .min(6, 'El PIN del administrador debe tener al menos 6 caracteres')
    .max(8, 'El PIN del administrador debe tener máximo 8 caracteres')
    .regex(/^[a-zA-Z0-9]+$/, 'El PIN solo puede contener letras y números'),
  cashier_name: z.string().min(2, 'El nombre del cajero debe tener al menos 2 caracteres'),
  cashier_pin: z
    .string()
    .min(6, 'El PIN del cajero debe tener al menos 6 caracteres')
    .max(8, 'El PIN del cajero debe tener máximo 8 caracteres')
    .regex(/^[a-zA-Z0-9]+$/, 'El PIN solo puede contener letras y números'),
})

type RegisterForm = z.infer<typeof registerSchema>

// ============================================================================
// Component
// ============================================================================

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const queryClient = useQueryClient()
  const [registrationSuccess, setRegistrationSuccess] = useState<RegisterResponse | null>(null)
  const [cashierPin, setCashierPin] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      store_name: '',
      owner_name: '',
      owner_email: '',
      owner_pin: '',
      cashier_name: '',
      cashier_pin: '',
    },
  })

  // Register mutation
  const mutation = useMutation({
    mutationFn: (data: RegisterForm) => {
      // Guardar el PIN para usar en auto-login
      setCashierPin(data.cashier_pin)
      return authService.register({
        store_name: data.store_name,
        owner_name: data.owner_name,
        owner_email: data.owner_email,
        owner_pin: data.owner_pin,
        cashier_name: data.cashier_name,
        cashier_pin: data.cashier_pin,
      })
    },
    onSuccess: (response: RegisterResponse) => {
      console.log('[Register] Registro exitoso', response)
      setRegistrationSuccess(response)
      toast.success('¡Registro exitoso! Tu tienda ha sido creada.')
    },
    onError: (error: any) => {
      console.error('[Register] Error en registro:', error)

      const errorMessage = error.response?.data?.message

      if (Array.isArray(errorMessage)) {
        // Si es un array (errores de validación), mostrar cada uno
        errorMessage.forEach(msg => toast.error(msg))
      } else {
        // Mensaje único
        toast.error(errorMessage || error.message || 'Error al registrar')
      }
    },
  })

  const onSubmit = async (data: RegisterForm) => {
    mutation.mutate(data)
  }

  const handleGoToLogin = () => {
    navigate('/login')
  }

  const handleAutoLogin = async () => {
    if (!registrationSuccess || !cashierPin) {
      navigate('/login')
      return
    }

    try {
      // Intentar login automático con el store_id y PIN del cajero
      const loginResponse = await authService.login({
        store_id: registrationSuccess.store_id,
        pin: cashierPin,
      })

      // Guardar en el store de autenticación
      login(loginResponse.access_token, loginResponse.refresh_token, {
        user_id: loginResponse.user_id,
        store_id: loginResponse.store_id,
        role: loginResponse.role,
        full_name: loginResponse.full_name,
        license_status: loginResponse.license_status,
        license_expires_at: loginResponse.license_expires_at || null,
      })

      try {
        await syncService.ensureInitialized(loginResponse.store_id)
        console.log('[Register] SyncService inicializado')
      } catch (error) {
        console.warn('[Register] Error al inicializar SyncService:', error)
      }

      try {
        await prefetchAllData({
          storeId: loginResponse.store_id,
          queryClient,
          userRole: loginResponse.role,
        })
        console.log('[Register] Prefetch completo')
      } catch (error) {
        console.warn('[Register] Error al prefetch:', error)
      }

      toast.success('¡Bienvenido! Sesión iniciada automáticamente.')
      navigate(getDefaultRoute(loginResponse.role))
    } catch (error: any) {
      console.error('[Register] Error en auto-login:', error)
      toast.error('Registro exitoso, pero no se pudo iniciar sesión automáticamente')
      navigate('/login')
    }
  }

  // Si el registro fue exitoso, mostrar información de licencia
  if (registrationSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fbfaf8] relative overflow-hidden px-6 py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#d9ecfb] blur-3xl" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#e1f2ff] blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(12,129,207,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(12,129,207,0.14),transparent_40%)]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl mx-auto relative z-10"
        >
          {/* Success Header */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              <div className="relative">
                <motion.div
                  className="absolute -inset-3 rounded-full opacity-60"
                  style={{
                    background: `radial-gradient(circle, ${colors.brand.primaryLight} 0%, transparent 70%)`,
                  }}
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.4, 0.6, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <div className="relative w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.h1
              className="text-4xl font-bold tracking-tight mb-2"
              style={{ color: colors.brand.primary }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              ¡Registro Exitoso!
            </motion.h1>

            <motion.p
              className="text-slate-500 text-base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Tu tienda <strong>{registrationSuccess.store_name}</strong> ha sido creada correctamente
            </motion.p>
          </div>

          <ShineBorder
            className="w-full bg-transparent mb-6"
            borderRadius={24}
            borderWidth={1.5}
            duration={14}
            color={["#0C81CF", "#9ad4fb", "#0C81CF"]}
          >
            <Card className="overflow-hidden rounded-[22px] bg-white/92 border-0 shadow-[0_25px_60px_rgba(15,23,42,0.14)]">
              <CardContent className="p-6 space-y-6 bg-gradient-to-b from-white to-[#fbfaf8]">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <LicenseInfoCard
                    license_plan={registrationSuccess.license_plan}
                    license_status={registrationSuccess.license_status}
                    license_expires_at={registrationSuccess.license_expires_at}
                    license_grace_days={registrationSuccess.license_grace_days}
                    trial_days_remaining={registrationSuccess.trial_days_remaining}
                  />
                </motion.div>

                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">
                    ID de tu Tienda
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-800 flex-1">
                      {registrationSuccess.store_id}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(registrationSuccess.store_id)
                        toast.success('ID copiado al portapapeles')
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Guarda este ID, lo necesitarás para iniciar sesión
                  </p>
                </div>
              </CardContent>
            </Card>
          </ShineBorder>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={handleAutoLogin}
              className="flex-1 h-12 text-base font-semibold"
              style={{
                background: colors.gradients.primary,
                boxShadow: colors.shadows.lg,
              }}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Iniciar Sesión Automáticamente
            </Button>
            <Button
              onClick={handleGoToLogin}
              variant="outline"
              className="flex-1 h-12 text-base font-semibold"
            >
              Ir a Iniciar Sesión
            </Button>
          </motion.div>

          <motion.p
            className="text-center text-xs text-slate-400 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Usa el ID de tienda y el PIN del administrador o del cajero para iniciar sesión
          </motion.p>
        </motion.div>
      </div>
    )
  }

  // Formulario de registro
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fbfaf8] relative overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#d9ecfb] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#e1f2ff] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(12,129,207,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(12,129,207,0.14),transparent_40%)]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            className="inline-flex items-center justify-center mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          >
            <div className="relative">
              <motion.div
                className="absolute -inset-3 rounded-3xl opacity-60"
                style={{
                  background: `radial-gradient(circle, ${colors.brand.primaryLight} 0%, transparent 70%)`,
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <img
                src="/favicon.svg"
                alt="Velox POS Logo"
                className="relative w-20 h-20 rounded-2xl shadow-xl"
                style={{
                  boxShadow: colors.shadows.lg,
                }}
              />
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ color: colors.brand.primary }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Crear Cuenta
          </motion.h1>

          <motion.p
            className="text-slate-500 text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Regístrate y obtén 14 días de prueba gratuita
          </motion.p>
        </div>

        <ShineBorder
          className="w-full bg-transparent"
          borderRadius={24}
          borderWidth={1.5}
          duration={14}
          color={["#0C81CF", "#9ad4fb", "#0C81CF"]}
        >
          <Card className="overflow-hidden rounded-[22px] bg-white/92 border-0 shadow-[0_25px_60px_rgba(15,23,42,0.14)]">
            <CardContent className="p-8 space-y-6 bg-gradient-to-b from-white to-[#fbfaf8]">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Store Name */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="store_name"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Nombre de la Tienda
              </Label>

              <Input
                id="store_name"
                type="text"
                placeholder="Ej: Mi Tienda"
                className={cn(
                  'h-12 text-base border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                  errors.store_name
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)] hover:border-[rgba(13,129,206,0.5)]'
                )}
                {...register('store_name')}
                autoFocus
              />

              <AnimatePresence>
                {errors.store_name && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.store_name.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Owner Name */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="owner_name"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Nombre del Dueño
              </Label>

              <Input
                id="owner_name"
                type="text"
                placeholder="Ej: Juan Pérez"
                className={cn(
                  'h-12 text-base border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                  errors.owner_name
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)] hover:border-[rgba(13,129,206,0.5)]'
                )}
                {...register('owner_name')}
              />

              <AnimatePresence>
                {errors.owner_name && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.owner_name.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Owner Email */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="owner_email"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Email del Dueño
              </Label>

              <Input
                id="owner_email"
                type="email"
                placeholder="Ej: juan@example.com"
                className={cn(
                  'h-12 text-base border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                  errors.owner_email
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)] hover:border-[rgba(13,129,206,0.5)]'
                )}
                {...register('owner_email')}
              />

              <AnimatePresence>
                {errors.owner_email && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.owner_email.message}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="text-xs text-muted-foreground">
                Te enviaremos un email de verificación a esta dirección
              </p>
            </motion.div>

            {/* Owner PIN */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="owner_pin"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                PIN del Administrador
              </Label>

              <Input
                id="owner_pin"
                type="password"
                placeholder="••••"
                maxLength={8}
                className={cn(
                  'h-14 text-center text-2xl tracking-[0.5em] font-semibold border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                  errors.owner_pin
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 hover:border-[rgba(13,129,206,0.5)] focus:border-[rgb(13,129,206)]'
                )}
                {...register('owner_pin')}
              />

              <AnimatePresence>
                {errors.owner_pin && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.owner_pin.message}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="text-xs text-muted-foreground">
                El PIN del administrador debe tener entre 6 y 8 caracteres (letras y números)
              </p>
            </motion.div>

            {/* Cashier Name */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="cashier_name"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Nombre del Cajero
              </Label>

              <Input
                id="cashier_name"
                type="text"
                placeholder="Ej: María González"
                className={cn(
                  'h-12 text-base border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                  errors.cashier_name
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)] hover:border-[rgba(13,129,206,0.5)]'
                )}
                {...register('cashier_name')}
              />

              <AnimatePresence>
                {errors.cashier_name && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.cashier_name.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Cashier PIN */}
            <motion.div
              className="space-y-3"
              variants={motionVariants.staggerItem}
              initial="hidden"
              animate="visible"
            >
              <Label
                htmlFor="cashier_pin"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                PIN del Cajero
              </Label>

              <Input
                id="cashier_pin"
                type="password"
                placeholder="••••"
                maxLength={8}
                className={cn(
                  'h-14 text-center text-2xl tracking-[0.5em] font-semibold border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                  errors.cashier_pin
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 hover:border-[rgba(13,129,206,0.5)] focus:border-[rgb(13,129,206)]'
                )}
                {...register('cashier_pin')}
              />

              <AnimatePresence>
                {errors.cashier_pin && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.cashier_pin.message}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="text-xs text-muted-foreground">
                El PIN debe tener entre 6 y 8 caracteres (letras y números)
              </p>
            </motion.div>

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
                  boxShadow: colors.shadows.lg,
                }}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creando cuenta...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Crear Cuenta
                  </span>
                )}

                {/* Shimmer effect */}
                {!mutation.isPending && (
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

        {/* Footer with login link */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-sm text-slate-500">
            ¿Ya tienes una cuenta?{' '}
            <Link
              to="/login"
              className="font-semibold hover:underline"
              style={{ color: colors.brand.primary }}
            >
              Inicia sesión
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
