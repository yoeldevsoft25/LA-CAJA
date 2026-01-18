import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const isDev = import.meta.env.DEV

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: undefined,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  isOfflineModuleError(error: Error | undefined): boolean {
    if (!error) return false
    const message = error.message || ''
    const stack = error.stack || ''
    
    // Detectar errores de módulos dinámicos en desarrollo offline
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('ERR_INTERNET_DISCONNECTED') ||
      stack.includes('lazyInitializer') ||
      stack.includes('resolveLazy')
    )
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const isOfflineModuleError = this.isOfflineModuleError(this.state.error)

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-muted/20 p-6">
        <Card className="w-full max-w-lg border border-destructive/20 shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">
              {isOfflineModuleError && isDev
                ? 'Modo Offline No Disponible en Desarrollo'
                : 'Algo salio mal'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isOfflineModuleError && isDev ? (
              <>
                <p className="text-sm text-muted-foreground">
                  En modo desarrollo, Vite necesita el servidor para transformar módulos dinámicamente.
                  Cuando estás offline, no puede cargar las páginas.
                </p>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 text-left">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    💡 Para probar offline:
                  </p>
                  <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Construye la app en producción: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">cd apps/pwa && npm run build</code></li>
                    <li>Ejecuta el preview: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">npm run preview</code></li>
                    <li>O usa el script: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">./scripts/test-offline.sh</code></li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  En producción, el offline funciona perfectamente gracias al Service Worker.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ocurrio un problema inesperado. Puedes reintentar o volver al inicio.
              </p>
            )}
            {isDev && this.state.error?.message && !isOfflineModuleError ? (
              <div className="rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {!isOfflineModuleError && (
                <Button variant="outline" onClick={this.handleRetry}>
                  Reintentar
                </Button>
              )}
              <Button variant="secondary" onClick={this.handleGoHome}>
                Ir al inicio
              </Button>
              <Button onClick={this.handleReload}>Recargar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}

export default ErrorBoundary
