/**
 * Página pública para acceder al menú directamente por tableId
 * Ruta: /public/menu/:tableId
 */
export default function PublicMenuPage() {

  // Esta página requiere qrCode, así que redirigimos si no está disponible
  // Por ahora, solo mostramos un mensaje
  // TODO: Mejorar para obtener menú directamente por tableId

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="max-w-md w-full text-center">
        <p className="text-muted-foreground">
          Por favor, escanea el código QR de tu mesa para acceder al menú.
        </p>
      </div>
    </div>
  )
}
