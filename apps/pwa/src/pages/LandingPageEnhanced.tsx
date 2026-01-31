import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMobileDetection } from '@/hooks/use-mobile-detection'
import {
  Check,
  Shield,
  BarChart3,
  Globe,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Brain,
  Smartphone,
  ChevronDown,
  Play,
  Zap,
  FileText,
  QrCode,
  Lock,
  Banknote,
  Wifi,
  WifiOff,
  CheckCircle2,
  Printer,
  ShoppingCart,
  Boxes,
  Calculator,
  DollarSign,
  TrendingDown,
  AlertCircle,
  X,
  Minus,
  Rocket,
  Target,
  Star,
  Quote,
  Mail,
  Github,
  Twitter,
  Linkedin,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STAT_COLOR_CLASSES = {
  emerald: 'from-emerald-500 to-emerald-600',
  blue: 'from-blue-500 to-blue-600',
  purple: 'from-indigo-500 to-indigo-600',
  pink: 'from-slate-500 to-slate-600',
  yellow: 'from-amber-500 to-amber-600',
  cyan: 'from-cyan-500 to-cyan-600',
  orange: 'from-teal-500 to-teal-600',
  indigo: 'from-indigo-500 to-indigo-600',
  green: 'from-green-500 to-green-600',
} as const

type StatItem = {
  label: string
  value: number
  prefix?: string
  suffix?: string
  icon: LucideIcon
  color: keyof typeof STAT_COLOR_CLASSES
}

type StatCardProps = {
  stat: StatItem
  index: number
  isInView: boolean
}

function useCounter(end: number, isInView: boolean, duration: number = 2000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView) return

    let startTime: number | null = null
    let frameId = 0
    const decimals = Number.isInteger(end) ? 0 : String(end).split('.')[1]?.length ?? 0
    const factor = Math.pow(10, decimals)

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const nextValue = Math.floor(progress * end * factor) / factor
      setCount(nextValue)
      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [end, duration, isInView])

  return count
}

