import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Info, Sparkles } from 'lucide-react'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import type { AnalyticsDefaultsPreview } from '@/types/realtime-analytics.types'

interface ApplyDefaultsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function ApplyDefaultsModal({
    open,
    onOpenChange,
    onSuccess,
}: ApplyDefaultsModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [preview, setPreview] = useState<AnalyticsDefaultsPreview | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [thresholdsCreated, setThresholdsCreated] = useState(0)

    const [isLoadingPreview, setIsLoadingPreview] = useState(false)

    useEffect(() => {
        if (open && !preview && !success && !isLoadingPreview) {
            loadPreview()
        }
    }, [open, preview, success])

    const loadPreview = async () => {
        setIsLoadingPreview(true)
        try {
            const data = await realtimeAnalyticsService.getDefaultsPreview()
            setPreview(data)
        } catch (err) {
            setError('Error al cargar la configuración predeterminada')
            console.error(err)
        } finally {
            setIsLoadingPreview(false)
        }
    }

    // Wrapper para onOpenChange para limpiar estado al cerrar si es necesario
    const handleOpenChange = (isOpen: boolean) => {
        onOpenChange(isOpen)
        if (!isOpen) {
            // Optional: reset state here or rely on handleClose
        }
    }

    const handleApply = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const result = await realtimeAnalyticsService.applyDefaultThresholds()
            setThresholdsCreated(result.thresholds_created)
            setSuccess(true)

            // Notificar éxito después de 1 segundo
            setTimeout(() => {
                onSuccess?.()
                handleClose()
            }, 2000)
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al aplicar la configuración')
            console.error('Error applying defaults:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        // Reset state after animation
        setTimeout(() => {
            setSuccess(false)
            setError(null)
            setPreview(null)
            setThresholdsCreated(0)
        }, 300)
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            case 'high':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
            case 'low':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
        }
    }

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical':
            case 'high':
                return <AlertCircle className="h-4 w-4" />
            case 'medium':
                return <Info className="h-4 w-4" />
            case 'low':
                return <CheckCircle2 className="h-4 w-4" />
            default:
                return null
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Aplicar Configuración Recomendada</DialogTitle>
                    <DialogDescription>
                        Esta acción restaurará los umbrales de detección a sus valores predeterminados seguros.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="py-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold">¡Configuración Aplicada!</h3>
                        <p className="text-muted-foreground">
                            Se crearon <strong>{thresholdsCreated} alertas inteligentes</strong> que
                            ahora están monitoreando tu negocio en tiempo real.
                        </p>
                    </div>
                ) : (
                    <>
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {preview ? (
                            <div className="space-y-4">
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertDescription>
                                        Esta configuración creará <strong>{preview.totalAlerts} alertas</strong>{' '}
                                        que monitorearán automáticamente las métricas más importantes de tu
                                        negocio.
                                    </AlertDescription>
                                </Alert>

                                <div>
                                    <h4 className="mb-3 font-semibold">Alertas por Prioridad:</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                            <div className="flex items-center gap-2">
                                                {getSeverityIcon('critical')}
                                                <span className="text-sm font-medium">Críticas</span>
                                            </div>
                                            <Badge className={getSeverityColor('critical')}>
                                                {preview.byPriority.critical}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                            <div className="flex items-center gap-2">
                                                {getSeverityIcon('high')}
                                                <span className="text-sm font-medium">Alta</span>
                                            </div>
                                            <Badge className={getSeverityColor('high')}>
                                                {preview.byPriority.high}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                            <div className="flex items-center gap-2">
                                                {getSeverityIcon('medium')}
                                                <span className="text-sm font-medium">Media</span>
                                            </div>
                                            <Badge className={getSeverityColor('medium')}>
                                                {preview.byPriority.medium}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                            <div className="flex items-center gap-2">
                                                {getSeverityIcon('low')}
                                                <span className="text-sm font-medium">Info</span>
                                            </div>
                                            <Badge className={getSeverityColor('low')}>
                                                {preview.byPriority.low}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="mb-2 font-semibold">Beneficios:</h4>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                            <span>Prevención de roturas de stock y productos vencidos</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                            <span>Detección temprana de caídas en ventas e ingresos</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                            <span>Optimización de capital en inventario y deudas</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                            <span>
                                                Ajuste inteligente basado en el histórico de tu tienda
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            !error && (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            )
                        )}
                    </>
                )}

                {!success && (
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleApply} disabled={isLoading || !preview}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Aplicando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Aplicar Configuración
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
