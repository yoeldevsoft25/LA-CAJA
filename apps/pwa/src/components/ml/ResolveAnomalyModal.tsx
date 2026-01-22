import { useState } from 'react'
import { useResolveAnomaly } from '@/hooks/useAnomalies'
import { DetectedAnomaly } from '@/types/ml.types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { formatAnomalyType, formatAnomalySeverity } from '@/utils/ml-formatters'
import { AlertTriangle } from 'lucide-react'
import toast from '@/lib/toast'

interface ResolveAnomalyModalProps {
  isOpen: boolean
  onClose: () => void
  anomaly: DetectedAnomaly | null
}

export default function ResolveAnomalyModal({
  isOpen,
  onClose,
  anomaly,
}: ResolveAnomalyModalProps) {
  const [resolutionNote, setResolutionNote] = useState('')
  const resolveMutation = useResolveAnomaly()

  const handleResolve = async () => {
    if (!anomaly) return

    try {
      await resolveMutation.mutateAsync({
        anomalyId: anomaly.id,
        resolutionNote: resolutionNote.trim() || undefined,
      })
      toast.success('Anomalía resuelta correctamente')
      setResolutionNote('')
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al resolver la anomalía')
    }
  }

  const severity = anomaly ? formatAnomalySeverity(anomaly.severity) : null

  return (
    <Dialog open={isOpen && !!anomaly} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Resolver Anomalía
          </DialogTitle>
          <DialogDescription>
            Marca esta anomalía como resuelta. Puedes agregar una nota opcional.
          </DialogDescription>
        </DialogHeader>

        {anomaly && severity && (
          <>
            <div className="space-y-4">
              {/* Detalles de la anomalía */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{formatAnomalyType(anomaly.anomaly_type)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Severidad:</span>
                  <span className={`font-medium ${severity.color}`}>{severity.label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Score:</span>
                  <span className="font-medium">{Number(anomaly.score).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Descripción:</p>
                  <p className="text-sm">{anomaly.description}</p>
                </div>
              </div>

              {/* Nota de resolución */}
              <div>
                <Label htmlFor="resolutionNote">Nota de Resolución (Opcional)</Label>
                <Textarea
                  id="resolutionNote"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Agrega una nota sobre cómo se resolvió esta anomalía..."
                  className="mt-2"
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={resolveMutation.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={handleResolve}
                disabled={resolveMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {resolveMutation.isPending ? 'Resolviendo...' : 'Resolver Anomalía'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}











