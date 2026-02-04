import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle } from 'lucide-react'
import { publicMenuService } from '@/services/public-menu.service'
import MenuViewer from '@/components/public/MenuViewer'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Página pública para acceder al menú desde un código QR
 * Ruta: /public/qr/:qrCode
 */
export default function PublicMenuQRPage() {
  const { qrCode } = useParams<{ qrCode: string }>()
  const navigate = useNavigate()
  const [tableId, setTableId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-menu', qrCode],
    queryFn: () => {
      if (!qrCode) throw new Error('Código QR no válido')
      return publicMenuService.getMenuByQR(qrCode)
    },
    enabled: !!qrCode,
    retry: 2,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  useEffect(() => {
    if (data?.table?.id) {
      setTableId(data.table.id)
      // Guardar información en localStorage para persistencia
      localStorage.setItem('table_session', JSON.stringify({
        tableId: data.table.id,
        qrCode: qrCode,
        tableNumber: data.table.table_number,
      }))
    }
  }, [data, qrCode])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Cargando menú...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="mt-2">
              <p className="font-semibold mb-2">Error al cargar el menú</p>
              <p className="text-sm">
                {error instanceof Error
                  ? error.message
                  : 'El código QR no es válido o ha expirado. Por favor, escanéalo nuevamente.'}
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => navigate('/')}
              >
                Volver al inicio
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (!tableId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <MenuViewer
      tableId={tableId}
      tableInfo={data.table}
      menu={data.menu}
      qrCode={qrCode || ''}
    />
  )
}
