import { useState } from 'react'
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
import { Loader2, Store, Lock, ChevronRight } from 'lucide-react'
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
      
      login(response.access_token, user)

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
      navigate('/dashboard')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative flex items-center justify-center p-6 overflow-hidden">
      {/* Partículas decorativas minimalistas usando CSS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(45)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, (Math.random() - 0.5) * 30, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
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
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, rotateY: -180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{
              delay: 0.1,
              type: 'spring',
              stiffness: 200,
            }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-xl"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Store className="w-8 h-8 text-white" strokeWidth={2.5} />
          </motion.div>
          <motion.h1
            className="text-4xl font-bold tracking-tight text-gray-900 mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Bienvenido
          </motion.h1>
          <motion.p
            className="text-base text-gray-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Inicia sesión en tu punto de venta
          </motion.p>
        </div>

        {/* Main Card */}
        <Card className="border-blue-200/50 shadow-2xl backdrop-blur-xl bg-white/80">
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {/* Selección de Tienda */}
            <div className="space-y-2">
              <Label htmlFor="store_id" className="text-sm font-medium">
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
                    <SelectTrigger className={cn("h-11", errors.store_id && "border-destructive")}>
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
                <p className="text-xs text-destructive">{errors.store_id.message}</p>
              )}
            </div>

            {/* Selección de Empleado */}
            <AnimatePresence mode="wait">
              {selectedStoreId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  <Label className="text-sm font-medium">Empleado</Label>
                  {loadingCashiers ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-sm">Cargando empleados...</span>
                    </div>
                  ) : cashiers && cashiers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {cashiers.map((cashier) => (
                        <motion.button
                          key={cashier.user_id}
                          type="button"
                          onClick={() => setSelectedCashierId(cashier.user_id)}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200",
                            selectedCashierId === cashier.user_id
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border/50 hover:border-primary/50 hover:bg-accent/50"
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            selectedCashierId === cashier.user_id ? "bg-primary scale-125" : "bg-muted"
                          )} />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {cashier.full_name || 'Sin nombre'}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {cashier.role === 'owner' ? 'Propietario' : 'Cajero'}
                            </p>
                          </div>
                          {selectedCashierId === cashier.user_id && (
                            <ChevronRight className="w-4 h-4 text-primary" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay empleados disponibles
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* PIN Input */}
            <AnimatePresence mode="wait">
              {selectedCashierId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  <Label htmlFor="pin" className="text-sm font-medium">
                    PIN {selectedCashierName && `de ${selectedCashierName}`}
                  </Label>
                  <Input
                    type="password"
                    id="pin"
                    placeholder="••••"
                    maxLength={6}
                    className={cn("h-11 text-center text-lg tracking-widest", errors.pin && "border-destructive")}
                    {...register('pin')}
                    autoFocus
                  />
                  {errors.pin && (
                    <p className="text-xs text-destructive">{errors.pin.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg hover:shadow-xl transition-all"
              disabled={mutation.isPending || !selectedCashierId}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Iniciar sesión
                </>
              )}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
