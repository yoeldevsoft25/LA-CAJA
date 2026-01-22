import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { motion } from 'framer-motion'
import { authService } from '@/services/auth.service'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/layouts'
import { colors } from '@/design-system'
import { cn } from '@/lib/utils'
import { AnimatePresence } from 'framer-motion'

const forgotPinSchema = z.object({
  store_id: z.string().min(1, 'Debes seleccionar una tienda'),
  email: z.string().email('El email debe ser válido'),
})

type ForgotPinForm = z.infer<typeof forgotPinSchema>

export default function ForgotPinPage() {
  const navigate = useNavigate()
  const [emailSent, setEmailSent] = useState(false)

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: authService.getStores,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPinForm>({
    resolver: zodResolver(forgotPinSchema),
    defaultValues: {
      store_id: '',
      email: '',
    },
  })

  const selectedStoreId = watch('store_id')

  const mutation = useMutation({
    mutationFn: (data: ForgotPinForm) =>
      authService.forgotPin(data.email, data.store_id),
    onSuccess: () => {
      setEmailSent(true)
      toast.success('Si el email existe, recibirás un enlace para recuperar tu PIN')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al solicitar recuperación'
      toast.error(message)
    },
  })

  const onSubmit = (data: ForgotPinForm) => {
    mutation.mutate(data)
  }

  if (emailSent) {
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
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center mx-auto">
              <Mail className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.brand.primary }}>
            Email Enviado
          </h1>
          <p className="text-slate-500 mb-6">
            Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu PIN.
            Revisa tu bandeja de entrada y carpeta de spam.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/login')}
              className="w-full"
              style={{
                background: colors.gradients.primary,
              }}
            >
              Volver a Iniciar Sesión
            </Button>
            <Button
              onClick={() => setEmailSent(false)}
              variant="outline"
              className="w-full"
            >
              Intentar con Otro Email
            </Button>
          </div>
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
            Recuperar PIN
          </h1>
          <p className="text-slate-500 text-base">
            Ingresa tu email y tienda para recibir un enlace de recuperación
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Store Selection */}
            <div className="space-y-3">
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

              <select
                id="store_id"
                {...register('store_id')}
                className={cn(
                  'w-full h-12 px-4 text-base border-2 rounded-lg transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                  errors.store_id
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)]'
                )}
              >
                <option value="">Selecciona una tienda</option>
                {stores?.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>

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
            </div>

            {/* Email */}
            <div className="space-y-3">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700 flex items-center gap-2"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.brand.primary }}
                />
                Email
              </Label>

              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                className={cn(
                  'h-12 text-base border-2 transition-all duration-200',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                  errors.email
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200 focus:border-[rgb(13,129,206)]'
                )}
                {...register('email')}
              />

              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    className="text-xs text-destructive font-medium"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={mutation.isPending || !selectedStoreId}
              className="w-full h-12"
              style={{
                background: colors.gradients.primary,
              }}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Enviar Enlace de Recuperación
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
