import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { CreditCard, Calendar, Clock, CheckCircle2 } from 'lucide-react'

interface LicenseInfoCardProps {
  license_plan: string
  license_status: string
  license_expires_at: string | Date | null
  license_grace_days: number
  trial_days_remaining?: number
}

export function LicenseInfoCard({
  license_plan,
  license_status,
  license_expires_at,
  license_grace_days,
  trial_days_remaining,
}: LicenseInfoCardProps) {
  const expiresAt = license_expires_at
    ? typeof license_expires_at === 'string'
      ? parseISO(license_expires_at)
      : license_expires_at
    : null

  const daysRemaining =
    trial_days_remaining !== undefined
      ? trial_days_remaining
      : expiresAt
        ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null

  const isActive = license_status === 'active'
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0
  const isExpired = daysRemaining !== null && daysRemaining <= 0

  const planName =
    license_plan === 'freemium'
      ? 'Freemium'
      : license_plan === 'trial'
        ? 'Prueba'
        : license_plan === 'basico'
          ? 'Básico'
          : license_plan === 'profesional'
            ? 'Profesional'
            : license_plan === 'empresarial'
              ? 'Empresarial'
              : license_plan

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Información de Licencia
          </span>
          <Badge
            variant={isActive && !isExpired ? 'default' : 'destructive'}
            className="capitalize"
          >
            {isActive && !isExpired ? 'Activa' : isExpired ? 'Expirada' : 'Inactiva'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Plan Actual
            </Label>
            <div className="text-lg font-semibold">{planName}</div>
            {license_plan === 'freemium' && (
              <p className="text-sm text-muted-foreground mt-1">
                Plan gratuito para empezar
              </p>
            )}
          </div>

          <div>
            <Label className="text-muted-foreground flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4" />
              Días de Prueba Restantes
            </Label>
            <div className="text-lg font-semibold">
              {daysRemaining !== null ? (
                <span className={isExpiringSoon ? 'text-amber-600' : isExpired ? 'text-destructive' : ''}>
                  {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                </span>
              ) : (
                <span className="text-muted-foreground">No disponible</span>
              )}
            </div>
            {isExpiringSoon && (
              <p className="text-xs text-amber-600 mt-1">
                Tu licencia expira pronto
              </p>
            )}
            {isExpired && (
              <p className="text-xs text-destructive mt-1">
                Tu licencia ha expirado
              </p>
            )}
          </div>
        </div>

        {expiresAt && (
          <div>
            <Label className="text-muted-foreground flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4" />
              Fecha de Expiración
            </Label>
            <div className="text-base font-medium">
              {format(expiresAt, "dd 'de' MMMM, yyyy", { locale: es })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Días de gracia: {license_grace_days} días
            </p>
          </div>
        )}

        {license_plan === 'freemium' && (
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Plan Freemium:</strong> Disfruta de{' '}
              {daysRemaining !== null ? daysRemaining : '14'} días de prueba gratuita.
              Después puedes actualizar a un plan de pago para continuar usando el sistema.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
