import { motion, AnimatePresence } from 'framer-motion'
import { Store } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { Engine } from 'tsparticles-engine'

interface SimpleLoaderProps {
  onComplete?: () => void
  duration?: number
  userName?: string | null
}

/**
 * Loader ligero y elegante para transición login -> dashboard
 * Optimizado para rendimiento sin sacrificar la estética
 * Incluye partículas avanzadas pero ligeras
 */
export default function SimpleLoader({
  onComplete,
  duration = 4000, // Duración aumentada para mejor visibilidad
  userName,
}: SimpleLoaderProps) {
  // Obtener primer nombre del usuario
  const getFirstName = (fullName: string | null | undefined): string => {
    if (!fullName) return 'Usuario'
    return fullName.split(' ')[0] || 'Usuario'
  }

  const firstName = getFirstName(userName)

  // Inicializar partículas
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine)
  }, [])
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsComplete(true)
      onComplete?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Partículas avanzadas ligeras */}
          <Particles
            id="loader-particles"
            init={particlesInit}
            options={{
              background: {
                color: { value: 'transparent' },
              },
              fpsLimit: 60,
              particles: {
                number: {
                  value: 60, // Cantidad optimizada para efecto avanzado pero ligero
                  density: {
                    enable: true,
                    area: 800,
                  },
                },
                color: {
                  value: ['#3b82f6', '#8b5cf6', '#60a5fa', '#a78bfa'],
                },
                shape: {
                  type: 'circle', // Solo círculos para mejor rendimiento
                },
                opacity: {
                  value: { min: 0.2, max: 0.6 },
                  animation: {
                    enable: true,
                    speed: 0.3,
                    sync: false,
                  },
                },
                size: {
                  value: { min: 1.5, max: 3.5 },
                  animation: {
                    enable: true,
                    speed: 1,
                    sync: false,
                  },
                },
                links: {
                  enable: true,
                  distance: 100,
                  color: '#3b82f6',
                  opacity: 0.15,
                  width: 0.8,
                  triangles: {
                    enable: false, // Sin triángulos para mejor rendimiento
                  },
                },
                move: {
                  enable: true,
                  speed: 0.8,
                  direction: 'none',
                  random: false,
                  straight: false,
                  outModes: {
                    default: 'bounce',
                  },
                  attract: {
                    enable: false,
                  },
                },
              },
              interactivity: {
                detectsOn: 'window',
                events: {
                  onHover: {
                    enable: true,
                    mode: 'grab',
                  },
                  onClick: {
                    enable: false,
                  },
                  resize: true,
                },
                modes: {
                  grab: {
                    distance: 120,
                    links: {
                      opacity: 0.3,
                      color: '#8b5cf6',
                    },
                  },
                },
              },
              detectRetina: true,
              smooth: true,
            }}
            className="absolute inset-0 w-full h-full"
          />
          {/* Logo animado - sobre las partículas */}
          <motion.div
            className="flex flex-col items-center gap-4 relative z-10"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.34, 1.56, 0.64, 1], // Ease out back para efecto suave
            }}
          >
            {/* Icono con glow sutil */}
            <motion.div
              className="relative"
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-2xl shadow-2xl">
                <Store className="w-12 h-12 text-white" strokeWidth={2} />
              </div>
            </motion.div>

            {/* Texto con fade elegante */}
            <motion.div
              className="text-center"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <motion.h2
                className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  backgroundSize: '200% 200%',
                }}
              >
                LA CAJA
              </motion.h2>
              <motion.p
                className="text-sm text-slate-500 mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                ¡Bienvenido, {firstName}!
              </motion.p>
            </motion.div>

            {/* Barra de progreso sutil */}
            <motion.div
              className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{
                  duration: duration / 1000,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  )
}

