import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { authService } from '@/services/auth.service'
import { Shield, CheckCircle2, XCircle, Copy, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function TwoFactorSetup() {
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: authService.get2FAStatus,
  })

  const initiateMutation = useMutation({
    mutationFn: () => authService.initiate2FA(),
    onSuccess: (data) => {
      setQrCodeUrl(data.qrCodeUrl)
      setBackupCodes(data.backupCodes)
      toast.success('Configuración de 2FA iniciada. Escanea el código QR.')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al iniciar 2FA'
      toast.error(message)
    },
  })

  const enableMutation = useMutation({
    mutationFn: (code: string) => authService.enable2FA(code),
    onSuccess: () => {
      toast.success('2FA habilitado exitosamente')
      setVerificationCode('')
      // Invalidar query para refrescar estado
      window.location.reload() // Simple reload para refrescar estado
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al habilitar 2FA'
      toast.error(message)
    },
  })

  const disableMutation = useMutation({
    mutationFn: (code: string) => authService.disable2FA(code),
    onSuccess: () => {
      toast.success('2FA deshabilitado exitosamente')
      setVerificationCode('')
      window.location.reload()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Error al deshabilitar 2FA'
      toast.error(message)
    },
  })

  const handleInitiate = () => {
    initiateMutation.mutate()
  }

  const handleEnable = () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Ingresa un código de 6 dígitos')
      return
    }
    enableMutation.mutate(verificationCode)
  }

  const handleDisable = () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Ingresa un código de 6 dígitos para deshabilitar')
      return
    }
    if (!confirm('¿Estás seguro de que deseas deshabilitar 2FA? Esto reducirá la seguridad de tu cuenta.')) {
      return
    }
    disableMutation.mutate(verificationCode)
  }

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    toast.success('Códigos de respaldo copiados al portapapeles')
  }

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    const blob = new Blob([codesText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'velox-pos-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Códigos de respaldo descargados')
  }

  if (statusLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (status?.is_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Autenticación de Dos Factores (2FA)
          </CardTitle>
          <CardDescription>
            Tu cuenta está protegida con 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Habilitado
            </Badge>
            {status.enabled_at && (
              <span className="text-sm text-muted-foreground">
                Habilitado el {new Date(status.enabled_at).toLocaleDateString('es-VE')}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="disable-code">Código de Verificación para Deshabilitar</Label>
            <Input
              id="disable-code"
              type="text"
              placeholder="000000"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em] font-semibold"
            />
            <Button
              onClick={handleDisable}
              disabled={disableMutation.isPending || verificationCode.length !== 6}
              variant="destructive"
              className="w-full"
            >
              {disableMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deshabilitando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Deshabilitar 2FA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Autenticación de Dos Factores (2FA)
        </CardTitle>
        <CardDescription>
          Protege tu cuenta con una capa adicional de seguridad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!qrCodeUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La autenticación de dos factores (2FA) agrega una capa adicional de seguridad a tu cuenta.
              Necesitarás un código de 6 dígitos de una app de autenticación (como Google Authenticator) además de tu PIN.
            </p>
            <Button
              onClick={handleInitiate}
              disabled={initiateMutation.isPending}
              className="w-full"
            >
              {initiateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Iniciar Configuración de 2FA
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Paso 1: Escanea el código QR
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Usa una app de autenticación como Google Authenticator, Authy o Microsoft Authenticator
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg border-2">
                <img src={qrCodeUrl} alt="QR Code para 2FA" className="w-48 h-48" />
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Paso 2: Ingresa el código de verificación
              </Label>
              <Input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-[0.5em] font-semibold"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Ingresa el código de 6 dígitos que aparece en tu app de autenticación
              </p>
            </div>

            <Button
              onClick={handleEnable}
              disabled={enableMutation.isPending || verificationCode.length !== 6}
              className="w-full"
            >
              {enableMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Habilitando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Habilitar 2FA
                </>
              )}
            </Button>

            {backupCodes.length > 0 && (
              <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-yellow-900">
                    Códigos de Respaldo (Guárdalos en un lugar seguro)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyBackupCodes}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadBackupCodes}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Descargar
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <code
                      key={index}
                      className="text-xs font-mono p-2 bg-white rounded border text-center"
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-yellow-800">
                  Estos códigos te permitirán acceder a tu cuenta si pierdes acceso a tu app de autenticación.
                  Solo se mostrarán una vez.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
