import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '@/stores/auth.store'
import { authService } from '@/services/auth.service'
import { Loader2, Store, Lock, User } from 'lucide-react'

const loginSchema = z.object({
  store_id: z.string().uuid('Selecciona una tienda'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 dígitos').max(6, 'El PIN debe tener máximo 6 dígitos'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedCashierId, setSelectedCashierId] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  // Obtener tiendas disponibles
  const { data: stores, isLoading: loadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: authService.getStores,
  })

  // Obtener cajeros cuando se selecciona una tienda
  const { data: cashiers, isLoading: loadingCashiers } = useQuery({
    queryKey: ['cashiers', selectedStoreId],
    queryFn: () => authService.getCashiers(selectedStoreId),
    enabled: !!selectedStoreId,
  })

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      login(data.access_token, {
        user_id: data.user_id,
        store_id: data.store_id,
        role: data.role,
        full_name: data.full_name,
      })
      toast.success(`Bienvenido, ${data.full_name || 'Usuario'}`)
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

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId)
    setSelectedCashierId('')
    setValue('store_id', storeId)
  }

  const handleCashierSelect = (cashierId: string) => {
    setSelectedCashierId(cashierId)
  }

  const selectedStoreName = stores?.find((s) => s.id === selectedStoreId)?.name
  const selectedCashierName = cashiers?.find((c) => c.user_id === selectedCashierId)?.full_name

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">LA CAJA</h1>
          <p className="text-gray-600">Sistema POS Offline-First</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Paso 1: Selección de Tienda */}
          <div>
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <Store className="w-4 h-4 mr-2 text-blue-600" />
              Paso 1: Selecciona la Tienda
            </label>
            {loadingStores ? (
              <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-600">Cargando tiendas...</span>
              </div>
            ) : (
              <select
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium transition-colors"
              >
                <option value="">-- Selecciona una tienda --</option>
                {stores?.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
            {errors.store_id && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <span className="mr-1">⚠️</span> {errors.store_id.message}
              </p>
            )}
            {stores && stores.length === 0 && !loadingStores && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No hay tiendas disponibles. Contacta al administrador.
                </p>
              </div>
            )}
          </div>

          {/* Paso 2: Lista de Empleados */}
          {selectedStoreId && (
            <div className="animate-fadeIn">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <User className="w-4 h-4 mr-2 text-blue-600" />
                Paso 2: Selecciona el Empleado
              </label>
              {loadingCashiers ? (
                <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                  <span className="text-sm text-gray-600">Cargando empleados...</span>
                </div>
              ) : cashiers && cashiers.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cashiers.map((cashier) => {
                    const isSelected = selectedCashierId === cashier.user_id
                    return (
                      <div
                        key={cashier.user_id}
                        onClick={() => handleCashierSelect(cashier.user_id)}
                        className={`p-3 border-2 rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center">
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                              isSelected ? 'bg-blue-600' : 'bg-blue-100'
                            }`}
                          >
                            <User className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                          </div>
                          <div className="ml-3 flex-1">
                            <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                              {cashier.full_name || 'Cajero'}
                            </p>
                            <p className={`text-xs capitalize ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                              {cashier.role}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                  <p className="text-sm text-gray-600">
                    No hay cajeros disponibles en <strong>{selectedStoreName}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Contacta al administrador para crear cajeros
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Paso 3: PIN */}
          {selectedStoreId && selectedCashierId && cashiers && cashiers.length > 0 && (
            <div className="animate-fadeIn">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <Lock className="w-4 h-4 mr-2 text-blue-600" />
                Paso 3: Ingresa tu PIN
              </label>
              {selectedCashierName && (
                <p className="text-sm text-gray-600 mb-2">
                  PIN de <strong>{selectedCashierName}</strong>
                </p>
              )}
              <input
                type="password"
                {...register('store_id', { value: selectedStoreId })}
                style={{ display: 'none' }}
              />
              <input
                type="password"
                {...register('pin')}
                placeholder="••••"
                maxLength={6}
                autoComplete="off"
                className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-3xl tracking-[0.5em] font-mono bg-gray-50"
              />
              {errors.pin && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <span className="mr-1">⚠️</span> {errors.pin.message}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 text-center">
                PIN de seguridad (4-6 dígitos)
              </p>
            </div>
          )}

          {/* Botón de Login */}
          {selectedStoreId && selectedCashierId && cashiers && cashiers.length > 0 && (
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center shadow-lg"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </button>
          )}
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            ¿Problemas para iniciar sesión? Contacta al administrador
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

