import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Settings } from 'lucide-react'
import {
  fastCheckoutService,
  CreateFastCheckoutConfigRequest,
} from '@/services/fast-checkout.service'
import toast from '@/lib/toast'
import FastCheckoutConfigModal from '@/components/fast-checkout/FastCheckoutConfigModal'
import QuickProductsManager from '@/components/fast-checkout/QuickProductsManager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@la-caja/ui-core'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function FastCheckoutPage() {
  const queryClient = useQueryClient()
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['fast-checkout', 'config'],
    queryFn: () => fastCheckoutService.getFastCheckoutConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const upsertConfigMutation = useMutation({
    mutationFn: (data: CreateFastCheckoutConfigRequest) =>
      fastCheckoutService.upsertFastCheckoutConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fast-checkout'] })
      toast.success('Configuración guardada correctamente')
      setIsConfigModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al guardar la configuración')
    },
  })

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Modo Caja Rápida</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Configura productos rápidos y reglas para ventas aceleradas
          </p>
        </div>
        <Button onClick={() => setIsConfigModalOpen(true)}>
          <Settings className="w-4 h-4 mr-2" />
          {config ? 'Editar Configuración' : 'Configurar Modo Rápido'}
        </Button>
      </div>

      {/* Configuración actual */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Configuración Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Estado</p>
                <Badge variant={config.enabled ? 'default' : 'secondary'}>
                  {config.enabled ? 'Habilitado' : 'Deshabilitado'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Límite de Items</p>
                <p className="text-lg font-bold text-foreground">{config.max_items}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Permitir Descuentos</p>
                <Badge variant={config.allow_discounts ? 'default' : 'secondary'}>
                  {config.allow_discounts ? 'Sí' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Permitir Cliente</p>
                <Badge variant={config.allow_customer_selection ? 'default' : 'secondary'}>
                  {config.allow_customer_selection ? 'Sí' : 'No'}
                </Badge>
              </div>
              {config.default_payment_method && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Método por Defecto</p>
                  <Badge variant="outline">{config.default_payment_method}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            Productos Rápidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <QuickProductsManager />
        </TabsContent>
      </Tabs>

      {/* Modal de configuración */}
      <FastCheckoutConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config || null}
        onConfirm={(data) => upsertConfigMutation.mutate(data)}
        isLoading={upsertConfigMutation.isPending}
      />
    </div>
  )
}

