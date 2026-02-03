import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from '@/lib/toast'
import { motion } from 'framer-motion'
import { authService } from '@/services/auth.service'
import { useAuth } from '@/stores/auth.store'
import { Shield, Trash2, Monitor, Smartphone, Tablet, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@la-caja/ui-core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Session {
  id: string
  device_id: string | null
  device_info: string | null
  ip_address: string | null
  created_at: string
  last_used_at: string | null
}

export default function SecurityPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: authService.getActiveSessions,
    enabled: !!user,
  })

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Sesión revocada correctamente')
      setRevokingSessionId(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al revocar sesión'
      toast.error(message)
      setRevokingSessionId(null)
    },
  })

  const handleRevokeSession = (sessionId: string) => {
    if (confirm('¿Estás seguro de que deseas cerrar esta sesión?')) {
      setRevokingSessionId(sessionId)
      revokeMutation.mutate(sessionId)
    }
  }

  const getDeviceIcon = (deviceInfo: string | null) => {
    if (!deviceInfo) return <Monitor className="w-5 h-5" />
    const info = deviceInfo.toLowerCase()
    if (info.includes('mobile') || info.includes('android') || info.includes('iphone')) {
      return <Smartphone className="w-5 h-5" />
    }
    if (info.includes('tablet') || info.includes('ipad')) {
      return <Tablet className="w-5 h-5" />
    }
    return <Monitor className="w-5 h-5" />
  }

  const getDeviceName = (session: Session) => {
    if (session.device_info) {
      return session.device_info
    }
    if (session.device_id) {
      return `Dispositivo ${session.device_id.substring(0, 8)}`
    }
    return 'Dispositivo desconocido'
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Seguridad
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus sesiones activas y dispositivos conectados
          </p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle>Sesiones Activas</CardTitle>
            <CardDescription>
              Estas son todas las sesiones activas en tus dispositivos. Puedes cerrar cualquier sesión en cualquier momento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : sessions && sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-3 bg-slate-100 rounded-lg">
                        {getDeviceIcon(session.device_info)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{getDeviceName(session)}</p>
                          {session.last_used_at && (
                            <Badge variant="outline" className="text-xs">
                              Activo
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {session.ip_address && (
                            <p>IP: {session.ip_address}</p>
                          )}
                          <p>
                            Creada:{' '}
                            {formatDistanceToNow(new Date(session.created_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                          {session.last_used_at && (
                            <p>
                              Último uso:{' '}
                              {formatDistanceToNow(new Date(session.last_used_at), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingSessionId === session.id}
                    >
                      {revokingSessionId === session.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cerrando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Cerrar Sesión
                        </>
                      )}
                    </Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay sesiones activas</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Autenticación de Dos Factores (2FA)</CardTitle>
            <CardDescription>
              Protege tu cuenta con una capa adicional de seguridad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TwoFactorSetup />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recomendaciones de Seguridad</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Habilita 2FA para mayor seguridad (recomendado para owners)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Revisa regularmente tus sesiones activas y cierra las que no reconozcas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Usa un PIN fuerte (6-8 caracteres con letras y números)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Si recibes un email sobre un nuevo dispositivo y no fuiste tú, cambia tu PIN inmediatamente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>No compartas tu PIN con nadie</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
  )
}
