import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/stores/auth.store'
import { authService } from '@/services/auth.service'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchAllData } from '@/services/prefetch.service'
import { syncService } from '@/services/sync.service' // Importar el servicio de sincronización
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

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async (data) => {
      login(data.access_token, {
        user_id: data.user_id,
        store_id: data.store_id,
        role: data.role,
        full_name: data.full_name,
      })
      toast.success(`Bienvenido, ${data.full_name || 'Usuario'}`)
      
      // Inicializar servicio de sincronización para ventas offline
      let deviceId = localStorage.getItem('device_id')
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        localStorage.setItem('device_id', deviceId)
      }
      syncService.initialize(data.store_id, deviceId).catch((error) => {
        console.error('[SyncService] Error inicializando:', error)
        // No bloquear el login si falla la inicialización
      })
      
      // Prefetch inteligente en background - no bloquea la navegación
      prefetchAllData({
        storeId: data.store_id,
        queryClient,
        onProgress: (progress) => {
          // Log silencioso - no molestar al usuario
          if (progress === 100) {
            console.log('[Prefetch] ✅ Cacheo completo')
          }
        },
      }).catch(() => {
        // Silenciar errores - el prefetch es opcional
      })
      
      navigate('/pos')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'PIN incorrecto o cajero no encontrado'
      toast.error(message)
    },
  })

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data)
  }

  const handleCashierSelect = (cashierId: string) => {
    setSelectedCashierId(cashierId)
  }

  const selectedCashierName = cashiers?.find((c) => c.user_id === selectedCashierId)?.full_name

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-6"
          >
            <Store className="w-7 h-7 text-primary-foreground" strokeWidth={2} />
          </motion.div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
            Bienvenido
          </h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión en tu punto de venta
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-border/50 shadow-lg">
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
                      {stores?.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
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
                    <div className="space-y-2">
                      {cashiers.map((cashier) => {
                        const isSelected = selectedCashierId === cashier.user_id
                        return (
                          <motion.button
                            key={cashier.user_id}
                            type="button"
                            onClick={() => handleCashierSelect(cashier.user_id)}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border text-left transition-all",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-background border-border hover:border-primary/50 hover:bg-accent/50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">
                                  {cashier.full_name || 'Cajero'}
                                </p>
                                <p className={cn(
                                  "text-xs capitalize",
                                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                )}>
                                  {cashier.role}
                                </p>
                              </div>
                              {isSelected && (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No hay empleados disponibles
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* PIN Input */}
            <AnimatePresence mode="wait">
              {selectedStoreId && selectedCashierId && (
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
                    autoComplete="off"
                    className={cn(
                      "h-11 text-center text-lg tracking-widest font-mono",
                      "border-0",
                      "focus-visible:ring-2 focus-visible:ring-offset-1"
                    )}
                    style={{
                      border: 'none',
                      boxShadow: errors.pin 
                        ? 'inset 0 0 0 1px hsl(var(--destructive))'
                        : 'inset 0 0 0 1px hsl(var(--input))',
                    }}
                    {...register('pin')}
                  />
                  {errors.pin && (
                    <p className="text-xs text-destructive">{errors.pin.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <AnimatePresence mode="wait">
              {selectedStoreId && selectedCashierId && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-11 text-sm font-medium"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Iniciar Sesión
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Problemas para iniciar sesión?{' '}
          <button className="text-foreground hover:underline font-medium">
            Contacta al administrador
          </button>
        </p>
      </motion.div>
    </div>
  )
}
