import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Mail,
  Star,
  ChevronDown,
  Play,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    {
      icon: Globe,
      title: 'Offline-First Nativo',
      description: 'Funciona 100% sin internet. La única solución POS que realmente funciona en Venezuela.',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Brain,
      title: 'Inteligencia Artificial',
      description: 'Predicción de demanda, recomendaciones inteligentes y detección de anomalías automática.',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: BarChart3,
      title: 'Analytics en Tiempo Real',
      description: 'Dashboard ejecutivo con KPIs en vivo, heatmaps de ventas y métricas comparativas.',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: Shield,
      title: 'Sincronización Resiliente',
      description: 'Cola de eventos con reintentos automáticos. Funciona perfecto con conexiones intermitentes.',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: Smartphone,
      title: 'Multiplataforma',
      description: 'PWA, Desktop y Android. Funciona en cualquier dispositivo, en cualquier lugar.',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
    },
    {
      icon: TrendingUp,
      title: 'Contabilidad Integrada',
      description: 'Plan de cuentas, asientos automáticos y reportes contables completos integrados.',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
  ]

  const plans = [
    {
      name: 'Freemium',
      price: 'GRATIS',
      period: 'para siempre',
      description: 'Perfecto para empezar',
      popular: false,
      features: [
        '1 Usuario',
        '1 Bodega/POS',
        '500 productos',
        '1,000 ventas/mes',
        'POS completo offline-first',
        'Gestión básica de inventario',
        'Dashboard básico',
        'Soporte por email (vía VioTech OPS)',
      ],
      limitations: ['Sin multi-bodega', 'Sin facturación fiscal', 'Sin IA/ML'],
      cta: 'Empezar Gratis',
      color: 'from-slate-600 to-slate-800',
      buttonColor: 'bg-slate-700 hover:bg-slate-600',
    },
    {
      name: 'Básico',
      price: '$29',
      period: '/mes',
      description: 'Para pequeños negocios',
      popular: true,
      features: [
        '3 Usuarios',
        '3 Bodegas/POS',
        'Productos ilimitados',
        'Ventas ilimitadas',
        'Multi-bodega',
        'Órdenes de compra',
        'Reportes avanzados',
        'Backup automático semanal',
        'Soporte prioritario vía VioTech OPS',
      ],
      limitations: [],
      cta: 'Empezar Ahora',
      color: 'from-blue-600 to-blue-800',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      savings: '$290/año (2 meses gratis)',
    },
    {
      name: 'Profesional',
      price: '$79',
      period: '/mes',
      description: 'Para negocios en crecimiento',
      popular: false,
      features: [
        'Usuarios ilimitados',
        'Bodegas ilimitadas',
        'Facturación fiscal (SENIAT)',
        'Contabilidad integrada',
        'IA/ML (predicciones, anomalías)',
        'Analytics en tiempo real',
        'Dashboard ejecutivo completo',
        'API (10K req/mes)',
        'Backup diario',
        'Soporte prioritario vía VioTech OPS',
        'Capacitación incluida',
      ],
      limitations: [],
      cta: 'Upgrade Ahora',
      color: 'from-purple-600 to-purple-800',
      buttonColor: 'bg-purple-600 hover:bg-purple-700',
      savings: '$790/año (2 meses gratis)',
    },
    {
      name: 'Empresarial',
      price: '$199',
      period: '/mes',
      description: 'Para grandes empresas',
      popular: false,
      features: [
        'Todo del Profesional',
        'API ilimitada',
        'Integraciones personalizadas',
        'SLA garantizado (99.9%)',
        'Soporte 24/7 vía VioTech OPS',
        'Gestor de cuenta dedicado',
        'Consultoría (4h/mes)',
        'White-label disponible',
        'Backup en tiempo real',
        'Onboarding personalizado',
      ],
      limitations: [],
      cta: 'Contactar Ventas',
      color: 'from-emerald-600 to-emerald-800',
      buttonColor: 'bg-emerald-600 hover:bg-emerald-700',
      savings: '$1,990/año (2 meses gratis)',
    },
  ]

  const testimonials = [
    {
      name: 'María González',
      role: 'Dueña de tienda',
      company: 'Tienda Los Andes',
      content: 'Finalmente un sistema que funciona sin internet. Es increíble cómo podemos seguir trabajando durante los cortes.',
      rating: 5,
    },
    {
      name: 'Carlos Rodríguez',
      role: 'Gerente General',
      company: 'Supermercado Central',
      content: 'La IA nos ayudó a predecir la demanda y redujimos el stock muerto en 40%. Excelente inversión.',
      rating: 5,
    },
    {
      name: 'Ana Martínez',
      role: 'Contadora',
      company: 'Distribuidora Nacional',
      content: 'La contabilidad integrada me ahorra horas de trabajo cada semana. Todo se sincroniza automáticamente.',
      rating: 5,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header con scroll */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-slate-900/95 backdrop-blur-md border-b border-slate-800' : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                LA CAJA
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-300 hover:text-white transition-colors">
                Características
              </a>
              <a href="#pricing" className="text-slate-300 hover:text-white transition-colors">
                Precios
              </a>
              <a href="#testimonials" className="text-slate-300 hover:text-white transition-colors">
                Testimonios
              </a>
            </nav>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-slate-300 hover:text-white"
              >
                Iniciar Sesión
              </Button>
              <Button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Empezar Gratis
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-4 py-1.5">
              <Sparkles className="w-4 h-4 mr-2" />
              La única solución POS offline-first para Venezuela
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                El Sistema POS
              </span>
              <br />
              <span className="text-white">que Funciona Sin Internet</span>
            </h1>

            <p className="text-xl sm:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Gestión completa de punto de venta con IA integrada, contabilidad automática y analytics
              en tiempo real. Diseñado específicamente para la realidad venezolana.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg px-8 py-6 h-auto group"
              >
                Empezar Gratis Ahora
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white text-lg px-8 py-6 h-auto"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <Play className="mr-2 w-5 h-5" />
                Ver Demo
              </Button>
            </div>

            <div className="flex items-center justify-center gap-8 pt-8 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>Gratis para siempre</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>Setup en 5 minutos</span>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="pt-12">
              <ChevronDown className="w-6 h-6 text-slate-500 mx-auto animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
              Características Únicas
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold">
              Todo lo que necesitas para{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                gestionar tu negocio
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Tecnología de punta combinada con simplicidad. Diseñado para crecer contigo.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card
                  key={index}
                  className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 group"
                >
                  <CardHeader>
                    <div className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-slate-400 text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Precios Transparentes
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold">
              Elige el plan{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                perfecto para ti
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Empieza gratis y escala cuando crezcas. Sin compromisos, cancela cuando quieras.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`relative bg-gradient-to-b ${plan.color} border-slate-700 ${
                  plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
                } transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-4 py-1">Más Popular</Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-white text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-300">{plan.description}</CardDescription>
                  <div className="pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      {plan.period && <span className="text-slate-300">{plan.period}</span>}
                    </div>
                    {plan.savings && (
                      <p className="text-sm text-slate-400 mt-1">{plan.savings}</p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-200">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations.map((limit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-400">
                        <span className="w-5 h-5 flex-shrink-0 mt-0.5 text-center">—</span>
                        <span className="text-sm line-through">{limit}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plan.buttonColor} text-white mt-6 h-12 text-base`}
                    onClick={() => navigate('/login')}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-12 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Soporte Centralizado en VioTech OPS
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Todo el soporte de LA CAJA se gestiona desde nuestro sistema central{' '}
                    <strong className="text-blue-400">VioTech OPS</strong>, nuestra nave central de operaciones.
                    Regístrate en VioTech OPS para reportar incidencias, solicitar asistencia y gestionar todos
                    tus tickets de soporte de manera centralizada.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button
                      variant="outline"
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                      onClick={() => window.open('https://viotech.com.co/', '_blank')}
                    >
                      Acceder a VioTech OPS
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-400">
                      Registro gratuito • Gestión de tickets • Soporte 24/7
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <p className="text-slate-400">
              ¿Necesitas un plan personalizado?{' '}
              <a href="mailto:pricing@lacaja.pos" className="text-blue-400 hover:text-blue-300 underline">
                Contacta a nuestro equipo
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              Lo que Dicen Nuestros Clientes
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold">
              Miles de negocios confían en{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                LA CAJA
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <CardDescription className="text-slate-300 text-base">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-sm text-slate-400">
                        {testimonial.role} - {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white">
            <CardContent className="p-12 text-center space-y-6">
              <h2 className="text-4xl sm:text-5xl font-bold">
                ¿Listo para transformar tu negocio?
              </h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Únete a miles de empresas que ya están usando LA CAJA para gestionar sus ventas de
                manera más eficiente.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 h-auto"
                >
                  Empezar Gratis Ahora
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="border-white text-white hover:bg-white/10 text-lg px-8 py-6 h-auto"
                >
                  Ver Demo
                </Button>
              </div>
              <p className="text-sm text-blue-100 pt-4">
                Sin tarjeta de crédito • Setup en 5 minutos • Soporte incluido
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  LA CAJA
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                El sistema POS offline-first para Venezuela
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Producto</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Características
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    Precios
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="hover:text-white transition-colors">
                    Testimonios
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Soporte</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a
                    href="https://viotech.com.co/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    VioTech OPS - Centro de Soporte
                  </a>
                </li>
                <li>
                  <a href="mailto:support@lacaja.pos" className="hover:text-white transition-colors flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    support@lacaja.pos
                  </a>
                </li>
                <li className="text-slate-500 text-xs">
                  Todos los tickets se gestionan desde VioTech OPS
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Términos de Servicio
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacidad
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm text-slate-500">
            <p>© 2025 LA CAJA. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

