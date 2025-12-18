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
  hue: number
  speed: number
}

interface AdvancedParticleLoaderProps {
  onComplete?: () => void
  duration?: number
}

export default function AdvancedParticleLoader({
  onComplete,
  duration = 5000
}: AdvancedParticleLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isComplete, setIsComplete] = useState(false)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0, y: 0 })

  // Logo shape points - Forma de caja 3D más detallada
  const getLogoPoints = (centerX: number, centerY: number, scale: number) => {
    const points: { x: number; y: number }[] = []
    const size = 120 * scale

    // Caja frontal (perspectiva)
    const front = [
      { x: -size, y: -size },
      { x: size, y: -size },
      { x: size, y: size },
      { x: -size, y: size },
    ]

    // Caja trasera (más pequeña, arriba-derecha para perspectiva)
    const offset = 40 * scale
    const backSize = size * 0.75
    const back = [
      { x: -backSize + offset, y: -backSize - offset },
      { x: backSize + offset, y: -backSize - offset },
      { x: backSize + offset, y: backSize - offset },
      { x: -backSize + offset, y: backSize - offset },
    ]

    // Líneas frontal
    front.forEach((corner, i) => {
      const next = front[(i + 1) % front.length]
      for (let t = 0; t < 1; t += 0.02) {
        points.push({
          x: centerX + corner.x + (next.x - corner.x) * t,
          y: centerY + corner.y + (next.y - corner.y) * t,
        })
      }
    })

    // Líneas trasera
    back.forEach((corner, i) => {
      const next = back[(i + 1) % back.length]
      for (let t = 0; t < 1; t += 0.03) {
        points.push({
          x: centerX + corner.x + (next.x - corner.x) * t,
          y: centerY + corner.y + (next.y - corner.y) * t,
        })
      }
    })

    // Líneas de conexión (perspectiva 3D)
    front.forEach((corner, i) => {
      const backCorner = back[i]
      for (let t = 0; t < 1; t += 0.05) {
        points.push({
          x: centerX + corner.x + (backCorner.x - corner.x) * t,
          y: centerY + corner.y + (backCorner.y - corner.y) * t,
        })
      }
    })

    // Diagonal interior para efecto de profundidad
    for (let i = 0; i < 4; i++) {
      const start = front[i]
      const end = back[(i + 2) % 4]
      for (let t = 0; t < 1; t += 0.1) {
        points.push({
          x: centerX + start.x + (end.x - start.x) * t,
          y: centerY + start.y + (end.y - start.y) * t,
        })
      }
    }

    // "LA CAJA" text particles
    const textY = centerY + size * 1.6
    const textSpacing = 15 * scale

    // L
    for (let i = 0; i < 15; i++) {
      points.push({ x: centerX - size * 1.3, y: textY + i * textSpacing * 0.4 })
    }
    for (let i = 0; i < 8; i++) {
      points.push({ x: centerX - size * 1.3 + i * textSpacing * 0.4, y: textY + 14 * textSpacing * 0.4 })
    }

    // A
    const aX = centerX - size * 0.8
    for (let i = 0; i < 15; i++) {
      const t = i / 14
      const offset = Math.abs(0.5 - t) * 6 * textSpacing * 0.4
      points.push({ x: aX + offset, y: textY + i * textSpacing * 0.4 })
      points.push({ x: aX - offset, y: textY + i * textSpacing * 0.4 })
    }
    for (let i = 0; i < 6; i++) {
      points.push({ x: aX - 3 * textSpacing * 0.4 + i * textSpacing * 0.4, y: textY + 7 * textSpacing * 0.4 })
    }

    // Efectos decorativos (espirales y círculos)
    for (let angle = 0; angle < Math.PI * 4; angle += 0.2) {
      const radius = (angle / (Math.PI * 4)) * size * 0.5
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    }

    // Partículas aleatorias alrededor para densidad
    for (let i = 0; i < 100; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = size * (0.8 + Math.random() * 0.8)
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    }

    return points
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
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

    // Mouse tracking for interactive effect
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Create particles
    const particleCount = 3000 // Más partículas para mayor impacto

    // Initialize particles with explosion effect
    particlesRef.current = Array.from({ length: particleCount }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 3 + 1
      const distance = Math.random() * 200

      return {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        targetX: 0,
        targetY: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2.5 + 0.5,
        color: '',
        alpha: Math.random() * 0.5 + 0.5,
        life: 1,
        hue: Math.random() * 60 + 200, // Blue to purple range
        speed: speed,
      }
    })

    // Get logo target points
    const scale = Math.min(width, height) / 500
    const logoPoints = getLogoPoints(centerX, centerY, scale)

    // Assign target positions with smart distribution
    particlesRef.current.forEach((particle, i) => {
      const targetPoint = logoPoints[i % logoPoints.length]
      const jitter = 3
      particle.targetX = targetPoint.x + (Math.random() - 0.5) * jitter
      particle.targetY = targetPoint.y + (Math.random() - 0.5) * jitter
      particle.color = `hsl(${particle.hue}, 80%, 60%)`
    })

    startTimeRef.current = Date.now()

    // Animation loop with advanced effects
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Clear with fade trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.fillRect(0, 0, width, height)

      // Calculate easing
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2

      // Update and draw particles
      particlesRef.current.forEach((particle, index) => {
        // Position interpolation
        const currentX = particle.x + (particle.targetX - particle.x) * easeProgress
        const currentY = particle.y + (particle.targetY - particle.y) * easeProgress

        // Organic movement (spiral + wave)
        const wobbleAngle = elapsed * 0.002 + index * 0.1
        const wobbleRadius = (1 - easeProgress) * 15
        const wobbleX = Math.cos(wobbleAngle) * wobbleRadius
        const wobbleY = Math.sin(wobbleAngle) * wobbleRadius

        // Mouse interaction (particles flee from cursor before forming)
        let mouseInfluenceX = 0
        let mouseInfluenceY = 0
        if (progress < 0.6) {
          const dx = currentX - mouseRef.current.x
          const dy = currentY - mouseRef.current.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 150) {
            const force = (1 - distance / 150) * 30 * (1 - progress)
            mouseInfluenceX = (dx / distance) * force
            mouseInfluenceY = (dy / distance) * force
          }
        }

        const finalX = currentX + wobbleX + mouseInfluenceX
        const finalY = currentY + wobbleY + mouseInfluenceY

        // Color shift during animation
        const currentHue = particle.hue + progress * 30
        particle.color = `hsl(${currentHue}, 80%, 60%)`

        // Draw particle with advanced glow
        ctx.save()
        ctx.globalAlpha = particle.alpha * particle.life

        // Multi-layer glow
        const glowLayers = 3
        for (let i = 0; i < glowLayers; i++) {
          const glowSize = particle.size * (3 + i * 2)
          const glowAlpha = 0.3 / (i + 1)

          const gradient = ctx.createRadialGradient(
            finalX, finalY, 0,
            finalX, finalY, glowSize
          )
          gradient.addColorStop(0, particle.color)
          gradient.addColorStop(0.5, `hsla(${currentHue}, 80%, 60%, ${glowAlpha})`)
          gradient.addColorStop(1, 'transparent')

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(finalX, finalY, glowSize, 0, Math.PI * 2)
          ctx.fill()
        }

        // Core particle
        ctx.fillStyle = particle.color
        ctx.shadowBlur = 10
        ctx.shadowColor = particle.color
        ctx.beginPath()
        ctx.arc(finalX, finalY, particle.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.restore()

        // Update life for fade out at end
        if (progress > 0.85) {
          particle.life = Math.max(0, 1 - (progress - 0.85) / 0.15)
        }
      })

      // Draw dynamic connections between nearby particles
      if (progress > 0.4 && progress < 0.9) {
        const connectionDistance = 60 * (1 - Math.abs(progress - 0.65) * 2)

        for (let i = 0; i < particlesRef.current.length; i += 15) {
          const p1 = particlesRef.current[i]
          const x1 = p1.x + (p1.targetX - p1.x) * easeProgress
          const y1 = p1.y + (p1.targetY - p1.y) * easeProgress

          for (let j = i + 1; j < Math.min(i + 8, particlesRef.current.length); j += 3) {
            const p2 = particlesRef.current[j]
            const x2 = p2.x + (p2.targetX - p2.x) * easeProgress
            const y2 = p2.y + (p2.targetY - p2.y) * easeProgress

            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

            if (distance < connectionDistance) {
              const opacity = (1 - distance / connectionDistance) * 0.4
              ctx.strokeStyle = `rgba(96, 165, 250, ${opacity})`
              ctx.lineWidth = 1
              ctx.beginPath()
              ctx.moveTo(x1, y1)
              ctx.lineTo(x2, y2)
              ctx.stroke()
            }
          }
        }
      }

      // Central energy burst effect
      if (progress > 0.5 && progress < 0.85) {
        const burstProgress = (progress - 0.5) / 0.35
        const burstIntensity = Math.sin(burstProgress * Math.PI) * 0.5

        // Multiple concentric bursts
        for (let i = 0; i < 5; i++) {
          const burstRadius = (50 + i * 40) * scale * burstProgress
          const gradient = ctx.createRadialGradient(
            centerX, centerY, burstRadius * 0.8,
            centerX, centerY, burstRadius
          )
          gradient.addColorStop(0, 'transparent')
          gradient.addColorStop(0.5, `rgba(59, 130, 246, ${burstIntensity * (1 - i * 0.15)})`)
          gradient.addColorStop(1, 'transparent')

          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, width, height)
        }

        // Rotating rays
        const rayCount = 12
        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2 + elapsed * 0.001
          const rayLength = 300 * scale * burstProgress

          ctx.save()
          ctx.translate(centerX, centerY)
          ctx.rotate(angle)

          const gradient = ctx.createLinearGradient(0, 0, rayLength, 0)
          gradient.addColorStop(0, `rgba(139, 92, 246, ${burstIntensity * 0.3})`)
          gradient.addColorStop(0.5, `rgba(59, 130, 246, ${burstIntensity * 0.2})`)
          gradient.addColorStop(1, 'transparent')

          ctx.fillStyle = gradient
          ctx.fillRect(0, -2, rayLength, 4)
          ctx.restore()
        }
      }

      // Screen flash at peak
      if (progress > 0.65 && progress < 0.7) {
        const flashIntensity = Math.sin((progress - 0.65) / 0.05 * Math.PI) * 0.3
        ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity})`
        ctx.fillRect(0, 0, width, height)
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        setTimeout(() => {
          setIsComplete(true)
          onComplete?.()
        }, 300)
      }
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          {/* Canvas for particles */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Text overlay with sophisticated animations */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2.5, duration: 0.8 }}
          >
            <motion.div
              className="relative"
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 2.8, duration: 0.6, ease: 'easeOut' }}
            >
              <motion.h1
                className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 mb-4"
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
                  textShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
                }}
              >
                LA CAJA
              </motion.h1>

              {/* Glow effect behind text */}
              <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 -z-10" />
            </motion.div>

            <motion.p
              className="text-xl md:text-2xl text-blue-300 font-light tracking-wide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.2, duration: 0.6 }}
            >
              Sistema POS Inteligente
            </motion.p>

            {/* Animated loading indicator */}
            <motion.div
              className="flex gap-3 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.5, duration: 0.5 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="relative"
                >
                  <motion.div
                    className="w-3 h-3 bg-blue-400 rounded-full"
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
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
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: 'easeInOut',
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Vignette effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-radial from-transparent via-transparent to-black/40" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
