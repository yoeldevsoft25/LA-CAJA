import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, QrCode, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { whatsappConfigService } from '@/services/whatsapp-config.service'
import { useAuth } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from '@/lib/toast'

const whatsappConfigSchema = z.object({
  thank_you_message: z.string().max(500, 'El mensaje no puede exceder 500 caracteres').optional().or(z.literal('')),
  enabled: z.boolean(),
  debt_notifications_enabled: z.boolean(),
  debt_reminders_enabled: z.boolean(),
})

type WhatsAppConfigFormData = z.infer<typeof whatsappConfigSchema>

export default function WhatsAppConfigPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => whatsappConfigService.findOne(),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })


  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => whatsappConfigService.getStatus(),
    enabled: !!user?.store_id,
    refetchInterval: 5000, // Polling cada 5 segundos
    // Refetch inmediatamente cuando la página se monta o se enfoca
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<WhatsAppConfigFormData>({
    resolver: zodResolver(whatsappConfigSchema),
    defaultValues: {
      thank_you_message: '',
      enabled: false,
      debt_notifications_enabled: false,
      debt_reminders_enabled: false,
    },
  })

  const thankYouMessage = watch('thank_you_message')

  useEffect(() => {
    if (config) {
      reset({
        thank_you_message: config.thank_you_message || '',
        enabled: config.enabled,
        debt_notifications_enabled: config.debt_notifications_enabled,
        debt_reminders_enabled: config.debt_reminders_enabled,
      })
    }
  }, [config, reset])

  // Polling para obtener QR code y estado cuando el modal está abierto
  useEffect(() => {
    if (!isAuthModalOpen || !user?.store_id) return

    let qrInterval: NodeJS.Timeout
    let statusInterval: NodeJS.Timeout

    const closeAndRefresh = () => {
      setIsAuthModalOpen(false)
      setQrCode(null)
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] })
      toast.success('WhatsApp conectado exitosamente')
    }

    const fetchQR = async () => {
      try {
        const response = await whatsappConfigService.getQRCode()
        setQrCode(response.qrCode)

        if (response.isConnected) {
          closeAndRefresh()
          return
        }
        // Si QR es null (ej. Baileys ya lo quitó al conectar), comprobar status de inmediato
        if (!response.qrCode) {
          const st = await whatsappConfigService.getStatus()
          if (st.isConnected) {
            closeAndRefresh()
          }
        }
      } catch (error) {
        console.error('[WhatsApp] Error obteniendo QR:', error)
      }
    }

    const checkStatus = async () => {
      try {
        const currentStatus = await whatsappConfigService.getStatus()
        if (currentStatus.isConnected) {
          closeAndRefresh()
        }
      } catch (error) {
        console.error('[WhatsApp] Error verificando estado:', error)
      }
    }

    fetchQR()

    qrInterval = setInterval(fetchQR, 2000)
    // Más frecuente al esperar conexión (p. ej. tras escanear)
    statusInterval = setInterval(checkStatus, 600)

    return () => {
      if (qrInterval) clearInterval(qrInterval)
      if (statusInterval) clearInterval(statusInterval)
    }
  }, [isAuthModalOpen, user?.store_id, queryClient])

  const saveMutation = useMutation({
    mutationFn: (data: WhatsAppConfigFormData) => {
      if (config) {
        return whatsappConfigService.update(data)
      }
      return whatsappConfigService.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] })
      toast.success('Configuración guardada correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al guardar la configuración')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappConfigService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] })
      toast.success('WhatsApp desconectado')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al desconectar')
    },
  })

  const handleConnect = async () => {
    setIsConnecting(true)
    setIsAuthModalOpen(true)
    try {
      // Inicializar bot y obtener QR
      await whatsappConfigService.getQRCode()
    } catch (error) {
      toast.error('Error al inicializar WhatsApp')
      setIsAuthModalOpen(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const onSubmit = (data: WhatsAppConfigFormData) => {
    saveMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="h-full max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  const isConnected = status?.isConnected || false
  const whatsappNumber = status?.whatsappNumber

  return (
    <div className="h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Configuración de WhatsApp
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Configure WhatsApp para enviar notificaciones automáticas a sus clientes
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección: Autenticación */}
        <Card>
          <CardHeader>
            <CardTitle>Autenticación de WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Estado de Conexión</p>
                <div className="flex items-center gap-2 mt-2">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-green-600">Conectado</span>
                      {whatsappNumber && (
                        <span className="text-sm text-muted-foreground">
                          ({whatsappNumber})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-sm text-red-600">Desconectado</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 mr-2" />
                        Conectar WhatsApp
                      </>
                    )}
                  </Button>
                )}
                {isConnected && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => refetchStatus()}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                  </Button>
                )}
              </div>
            </div>

            {!isConnected && (
              <Alert>
                <AlertDescription>
                  Para enviar mensajes automáticos, debe conectar su WhatsApp escaneando el código QR.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Sección: Configuración de Mensajes */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Mensajes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="thank_you_message">Mensaje de Agradecimiento</Label>
              <Textarea
                id="thank_you_message"
                {...register('thank_you_message')}
                className="mt-2"
                rows={4}
                placeholder="¡Gracias por comprar en {storeName}! Esperamos verte pronto."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Puede usar variables: {'{storeName}'}, {'{customerName}'}
              </p>
              {errors.thank_you_message && (
                <p className="text-sm text-destructive mt-1">
                  {errors.thank_you_message.message}
                </p>
              )}
            </div>

            {/* Vista previa del mensaje */}
            {thankYouMessage && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Vista Previa:</p>
                <p className="text-sm text-muted-foreground">
                  {thankYouMessage.replace('{storeName}', 'Mi Tienda').replace('{customerName}', 'Cliente')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sección: Notificaciones Automáticas */}
        <Card>
          <CardHeader>
            <CardTitle>Notificaciones Automáticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Enviar detalles de compra automáticamente</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar detalles de venta a clientes cuando se realiza una compra
                </p>
              </div>
              <Switch
                id="enabled"
                checked={watch('enabled')}
                onCheckedChange={(checked) => {
                  reset({ ...watch(), enabled: checked })
                }}
                disabled={!isConnected}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="debt_notifications_enabled">Notificaciones de deudas</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar notificación cuando se crea una deuda (FIAO)
                </p>
              </div>
              <Switch
                id="debt_notifications_enabled"
                checked={watch('debt_notifications_enabled')}
                onCheckedChange={(checked) => {
                  reset({ ...watch(), debt_notifications_enabled: checked })
                }}
                disabled={!isConnected}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="debt_reminders_enabled">Recordatorios automáticos de deudas</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar recordatorios periódicos de deudas pendientes
                </p>
              </div>
              <Switch
                id="debt_reminders_enabled"
                checked={watch('debt_reminders_enabled')}
                onCheckedChange={(checked) => {
                  reset({ ...watch(), debt_reminders_enabled: checked })
                }}
                disabled={!isConnected}
              />
            </div>

            {!isConnected && (
              <Alert>
                <AlertDescription>
                  Debe conectar WhatsApp para habilitar las notificaciones automáticas.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={saveMutation.isPending || !isConnected}
            className="min-w-[150px]"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </form>

      {/* Modal de Autenticación */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escanea este código QR con tu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {qrCode ? (
              <div className="space-y-4">
                <img
                  src={qrCode}
                  alt="QR Code de WhatsApp"
                  className="w-64 h-64 mx-auto border-2 border-border rounded-lg"
                />
                <p className="text-sm text-center text-muted-foreground">
                  1. Abre WhatsApp en tu teléfono
                  <br />
                  2. Ve a Configuración → Dispositivos vinculados
                  <br />
                  3. Toca "Vincular un dispositivo"
                  <br />
                  4. Escanea este código QR
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Verificando conexión...
                </p>
                <p className="text-xs text-muted-foreground">
                  Si acaba de escanear el QR, espere un momento.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
