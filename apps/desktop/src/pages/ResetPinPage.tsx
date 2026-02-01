import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { motion, AnimatePresence } from 'framer-motion'
import { authService } from '@/services/auth.service'
import { Loader2, Lock, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/layouts'
import { colors } from '@/design-system'
import { cn } from '@/lib/utils'

const resetPinSchema = z.object({
  new_pin: z
    .string()
    .min(6, 'El PIN debe tener al menos 6 caracteres')
    .max(8, 'El PIN debe tener máximo 8 caracteres')
    .regex(/^[a-zA-Z0-9]+$/, 'El PIN solo puede contener letras y números'),
  confirm_pin: z.string(),
}).refine((data) => data.new_pin === data.confirm_pin, {
  message: 'Los PINs no coinciden',
  path: ['confirm_pin'],
})

type ResetPinForm = z.infer<typeof resetPinSchema>

export default function ResetPinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPinForm>({
    resolver: zodResolver(resetPinSchema),
    defaultValues: {
      new_pin: '',
      confirm_pin: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ResetPinForm) => {
      if (!token) {
        throw new Error('Token no válido')
      }
      return authService.resetPin(token, data.new_pin)
    },
    onSuccess: () => {
      setSuccess(true)
      toast.success('PIN restablecido exitosamente')
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al restablecer PIN'
      toast.error(message)
    },
  })

  const onSubmit = (data: ResetPinForm) => {
    mutation.mutate(data)
  }

  useEffect(() => {
    if (!token) {
      toast.error('Token de recuperación no válido')
      navigate('/forgot-pin')
    }
  }, [token, navigate])

  if (success) {
    return (
      <AuthLayout showParticles showLogo={false}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.brand.primary }}>
            PIN Restablecido
          </h1>
          <p className="text-slate-500 mb-6">
            Tu PIN ha sido restablecido exitosamente. Serás redirigido al login en unos segundos.
          </p>

          <Button
            onClick={() => navigate('/login')}
            className="w-full"
            style={{
              background: colors.gradients.primary,
            }}
          >
            Ir a Iniciar Sesión
          </Button>
        </motion.div>
      </AuthLayout>
    )
  }

  if (!token) {
    return (
      <AuthLayout showParticles showLogo={false}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.brand.primary }}>
            Token Inválido
          </h1>
          <p className="text-slate-500 mb-6">
            El enlace de recuperación no es válido o ha expirado.
          </p>

          <Button
            onClick={() => navigate('/forgot-pin')}
            className="w-full"
            style={{
              background: colors.gradients.primary,
            }}
          >
            Solicitar Nuevo Enlace
          </Button>
        </motion.div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout showParticles showLogo={false}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ color: colors.brand.primary }}>
            Restablecer PIN
          </h1>
          <p className="text-slate-500 text-base">
            Ingresa tu nuevo PIN de acceso
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* New PIN */}
            <div className="space-y-3">
              <Label
                htmlFor="new_pin"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Nuevo PIN
              </Label>

              <Input
                id="new_pin"
                type="password"
                placeholder="••••"
                maxLength={8}
                className={cn(
                  'h-14 text-center text-2xl tracking-[0.5em] font-semibold border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                  errors.new_pin
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)]'
                )}
                {...register('new_pin')}
              />

              <AnimatePresence>
                {errors.new_pin && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.new_pin.message}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="text-xs text-muted-foreground">
                El PIN debe tener entre 6 y 8 caracteres (letras y números)
              </p>
            </div>

            {/* Confirm PIN */}
            <div className="space-y-3">
              <Label
                htmlFor="confirm_pin"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Confirmar PIN
              </Label>

              <Input
                id="confirm_pin"
                type="password"
                placeholder="••••"
                maxLength={8}
                className={cn(
                  'h-14 text-center text-2xl tracking-[0.5em] font-semibold border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                  errors.confirm_pin
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)]'
                )}
                {...register('confirm_pin')}
              />

              <AnimatePresence>
                {errors.confirm_pin && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.confirm_pin.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-12"
              style={{
                background: colors.gradients.primary,
              }}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Restableciendo...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Restablecer PIN
                </>
              )}
            </Button>
          </form>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Iniciar Sesión
            </Link>
          </div>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
