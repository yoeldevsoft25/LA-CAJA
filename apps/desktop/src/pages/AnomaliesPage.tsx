import AnomaliesList from '@/components/ml/AnomaliesList'
import { AlertTriangle } from 'lucide-react'

export default function AnomaliesPage() {
  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Anomalías Detectadas
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Sistema de detección de anomalías usando Machine Learning
        </p>
      </div>

      {/* Lista de anomalías */}
      <AnomaliesList limit={100} />
    </div>
  )
}

