import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Particle {
  x: number
  y: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  life: number
}

interface ParticleLoaderProps {
  onComplete?: () => void
  duration?: number
}

export default function ParticleLoader({ onComplete, duration = 4000 }: ParticleLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isComplete, setIsComplete] = useState(false)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(0)

  // Logo shape points (forma de caja/box simplificada)
  const getLogoPoints = (centerX: number, centerY: number, scale: number) => {
    const points: { x: number; y: number }[] = []
    const size = 100 * scale

    // Crear puntos para formar "LA CAJA" de manera artística
    // Caja exterior (cuadrado grande)
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2
      const radius = size
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    }

    // Caja interior (cuadrado pequeño con offset 3D)
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2
      const radius = size * 0.6
      const offset = 15 * scale
      points.push({
        x: centerX + Math.cos(angle) * radius + offset,
        y: centerY + Math.sin(angle) * radius - offset,
      })
    }

    // Líneas de conexión para efecto 3D
    const corners = [
      { x: centerX - size, y: centerY - size },
      { x: centerX + size, y: centerY - size },
      { x: centerX + size, y: centerY + size },
      { x: centerX - size, y: centerY + size },
    ]

    corners.forEach((corner) => {
      for (let i = 0; i < 8; i++) {
        const t = i / 7
        const offset = 15 * scale
        points.push({
          x: corner.x + t * offset,
          y: corner.y - t * offset,
        })
      }
    })

    // Texto "LA CAJA" simplificado con puntos
    const textOffset = size * 1.5
    const textPoints = [
      // L
      ...Array.from({ length: 10 }, (_, i) => ({
        x: centerX - size * 1.2,
        y: centerY + textOffset + i * 3,
      })),
      // A
      ...Array.from({ length: 8 }, (_, i) => ({
        x: centerX - size * 0.7 + i * 2,
        y: centerY + textOffset + Math.abs(4 - i) * 2,
      })),
      // Más puntos decorativos
      ...Array.from({ length: 20 }, () => ({
        x: centerX + (Math.random() - 0.5) * size * 2.5,
        y: centerY + textOffset + (Math.random() - 0.5) * 20,
      })),
    ]

    return [...points, ...textPoints]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup canvas
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx.scale(dpr, dpr)

    const width = window.innerWidth
    const height = window.innerHeight
    const centerX = width / 2
    const centerY = height / 2

    // Create particles
    const particleCount = 2000
    const colors = [
      '#3b82f6', // blue-500
      '#60a5fa', // blue-400
      '#93c5fd', // blue-300
      '#dbeafe', // blue-100
      '#f0f9ff', // blue-50
      '#8b5cf6', // violet-500
      '#a78bfa', // violet-400
    ]

    // Initialize particles randomly
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      targetX: 0,
      targetY: 0,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.5,
      life: 1,
    }))

    // Get logo target points
    const scale = Math.min(width, height) / 400
    const logoPoints = getLogoPoints(centerX, centerY, scale)

    // Assign target positions
    particlesRef.current.forEach((particle, i) => {
      const targetPoint = logoPoints[i % logoPoints.length]
      particle.targetX = targetPoint.x + (Math.random() - 0.5) * 5
      particle.targetY = targetPoint.y + (Math.random() - 0.5) * 5
    })

    startTimeRef.current = Date.now()

    // Animation loop
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Clear canvas with trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, width, height)

      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        // Calculate easing (ease-in-out cubic)
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        // Interpolate position
        const currentX = particle.x + (particle.targetX - particle.x) * easeProgress
        const currentY = particle.y + (particle.targetY - particle.y) * easeProgress

        // Add some organic movement
        const wobbleX = Math.sin(elapsed * 0.001 + particle.x) * 2 * (1 - easeProgress)
        const wobbleY = Math.cos(elapsed * 0.001 + particle.y) * 2 * (1 - easeProgress)

        // Draw particle with glow
        ctx.save()
        ctx.globalAlpha = particle.alpha * particle.life

        // Glow effect
        const gradient = ctx.createRadialGradient(
          currentX + wobbleX,
          currentY + wobbleY,
          0,
          currentX + wobbleX,
          currentY + wobbleY,
          particle.size * 3
        )
        gradient.addColorStop(0, particle.color)
        gradient.addColorStop(0.5, particle.color + '80')
        gradient.addColorStop(1, particle.color + '00')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(currentX + wobbleX, currentY + wobbleY, particle.size * 2, 0, Math.PI * 2)
        ctx.fill()

        // Core particle
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(currentX + wobbleX, currentY + wobbleY, particle.size, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()

        // Update life for fade out at the end
        if (progress > 0.85) {
          particle.life = Math.max(0, 1 - (progress - 0.85) / 0.15)
        }
      })

      // Draw connections between nearby particles (for complexity)
      if (progress > 0.3 && progress < 0.9) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)'
        ctx.lineWidth = 0.5

        for (let i = 0; i < particlesRef.current.length; i += 10) {
          const p1 = particlesRef.current[i]
          const easeProgress = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2
          const x1 = p1.x + (p1.targetX - p1.x) * easeProgress
          const y1 = p1.y + (p1.targetY - p1.y) * easeProgress

          for (let j = i + 1; j < Math.min(i + 5, particlesRef.current.length); j += 2) {
            const p2 = particlesRef.current[j]
            const x2 = p2.x + (p2.targetX - p2.x) * easeProgress
            const y2 = p2.y + (p2.targetY - p2.y) * easeProgress

            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            if (distance < 50) {
              ctx.globalAlpha = (1 - distance / 50) * 0.3
              ctx.beginPath()
              ctx.moveTo(x1, y1)
              ctx.lineTo(x2, y2)
              ctx.stroke()
            }
          }
        }
        ctx.globalAlpha = 1
      }

      // Central glow effect when forming logo
      if (progress > 0.5 && progress < 0.95) {
        const glowIntensity = Math.sin((progress - 0.5) * Math.PI) * 0.3
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          200 * scale
        )
        gradient.addColorStop(0, `rgba(59, 130, 246, ${glowIntensity})`)
        gradient.addColorStop(0.5, `rgba(139, 92, 246, ${glowIntensity * 0.5})`)
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete
        setTimeout(() => {
          setIsComplete(true)
          onComplete?.()
        }, 500)
      }
    }

    animate()

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Loading text with fade animation */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            <motion.h1
              className="text-4xl md:text-6xl font-bold text-white mb-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 2.5, duration: 0.5 }}
            >
              LA CAJA
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl text-blue-300"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 2.8, duration: 0.5 }}
            >
              Sistema POS Inteligente
            </motion.p>

            {/* Loading dots */}
            <motion.div
              className="flex gap-2 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, duration: 0.5 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-blue-400 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