function StatCard({ stat, index, isInView }: StatCardProps) {
  const Icon = stat.icon
  const count = useCounter(stat.value, isInView)
  const gradient = STAT_COLOR_CLASSES[stat.color]
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: isMobile ? 1 : 0, scale: isMobile ? 1 : 0.9 }}
      transition={{ duration: isMobile ? 0.3 : 0.5, delay: isMobile ? 0 : index * 0.1 }}
    >
      <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 group relative overflow-hidden">
        {/* Gradient background on hover */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300',
            gradient
          )}
        />

        <CardContent className="p-8 text-center relative z-10">
          <div
            className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300',
              gradient
            )}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>

          <div
            className="text-5xl font-black mb-2 bg-gradient-to-br bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, var(--tw-gradient-stops))',
            }}
          >
            <span className="text-white">
              {stat.prefix}
              {count}
              {stat.suffix}
            </span>
          </div>

          <p className="text-slate-400 font-medium">{stat.label}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function LandingPageEnhanced() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const { scrollYProgress } = useScroll()
  const heroRef = useRef(null)
  const isHeroInView = useInView(heroRef, { once: true })

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* ========================================
          HEADER CON SCROLL EFFECT
      ======================================== */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl'
            : 'bg-transparent'
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Logo */}
            <motion.div
              className="flex items-center gap-2 cursor-pointer flex-shrink-0 min-w-0"
              whileHover={{ scale: 1.05 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <img
                src="/logo-velox-white.svg"
                alt="Velox POS Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 border-slate-700/50 shadow-lg shadow-blue-500/20 hover:border-slate-600/70 transition-all duration-300 flex-shrink-0"
              />
              <span className="text-lg sm:text-xl font-black text-white whitespace-nowrap">
                Velox POS
              </span>
            </motion.div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8 flex-shrink-0">
              <a
                href="#features"
                className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
              >
                Características
              </a>
              <a
                href="#seniat"
                className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
              >
                SENIAT
              </a>
              <a
                href="#pricing"
                className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
              >
                Precios
              </a>
            </nav>

            {/* CTAs */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="hidden sm:flex text-slate-300 hover:text-white hover:bg-slate-800/50 hover:shadow-md rounded-lg px-3 sm:px-4 py-2 transition-all duration-300 hover:scale-105 text-xs sm:text-sm"
              >
                <span className="whitespace-nowrap">Iniciar Sesión</span>
              </Button>
              <Button
                variant="gradient"
                onClick={() => navigate('/login')}
                className="rounded-lg px-3 sm:px-5 py-2 sm:py-2.5 font-semibold relative overflow-hidden group text-xs sm:text-sm"
              >
                <span className="relative z-10 flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                  Empezar Gratis
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================
          1. HERO SECTION - EL POS QUE VENEZUELA NECESITA
      ======================================== */}
      <motion.section
        ref={heroRef}
        style={{ opacity, scale }}
        className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.15),transparent_50%)]" />
        </div>

        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, (Math.random() - 0.5) * 40, 0],
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isHeroInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 px-4 py-2 text-sm backdrop-blur-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                La única solución POS offline-first para Venezuela
              </Badge>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight"
            >
              <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-slate-300 bg-clip-text text-transparent">
                El Sistema POS
              </span>
              <br />
              <span className="text-white">que Funciona Sin Internet</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl sm:text-2xl text-slate-300 max-w-4xl mx-auto leading-relaxed"
            >
              <span className="font-semibold text-white">85% cumplimiento SENIAT</span> •{' '}
              <span className="font-semibold text-white">Offline-first real</span> •{' '}
              <span className="font-semibold text-white">IA integrada</span> •{' '}
              <span className="font-semibold text-white">Multi-plataforma</span>
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={isHeroInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg text-slate-400 max-w-3xl mx-auto"
            >
              Gestión completa de punto de venta con facturación fiscal, contabilidad automática y
              analytics en tiempo real. Diseñado específicamente para la realidad venezolana.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            >
              <Button
                variant="gradient"
                size="xl"
                onClick={() => navigate('/login')}
                className="group relative overflow-hidden rounded-xl px-10 py-7 font-bold shadow-xl shadow-blue-500/20"
              >
                <span className="relative z-10 flex items-center gap-3">
                  Empezar Gratis Ahora
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="border-2 border-slate-500 bg-slate-800/50 text-slate-100 hover:bg-slate-700/70 hover:text-white hover:border-slate-400 rounded-xl px-10 py-7 font-semibold backdrop-blur-sm hover:shadow-xl hover:shadow-slate-500/30 transition-all duration-300 group"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <Play className="mr-2 w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                Ver Demo
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isHeroInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-slate-400"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Gratis para siempre</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Setup en 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>100% Offline-first</span>
              </div>
            </motion.div>

            {/* Terminal animado mostrando sync */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="pt-12 max-w-4xl mx-auto"
            >
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs text-slate-500 ml-2 font-mono">
                      terminal ~ sync-status
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 font-mono text-sm">
                  <TerminalAnimation />
                </CardContent>
              </Card>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isHeroInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="pt-12"
            >
              <ChevronDown className="w-6 h-6 text-slate-500 mx-auto animate-bounce" />
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ========================================
          2. SOCIAL PROOF TICKER - BARRA DE CONFIANZA
      ======================================== */}
      <section className="py-6 bg-slate-900/50 border-y border-slate-800 overflow-hidden">
        <div className="relative">
          <motion.div
            animate={{ x: [0, -1920] }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="flex gap-12 whitespace-nowrap"
          >
            {[...Array(4)].map((_, setIndex) => (
              <div key={setIndex} className="flex gap-12 items-center">
                <div className="flex items-center gap-3 text-slate-400">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-medium">
                    <span className="text-white font-bold">10,000+</span> ventas procesadas hoy
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium">
                    <span className="text-white font-bold">99.9%</span> uptime
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium">
                    <span className="text-white font-bold">Bs. 2.5M+</span> procesados hoy
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium">
                    <span className="text-white font-bold">500+</span> negocios activos
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-medium">
                    <span className="text-white font-bold">&lt;15ms</span> tiempo de respuesta
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <WifiOff className="w-5 h-5 text-teal-400" />
                  <span className="text-sm font-medium">
                    <span className="text-white font-bold">0</span> ventas perdidas por internet
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========================================
          3. PROBLEMA/SOLUCIÓN - LA REALIDAD VENEZOLANA
      ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              Diseñado para Venezuela
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black">
              <span className="text-white">Entendemos</span>{' '}
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                tus Desafíos
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              La realidad venezolana requiere soluciones únicas. Velox POS fue diseñado específicamente
              para estos retos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Problemas */}
            <Card className="bg-slate-900/50 border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Problemas Comunes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProblemItem
                  icon={Wifi}
                  problem="Internet intermitente"
                  description="Cortes constantes afectan las ventas"
                />
                <ProblemItem
                  icon={DollarSign}
                  problem="POS caros y lentos"
                  description="Inversión alta sin retorno"
                />
                <ProblemItem
                  icon={FileText}
                  problem="Sin facturación SENIAT"
                  description="No cumplen normativa venezolana"
                />
                <ProblemItem
                  icon={Banknote}
                  problem="No soportan Bs/USD"
                  description="Solo una moneda o conversión manual"
                />
                <ProblemItem
                  icon={TrendingDown}
                  problem="Software desactualizado"
                  description="Tecnología vieja, sin IA"
                />
              </CardContent>
            </Card>

            {/* Soluciones */}
            <Card className="bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border-emerald-500/30 ring-2 ring-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Nuestra Solución
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SolutionItem
                  icon={WifiOff}
                  solution="100% offline-first"
                  description="Funciona perfecto sin internet"
                />
                <SolutionItem
                  icon={Zap}
                  solution="Freemium + super rápido"
                  description="Plan gratuito para siempre"
                />
                <SolutionItem
                  icon={QrCode}
                  solution="85% cumplimiento SENIAT"
                  description="Facturación fiscal completa"
                />
                <SolutionItem
                  icon={Banknote}
                  solution="Sistema dual nativo Bs/USD"
                  description="Tasa BCV automática"
                />
                <SolutionItem
                  icon={Brain}
                  solution="Stack moderno + IA"
                  description="Tecnología de punta"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ========================================
          4. CARACTERÍSTICAS PRINCIPALES - TODO LO QUE NECESITAS
      ======================================== */}
      <FeaturesSection />

      {/* ========================================
          5. SHOWCASE FACTURACIÓN FISCAL - ÚNICO EN VENEZUELA
      ======================================== */}
      <SeniatShowcaseSection />

      {/* ========================================
          6. COMPARISON TABLE - VELOX POS VS COMPETITORS
      ======================================== */}
      <ComparisonSection />

      {/* ========================================
          7. STATS IMPRESIONANTES - NÚMEROS QUE HABLAN
      ======================================== */}
      <StatsSection />

      {/* ========================================
          8. PRICING SECTION - PLANES Y PRECIOS
      ======================================== */}
      <PricingSection />

      {/* ========================================
          9. TESTIMONIALS - CASOS DE USO REALES
      ======================================== */}
      <TestimonialsSection />

      {/* ========================================
          10. FAQ - PREGUNTAS FRECUENTES
      ======================================== */}
      <FAQSection />

      {/* ========================================
          11. CTA FINAL ÉPICO
      ======================================== */}
      <FinalCTASection />

      {/* ========================================
          12. FOOTER RICO
      ======================================== */}
      <Footer />
    </div>
  )
}

// ========================================
// COMPONENTES AUXILIARES
// ========================================

function TerminalAnimation() {
  const lines = [
    { text: '$ velox-pos status', delay: 0, type: 'command' as const },
    { text: '✓ Sistema: Online', delay: 0.5, type: 'success' as const },
    { text: '✓ Base de datos: Conectada', delay: 1, type: 'success' as const },
    { text: '✓ Modo: Offline-First Activo', delay: 1.5, type: 'success' as const },
    { text: '✓ Cola de sync: 0 eventos pendientes', delay: 2, type: 'success' as const },
    { text: '✓ Última sincronización: Hace 2 segundos', delay: 2.5, type: 'success' as const },
    { text: '', delay: 3, type: 'empty' as const },
    { text: '$ velox-pos sell --offline', delay: 3.5, type: 'command' as const },
    { text: '⚡ Venta procesada localmente en 15ms', delay: 4, type: 'info' as const },
    { text: '⚡ Evento guardado en cola', delay: 4.5, type: 'info' as const },
    { text: '✓ Sincronización programada', delay: 5, type: 'success' as const },
  ]

  return (
    <div className="space-y-1 py-3">
      {lines.map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: line.delay, duration: 0.3 }}
          className={cn(
            line.type === 'command' && 'text-blue-400',
            line.type === 'success' && 'text-emerald-400',
            line.type === 'info' && 'text-indigo-400',
            line.type === 'empty' && 'h-2'
          )}
        >
          {line.text}
        </motion.div>
      ))}
      <motion.span
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="text-slate-400"
      >
        _
      </motion.span>
    </div>
  )
}

