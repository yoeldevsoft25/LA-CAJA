import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useMemo } from 'react'

interface SimpleLoaderProps {
  onComplete?: () => void
  duration?: number
  userName?: string | null
}

/**
 * Loader minimalista y elegante con partículas flotantes
 * Diseño limpio inspirado en Apple/Linear
 */
export default function SimpleLoader({
  onComplete,
  duration = 3500,
  userName,
}: SimpleLoaderProps) {
  const getFirstName = (fullName: string | null | undefined): string => {
    if (!fullName) return ''
    return fullName.split(' ')[0] || ''
  }

  const firstName = getFirstName(userName)
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'welcome'>('loading')

  // Partículas elegantes y sutiles
  const particles = useMemo(() => {
    const count = 60 // Menos partículas, más elegante
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      // Posición inicial dispersa
      startX: Math.random() * 100,
      startY: Math.random() * 100,
      // Tamaño variado pero sutil
      size: Math.random() * 4 + 2,
      // Opacidad base
      opacity: Math.random() * 0.4 + 0.1,
      // Velocidad de movimiento
      speed: Math.random() * 20 + 10,
      // Delay para escalonar
      delay: Math.random() * 0.5,
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
        }, 1500)
      }
    }, 16)

    return () => clearInterval(interval)
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #fafbfc 0%, #f0f4f8 100%)',
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {/* Partículas flotantes sutiles */}
          <div className="absolute inset-0 overflow-hidden">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: `${particle.startX}%`,
                  top: `${particle.startY}%`,
                  backgroundColor: 'rgb(13, 129, 206)',
                }}
                initial={{
                  opacity: 0,
                  scale: 0,
                }}
                animate={{
                  opacity: particle.opacity,
                  scale: 1,
                  y: [0, -particle.speed, 0],
                  x: [0, Math.sin(particle.id) * 10, 0],
                }}
                transition={{
                  opacity: { duration: 0.8, delay: particle.delay },
                  scale: { duration: 0.8, delay: particle.delay },
                  y: {
                    duration: particle.speed / 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                  x: {
                    duration: particle.speed / 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }}
              />
            ))}
          </div>

          {/* Círculo de progreso sutil en el fondo */}
          <motion.div
            className="absolute"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.08, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <svg width="400" height="400" viewBox="0 0 400 400">
              <circle
                cx="200"
                cy="200"
                r="180"
                fill="none"
                stroke="rgb(13, 129, 206)"
                strokeWidth="1"
                strokeDasharray={`${2 * Math.PI * 180}`}
                strokeDashoffset={`${2 * Math.PI * 180 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
              />
            </svg>
          </motion.div>

          {/* Contenido central */}
          <div className="relative z-10 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {phase === 'loading' ? (
                <motion.div
                  key="loading"
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                >
                  {/* Logo container */}
                  <motion.div
                    className="relative mb-8"
                    animate={{
                      y: [0, -8, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    {/* Glow sutil */}
                    <div
                      className="absolute inset-0 blur-2xl opacity-30"
                      style={{
                        background: 'radial-gradient(circle, rgb(13, 129, 206) 0%, transparent 70%)',
                        transform: 'scale(2)',
                      }}
                    />

                    {/* Logo */}
                    <div className="relative bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
                      <img
                        src="/favicon.svg"
                        alt="LA CAJA"
                        className="w-16 h-16"
                      />
                    </div>
                  </motion.div>

                  {/* Nombre de la app */}
                  <motion.h2
                    className="text-xl font-semibold tracking-wide text-slate-800 mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    LA CAJA
                  </motion.h2>

                  {/* Barra de progreso minimalista */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: 'rgb(13, 129, 206)',
                        }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>

                    {/* Porcentaje sutil */}
                    <motion.span
                      className="text-sm font-medium text-slate-400 tabular-nums"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      {Math.round(progress)}%
                    </motion.span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="welcome"
                  className="flex flex-col items-center text-center px-8"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  {/* Checkmark animado */}
                  <motion.div
                    className="mb-6 w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(13, 129, 206, 0.1)' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 20,
                    }}
                  >
                    <motion.svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <motion.path
                        d="M5 13l4 4L19 7"
                        stroke="rgb(13, 129, 206)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      />
                    </motion.svg>
                  </motion.div>

                  {/* Saludo */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <h1
                      className="text-3xl font-semibold mb-2"
                      style={{ color: 'rgb(13, 129, 206)' }}
                    >
                      {firstName && firstName.toLowerCase().endsWith('a') ? 'Bienvenida' : 'Bienvenido'}
                    </h1>
                    {firstName && (
                      <p className="text-2xl font-medium text-slate-700">
                        {firstName}
                      </p>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Gradiente sutil en las esquinas */}
          <div
            className="absolute top-0 left-0 w-64 h-64 opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at top left, rgba(13, 129, 206, 0.15) 0%, transparent 60%)',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-64 h-64 opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at bottom right, rgba(13, 129, 206, 0.15) 0%, transparent 60%)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
