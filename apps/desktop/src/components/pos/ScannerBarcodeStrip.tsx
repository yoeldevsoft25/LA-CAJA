import { Barcode } from 'lucide-react'
import { cn } from '@/lib/utils'

type ScannerStatus = 'idle' | 'scanning' | 'success' | 'error'

export interface ScannerBarcodeStripProps {
  lastScannedBarcode: string | null
  scannerStatus: ScannerStatus
}

export default function ScannerBarcodeStrip({ lastScannedBarcode, scannerStatus }: ScannerBarcodeStripProps) {
  if (!lastScannedBarcode || scannerStatus === 'idle') return null

  return (
    <div
      className={cn(
        'mt-2 px-3 py-2 rounded-md text-sm font-mono flex items-center gap-2 transition-all duration-300',
        scannerStatus === 'scanning' && 'bg-primary/10 text-primary border border-primary/30',
        scannerStatus === 'success' && 'bg-green-500/10 text-green-600 border border-green-500/30',
        scannerStatus === 'error' && 'bg-destructive/10 text-destructive border border-destructive/30'
      )}
    >
      <Barcode className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{lastScannedBarcode}</span>
    </div>
  )
}
