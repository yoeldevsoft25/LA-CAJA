import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { Engine, ISourceOptions } from 'tsparticles-engine'

interface PremiumParticleLoaderProps {
  onComplete?: () => void
  duration?: number
}

export default function PremiumParticleLoader({
  onComplete,
  duration = 4000
}: PremiumParticleLoaderProps) {
  const [isComplete, setIsComplete] = useState(false)
  const [phase, setPhase] = useState<'explosion' | 'forming' | 'complete'>('explosion')

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine)
  }, [])

  // Configuración de partículas premium
  const particlesConfig: ISourceOptions = {
    background: {
      color: {
        value: 'transparent',
      },
    },
    fpsLimit: 120,
    particles: {
      number: {
        value: phase === 'explosion' ? 300 : 200,
        density: {
          enable: true,
          area: 800,
        },
      },
      color: {
        value: ['#3b82f6', '#60a5fa', '#93c5fd', '#8b5cf6', '#a78bfa', '#ec4899', '#f472b6'],
      },
      shape: {
        type: ['circle', 'triangle', 'polygon'],
        options: {
          polygon: {
            sides: 6,
          },
        },
      },
      opacity: {
        value: { min: 0.3, max: 1 },
        animation: {
          enable: true,
          speed: 1,
          sync: false,
        },
      },
      size: {
        value: { min: 1, max: 5 },
        animation: {
          enable: true,
          speed: 3,
          sync: false,
        },
      },
      links: {
        enable: phase === 'forming',
        distance: 150,
        color: '#3b82f6',
        opacity: 0.4,
        width: 1,
        triangles: {
          enable: true,
          opacity: 0.1,
        },
      },
      move: {
        enable: true,
        speed: phase === 'explosion' ? 8 : 2,
        direction: phase === 'explosion' ? 'none' : 'none',
        random: phase === 'explosion',
        straight: false,
        outModes: {
          default: 'bounce',
        },
        attract: {
          enable: phase === 'forming',
          rotateX: 600,
          rotateY: 1200,
        },
      },
      life: {
        duration: {
          sync: false,
          value: 3,
        },
        count: 0,
      },
      rotate: {
        value: {
          min: 0,
          max: 360,
        },
        direction: 'random',
        animation: {
          enable: true,
          speed: 5,
          sync: false,
        },
      },
    },
    interactivity: {
      detectsOn: 'window',
      events: {
        onHover: {
          enable: true,
          mode: phase === 'forming' ? 'grab' : 'repulse',
        },
        resize: true,
      },
      modes: {
        grab: {
          distance: 200,
          links: {
            opacity: 0.8,
          },
        },
        repulse: {
          distance: 150,
          duration: 0.4,
        },
      },
    },
    detectRetina: true,
    emitters: phase === 'explosion' ? {
      position: {
        x: 50,
        y: 50,
      },
      rate: {
        delay: 0.1,
        quantity: 5,
      },
      size: {
        width: 0,
        height: 0,
      },
      life: {
        duration: 1.5,
        count: 1,
      },
    } : undefined,
  }

  // Animación por fases
  useEffect(() => {
    // Fase 1: Explosión (0-1.5s)
    const timer1 = setTimeout(() => {
      setPhase('forming')
    }, 1500)

    // Fase 2: Formación con conexiones (1.5-3.5s)
    const timer2 = setTimeout(() => {
      setPhase('complete')
    }, 3500)

    // Completar animación
    const timer3 = setTimeout(() => {
      setIsComplete(true)
      onComplete?.()
    }, duration)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {/* Particles Background */}
          <Particles
            id="tsparticles"
            init={particlesInit}
            options={particlesConfig}
            className="absolute inset-0 w-full h-full"
          />

          {/* Logo/Text Overlay */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            {/* Logo Container con efecto de caja 3D */}
            <motion.div
              className="relative mb-8"
              initial={{ scale: 0.5, rotateY: -180 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{
                delay: 1.5,
                duration: 1,
                type: 'spring',
                stiffness: 100,
              }}
              style={{ perspective: 1000 }}
            >
              {/* Caja 3D efecto */}
              <div className="relative w-32 h-32 md:w-40 md:h-40">
                {/* Cara frontal */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-2xl"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(59, 130, 246, 0.5)',
                      '0 0 40px rgba(139, 92, 246, 0.8)',
                      '0 0 20px rgba(59, 130, 246, 0.5)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-4xl md:text-5xl">
                    📦
                  </div>
                </motion.div>

                {/* Cara lateral (efecto 3D) */}
                <motion.div
                  className="absolute top-0 -right-8 w-8 h-full bg-gradient-to-br from-purple-600 to-purple-800"
                  style={{
                    transformOrigin: 'left',
                    transform: 'skewY(-10deg)',
                  }}
                  animate={{
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {/* Cara superior (efecto 3D) */}
                <motion.div
                  className="absolute -top-8 left-0 w-full h-8 bg-gradient-to-br from-blue-400 to-blue-600"
                  style={{
                    transformOrigin: 'bottom',
                    transform: 'skewX(-10deg)',
                  }}
                  animate={{
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.5,
                  }}
                />
              </div>
            </motion.div>

            {/* Texto BIENVENIDO */}
            <motion.div
              className="relative text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 0.8 }}
            >
              <motion.h1
                className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-4"
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
                Bienvenido a LA CAJA
              </motion.h1>

              {/* Línea decorativa */}
              <motion.div
                className="h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 2.3, duration: 0.8 }}
              />
            </motion.div>

            {/* Loading indicator mejorado */}
            <motion.div
              className="flex gap-3 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.8, duration: 0.5 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="relative"
                >
                  <motion.div
                    className="w-3 h-3 bg-blue-400 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-blue-400 rounded-full blur-md"
                    animate={{
                      scale: [1, 2, 1],
                      opacity: [0.6, 0, 0.6],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Texto de carga */}
            <motion.p
              className="text-sm text-gray-600 mt-4 tracking-widest uppercase font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{
                delay: 3,
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              Cargando...
            </motion.p>
          </motion.div>

          {/* Gradient orbs animados */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/40 to-purple-400/40 rounded-full blur-3xl"
              animate={{
                x: [0, 150, 0],
                y: [0, 100, 0],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-br from-purple-400/40 to-pink-400/40 rounded-full blur-3xl"
              animate={{
                x: [0, -150, 0],
                y: [0, -100, 0],
                scale: [1, 1.4, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-300/30 to-purple-300/30 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.6, 1],
                rotate: [0, 360],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>

          {/* Corner accents */}
          <motion.div
            className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-blue-500/30"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8, duration: 0.5 }}
          />
          <motion.div
            className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-purple-500/30"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8, duration: 0.5 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
