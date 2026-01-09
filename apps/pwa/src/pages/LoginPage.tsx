import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/stores/auth.store'
import { authService, type LoginResponse } from '@/services/auth.service'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchAllData } from '@/services/prefetch.service'
import { syncService } from '@/services/sync.service'
import { Loader2, Lock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  store_id: z.string().min(1, 'Selecciona una tienda'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 dígitos').max(6, 'El PIN debe tener máximo 6 dígitos'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const queryClient = useQueryClient()
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedCashierId, setSelectedCashierId] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      store_id: '',
      pin: '',
    },
  })

  const { data: stores, isLoading: loadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: authService.getStores,
  })

  const { data: cashiers, isLoading: loadingCashiers } = useQuery({
    queryKey: ['cashiers', selectedStoreId],
    queryFn: () => authService.getCashiers(selectedStoreId),
    enabled: !!selectedStoreId,
  })


  const mutation = useMutation({
    mutationFn: (data: LoginForm) =>
      authService.login({ store_id: data.store_id, pin: data.pin }),
    onSuccess: async (response: LoginResponse) => {
      console.log('[Login] ✅ Login exitoso', response)
      
      // Convertir LoginResponse al formato que espera el store
      const user = {
        user_id: response.user_id,
        store_id: response.store_id,
        role: response.role,
        full_name: response.full_name,
        license_status: response.license_status,
        license_expires_at: response.license_expires_at || null,
      }
      
      login(response.access_token, response.refresh_token, user)

      try {
        await syncService.ensureInitialized(response.store_id)
        console.log('[Login] ✅ SyncService inicializado')
      } catch (error) {
        console.warn('[Login] ⚠️ Error al inicializar SyncService (no crítico):', error)
      }

      try {
        await prefetchAllData({ storeId: response.store_id, queryClient })
        console.log('[Prefetch] ✅ Cacheo completo')
      } catch (error) {
        console.warn('[Prefetch] ⚠️ Error al prefetch (no crítico):', error)
      }

      // Obtener primer nombre para el mensaje
      const firstName = response.full_name?.split(' ')[0] || 'Usuario'
      toast.success(`¡Bienvenido, ${firstName}!`)
      navigate('/app/dashboard')
    },
    onError: (error: Error) => {
      console.error('[Login] ❌ Error en login:', error)
      toast.error(error.message || 'Error al iniciar sesión')
    },
  })

  const onSubmit = async (data: LoginForm) => {
    mutation.mutate(data)
  }

  const selectedCashierName = cashiers?.find((c) => c.user_id === selectedCashierId)?.full_name

  // Partículas memorizadas para evitar regeneración en cada render
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => {
      const size = Math.random() * 3 + 2
      const baseDelay = Math.random() * 3
      const duration = 5 + Math.random() * 4
      const moveDistance = 30 + Math.random() * 20

      return {
        id: i,
        size,
        left: Math.random() * 100,
        top: Math.random() * 100,
        baseDelay,
        duration,
        yMove: [(Math.random() - 0.5) * moveDistance, (Math.random() - 0.5) * moveDistance * 0.5],
        xMove: [(Math.random() - 0.5) * moveDistance * 0.4, (Math.random() - 0.5) * moveDistance * 0.2],
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-white relative flex items-center justify-center p-6 overflow-hidden">
      {/* Partículas decorativas sutiles */}
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
              backgroundColor: 'rgba(13, 129, 206, 0.5)',
            }}
            animate={{
              y: [0, particle.yMove[0], particle.yMove[1], 0],
              x: [0, particle.xMove[0], particle.xMove[1], 0],
              opacity: [0.2, 0.6, 0.4, 0.2],
              scale: [1, 1.3, 1.1, 1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.baseDelay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header - Mejorado con tipografía moderna */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, rotateY: -180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{
              delay: 0.1,
              type: 'spring',
              stiffness: 200,
            }}
            className="inline-flex items-center justify-center mb-8"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <img 
              src="/favicon.svg" 
              alt="LA CAJA Logo" 
              className="w-20 h-20 rounded-2xl border-2 border-slate-300/50 shadow-xl"
            />
          </motion.div>
          <motion.h1
            className="text-5xl font-extrabold tracking-tight mb-4 leading-tight"
            style={{
              color: 'rgb(13, 129, 206)', // Color exacto del logo
              textShadow: '0 2px 8px rgba(13, 129, 206, 0.2)',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Bienvenido
          </motion.h1>
          <motion.p
            className="text-lg text-gray-600 font-medium leading-relaxed"
            style={{
              letterSpacing: '0.01em',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Inicia sesión en tu punto de venta
          </motion.p>
        </div>

        {/* Main Card - Mejorado con diseño moderno */}
        <Card className="border-2 shadow-2xl backdrop-blur-xl bg-white/95 rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(13, 129, 206, 0.2)' }}>
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(to right, rgb(13, 129, 206), rgba(13, 129, 206, 0.8), rgb(13, 129, 206))` }} />
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {/* Selección de Tienda - Mejorado */}
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Label htmlFor="store_id" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgb(13, 129, 206)' }} />
                Tienda
              </Label>
              <Controller
                name="store_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      setSelectedStoreId(value)
                      setSelectedCashierId('')
                    }}
                    disabled={loadingStores}
                  >
                    <SelectTrigger 
                      className={cn(
                        "h-12 text-base border-2 transition-all duration-200",
                        errors.store_id 
                          ? "border-destructive focus:border-destructive" 
                          : "border-gray-200"
                      )}
                      style={!errors.store_id ? {
                        '--hover-border': 'rgba(13, 129, 206, 0.5)',
                        '--focus-border': 'rgb(13, 129, 206)',
                      } as React.CSSProperties & { '--hover-border'?: string; '--focus-border'?: string } : undefined}
                      onMouseEnter={(e) => {
                        if (!errors.store_id) {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(13, 129, 206, 0.5)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!errors.store_id) {
                          (e.currentTarget as HTMLElement).style.borderColor = ''
                        }
                      }}
                      onFocus={(e) => {
                        if (!errors.store_id) {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgb(13, 129, 206)'
                        }
                      }}
                      onBlur={(e) => {
                        if (!errors.store_id) {
                          (e.currentTarget as HTMLElement).style.borderColor = ''
                        }
                      }}
                    >
                      <SelectValue placeholder="Selecciona tu tienda" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores?.map((store) => {
                        const expired = store.license_expires_at ? new Date(store.license_expires_at).getTime() < Date.now() : false
                        const blocked = store.license_status === 'suspended' || expired
                        return (
                          <SelectItem key={store.id} value={store.id} disabled={blocked}>
                            {store.name}
                            {blocked && ' (licencia vencida/suspendida)'}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.store_id && (
                <motion.p 
                  className="text-xs text-destructive font-medium"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {errors.store_id.message}
                </motion.p>
              )}
            </motion.div>

            {/* Selección de Empleado - Mejorado */}
            <AnimatePresence mode="wait">
              {selectedStoreId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-3 overflow-hidden"
                >
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgb(13, 129, 206)' }} />
                    Empleado
                  </Label>
                  {loadingCashiers ? (
                    <motion.div 
                      className="flex items-center justify-center py-10 text-muted-foreground"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Loader2 className="w-5 h-5 animate-spin mr-3" style={{ color: 'rgb(13, 129, 206)' }} />
                      <span className="text-sm font-medium">Cargando empleados...</span>
                    </motion.div>
                  ) : cashiers && cashiers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {cashiers.map((cashier, index) => (
                        <motion.button
                          key={cashier.user_id}
                          type="button"
                          onClick={() => setSelectedCashierId(cashier.user_id)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 relative overflow-hidden",
                            selectedCashierId === cashier.user_id
                              ? "border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-lg shadow-blue-500/20"
                              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50/80 hover:shadow-md"
                          )}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Indicador de selección mejorado */}
                          <div className={cn(
                            "w-3 h-3 rounded-full transition-all duration-300 flex items-center justify-center",
                            selectedCashierId === cashier.user_id 
                              ? "bg-blue-500 scale-125 shadow-lg shadow-blue-500/50" 
                              : "bg-gray-300"
                          )}>
                            {selectedCashierId === cashier.user_id && (
                              <motion.div
                                className="w-1.5 h-1.5 rounded-full bg-white"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500 }}
                              />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className={cn(
                              "text-sm font-semibold transition-colors",
                              selectedCashierId === cashier.user_id ? "text-blue-700" : "text-gray-900"
                            )}>
                              {cashier.full_name || 'Sin nombre'}
                            </p>
                            <p className={cn(
                              "text-xs capitalize transition-colors",
                              selectedCashierId === cashier.user_id ? "text-blue-600" : "text-gray-500"
                            )}>
                              {cashier.role === 'owner' ? 'Propietario' : 'Cajero'}
                            </p>
                          </div>
                          {selectedCashierId === cashier.user_id && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            >
                              <ChevronRight className="w-5 h-5 text-blue-500" />
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <motion.p 
                      className="text-sm text-muted-foreground text-center py-6 font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      No hay empleados disponibles
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* PIN Input - Mejorado */}
            <AnimatePresence mode="wait">
              {selectedCashierId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-3 overflow-hidden"
                >
                  <Label htmlFor="pin" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    PIN {selectedCashierName && <span className="font-normal text-gray-500">de {selectedCashierName}</span>}
                  </Label>
                  <Input
                    type="password"
                    id="pin"
                    placeholder="••••"
                    maxLength={6}
                    className={cn(
                      "h-12 text-center text-xl tracking-[0.5em] font-semibold border-2 transition-all duration-200",
                      errors.pin 
                        ? "border-destructive focus:border-destructive" 
                        : "border-gray-200 hover:border-blue-300 focus:border-blue-500"
                    )}
                    {...register('pin')}
                    autoFocus
                  />
                  {errors.pin && (
                    <motion.p 
                      className="text-xs text-destructive font-medium"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {errors.pin.message}
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button - Mejorado */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                type="submit"
                className={cn(
                  "w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden",
                  "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                disabled={mutation.isPending || !selectedCashierId}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    Iniciar sesión
                  </>
                )}
                {/* Efecto de brillo en hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '200%' }}
                  transition={{ duration: 0.6 }}
                />
              </Button>
            </motion.div>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
