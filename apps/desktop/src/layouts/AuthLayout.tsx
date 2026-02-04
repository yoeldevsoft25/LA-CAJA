import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FloatingParticles } from '@/components/aceternity'
import { colors } from '@/design-system'

interface AuthLayoutProps {
  children: ReactNode
  className?: string
  showParticles?: boolean
  showLogo?: boolean
  variant?: 'minimal' | 'full'
}

/**
 * AuthLayout - Layout para páginas de autenticación
 *
 * Incluye:
 * - Fondo con gradientes sutiles y partículas animadas
 * - Logo opcional con animación
 * - Diseño centrado responsive
 *
 * @example
 * <AuthLayout>
 *   <LoginForm />
 * </AuthLayout>
 *
 * @example
 * <AuthLayout variant="full" showLogo>
 *   <RegisterForm />
 * </AuthLayout>
 */
export function AuthLayout({
  children,
  className,
  showParticles = true,
  showLogo = true,
  variant = 'minimal',
}: AuthLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-white relative overflow-hidden', className)}>
      {/* Background gradients - Full coverage */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top gradient - covers upper half */}
        <div
          className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] opacity-20"
          style={{
            background: `radial-gradient(ellipse at top left, ${colors.brand.primaryMedium} 0%, transparent 50%)`,
          }}
        />

        {/* Bottom gradient - covers lower half */}
        <div
          className="absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] opacity-20"
          style={{
            background: `radial-gradient(ellipse at bottom right, ${colors.brand.primaryMedium} 0%, transparent 50%)`,
          }}
        />

        {/* Top-right subtle accent */}
        <div
          className="absolute -top-1/4 -right-1/4 w-[60%] h-[60%] opacity-10"
          style={{
            background: `radial-gradient(ellipse at top right, ${colors.brand.primaryLight} 0%, transparent 60%)`,
          }}
        />

        {/* Bottom-left subtle accent */}
        <div
          className="absolute -bottom-1/4 -left-1/4 w-[60%] h-[60%] opacity-10"
          style={{
            background: `radial-gradient(ellipse at bottom left, ${colors.brand.primaryLight} 0%, transparent 60%)`,
          }}
        />
      </div>

      {/* Floating particles */}
      {showParticles && (
        <FloatingParticles
          count={40}
          color={colors.brand.primarySoft}
          minSize={2}
          maxSize={4}
        />
      )}

      {/* Content container */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Logo section */}
        {showLogo && variant === 'full' && (
          <motion.div
            className="mb-8 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.div
              className="inline-flex items-center justify-center mb-4"
              initial={{ scale: 0.9, rotateY: -180 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{
                delay: 0.2,
                type: 'spring',
                stiffness: 200,
              }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="relative">
                {/* Glow effect */}
                <div
                  className="absolute inset-0 blur-2xl opacity-40 rounded-full"
                  style={{
                    background: colors.brand.primary,
                    transform: 'scale(1.5)',
                  }}
                />
                <img
                  src="/logo-velox.svg"
                  alt="Velox POS Logo"
                  className="relative w-20 h-20 rounded-2xl border-2 border-slate-200/50 shadow-xl object-contain p-2"
                />
              </div>
            </motion.div>

            <motion.h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: colors.brand.primary }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Velox POS
            </motion.h1>

            <motion.p
              className="text-sm text-slate-500 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Sistema de Punto de Venta
            </motion.p>
          </motion.div>
        )}

        {/* Main content */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: variant === 'full' ? 0.3 : 0.1 }}
        >
          {children}
        </motion.div>

        {/* Footer */}
        <motion.footer
          className="mt-8 text-center text-xs text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p>&copy; {new Date().getFullYear()} Velox POS. Todos los derechos reservados.</p>
        </motion.footer>
      </div>
    </div>
  )
}

export default AuthLayout
