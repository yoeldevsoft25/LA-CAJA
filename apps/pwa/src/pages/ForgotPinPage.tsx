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
import { Card, CardContent } from '@/components/ui/card'
import ShineBorder from '@/components/magicui/shine-border'
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
      <div className="min-h-screen w-full flex items-start sm:items-center justify-center bg-[#fbfaf8] relative overflow-x-hidden overflow-y-auto px-6 py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#d9ecfb] blur-3xl" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#e1f2ff] blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(12,129,207,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(12,129,207,0.14),transparent_40%)]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto text-center relative z-10"
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-white/70">
            <img src="/logo-velox.svg" alt="Velox POS" className="h-7 w-7" />
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

                <h1 className="text-3xl font-heading font-semibold mb-2 text-slate-900">
                  Email Enviado
                </h1>
                <p className="text-slate-500 mb-6 text-sm">
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
              </CardContent>
            </Card>
          </ShineBorder>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-start sm:items-center justify-center bg-[#fbfaf8] relative overflow-x-hidden overflow-y-auto px-6 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#d9ecfb] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#e1f2ff] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(12,129,207,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(12,129,207,0.14),transparent_40%)]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto relative z-10"
      >
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-white/70">
            <img src="/logo-velox.svg" alt="Velox POS" className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-heading font-semibold tracking-tight text-slate-900">
            Recuperar PIN
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Ingresa tu email y tienda para recibir un enlace de recuperación.
          </p>
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
            {/* Store Selection */}
            <div className="space-y-3">
              <Label
                htmlFor="store_id"
                className="text-xs font-semibold tracking-[0.2em] text-slate-500 flex items-center gap-2 uppercase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#0C81CF]" />
                Tienda
              </Label>

              <select
                id="store_id"
                {...register('store_id')}
                className={cn(
                  'w-full h-12 px-4 text-base border rounded-lg transition-all duration-200 bg-white/90 shadow-sm',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                  errors.store_id
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200/70 focus:border-[rgba(12,129,207,0.8)]'
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
                className="text-xs font-semibold tracking-[0.2em] text-slate-500 flex items-center gap-2 uppercase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#0C81CF]" />
                Email
              </Label>

              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                className={cn(
                  'h-12 text-base border transition-all duration-200 bg-white/90 shadow-sm',
                  'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                  errors.email
                    ? 'border-destructive focus:border-destructive'
                    : 'border-slate-200/70 focus:border-[rgba(12,129,207,0.8)]'
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
            </CardContent>
          </Card>
        </ShineBorder>
      </motion.div>
    </div>
  )
}
