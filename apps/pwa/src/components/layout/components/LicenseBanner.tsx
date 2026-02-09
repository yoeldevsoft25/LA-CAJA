import { memo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { LicenseState } from '../hooks/useLicenseAlerts'

interface LicenseBannerProps {
    license: LicenseState
}

export const LicenseBanner = memo(function LicenseBanner({ license }: LicenseBannerProps) {
    const { isExpired, isExpiringSoon, daysToExpire } = license

    if (!isExpired && !isExpiringSoon) return null

    return (
        <div className="px-6 pb-3">
            <Alert variant={isExpired ? 'destructive' : 'default'}>
                <AlertTitle>
                    {isExpired
                        ? 'Licencia vencida/suspendida'
                        : `Licencia vence en ${daysToExpire} día(s)`}
                </AlertTitle>
                <AlertDescription>
                    {isExpired
                        ? 'Renueva tu licencia para continuar operando.'
                        : 'Por favor renueva antes de la fecha de vencimiento.'}
                </AlertDescription>
            </Alert>
        </div>
    )
})
