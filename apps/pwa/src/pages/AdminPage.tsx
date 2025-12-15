import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService, AdminStore } from '@/services/admin.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { addDays, format, parseISO } from 'date-fns'

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'yyyy-MM-dd')
  } catch {
    return value
  }
}

export default function AdminPage() {
  const qc = useQueryClient()
  const [adminKey, setAdminKey] = useState<string>(() => adminService.getKey() || '')

  const { data: stores, isLoading, refetch } = useQuery({
    queryKey: ['admin-stores'],
    queryFn: () => adminService.listStores(),
    enabled: !!adminKey,
    staleTime: 1000 * 30,
  })

  useEffect(() => {
    if (adminKey) adminService.setKey(adminKey)
  }, [adminKey])

  const mutation = useMutation({
    mutationFn: (payload: { storeId: string; data: any }) =>
      adminService.updateLicense(payload.storeId, payload.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
      toast.success('Licencia actualizada')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const trialMutation = useMutation({
    mutationFn: (storeId: string) => adminService.startTrial(storeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
      toast.success('Trial reiniciado')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const sorted = useMemo<AdminStore[]>(() => {
    if (!stores) return []
    return [...stores].sort((a, b) => {
      const aDate = a.license_expires_at || ''
      const bDate = b.license_expires_at || ''
      return aDate.localeCompare(bDate)
    })
  }, [stores])

  const handleExtend = (store: AdminStore, days: number) => {
    const base = store.license_expires_at ? parseISO(store.license_expires_at) : new Date()
    const newDate = addDays(base, days)
    mutation.mutate({
      storeId: store.id,
      data: { status: 'active', expires_at: newDate.toISOString(), plan: store.license_plan ?? 'plan' },
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Input
          type="password"
          placeholder="Admin key"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={() => refetch()} disabled={!adminKey}>
          Cargar
        </Button>
        <Button variant="outline" onClick={() => { adminService.clearKey(); setAdminKey(''); qc.clear(); }}>
          Limpiar key
        </Button>
      </div>

      {!adminKey ? (
        <p className="text-sm text-muted-foreground">Ingresa la admin key para gestionar licencias.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Tienda</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Expira</th>
                <th className="px-3 py-2">Gracia</th>
                <th className="px-3 py-2">Notas</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((store) => (
                <tr key={store.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{store.name}</div>
                    <div className="text-xs text-muted-foreground">{store.id}</div>
                  </td>
                  <td className="px-3 py-2 text-center capitalize">{store.license_status}</td>
                  <td className="px-3 py-2 text-center">{store.license_plan || '—'}</td>
                  <td className="px-3 py-2 text-center">{formatDate(store.license_expires_at)}</td>
                  <td className="px-3 py-2 text-center">{store.license_grace_days}</td>
                  <td className="px-3 py-2 text-xs max-w-[200px]">{store.license_notes || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => trialMutation.mutate(store.id)}
                        disabled={trialMutation.isPending}
                      >
                        Trial 14d
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExtend(store, 30)}
                        disabled={mutation.isPending}
                      >
                        +30d
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          mutation.mutate({
                            storeId: store.id,
                            data: { status: 'suspended', notes: 'Suspendida manualmente' },
                          })
                        }
                        disabled={mutation.isPending}
                      >
                        Suspender
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          mutation.mutate({
                            storeId: store.id,
                            data: { status: 'active' },
                          })
                        }
                        disabled={mutation.isPending}
                      >
                        Activar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
