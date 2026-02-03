import React from 'react'
import { useLicenseStatus } from '@/hooks/use-license-status'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { Button } from '@la-caja/ui-core'

interface QuotaIndicatorProps {
    metric: string
    label: string
}

export const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({ metric, label }) => {
    const { licenseStatus } = useLicenseStatus()

    if (!licenseStatus) return null

    const limit = licenseStatus.limits[metric] ?? Infinity
    const used = licenseStatus.usage[metric] ?? 0

    if (limit === Infinity) return null

    const percentage = Math.min(100, (used / limit) * 100)
    const isWarning = percentage >= 80
    const isCritical = percentage >= 95

    return (
        <div className="space-y-2 p-4 border rounded-xl bg-card">
            <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">{label}</span>
                <span className={isCritical ? 'text-destructive font-bold' : isWarning ? 'text-yellow-600 font-semibold' : ''}>
                    {used} / {limit}
                </span>
            </div>
            <Progress
                value={percentage}
                className="h-2"
                indicatorClassName={isCritical ? 'bg-destructive' : isWarning ? 'bg-yellow-500' : 'bg-primary'}
            />
            {isCritical && (
                <div className="flex items-start gap-2 text-xs text-destructive animate-pulse pt-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <p>Has alcanzado el límite. Actualiza para seguir operando sin interrupciones.</p>
                </div>
            )}
        </div>
    )
}

export const QuotaBanner: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
    const { licenseStatus } = useLicenseStatus()

    if (!licenseStatus) return null

    // Encontrar métrica más crítica
    const metrics = Object.keys(licenseStatus.limits)
    const criticalMetric = metrics.find(m => {
        const limit = licenseStatus.limits[m]
        const used = licenseStatus.usage[m]
        return limit && (used / limit) >= 0.9
    })

    if (!criticalMetric) return null

    return (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-sm animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Estás cerca del límite de <strong>{criticalMetric}</strong> de tu plan.</span>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={onUpgrade}
                className="bg-transparent border-destructive-foreground text-destructive-foreground hover:bg-destructive-foreground hover:text-destructive h-8 px-3 gap-1"
            >
                Actualizar <ChevronRight className="w-3 h-3" />
            </Button>
        </div>
    )
}
