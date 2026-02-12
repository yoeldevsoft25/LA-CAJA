import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Percent, Settings, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  discountsService,
  CreateDiscountConfigRequest,
} from '@/services/discounts.service'
import toast from '@/lib/toast'
import DiscountConfigModal from '@/components/discounts/DiscountConfigModal'
import DiscountAuthorizationsList from '@/components/discounts/DiscountAuthorizationsList'
import DiscountSummary from '@/components/discounts/DiscountSummary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DiscountsPage() {
  const queryClient = useQueryClient()
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['discounts', 'config'],
    queryFn: () => discountsService.getDiscountConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const upsertConfigMutation = useMutation({
    mutationFn: (data: CreateDiscountConfigRequest) => discountsService.upsertDiscountConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
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
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Configuración de Descuentos
            </h1>
            {/* Indicador de descuentos activos */}
            {config ? (
              <Badge
                variant="default"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descuentos Activos</span>
                <span className="sm:hidden">Activo</span>
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">No Configurado</span>
                <span className="sm:hidden">Inactivo</span>
              </Badge>
            )}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            {config
              ? 'Los descuentos están configurados y activos en el sistema'
              : 'Gestiona límites, autorizaciones y reglas de descuentos'}
          </p>
        </div>
        <Button onClick={() => setIsConfigModalOpen(true)} variant="outline" className="btn-glass-neutral">
          <Settings className="w-4 h-4 mr-2" />
          {config ? 'Editar Configuración' : 'Configurar Descuentos'}
        </Button>
      </div>

      {/* Configuración actual */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl flex items-center">
              <Percent className="w-5 h-5 mr-2" />
              Configuración Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Porcentaje Máximo</p>
                <p className="text-lg font-bold text-foreground">
                  {Number(config.max_percentage) === 0
                    ? 'Sin límite'
                    : `${Number(config.max_percentage).toFixed(2)}%`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monto Máximo Bs</p>
                <p className="text-lg font-bold text-foreground">
                  {config.max_amount_bs
                    ? `${Number(config.max_amount_bs).toFixed(2)} Bs`
                    : 'Sin límite'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monto Máximo USD</p>
                <p className="text-lg font-bold text-foreground">
                  {config.max_amount_usd
                    ? `$${Number(config.max_amount_usd).toFixed(2)}`
                    : 'Sin límite'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Requiere Autorización</p>
                <Badge variant={config.requires_authorization ? 'default' : 'secondary'}>
                  {config.requires_authorization ? 'Sí' : 'No'}
                </Badge>
              </div>
              {config.requires_authorization && config.authorization_role && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rol Mínimo</p>
                  <Badge variant="outline">{config.authorization_role}</Badge>
                </div>
              )}
              {config.auto_approve_below_percentage && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Auto-Aprobar &lt; %</p>
                  <p className="text-lg font-bold text-foreground">
                    {Number(config.auto_approve_below_percentage).toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="h-11 p-1 rounded-xl bg-card border border-border/70">
          <TabsTrigger value="summary" className="flex items-center">
            <Percent className="w-4 h-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="authorizations" className="flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Autorizaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <DiscountSummary />
        </TabsContent>

        <TabsContent value="authorizations" className="space-y-4">
          <DiscountAuthorizationsList />
        </TabsContent>
      </Tabs>

      {/* Modal de configuración */}
      <DiscountConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config || null}
        onConfirm={(data) => upsertConfigMutation.mutate(data)}
        isLoading={upsertConfigMutation.isPending}
      />
    </div>
  )
}

