import React from 'react'
import { useLicenseStatus } from '@/hooks/use-license-status'
import { Button } from '@la-caja/ui-core'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Sparkles } from 'lucide-react'

interface FeatureGateProps {
    feature: string
    children: React.ReactNode
    fallback?: React.ReactNode
    showUpgradeCard?: boolean
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
    feature,
    children,
    fallback,
    showUpgradeCard = false
}) => {
    const { licenseStatus } = useLicenseStatus()

    const hasFeature = licenseStatus?.features?.includes(feature) || false

    if (hasFeature) {
        return <>{children}</>
    }

    if (fallback) {
        return <>{fallback}</>
    }

    if (showUpgradeCard) {
        return (
            <Card className="border-dashed border-2 bg-muted/50">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Funcionalidad Premium</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                    La funcionalidad <strong>{feature}</strong> no está disponible en tu plan actual.
                    ¡Actualiza tu plan para desbloquear todo el potencial de Velox POS!
                </CardContent>
                <CardFooter className="justify-center">
                    <Button variant="default" className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Ver Planes de Mejora
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return null
}
