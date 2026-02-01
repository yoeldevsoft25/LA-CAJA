import { useEffect, useState } from 'react'
import { QrCode, Download, Copy, Check, ExternalLink } from 'lucide-react'
import { Table } from '@/services/tables.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/toast'

interface TableQRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  table: Table | null
}

/**
 * Genera un código QR usando la API de QR Server (gratuita)
 * Alternativa: usar una librería como qrcode.react si se prefiere
 */
function generateQRCodeURL(text: string, size: number = 300): string {
  // Usar API pública gratuita para generar QR codes
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
}

export default function TableQRCodeModal({
  isOpen,
  onClose,
  table,
}: TableQRCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const qrCodeUrl = table?.qrCode?.public_url || ''

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopyURL = async () => {
    if (!qrCodeUrl) {
      toast.error('No hay URL disponible')
      return
    }

    try {
      await navigator.clipboard.writeText(qrCodeUrl)
      setCopied(true)
      toast.success('URL copiada al portapapeles')
    } catch (error) {
      toast.error('Error al copiar la URL')
    }
  }

  const handleDownloadQR = () => {
    if (!qrCodeUrl) {
      toast.error('No hay URL disponible')
      return
    }

    const qrImageUrl = generateQRCodeURL(qrCodeUrl, 512)
    const link = document.createElement('a')
    link.href = qrImageUrl
    link.download = `QR-Mesa-${table?.table_number || 'unknown'}.png`
    link.click()
    toast.success('Código QR descargado')
  }

  const handleOpenURL = () => {
    if (!qrCodeUrl) {
      toast.error('No hay URL disponible')
      return
    }

    window.open(qrCodeUrl, '_blank')
  }

  if (!table) return null

  const qrCodeImageUrl = qrCodeUrl ? generateQRCodeURL(qrCodeUrl, 400) : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Código QR - Mesa {table.table_number}
          </DialogTitle>
          <DialogDescription>
            Escanea este código para acceder al menú de esta mesa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!table.qrCode ? (
            <Alert variant="destructive">
              <AlertDescription>
                Esta mesa no tiene un código QR asociado. Por favor, guarda la mesa nuevamente para generar el código QR.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Código QR */}
              <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-dashed">
                {qrCodeImageUrl ? (
                  <img
                    src={qrCodeImageUrl}
                    alt={`QR Code Mesa ${table.table_number}`}
                    className="w-full max-w-[300px] h-auto"
                  />
                ) : (
                  <div className="w-[300px] h-[300px] flex items-center justify-center text-muted-foreground">
                    Generando código QR...
                  </div>
                )}
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label>URL del Menú</Label>
                <div className="flex gap-2">
                  <Input
                    value={qrCodeUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyURL}
                    title="Copiar URL"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Información */}
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Instrucciones:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Descarga o imprime este código QR</li>
                    <li>Pégalo en la mesa correspondiente</li>
                    <li>Los clientes podrán escanearlo para ver el menú y hacer pedidos</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Acciones */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleDownloadQR}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar QR
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenURL}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Menú
                </Button>
              </div>
            </>
          )}

          {/* Cerrar */}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
