import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, Variants } from 'framer-motion'
import {
  ArrowRight,
  Shield,
  BarChart3,
  Zap,
  Wifi,
  QrCode,
  ReceiptText,
  Boxes,
  Check,
  Brain,
  Globe,
  Lock,
  Quote,
} from 'lucide-react'
import { Button } from '@la-caja/ui-core'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@la-caja/ui-core'

const sectionFade: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function LandingPageEnhanced() {
  const navigate = useNavigate()
  const { scrollYProgress } = useScroll()
  const haloY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const haloY2 = useTransform(scrollYProgress, [0, 1], [0, -80])
  const haloY3 = useTransform(scrollYProgress, [0, 1], [0, 60])
  const heroTitleY = useTransform(scrollYProgress, [0, 0.25], [0, -18])
  const heroSubtitleY = useTransform(scrollYProgress, [0, 0.25], [0, -10])
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  const features = useMemo(
    () => [
      {
        title: 'Ventas rápidas, sin fricción',
        description: 'POS ágil, flujos inteligentes y control de caja con cierres consistentes.',
        icon: Zap,
      },
      {
        title: 'Fiscal y contable alineado',
        description: 'Facturación fiscal, series, notas y contabilidad integrada sin desbalances.',
        icon: ReceiptText,
      },
      {
        title: 'Offline real',
        description: 'Vende sin Internet, sincroniza cuando vuelve. Sin pérdida de datos.',
        icon: Wifi,
      },
      {
        title: 'Inventario con precisión',
        description: 'Bodegas, lotes y costos claros. Evita quiebres y mermas invisibles.',
        icon: Boxes,
      },
      {
        title: 'Catálogo público y QR',
        description: 'Menú y catálogo elegantes con acceso público, sin exponer costos internos.',
        icon: QrCode,
      },
      {
        title: 'Seguridad por diseño',
        description: 'Roles, trazabilidad y auditoría. Control sin burocracia.',
        icon: Shield,
      },
    ],
    []
  )

  const roadmap = useMemo(
    () => [
      {
        title: 'Ahora: operación impecable',
        description: 'POS, fiscal, inventario, offline y cocina listos para producción.',
        status: 'Disponible',
      },
      {
        title: 'Próximo: analítica predictiva',
        description: 'IA para demanda, recomendaciones y optimización de compras.',
        status: 'En camino',
      },
      {
        title: 'Futuro: automatización total',
        description: 'Workflows contables, conciliaciones y alertas inteligentes.',
        status: 'Visión',
      },
    ],
    []
  )

  const testimonials = useMemo(
    () => [
      {
        quote:
          'Con Velox POS dejamos de improvisar. La caja cuadra y el fiscal no se rompe.',
        author: 'María F.',
        role: 'Restaurante · Caracas',
      },
      {
        quote:
          'El modo offline es real. Vendemos sin internet y todo sincroniza perfecto.',
        author: 'Luis G.',
        role: 'Retail · Valencia',
      },
      {
        quote:
          'Inventario y cocina por fin hablan el mismo idioma. Menos errores, más velocidad.',
        author: 'Ana P.',
        role: 'Cocina · Maracaibo',
      },
    ],
    []
  )

  const architecture = useMemo(
    () => [
      {
        title: 'Offline-first',
        description: 'Ventas y caja operan localmente, sin depender de internet.',
      },
      {
        title: 'Sincronización segura',
        description: 'Eventos con prioridad y reconciliación automática.',
      },
      {
        title: 'Fiscal & Contable',
        description: 'Facturas y asientos consistentes, sin desbalances.',
      },
    ],
    []
  )

  const pricing = useMemo(
    () => [
      {
        name: 'Básico',
        price: '$29',
        tone: 'bg-white',
        features: ['3 usuarios', '500 productos', 'Offline completo', 'Fiscal'],
      },
      {
        name: 'Profesional',
        price: '$79',
        tone: 'bg-[#f8fbff]',
        features: ['10 usuarios', '5.000 productos', 'Inventario avanzado', 'Contabilidad'],
        highlight: true,
      },
      {
        name: 'Empresarial',
        price: '$199',
        tone: 'bg-white',
        features: ['Usuarios ilimitados', 'IA Analytics', 'Hasta 99 tiendas', 'Cuenta dedicada'],
      },
    ],
    []
  )

  return (
    <div className="min-h-[100dvh] bg-[#fbfaf8] text-slate-900 overflow-x-hidden touch-pan-y">
      {/* Background texture */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          style={{ y: haloY }}
          className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[#d9ecfb] blur-3xl"
        />
        <motion.div
          style={{ y: haloY2 }}
          className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-[#e1f2ff] blur-3xl"
        />
        <motion.div
          style={{ y: haloY3 }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(12,129,207,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(12,129,207,0.1),transparent_40%),linear-gradient(120deg,rgba(12,129,207,0.03),transparent_30%)]"
        />
        <div className={`absolute inset-0 opacity-20 mix-blend-soft-light bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="180" height="180" filter="url(%23n)" opacity="0.35"/></svg>')] bg-repeat`} />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white shadow-sm border border-white/70 flex items-center justify-center">
              <img src="/logo-velox.svg" alt="Velox POS" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#0C81CF] font-semibold drop-shadow-[0_2px_8px_rgba(12,129,207,0.35)]">Velox POS</p>
              <p className="text-sm text-slate-500">Operación elegante, control total</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-slate-600" onClick={() => navigate('/login')}>
              Iniciar sesión
            </Button>
            <Button className="bg-[#0C81CF] hover:bg-[#0a6ab0]" onClick={() => navigate('/register')}>
              Crear cuenta
            </Button>
          </div>
        </div>
        <motion.div
          style={{ width: progressWidth }}
          className="h-[2px] bg-gradient-to-r from-[#0C81CF] via-[#7cc8f8] to-transparent"
        />
      </header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-16 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <motion.div initial="hidden" animate="visible" variants={sectionFade}>
            <Badge className="bg-white text-[#0C81CF] border border-[#0C81CF]/20">Hecho para Venezuela</Badge>
            <motion.h1
              style={{ y: heroTitleY }}
              className="mt-5 text-4xl sm:text-5xl font-heading font-semibold tracking-tight text-slate-900"
            >
              Un POS premium que respeta tu operación y tu marca
            </motion.h1>
            <motion.p
              style={{ y: heroSubtitleY }}
              className="mt-5 text-slate-600 text-lg leading-relaxed"
            >
              Velox POS une ventas, fiscal y contabilidad en una sola experiencia. Elegante, veloz y
              listo para operar offline sin romper tus asientos.
            </motion.p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="bg-[#0C81CF] hover:bg-[#0a6ab0] relative overflow-hidden group shadow-[0_18px_40px_rgba(12,129,207,0.25)]"
                onClick={() => navigate('/register')}
              >
                <span className="relative z-10 inline-flex items-center">
                  Comenzar ahora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
                <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/30" />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>
              <Button
                variant="outline"
                className="border-[#0C81CF]/30 text-[#0C81CF] bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-white/90"
                onClick={() => navigate('/login')}
              >
                Ver demo
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 shadow-sm">
                <Shield className="h-3.5 w-3.5 text-[#0C81CF]" /> Fiscal listo
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 shadow-sm">
                <Wifi className="h-3.5 w-3.5 text-[#0C81CF]" /> Offline real
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 shadow-sm">
                <Lock className="h-3.5 w-3.5 text-[#0C81CF]" /> Trazabilidad
              </span>
            </div>
          </motion.div>

          {/* Asymmetric visual stack */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -top-6 -left-6 h-40 w-40 rounded-full bg-[#0C81CF]/10 blur-2xl" />
            <div className="relative grid gap-4">
              <Card className="rounded-3xl border-0 bg-white/90 shadow-[0_25px_60px_rgba(15,23,42,0.12)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Caja diaria</p>
                      <p className="text-2xl font-heading font-semibold">$ 2.540</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-[#0C81CF]/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-[#0C81CF]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border border-white/70 bg-white/80 shadow-[0_20px_45px_rgba(12,129,207,0.18)] translate-x-6">
                <CardContent className="p-6 space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Inventario crítico</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Smash Burger</p>
                      <p className="text-xs text-slate-500">Restan 12 uds</p>
                    </div>
                    <Badge className="bg-[#0C81CF]/10 text-[#0C81CF] text-[11px] font-semibold tracking-[0.2em]">Actualizar</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border border-white/70 bg-[#f7fbff] shadow-[0_18px_40px_rgba(15,23,42,0.08)] -translate-x-4">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Facturación fiscal</p>
                      <p className="text-xs text-slate-500">Series y control por tienda</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} variants={sectionFade}>
            <p className="text-xs uppercase tracking-[0.35em] text-[#0C81CF] font-semibold">Solución completa</p>
            <h2 className="mt-3 text-3xl font-heading font-semibold">Todo lo esencial, sin ruido</h2>
          </motion.div>
          <motion.div
            className="mt-10 grid gap-6 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  variants={staggerItem}
                  whileHover={{ y: -6 }}
                  className={cn('rounded-3xl border border-white/70 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6 transition-transform relative overflow-hidden group')}
                >
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#0C81CF]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_30%_20%,rgba(12,129,207,0.18),transparent_55%)]" />
                  <div className="h-12 w-12 rounded-2xl bg-[#0C81CF]/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[#0C81CF]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Proof / Testimonials */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.35 }} variants={sectionFade}>
            <p className="text-xs uppercase tracking-[0.35em] text-[#0C81CF] font-semibold">Confianza real</p>
            <h2 className="mt-3 text-3xl font-heading font-semibold">La operación se siente distinta</h2>
          </motion.div>
          <motion.div
            className="mt-10 grid gap-6 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {testimonials.map((item) => (
              <motion.div
                key={item.author}
                variants={staggerItem}
                whileHover={{ y: -6 }}
                className="rounded-3xl border border-white/70 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6 transition-transform relative overflow-hidden group"
              >
                <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-[#0C81CF]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_70%_80%,rgba(12,129,207,0.18),transparent_55%)]" />
                <Quote className="h-6 w-6 text-[#0C81CF] opacity-60" />
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">“{item.quote}”</p>
                <div className="mt-5">
                  <p className="text-sm font-semibold">{item.author}</p>
                  <p className="text-xs text-slate-500">{item.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Architecture */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.35 }} variants={sectionFade}>
            <p className="text-xs uppercase tracking-[0.35em] text-[#0C81CF] font-semibold">Arquitectura</p>
            <h2 className="mt-3 text-3xl font-heading font-semibold">Diseñado para escalar sin caos</h2>
            <p className="mt-3 text-sm text-slate-500 max-w-2xl">
              Cada capa está pensada para proteger tu operación. Datos consistentes, sync inteligente y
              contabilidad sin sorpresas.
            </p>
          </motion.div>
          <motion.div
            className="mt-10 grid gap-6 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {architecture.map((item) => (
              <motion.div
                key={item.title}
                variants={staggerItem}
                whileHover={{ y: -6 }}
                className="rounded-3xl border border-white/70 bg-[#f7fbff] shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6 transition-transform relative overflow-hidden group"
              >
                <div className="absolute -right-16 -bottom-16 h-40 w-40 rounded-full bg-[#0C81CF]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_70%_30%,rgba(12,129,207,0.18),transparent_55%)]" />
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.35 }} variants={sectionFade}>
            <p className="text-xs uppercase tracking-[0.35em] text-[#0C81CF] font-semibold">Camino Velox</p>
            <h2 className="mt-3 text-3xl font-heading font-semibold">Lo que ya existe y lo que construiremos</h2>
            <p className="mt-3 text-sm text-slate-500 max-w-2xl">
              Velox POS no es un experimento: ya opera ventas, fiscal y cocina. Nuestro siguiente paso es
              convertir la operación en inteligencia estratégica.
            </p>
          </motion.div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {roadmap.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="rounded-3xl border border-white/70 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6"
              >
                <Badge className="bg-[#0C81CF]/10 text-[#0C81CF]">{item.status}</Badge>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.35 }} variants={sectionFade}>
            <p className="text-xs uppercase tracking-[0.35em] text-[#0C81CF] font-semibold">Planes</p>
            <h2 className="mt-3 text-3xl font-heading font-semibold">Escala a tu ritmo</h2>
          </motion.div>
          <motion.div
            className="mt-10 grid gap-6 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {pricing.map((plan) => (
              <motion.div
                key={plan.name}
                variants={staggerItem}
                whileHover={{ y: -8 }}
                className="transition-transform relative group"
              >
                <Card
                  key={plan.name}
                  className={cn(
                    'rounded-3xl border border-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.08)]',
                    plan.tone,
                    plan.highlight && 'ring-2 ring-[#0C81CF]/50'
                  )}
                >
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#0C81CF]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_30%_20%,rgba(12,129,207,0.18),transparent_55%)]" />
                  <CardContent className="p-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      {plan.highlight && <Badge className="bg-[#0C81CF]/10 text-[#0C81CF]">Popular</Badge>}
                    </div>
                    <div className="text-3xl font-heading font-semibold">{plan.price}<span className="text-sm text-slate-500">/mes</span></div>
                    <ul className="space-y-2 text-sm text-slate-600">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-[#0C81CF]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full bg-[#0C81CF] hover:bg-[#0a6ab0]">Elegir plan</Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pb-20">
          <Card className="rounded-[32px] border border-white/70 bg-white/90 shadow-[0_25px_60px_rgba(15,23,42,0.12)]">
            <CardContent className="p-10 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[#0C81CF] font-semibold">Velox POS</p>
                <h3 className="mt-3 text-3xl font-heading font-semibold">Listo para tu operación premium</h3>
                <p className="mt-2 text-sm text-slate-500">Comienza hoy y construye el futuro de tu negocio con Velox.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="bg-[#0C81CF] hover:bg-[#0a6ab0] relative overflow-hidden group shadow-[0_18px_40px_rgba(12,129,207,0.25)]"
                  onClick={() => navigate('/register')}
                >
                  <span className="relative z-10">Comenzar ahora</span>
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/30" />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </Button>
                <Button
                  variant="outline"
                  className="border-[#0C81CF]/30 text-[#0C81CF] bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-white/90"
                  onClick={() => navigate('/login')}
                >
                  Iniciar sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/70">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/logo-velox.svg" alt="Velox POS" className="h-4 w-4" />
            © {new Date().getFullYear()} Velox POS. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2"><Globe className="h-3 w-3" />PWA · Desktop · Android</span>
            <span className="inline-flex items-center gap-2"><Brain className="h-3 w-3" />IA Analytics</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
