import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LogOut, RefreshCcw } from 'lucide-react'
import { useAuth } from '@/stores/auth.store'

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function LicenseBlockedPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const reason = useMemo(() => {
    if (!user) return 'Sesión no encontrada'
    if (user.license_status === 'suspended') return 'La licencia está suspendida.'

    const expired =
      user.license_expires_at && new Date(user.license_expires_at).getTime() < Date.now()
    if (expired) {
      return 'La licencia expiró.'
    }
    return 'Licencia inválida o pendiente de revisión.'
  }, [user])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 text-amber-300">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <p className="text-sm uppercase tracking-wide text-amber-400/80">Licencia requerida</p>
            <h1 className="text-xl font-semibold">Acceso bloqueado</h1>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-200">
          <p>{reason}</p>
          <p className="text-slate-400">
            Comunícate con el administrador para renovar o reactivar la licencia.
          </p>
        </div>

        <div className="mt-6 grid gap-3 rounded-xl bg-slate-800/60 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Estatus</span>
            <span className="font-medium capitalize">{user?.license_status ?? 'desconocido'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Expira</span>
            <span className="font-medium">{formatDate(user?.license_expires_at)}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            <RefreshCcw className="h-4 w-4" />
            Reintentar acceso
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
