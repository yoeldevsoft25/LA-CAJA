import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { motion } from 'framer-motion'
import { authService } from '@/services/auth.service'
import { CheckCircle2, XCircle, Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/layouts'
import { colors } from '@/design-system'
import { useAuth } from '@/stores/auth.store'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const token = searchParams.get('token')
  const [verified, setVerified] = useState<boolean | null>(null)

  const verifyMutation = useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
    onSuccess: () => {
      setVerified(true)
      toast.success('Email verificado exitosamente')
    },
    onError: (error: any) => {
      setVerified(false)
      const message = error.response?.data?.message || error.message || 'Error al verificar email'
      toast.error(message)
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => authService.resendVerificationEmail(),
    onSuccess: () => {
      toast.success('Email de verificación reenviado')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al reenviar email'
      toast.error(message)
    },
  })

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token)
    } else {
      setVerified(false)
    }
  }, [token])

  if (verified === null || verifyMutation.isPending) {
    return (
      <AuthLayout showParticles showLogo={false}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto text-center"
        >
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4" style={{ color: colors.brand.primary }} />
          <h1 className="text-2xl font-bold mb-2">Verificando email...</h1>
          <p className="text-slate-500">Por favor espera</p>
        </motion.div>
      </AuthLayout>
    )
  }

  if (verified) {
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
            Email Verificado
          </h1>
          <p className="text-slate-500 mb-6">
            Tu email ha sido verificado exitosamente. Ya puedes usar todas las funcionalidades de LA-CAJA.
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
          Error al Verificar
        </h1>
        <p className="text-slate-500 mb-6">
          El enlace de verificación es inválido o ha expirado. Por favor solicita un nuevo enlace.
        </p>

        <div className="space-y-3">
          {user && (
            <Button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              className="w-full"
              style={{
                background: colors.gradients.primary,
              }}
            >
              {resendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Reenviar Email de Verificación
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => navigate('/login')}
            variant="outline"
            className="w-full"
          >
            Ir a Iniciar Sesión
          </Button>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
