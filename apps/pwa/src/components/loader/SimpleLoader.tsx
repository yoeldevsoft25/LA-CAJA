import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useMemo } from 'react'
import { colors } from '@/design-system'
import { cn } from '@/lib/utils'

interface SimpleLoaderProps {
  onComplete?: () => void
  duration?: number
  userName?: string | null
  className?: string
}

/**
 * Loader profesional con transición elegante
 * Incluye partículas flotantes, progreso animado y saludo personalizado
 */
export default function SimpleLoader({
  onComplete,
  duration = 3500,
  userName,
  className,
}: SimpleLoaderProps) {
  const getFirstName = (fullName: string | null | undefined): string => {
    if (!fullName) return ''
    return fullName.split(' ')[0] || ''
  }

  const firstName = getFirstName(userName)
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'welcome'>('loading')

  // Partículas memorizadas
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 4 + Math.random() * 4,
      delay: Math.random() * 2,
    }))
  }, [])

  // Puntos orbitales para el círculo de progreso
  const orbitalDots = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i * 360) / 8,
      delay: i * 0.1,
    }))
  }, [])

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const currentProgress = Math.min((elapsed / duration) * 100, 100)
      setProgress(currentProgress)

      if (currentProgress >= 100) {
        clearInterval(interval)
        setPhase('welcome')
        setTimeout(() => {
          setIsComplete(true)
          onComplete?.()
        }, 3500)
      }
    }, 16)

    return () => clearInterval(interval)
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className={cn("fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden", className)}
          style={{
            background: 'linear-gradient(135deg, #fafbfc 0%, #f0f4f8 100%)',
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Partículas flotantes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  backgroundColor: colors.brand.primarySoft,
                }}
                animate={{
                  y: [0, -30, 0],
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: particle.delay,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* Gradientes de fondo */}
          <motion.div
            className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] opacity-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse, ${colors.brand.primaryLight} 0%, transparent 60%)`,
            }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1.5 }}
          />
          <motion.div
            className="absolute -bottom-1/4 -right-1/4 w-[60%] h-[60%] opacity-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse, ${colors.brand.primaryLight} 0%, transparent 60%)`,
            }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />

          {/* Contenido central */}
          <div className="relative z-10 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {phase === 'loading' ? (
                <motion.div
                  key="loading"
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30, scale: 0.9 }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                >
                  {/* Logo con anillo de progreso */}
                  <div className="relative mb-10 w-20 h-20 flex items-center justify-center">
                    {/* Anillo de progreso exterior */}
                    <svg
                      className="absolute -inset-3"
                      width="104"
                      height="104"
                      viewBox="0 0 104 104"
                    >
                      {/* Track */}
                      <circle
                        cx="52"
                        cy="52"
                        r="48"
                        fill="none"
                        stroke={colors.brand.primaryLight}
                        strokeWidth="2"
                      />
                      {/* Progress */}
                      <motion.circle
                        cx="52"
                        cy="52"
                        r="48"
                        fill="none"
                        stroke={colors.brand.primary}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 * (1 - progress / 100)}
                        style={{
                          transform: 'rotate(-90deg)',
                          transformOrigin: 'center',
                        }}
                        transition={{ duration: 0.1 }}
                      />
                    </svg>

                    {/* Puntos orbitales */}
                    {orbitalDots.map((dot) => (
                      <motion.div
                        key={dot.id}
                        className="absolute w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: colors.brand.primary,
                          top: '50%',
                          left: '50%',
                          marginTop: -3,
                          marginLeft: -3,
                        }}
                        animate={{
                          x: Math.cos((dot.angle * Math.PI) / 180 + (progress / 100) * Math.PI * 2) * 44,
                          y: Math.sin((dot.angle * Math.PI) / 180 + (progress / 100) * Math.PI * 2) * 44,
                          opacity: progress > dot.id * 12.5 ? [0.3, 1, 0.3] : 0.1,
                          scale: progress > dot.id * 12.5 ? [0.8, 1.2, 0.8] : 0.5,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: dot.delay,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}

                    {/* Glow pulsante */}
                    <motion.div
                      className="absolute inset-0 blur-xl rounded-full"
                      style={{
                        background: `radial-gradient(circle, rgba(13, 129, 206, 0.4) 0%, rgba(13, 129, 206, 0.2) 50%, transparent 80%)`,
                      }}
                      animate={{
                        opacity: [0.3, 0.5, 0.3],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />

                    {/* Logo container - sin fondo para integrar con el círculo */}
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-full overflow-hidden bg-white">
                      <img
                        src="/logo-velox.svg"
                        alt="Velox POS"
                        className="w-full h-full object-contain drop-shadow-lg"
                      />
                    </div>
                  </div>

                  {/* Nombre de la app */}
                  <motion.h2
                    className="text-xl font-bold tracking-wide mb-6"
                    style={{ color: colors.brand.primary }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Velox POS
                  </motion.h2>

                  {/* Texto de carga */}
                  <div className="flex flex-col items-center justify-center gap-4 w-full">
                    <motion.div
                      className="flex items-center justify-center gap-2 text-sm text-slate-500 w-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <span className="font-medium">Preparando tu espacio</span>
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        ...
                      </motion.span>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="welcome"
                  className="flex flex-col items-center text-center px-8"
                  initial={{ opacity: 0, scale: 0.8, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.34, 1.56, 0.64, 1], // Bounce out
                  }}
                >
                  {/* Checkmark animado con burst effect */}
                  <motion.div className="relative mb-8">
                    {/* Burst particles */}
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: colors.brand.primary,
                          top: '50%',
                          left: '50%',
                        }}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                        animate={{
                          scale: [0, 1, 0],
                          x: Math.cos((i * 45 * Math.PI) / 180) * 60,
                          y: Math.sin((i * 45 * Math.PI) / 180) * 60,
                          opacity: [1, 1, 0],
                        }}
                        transition={{
                          duration: 0.8,
                          delay: 0.2,
                          ease: 'easeOut',
                        }}
                      />
                    ))}

                    {/* Circle background */}
                    <motion.div
                      className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: colors.brand.primaryLight }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      {/* Checkmark SVG */}
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <motion.path
                          d="M5 13l4 4L19 7"
                          stroke={colors.brand.primary}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.4, delay: 0.3 }}
                        />
                      </svg>
                    </motion.div>
                  </motion.div>

                  {/* Saludo personalizado */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <h1
                      className="text-4xl font-bold mb-3"
                      style={{ color: colors.brand.primary }}
                    >
                      {firstName && firstName.toLowerCase().endsWith('a') ? 'Bienvenida' : 'Bienvenido'}
                    </h1>
                    {firstName && (
                      <motion.p
                        className="text-3xl font-semibold text-slate-700"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                      >
                        {firstName}
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Subtitle */}
                  <motion.p
                    className="mt-4 text-slate-500 text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                  >
                    Tu punto de venta está listo
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
