import { Barcode, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export type ScannerStatus = 'idle' | 'scanning' | 'success' | 'error'

export interface ScannerStatusBadgeProps {
  scannerStatus: ScannerStatus
  scannerSoundEnabled: boolean
  onSoundToggle: () => void
}

export default function ScannerStatusBadge({
  scannerStatus,
  scannerSoundEnabled,
  onSoundToggle,
}: ScannerStatusBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={onSoundToggle}
        className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-border bg-background px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-foreground hover:bg-accent/50 transition-colors shadow-sm"
      >
        <span className="hidden sm:inline">Sonido</span>
        <div
          className={cn(
            'relative flex items-center w-10 h-5 sm:w-12 sm:h-6 rounded-full transition-colors duration-300',
            scannerSoundEnabled ? 'bg-primary' : 'bg-muted border border-border'
          )}
        >
          <div
            className={cn(
              'absolute flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-background shadow-md transition-transform duration-300 ease-in-out',
              scannerSoundEnabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5 sm:translate-x-0.5'
            )}
          >
            {scannerSoundEnabled ? (
              <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
            ) : (
              <VolumeX className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>
      <motion.div
        animate={scannerStatus === 'scanning' ? {
          scale: [1, 1.05, 1],
          opacity: [1, 0.7, 1],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          'flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-medium transition-all duration-300 relative overflow-hidden',
          scannerStatus === 'idle' && 'bg-muted/50 text-muted-foreground',
          scannerStatus === 'scanning' && 'bg-primary/20 text-primary border border-primary/30',
          scannerStatus === 'success' && 'bg-green-500/20 text-green-600 border border-green-500/30',
          scannerStatus === 'error' && 'bg-destructive/20 text-destructive border border-destructive/30'
        )}
      >
        {scannerStatus === 'scanning' && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent skew-x-12"
          />
        )}
        <Barcode className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10')} />
        <span className="hidden sm:inline relative z-10">
          {scannerStatus === 'idle' && 'Scanner listo'}
          {scannerStatus === 'scanning' && 'Buscando...'}
          {scannerStatus === 'success' && 'Agregado'}
          {scannerStatus === 'error' && 'No encontrado'}
        </span>
      </motion.div>
    </div>
  )
}