function ProblemItem({
  icon: Icon,
  problem,
  description,
}: {
  icon: any
  problem: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 group">
      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
        <Icon className="w-5 h-5 text-red-400" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white mb-1">{problem}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function SolutionItem({
  icon: Icon,
  solution,
  description,
}: {
  icon: any
  solution: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 group">
      <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
        <Icon className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white mb-1">{solution}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  )
}

// ========================================
// SECCIÓN DE FEATURES
// ========================================
function FeaturesSection() {
  const featuresRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, usar amount más bajo y margin más grande para activar antes
  const isInView = useInView(featuresRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.2,
    margin: isMobile ? '-150px' : '0px'
  })

  const features = [
    {
      icon: WifiOff,
      title: 'POS Offline-First',
      description: 'Funciona 100% sin internet con sincronización resiliente y event sourcing.',
      details: [
        'Event sourcing completo',
        'Split payments (6 métodos)',
        'Cambio exacto Bs/USD',
        'Atajos de teclado (F2-F4)',
      ],
      color: 'blue',
      badge: 'La única solución real offline en Venezuela',
    },
    {
      icon: QrCode,
      title: 'Facturación Fiscal SENIAT',
      description: 'Cumplimiento Providencia SNAT/2024/000121 con códigos QR y control fiscal.',
      details: [
        'Códigos QR + Control Code',
        'Inmutabilidad garantizada',
        'Notas crédito/débito',
        'Endpoint auditoría SENIAT',
      ],
      color: 'blue',
      badge: '85% Compliant - Único en el mercado',
    },
    {
      icon: Calculator,
      title: 'Contabilidad Integrada',
      description: 'Plan de cuentas, asientos automáticos y reportes contables completos.',
      details: [
        'Balance general',
        'Estado de resultados',
        'Flujo de efectivo',
        'Integración ERP',
      ],
      color: 'emerald',
      badge: 'Ahorra 20 horas/mes en contabilidad',
    },
    {
      icon: Brain,
      title: 'IA/ML Avanzado',
      description: 'Inteligencia artificial que aprende de tu negocio y optimiza operaciones.',
      details: [
        'Predicción de demanda',
        'Detección de anomalías',
        'Recomendaciones inteligentes',
        'Optimización inventario',
      ],
      color: 'pink',
      badge: 'IA que aprende de tu negocio',
    },
    {
      icon: Boxes,
      title: 'Gestión de Inventario',
      description: 'Control total con multi-bodega, variantes, lotes y números de serie.',
      details: [
        'Multi-bodega',
        'Multi-variantes (talla/color)',
        'Lotes + vencimientos FIFO',
        'Transferencias entre bodegas',
      ],
      color: 'orange',
      badge: 'Control total del inventario',
    },
    {
      icon: BarChart3,
      title: 'Analytics en Tiempo Real',
      description: 'Dashboard ejecutivo con KPIs en vivo, heatmaps y análisis de rentabilidad.',
      details: [
        'Heatmaps de ventas',
        'Top productos',
        'Análisis rentabilidad',
        'Proyecciones',
      ],
      color: 'cyan',
      badge: 'Insights que impulsan ventas',
    },
    {
      icon: Smartphone,
      title: 'Multi-Plataforma',
      description: 'PWA, Desktop y Android. Un sistema, todos tus dispositivos.',
      details: [
        'PWA (Progressive Web App)',
        'Desktop (Electron)',
        'Android nativo',
        'Tablet optimizado',
      ],
      color: 'indigo',
      badge: 'Un sistema, todos tus dispositivos',
    },
    {
      icon: Banknote,
      title: 'Sistema Venezolano Único',
      description: 'Tasa BCV automática, dual Bs/USD, 24 bancos y denominaciones 2025.',
      details: [
        'Tasa BCV automática',
        '24 bancos venezolanos',
        'Denominaciones 2025',
        'Pago móvil + transferencia',
      ],
      color: 'yellow',
      badge: 'Hecho para Venezuela',
    },
    {
      icon: Printer,
      title: 'Periféricos',
      description: 'Plug & play con impresoras, lectores, cajones y balanzas.',
      details: [
        'Impresoras térmicas',
        'Lectores código barras',
        'Cajones de dinero',
        'Balanzas',
      ],
      color: 'slate',
      badge: 'Plug & play con tu hardware',
    },
    {
      icon: Lock,
      title: 'Seguridad Enterprise',
      description: 'Auditoría completa, 2FA, encriptación AES-256 y OWASP Top 10 compliant.',
      details: [
        'Rate limiting',
        'Refresh tokens',
        'Encriptación AES-256',
        'OWASP Top 10',
      ],
      color: 'red',
      badge: 'Seguridad de nivel bancario',
    },
  ]

  const colorClasses = {
    blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    purple: { icon: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
    emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    pink: { icon: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
    orange: { icon: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
    cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    indigo: { icon: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
    yellow: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    slate: { icon: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
    red: { icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  }

  return (
    <section id="features" ref={featuresRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
            Características Únicas
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="text-white">Todo lo que necesitas para</span>
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              gestionar tu negocio
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            10 módulos completos que cubren cada aspecto de tu operación. Tecnología de punta
            combinada con simplicidad.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            const colors = colorClasses[feature.color as keyof typeof colorClasses]

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
                transition={{ duration: isMobile ? 0.3 : 0.5, delay: isMobile ? 0 : index * 0.05 }}
              >
                <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 group h-full">
                  <CardHeader>
                    <div
                      className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform',
                        colors.bg
                      )}
                    >
                      <Icon className={cn('w-7 h-7', colors.icon)} />
                    </div>
                    <CardTitle className="text-white text-xl mb-2">{feature.title}</CardTitle>
                    <Badge
                      className={cn(
                        'text-xs font-normal mb-3 border',
                        colors.bg,
                        colors.icon,
                        colors.border
                      )}
                    >
                      {feature.badge}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CardDescription className="text-slate-400 text-base mb-4">
                      {feature.description}
                    </CardDescription>
                    <ul className="space-y-2">
                      {feature.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ========================================
// SECCIÓN SHOWCASE SENIAT
// ========================================
function SeniatShowcaseSection() {
  const sectionRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, activar más temprano con amount más bajo
  const isInView = useInView(sectionRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.3,
    margin: isMobile ? '-150px' : '0px'
  })

  return (
    <section
      id="seniat"
      ref={sectionRef}
      className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900/30 to-blue-900/10"
    >
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-base px-4 py-2">
            <Shield className="w-4 h-4 mr-2 inline" />
            Único en Venezuela
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="text-white">Facturación Fiscal</span>
            <br />
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-slate-300 bg-clip-text text-transparent">
              Cumplimiento SENIAT
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            85% de cumplimiento con la Providencia SNAT/2024/000121. El único POS en Venezuela con
            facturación fiscal integrada y endpoint de auditoría listo para el SENIAT.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: Mockup factura fiscal */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: isMobile ? 1 : 0, x: isMobile ? 0 : -40 }}
            transition={{ duration: isMobile ? 0.3 : 0.8 }}
          >
            <Card className="bg-white text-slate-900 shadow-2xl">
              <CardHeader className="border-b-2 border-slate-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <CardTitle className="text-2xl mb-1">TU NEGOCIO C.A.</CardTitle>
                    <p className="text-sm text-slate-600">RIF: J-12345678-9</p>
                    <p className="text-sm text-slate-600">Av. Principal, Caracas</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">FACTURA FISCAL</p>
                    <p className="text-sm">Nro: FAC-2025-001234</p>
                    <p className="text-sm text-indigo-600 font-semibold">
                      Fiscal: VE20251231-567890
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="font-semibold mb-1">Cliente:</p>
                  <p className="text-sm">Consumidor Final</p>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Producto</th>
                        <th className="text-right py-2">Cant.</th>
                        <th className="text-right py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">Producto Demo 1</td>
                        <td className="text-right">2</td>
                        <td className="text-right">Bs. 1,200.00</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Producto Demo 2</td>
                        <td className="text-right">1</td>
                        <td className="text-right">Bs. 800.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-t-2 border-slate-800 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Bs. 2,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA (16%):</span>
                    <span>Bs. 320.00</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL:</span>
                    <span>Bs. 2,320.00</span>
                  </div>
                  <div className="text-right text-sm text-slate-600">USD 7.70</div>
                </div>

                {/* QR Code Mock */}
                <div className="border-t pt-6 flex flex-col items-center">
                  <div className="w-32 h-32 bg-slate-900 rounded flex items-center justify-center mb-2 relative">
                    <QrCode className="w-24 h-24 text-white" />
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded" />
                  </div>
                  <p className="text-xs text-center text-slate-600">Código QR Fiscal</p>
                  <p className="text-xs text-center text-indigo-600 font-mono mt-1">
                    Control: A3F5K9X1Z2
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: Features + Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: isMobile ? 1 : 0, x: isMobile ? 0 : 40 }}
            transition={{ duration: isMobile ? 0.3 : 0.8 }}
            className="space-y-6"
          >
            {/* Stats destacados */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-indigo-500/10 border-indigo-500/30 text-center p-4">
                <div className="text-3xl font-black text-indigo-400">85%</div>
                <div className="text-xs text-slate-400 mt-1">Cumplimiento SENIAT</div>
              </Card>
              <Card className="bg-emerald-500/10 border-emerald-500/30 text-center p-4">
                <div className="text-3xl font-black text-emerald-400">100%</div>
                <div className="text-xs text-slate-400 mt-1">Inmutabilidad</div>
              </Card>
              <Card className="bg-blue-500/10 border-blue-500/30 text-center p-4">
                <div className="text-3xl font-black text-blue-400">✓</div>
                <div className="text-xs text-slate-400 mt-1">Endpoint Auditoría</div>
              </Card>
            </div>

            {/* Timeline del proceso */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Proceso de Emisión</CardTitle>
                <CardDescription>Automático y certificado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TimelineStep
                  number={1}
                  title="Venta en POS"
                  description="Registro completo de la transacción"
                />
                <TimelineStep
                  number={2}
                  title="Generación Códigos"
                  description="QR + Control Code + Fiscal Number"
                />
                <TimelineStep
                  number={3}
                  title="Impresión Factura"
                  description="Formato oficial con códigos fiscales"
                />
                <TimelineStep
                  number={4}
                  title="Registro Inmutable"
                  description="Guardado permanente, no modificable"
                />
                <TimelineStep
                  number={5}
                  title="Disponible SENIAT"
                  description="Endpoint listo para auditoría oficial"
                  isLast
                />
              </CardContent>
            </Card>

            {/* Features únicos */}
            <div className="space-y-3">
              <FeatureCheckItem
                icon={QrCode}
                text="Códigos QR verificables"
                description="Generación automática según normativa"
              />
              <FeatureCheckItem
                icon={Lock}
                text="Inmutabilidad blockchain-style"
                description="Las facturas emitidas no pueden modificarse"
              />
              <FeatureCheckItem
                icon={FileText}
                text="Notas de crédito/débito"
                description="Corrección de facturas según SENIAT"
              />
              <FeatureCheckItem
                icon={Shield}
                text="Endpoint de auditoría"
                description="Acceso especial para inspectores SENIAT"
              />
            </div>

            <Button
              variant="gradient"
              size="lg"
              className="w-full rounded-lg font-semibold relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Cumplir con SENIAT Hoy
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function TimelineStep({
  number,
  title,
  description,
  isLast = false,
}: {
  number: number
  title: string
  description: string
  isLast?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border-2 border-indigo-500 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0">
          {number}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-indigo-500/20 my-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="font-semibold text-white mb-1">{title}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function FeatureCheckItem({
  icon: Icon,
  text,
  description,
}: {
  icon: any
  text: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 transition-colors group">
      <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
        <Icon className="w-5 h-5 text-indigo-400" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white mb-0.5">{text}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </div>
  )
}

// ========================================
// SECCIÓN COMPARISON TABLE
// ========================================
function ComparisonSection() {
  const sectionRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, activar más temprano con amount más bajo
  const isInView = useInView(sectionRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.3,
    margin: isMobile ? '-150px' : '0px'
  })

  const features: Array<{
    name: string
    laCaja: boolean
    a2pos: boolean | 'partial'
    valerypos: boolean | 'partial'
    otros: boolean | 'partial'
  }> = [
      { name: 'Offline-first real', laCaja: true, a2pos: false, valerypos: false, otros: false },
      { name: 'Facturación SENIAT', laCaja: true, a2pos: true, valerypos: true, otros: 'partial' },
      { name: 'Dual Bs/USD nativo', laCaja: true, a2pos: false, valerypos: false, otros: 'partial' },
      { name: 'Contabilidad integrada', laCaja: true, a2pos: true, valerypos: true, otros: false },
      { name: 'IA/ML predictivo', laCaja: true, a2pos: false, valerypos: false, otros: false },
      { name: 'Multi-plataforma (PWA/Desktop/Android)', laCaja: true, a2pos: false, valerypos: false, otros: false },
      { name: 'Split payments (6 métodos)', laCaja: true, a2pos: 'partial', valerypos: 'partial', otros: false },
      { name: '24 bancos venezolanos', laCaja: true, a2pos: false, valerypos: false, otros: 'partial' },
      { name: 'Inventario multi-bodega', laCaja: true, a2pos: true, valerypos: true, otros: 'partial' },
      { name: 'Analytics tiempo real', laCaja: true, a2pos: true, valerypos: true, otros: 'partial' },
      { name: 'Plan gratuito ilimitado', laCaja: true, a2pos: false, valerypos: false, otros: false },
      { name: 'Setup en 5 minutos', laCaja: true, a2pos: false, valerypos: false, otros: 'partial' },
    ]

  const renderIcon = (status: boolean | 'partial') => {
    if (status === true) return <Check className="w-5 h-5 text-emerald-400" />
    if (status === 'partial') return <Minus className="w-5 h-5 text-amber-400" />
    return <X className="w-5 h-5 text-red-400/50" />
  }

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            Comparación Objetiva
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="text-white">¿Por qué</span>{' '}
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Velox POS?
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Comparación directa con los sistemas POS más utilizados en Venezuela.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6, delay: isMobile ? 0 : 0.2 }}
          className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0"
        >
          <div className="inline-block min-w-full">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-4 text-slate-400 font-medium">Característica</th>
                      <th className="p-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src="/logo-velox.svg"
                            alt="Velox POS Logo"
                            className="w-10 h-10 rounded-lg border-2 border-slate-700/50 shadow-lg shadow-blue-500/20"
                          />
                          <span className="text-white font-bold">Velox POS</span>
                        </div>
                      </th>
                      <th className="p-4 text-center text-slate-400">A2 POS</th>
                      <th className="p-4 text-center text-slate-400">ValeryPOS</th>
                      <th className="p-4 text-center text-slate-400">Otros POS VE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, index) => (
                      <motion.tr
                        key={feature.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={isInView ? { opacity: 1, x: 0 } : { opacity: isMobile ? 1 : 0, x: isMobile ? 0 : -20 }}
                        transition={{ duration: isMobile ? 0.2 : 0.4, delay: isMobile ? 0 : 0.1 * index }}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="p-4 text-slate-300 align-middle">{feature.name}</td>
                        <td className="p-4 text-center bg-blue-500/5 align-middle">
                          <div className="flex items-center justify-center">
                            {renderIcon(feature.laCaja)}
                          </div>
                        </td>
                        <td className="p-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            {renderIcon(feature.a2pos)}
                          </div>
                        </td>
                        <td className="p-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            {renderIcon(feature.valerypos)}
                          </div>
                        </td>
                        <td className="p-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            {renderIcon(feature.otros)}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Completo</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="w-4 h-4 text-amber-400" />
              <span>Parcial</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-400/50" />
              <span>No disponible</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ========================================
// SECCIÓN STATS IMPRESIONANTES
// ========================================
function StatsSection() {
  const sectionRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, activar más temprano con amount más bajo
  const isInView = useInView(sectionRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.3,
    margin: isMobile ? '-150px' : '0px'
  })

  const stats: StatItem[] = [
    { label: 'Uptime', value: 99.9, suffix: '%', icon: Zap, color: 'emerald' },
    { label: 'Tiempo Respuesta', value: 15, prefix: '<', suffix: 'ms', icon: Rocket, color: 'blue' },
    { label: 'Offline', value: 100, suffix: '%', icon: WifiOff, color: 'purple' },
    { label: 'SENIAT', value: 85, suffix: '%', icon: Shield, color: 'pink' },
    { label: 'Métodos Pago', value: 6, icon: Banknote, color: 'yellow' },
    { label: 'Bancos VE', value: 24, icon: Globe, color: 'cyan' },
    { label: 'Ventas/día', value: 10, suffix: 'K+', icon: TrendingUp, color: 'orange' },
    { label: 'Plataformas', value: 3, icon: Smartphone, color: 'indigo' },
    { label: 'Setup', value: 5, suffix: 'min', icon: Target, color: 'green' },
  ]

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            Números que Hablan
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-slate-300 bg-clip-text text-transparent">
              Estadísticas Impresionantes
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Rendimiento de clase mundial, hecho para Venezuela.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} isInView={isInView} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ========================================
// SECCIÓN DE PRICING - PLANES Y PRECIOS
// ========================================
function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const pricingRef = useRef(null)
  const isMobile = useMobileDetection()
  const isInView = useInView(pricingRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.2,
    margin: isMobile ? '-150px' : '0px'
  })
  const navigate = useNavigate()

  const plans = [
    {
      name: 'Freemium',
      description: 'Plan gratuito para empezar',
      price: { monthly: 0, yearly: 0 },
      features: [
        '1 Usuario',
        '50 Productos',
        '50 Facturas/mes',
        '1 Tienda',
        'Modo Offline Básico',
        'Reportes Básicos',
      ],
      cta: 'Empezar Gratis',
      popular: false,
      color: 'slate',
    },
    {
      name: 'Básico',
      description: 'Perfecto para pequeños negocios',
      price: { monthly: 29, yearly: 290 },
      features: [
        '3 Usuarios',
        '500 Productos',
        '1,000 Facturas/mes',
        '1 Tienda',
        'Modo Offline Completo',
        'Facturación Fiscal',
        'Inventario Básico',
        'Soporte WhatsApp',
      ],
      cta: 'Prueba Gratis 14 días',
      popular: true,
      color: 'blue',
    },
    {
      name: 'Profesional',
      description: 'Para negocios en crecimiento',
      price: { monthly: 79, yearly: 790 },
      features: [
        '10 Usuarios',
        '5,000 Productos',
        '10,000 Facturas/mes',
        '2 Tiendas',
        'Todo lo del Básico',
        'Inventario Avanzado',
        'Contabilidad Básica',
        'Soporte Prioritario',
        'Acceso API',
      ],
      cta: 'Contratar Ahora',
      popular: false,
      color: 'indigo',
    },
    {
      name: 'Empresarial',
      description: 'Para grandes empresas',
      price: { monthly: 199, yearly: 1990 },
      features: [
        'Usuarios Ilimitados',
        'Productos Ilimitados',
        'Facturación Ilimitada',
        'Hasta 99 Tiendas',
        'Todo lo del Profesional',
        'Contabilidad Completa',
        'IA Analytics',
        'Gerente de Cuenta Dedicado',
      ],
      cta: 'Contactar Ventas',
      popular: false,
      color: 'emerald',
    },
  ]

  return (
    <section id="pricing" className="py-24 relative overflow-hidden" ref={pricingRef}>
      <div className="absolute inset-0 bg-slate-900/50" />

      <div className="container mx-auto max-w-7xl relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            Precios Simples
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black text-white">
            Planes para cada{' '}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              etapa de tu negocio
            </span>
          </h2>
          <p className="text-xl text-slate-400">
            Comienza gratis y escala a medida que creces. Sin contratos forzosos.
          </p>

          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={cn("text-sm font-medium", billingPeriod === 'monthly' ? 'text-white' : 'text-slate-500')}>
              Mensual
            </span>
            <button
              onClick={() => setBillingPeriod(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-14 h-7 bg-slate-800 rounded-full p-1 transition-colors duration-200 border border-slate-700"
            >
              <div
                className={cn(
                  "w-5 h-5 bg-blue-500 rounded-full shadow-lg transition-transform duration-200",
                  billingPeriod === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                )}
              />
            </button>
            <span className={cn("text-sm font-medium flex items-center gap-2", billingPeriod === 'yearly' ? 'text-white' : 'text-slate-500')}>
              Anual
              <Badge variant="outline" className="text-xs border-green-500 text-green-400 bg-green-500/10">
                Ahorra 2 meses
              </Badge>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <Card
                className={cn(
                  "h-full relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col",
                  plan.popular
                    ? "bg-slate-800/80 border-blue-500/50 shadow-blue-500/10"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 p-4">
                    <Badge className="bg-blue-500 hover:bg-blue-600">Más Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-400 h-10">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 flex-1 flex flex-col">
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">
                        ${billingPeriod === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                      </span>
                      <span className="text-slate-500">
                        /mes
                      </span>
                    </div>
                    {billingPeriod === 'yearly' && plan.price.yearly > 0 && (
                      <p className="text-sm text-green-400 font-medium">
                        Facturado ${plan.price.yearly}/año
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                        <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={cn(
                      "w-full font-bold mt-4",
                      plan.popular
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    )}
                    size="lg"
                    onClick={() => navigate('/login')}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ========================================
// SECCIÓN TESTIMONIALS
// ========================================
function TestimonialsSection() {
  const sectionRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, activar más temprano con amount más bajo
  // Forzar render inicial en mobile para evitar problemas de carga
  const [forceRender, setForceRender] = useState(isMobile)
  const isInView = useInView(sectionRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.3,
    margin: isMobile ? '-150px' : '0px'
  })

  // En mobile, forzar render después de un pequeño delay si no se activó isInView
  useEffect(() => {
    if (isMobile && !forceRender) {
      const timer = setTimeout(() => setForceRender(true), 200)
      return () => clearTimeout(timer)
    }
  }, [isMobile, forceRender])

  // Usar forceRender en mobile si isInView no se ha activado
  const shouldAnimate = isMobile ? (forceRender || isInView) : isInView

  const testimonials = [
    {
      name: 'María González',
      role: 'Dueña de Bodega La Esquina',
      location: 'Caracas',
      rating: 5,
      quote: 'Antes perdía ventas cada vez que se iba el internet. Con Velox POS trabajo 100% offline y todo se sincroniza automático cuando vuelve la conexión. En 3 meses recuperé la inversión.',
      avatar: '👩‍💼',
      highlight: 'Recuperó inversión en 3 meses',
    },
    {
      name: 'Carlos Ramírez',
      role: 'Gerente de Supermercado',
      location: 'Valencia',
      rating: 5,
      quote: 'La facturación fiscal SENIAT integrada nos salvó. No tenemos que usar sistemas externos ni pagar más. El soporte técnico es excelente y siempre están disponibles.',
      avatar: '👨‍💼',
      highlight: 'Ahorra $500/mes en software fiscal',
    },
    {
      name: 'Ana Martínez',
      role: 'Propietaria de Farmacia',
      location: 'Maracaibo',
      rating: 5,
      quote: 'El sistema de inventario multi-bodega es perfecto. Controlo 3 sucursales desde un solo lugar. La IA me sugiere qué comprar antes de que se me acabe el stock.',
      avatar: '👩‍⚕️',
      highlight: 'Controla 3 sucursales sin esfuerzo',
    },
  ]

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900/50 to-slate-900/30">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
            Casos de Éxito
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="text-white">Lo que dicen</span>{' '}
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Nuestros Clientes
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Negocios reales, resultados reales. Historias de éxito de toda Venezuela.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: isMobile ? 0.3 : 0.5, delay: isMobile ? 0 : index * 0.1 }}
            >
              <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/30 transition-all duration-300 h-full group">
                <CardHeader>
                  {/* Quote icon */}
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                    <Quote className="w-6 h-6 text-amber-400" />
                  </div>

                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-slate-300 leading-relaxed italic mb-4">
                    "{testimonial.quote}"
                  </p>

                  {/* Highlight badge */}
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs w-fit">
                    ✓ {testimonial.highlight}
                  </Badge>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{testimonial.avatar}</div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-sm text-slate-400">{testimonial.role}</p>
                      <p className="text-xs text-slate-500">{testimonial.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Trust banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Card className="bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border-emerald-500/30 inline-block">
            <CardContent className="p-6">
              <p className="text-lg text-slate-300">
                <span className="font-bold text-emerald-400">500+ negocios</span> confían en Velox POS
                para gestionar más de{' '}
                <span className="font-bold text-blue-400">10,000 ventas diarias</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

// ========================================
// SECCIÓN FAQ
// ========================================
function FAQSection() {
  const sectionRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, activar más temprano con amount más bajo
  const isInView = useInView(sectionRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.3,
    margin: isMobile ? '-150px' : '0px'
  })
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      question: '¿Realmente funciona 100% offline?',
      answer: 'Sí. Velox POS usa arquitectura offline-first con event sourcing. Todas las operaciones (ventas, inventario, reportes) funcionan sin internet. Cuando vuelve la conexión, todo se sincroniza automáticamente sin pérdida de datos.',
    },
    {
      question: '¿Cómo funciona la facturación fiscal SENIAT?',
      answer: 'Tenemos 85% de cumplimiento con la Providencia SNAT/2024/000121. Generamos códigos QR, control codes y fiscal numbers automáticamente. Las facturas son inmutables y tenemos un endpoint especial para auditorías del SENIAT.',
    },
    {
      question: '¿Qué plataformas soporta?',
      answer: 'Velox POS funciona en 3 plataformas: PWA (navegador), Desktop (Windows/Mac/Linux con Electron) y Android nativo. Compras una licencia y usas en todos tus dispositivos.',
    },
    {
      question: '¿Puedo manejar múltiples tiendas?',
      answer: 'Sí. El plan Pro soporta hasta 5 usuarios y multi-bodega. El plan Enterprise soporta multi-tienda ilimitado con sincronización en tiempo real entre todas las sucursales.',
    },
    {
      question: '¿Cómo funciona el sistema dual Bs/USD?',
      answer: 'Velox POS obtiene la tasa BCV automáticamente cada día. Todos los productos se guardan en USD y se convierten a Bs en tiempo real. Soporta 6 métodos de pago y 24 bancos venezolanos.',
    },
    {
      question: '¿Qué hace la IA/ML predictivo?',
      answer: 'Nuestro sistema de IA analiza patrones de venta y predice demanda, detecta anomalías (posibles fraudes o errores), recomienda productos para comprar y optimiza niveles de inventario automáticamente.',
    },
    {
      question: '¿Hay costo de setup o migración?',
      answer: 'No. El plan gratuito es para siempre sin costo de setup. En planes pagos, la migración asistida está incluida. Setup completo en 5 minutos con nuestro wizard guiado.',
    },
    {
      question: '¿Qué soporte técnico incluye?',
      answer: 'Plan Free: email. Plan Pro: soporte prioritario 24/7 por chat y teléfono. Plan Enterprise: gerente de cuenta dedicado + capacitación in-situ + SLA 99.9% garantizado.',
    },
  ]

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
          transition={{ duration: isMobile ? 0.3 : 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            Preguntas Frecuentes
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black">
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ¿Tienes Preguntas?
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Aquí están las respuestas a las preguntas más comunes sobre Velox POS.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: isMobile ? 1 : 0, y: isMobile ? 0 : 20 }}
                transition={{ duration: isMobile ? 0.3 : 0.5, delay: isMobile ? 0 : index * 0.05 }}
              >
                <Card
                  className={cn(
                    'bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 cursor-pointer',
                    isOpen && 'border-blue-500/50 shadow-lg shadow-blue-500/10'
                  )}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                          <HelpCircle className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg text-white">{faq.question}</CardTitle>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex-shrink-0"
                      >
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      </motion.div>
                    </div>
                  </CardHeader>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <CardContent className="pt-0">
                          <p className="text-slate-300 leading-relaxed pl-11">{faq.answer}</p>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Contact support CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-slate-400 mb-4">¿No encontraste tu respuesta?</p>
          <Button
            variant="outline"
            className="border-2 border-slate-500 bg-slate-800/50 text-slate-100 hover:bg-slate-700/70 hover:text-white hover:border-slate-400 rounded-lg px-6 py-3 font-medium hover:shadow-lg hover:shadow-slate-500/30 transition-all duration-300 group"
          >
            <Mail className="mr-2 w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
            Contactar Soporte
          </Button>
        </motion.div>
      </div>
    </section>
  )
}

// ========================================
// SECCIÓN CTA FINAL
// ========================================
function FinalCTASection() {
  const sectionRef = useRef(null)
  const isMobile = useMobileDetection()
  // En mobile, activar más temprano con amount más bajo
  const isInView = useInView(sectionRef, {
    once: true,
    amount: isMobile ? 0.05 : 0.3,
    margin: isMobile ? '-150px' : '0px'
  })
  const navigate = useNavigate()

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900/30 to-slate-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.1),transparent_70%)]" />
      </div>

      <div className="container mx-auto max-w-5xl relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="bg-gradient-to-br from-blue-900/30 via-indigo-900/30 to-slate-900/30 border-blue-500/30 shadow-2xl shadow-blue-500/20 backdrop-blur-xl">
            <CardContent className="p-12 text-center space-y-8">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : { scale: 0 }}
                transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
                className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-600/50"
              >
                <Rocket className="w-10 h-10 text-white" />
              </motion.div>

              {/* Headline */}
              <div className="space-y-4">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black">
                  <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-slate-300 bg-clip-text text-transparent">
                    Transforma tu Negocio Hoy
                  </span>
                </h2>
                <p className="text-xl sm:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                  Únete a los <span className="font-bold text-white">500+ negocios</span> que ya están
                  vendiendo sin límites con Velox POS
                </p>
              </div>

              {/* Benefits */}
              <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Setup en 5 minutos</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Gratis para siempre</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Sin tarjeta de crédito</p>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button
                  variant="gradient"
                  size="xl"
                  onClick={() => navigate('/login')}
                  className="group relative overflow-hidden rounded-xl px-10 py-7 font-bold shadow-xl shadow-blue-500/20"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    Empezar Gratis Ahora
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="border-2 border-slate-500 bg-slate-800/40 text-slate-100 hover:bg-slate-700/60 hover:text-white hover:border-slate-400 rounded-xl px-10 py-7 font-semibold backdrop-blur-sm hover:shadow-xl hover:shadow-slate-500/30 transition-all duration-300 group"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Play className="mr-2 w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  Ver Demo
                </Button>
              </div>

              {/* Social proof */}
              <p className="text-sm text-slate-400 pt-4">
                Más de <span className="font-bold text-emerald-400">10,000 ventas</span> procesadas hoy •{' '}
                <span className="font-bold text-blue-400">99.9% uptime</span> •{' '}
                <span className="font-bold text-indigo-400">100% offline</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

// ========================================
// FOOTER
// ========================================
function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    producto: [
      { label: 'Características', href: '#features' },
      { label: 'Facturación SENIAT', href: '#seniat' },
      { label: 'Precios', href: '#pricing' },
      { label: 'Casos de Uso', href: '#' },
    ],
    recursos: [
      { label: 'Documentación', href: '#' },
      { label: 'API Reference', href: '#' },
      { label: 'Guías', href: '#' },
      { label: 'Blog', href: '#' },
    ],
    empresa: [
      { label: 'Sobre Nosotros', href: '#' },
      { label: 'Contacto', href: '#' },
      { label: 'Soporte', href: '#' },
      { label: 'Términos', href: '#' },
    ],
    comunidad: [
      { label: 'GitHub', href: '#' },
      { label: 'Twitter', href: '#' },
      { label: 'LinkedIn', href: '#' },
      { label: 'Discord', href: '#' },
    ],
  }

  return (
    <footer className="bg-slate-950 border-t border-slate-800 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/logo-velox-white.svg"
                alt="Velox POS Logo"
                className="w-10 h-10 rounded-lg border-2 border-slate-700/50 shadow-lg shadow-blue-500/20"
              />
              <span className="text-xl font-black text-white">
                Velox POS
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              El sistema POS que funciona sin internet. Hecho para Venezuela.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors group"
              >
                <Github className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </a>
              <a
                href="#"
                className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors group"
              >
                <Twitter className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </a>
              <a
                href="#"
                className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors group"
              >
                <Linkedin className="w-4 h-4 text-slate-400 group-hover:text-white" />
              </a>
            </div>
          </div>

          {/* Links columns */}
          <div>
            <h3 className="font-semibold text-white mb-4">Producto</h3>
            <ul className="space-y-3">
              {footerLinks.producto.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Recursos</h3>
            <ul className="space-y-3">
              {footerLinks.recursos.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Empresa</h3>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Comunidad</h3>
            <ul className="space-y-3">
              {footerLinks.comunidad.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {currentYear} Velox POS. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              Privacidad
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              Términos
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              Cookies
            </a>
          </div>
        </div>

        {/* Made in Venezuela badge */}
        <div className="mt-8 text-center">
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
            🇻🇪 Hecho con ❤️ en Venezuela
          </Badge>
        </div>
      </div>
    </footer>
  )
}
