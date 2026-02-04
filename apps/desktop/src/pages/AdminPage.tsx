import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// import { useNavigate } from 'react-router-dom'
import { adminService, AdminStore, AdminMember } from '@/services/admin.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { toast } from '@/lib/toast'
import { addDays, format, formatDistanceToNowStrict, isAfter, parseISO } from 'date-fns'
import { MoreHorizontal, ShieldCheck, ShieldOff, Sparkles, Calendar, Trash2, Store, Activity, AlertTriangle, Search } from 'lucide-react'
import NumberTicker from '@/components/magicui/number-ticker'
import BlurFade from '@/components/magicui/blur-fade'
import ShineBorder from '@/components/magicui/shine-border'
// import { BentoGrid, BentoCard } from '@/components/magicui/bento-grid'
// import { motion } from 'framer-motion'
// import { cn } from '@/lib/utils'

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'yyyy-MM-dd')
  } catch {
    return value
  }
}

function formatDistance(value: string | null) {
  if (!value) return '—'
  try {
    return formatDistanceToNowStrict(parseISO(value), { addSuffix: true })
  } catch {
    return value
  }
}

function statusBadge(store: AdminStore) {
  const now = new Date()
  const expires = store.license_expires_at ? parseISO(store.license_expires_at) : null
  const isExpired = expires ? isAfter(now, expires) : false
  if (store.license_status === 'suspended') {
    return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20">Suspendida</Badge>
  }
  if (isExpired) {
    return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20">Expirada</Badge>
  }
  return <Badge className="bg-[#0c81cf10] text-[#0c81cf] border-[#0c81cf20] hover:bg-[#0c81cf20]">Activa</Badge>
}

export default function AdminPage() {
  const qc = useQueryClient()
  // const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [expiringIn] = useState<string>('none')
  const [adminKey, setAdminKey] = useState<string>(() => adminService.getKey() || '')
  const [userSheetStore, setUserSheetStore] = useState<AdminStore | null>(null)
  const [planSheetStore, setPlanSheetStore] = useState<AdminStore | null>(null)
  const [newPlan, setNewPlan] = useState<string>('')
  const [planExpiryDays, setPlanExpiryDays] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [newUser, setNewUser] = useState<{ full_name: string; role: 'owner' | 'cashier'; pin: string }>({
    full_name: '',
    role: 'cashier',
    pin: '',
  })
  const [newStore, setNewStore] = useState<{ name: string; plan: string; days: string; notes: string }>({
    name: '',
    plan: '',
    days: '',
    notes: '',
  })
  // const [deleteConfirmStore, setDeleteConfirmStore] = useState<AdminStore | null>(null)

  const { data: stores, isLoading, refetch, error } = useQuery<AdminStore[], Error>({
    queryKey: ['admin-stores', statusFilter, planFilter, expiringIn, adminKey],
    queryFn: () =>
      adminService.listStores({
        status: statusFilter === 'all' ? undefined : statusFilter,
        plan: planFilter === 'all' ? undefined : planFilter,
        expiring_in_days: expiringIn === 'none' ? undefined : Number(expiringIn),
      }),
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
    let result = [...stores]

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        s.id.toLowerCase().includes(lower)
      )
    }

    return result
      .filter((s) => {
        if (statusFilter === 'expired') {
          return s.license_expires_at ? isAfter(new Date(), parseISO(s.license_expires_at)) : false
        }
        return true
      })
      .sort((a, b) => {
        const aDate = a.license_expires_at || ''
        const bDate = b.license_expires_at || ''
        return aDate.localeCompare(bDate)
      })
  }, [stores, statusFilter, searchTerm])

  const stats = useMemo(() => {
    if (!stores) return { total: 0, active: 0, suspended: 0, expiringSoon: 0 }
    const now = new Date()
    return {
      total: stores.length,
      active: stores.filter((s) => s.license_status === 'active').length,
      suspended: stores.filter((s) => s.license_status === 'suspended').length,
      expiringSoon: stores.filter((s) => {
        if (!s.license_expires_at) return false
        const diff = parseISO(s.license_expires_at).getTime() - now.getTime()
        return diff > 0 && diff < 1000 * 60 * 60 * 24 * 7
      }).length,
    }
  }, [stores])

  const handleExtend = (store: AdminStore, days: number) => {
    const base = store.license_expires_at ? parseISO(store.license_expires_at) : new Date()
    const newDate = addDays(base, days)
    mutation.mutate({
      storeId: store.id,
      data: { status: 'active', expires_at: newDate.toISOString(), plan: store.license_plan ?? 'plan' },
    })
  }

  const createStoreMutation = useMutation({
    mutationFn: () =>
      adminService.createStore({
        name: newStore.name,
        plan: newStore.plan || undefined,
        expires_at: newStore.days ? new Date(Date.now() + Number(newStore.days) * 86400000).toISOString() : undefined,
        notes: newStore.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Tienda creada')
      setNewStore({ name: '', plan: '', days: '', notes: '' })
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  // Sheet Logic Reuse
  const {
    data: members,
    refetch: refetchMembers,
    isFetching: isMembersLoading,
  } = useQuery<AdminMember[]>({
    queryKey: ['admin-members', userSheetStore?.id],
    queryFn: () => adminService.listUsers(userSheetStore!.id),
    enabled: !!userSheetStore?.id && !!adminKey,
  })

  const createUserMutation = useMutation({
    mutationFn: () =>
      adminService.createUser(userSheetStore!.id, {
        full_name: newUser.full_name,
        role: newUser.role,
        pin: newUser.pin ? newUser.pin : undefined,
      }),
    onSuccess: () => {
      toast.success('Usuario creado')
      setNewUser({ full_name: '', role: 'cashier', pin: '' })
      refetchMembers()
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userSheetStore!.id, userId),
    onSuccess: () => {
      toast.success('Usuario removido')
      refetchMembers()
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error'
      toast.error(msg)
    },
  })

  // deleteStoreMutation is not used


  return (
    <div className="space-y-6 pb-20">
      {/* Top Bar with Search and Create */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#0c81cf] transition-colors" />
          <Input
            placeholder="Buscar tienda por nombre o ID..."
            className="pl-9 bg-white border-slate-200 focus:border-[#0c81cf] transition-all rounded-xl shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-1.5 py-1.5 shadow-sm">
            <Input
              placeholder="Nombre nueva tienda"
              value={newStore.name}
              onChange={(e) => setNewStore((prev) => ({ ...prev, name: e.target.value }))}
              className="h-9 bg-transparent border-none focus-visible:ring-0 text-slate-900 placeholder:text-slate-400 w-48"
            />
            <div className="h-6 w-px bg-slate-200" />
            <Input
              placeholder="Días"
              value={newStore.days}
              onChange={(e) => setNewStore((prev) => ({ ...prev, days: e.target.value }))}
              className="h-9 bg-transparent border-none focus-visible:ring-0 text-slate-900 w-16 text-center"
            />
            <Button
              size="sm"
              className="bg-[#0c81cf] hover:bg-[#0a6fb3] text-white rounded-lg h-8 px-4"
              disabled={!newStore.name || createStoreMutation.isPending}
              onClick={() => createStoreMutation.mutate()}
            >
              Crear
            </Button>
          </div>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <BlurFade delay={0.1}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Tiendas</CardTitle>
              <Store className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                <NumberTicker value={stats.total} />
              </div>
              <p className="text-xs text-slate-400">Registradas en plataforma</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Activas</CardTitle>
              <Activity className="h-4 w-4 text-[#0c81cf]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#0c81cf]">
                <NumberTicker value={stats.active} />
              </div>
              <p className="text-xs text-slate-400">Licencias vigentes</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Suspendidas</CardTitle>
              <ShieldOff className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-500">
                <NumberTicker value={stats.suspended} />
              </div>
              <p className="text-xs text-slate-400">Acceso bloqueado</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Riesgo Expiración</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">
                <NumberTicker value={stats.expiringSoon} />
              </div>
              <p className="text-xs text-slate-400">Expiran en &lt; 7 días</p>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-[1fr] gap-6">
        {!adminKey ? (
          <BlurFade delay={0.2}>
            <ShineBorder className="w-full flex flex-col items-center justify-center p-12 text-center" color={["#0c81cf", "#0ea5e9"]}>
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-[#0c81cf]">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
              <p className="text-slate-500 mb-6 max-w-md">Esta área es exclusiva para administradores del sistema. Por favor ingresa tu clave maestra para continuar.</p>
              <div className="flex gap-2 max-w-sm w-full">
                <Input
                  type="password"
                  placeholder="Admin Key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="bg-white"
                />
                <Button onClick={() => refetch()} disabled={!adminKey} className="bg-[#0c81cf] hover:bg-[#0a6fb3]">Ingresar</Button>
              </div>
            </ShineBorder>
          </BlurFade>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0c81cf]"></div>
          </div>
        ) : error ? (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="py-6 text-sm text-red-600">
              {error.message || 'Error cargando tiendas'}
              <Button variant="link" onClick={() => refetch()} className="text-red-700 underline ml-2">Reintentar</Button>
            </CardContent>
          </Card>
        ) : (
          <BlurFade delay={0.3}>
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tiendas Registradas</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Gestión centralizada de clientes y licencias</p>
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px] h-8 bg-white text-xs">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="active">Activas</SelectItem>
                        <SelectItem value="suspended">Suspendidas</SelectItem>
                        <SelectItem value="expired">Expiradas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                      <SelectTrigger className="w-[130px] h-8 bg-white text-xs">
                        <SelectValue placeholder="Plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los planes</SelectItem>
                        <SelectItem value="basico">Básico</SelectItem>
                        <SelectItem value="profesional">Profesional</SelectItem>
                        <SelectItem value="empresarial">Empresarial</SelectItem>
                        <SelectItem value="freemium">Freemium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <div className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Tienda</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Plan</th>
                      <th className="px-6 py-3">Vencimiento</th>
                      <th className="px-6 py-3">Usuarios</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.map((store /*, i*/) => (
                      <tr key={store.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#0c81cf] to-[#0ea5e9] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                              {store.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-[#0c81cf] transition-colors">{store.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{store.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {statusBadge(store)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-normal capitalize bg-slate-50 text-slate-600 border-slate-200">
                            {store.license_plan || 'N/A'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-900 font-medium">{formatDate(store.license_expires_at)}</div>
                          <div className="text-xs text-slate-400">{formatDistance(store.license_expires_at)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex -space-x-2 overflow-hidden">
                            {store.members?.slice(0, 3).map((m, idx) => (
                              <div key={idx} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[10px] text-slate-600 font-bold" title={m.full_name ?? 'Usuario'}>
                                {m.full_name ? m.full_name.charAt(0) : '?'}
                              </div>
                            ))}
                            {(store.member_count || 0) > 3 && (
                              <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-50 flex items-center justify-center text-[10px] text-slate-400">
                                +{store.member_count - 3}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleExtend(store, 30)}>
                                <Calendar className="mr-2 h-4 w-4" /> Extender 30 días
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => trialMutation.mutate(store.id)}>
                                <Sparkles className="mr-2 h-4 w-4" /> Reiniciar Trial
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setUserSheetStore(store)}>
                                Gestión Usuarios
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPlanSheetStore(store)}>
                                Cambiar Plan
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-600 hover:bg-rose-50" onClick={() => { /* setDeleteConfirmStore(store) */ }}>
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar Tienda
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sorted.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    No se encontraron tiendas con los filtros seleccionados.
                  </div>
                )}
              </div>
            </Card>
          </BlurFade>
        )}
      </div>

      {/* Sheet para usuarios */}
      <Sheet open={!!userSheetStore} onOpenChange={(open) => !open && setUserSheetStore(null)}>
        <SheetContent className="bg-white text-slate-900 border-slate-200 w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-slate-900">Usuarios de {userSheetStore?.name || ''}</SheetTitle>
            <SheetDescription className="text-slate-500">
              Crea, revisa o elimina usuarios (owner/cashier) de la tienda.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {isMembersLoading ? (
              <p className="text-sm text-slate-500">Cargando usuarios...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Usuarios</p>
                <ScrollArea className="h-48 rounded-md border border-slate-200">
                  <div className="p-3 space-y-2">
                    {(members ?? []).map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{m.full_name || m.user_id}</div>
                          <div className="text-[11px] text-slate-500">{m.user_id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-slate-200 text-slate-700">
                            {m.role}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-300 hover:text-rose-200"
                            onClick={() => deleteUserMutation.mutate(m.user_id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(members ?? []).length === 0 && (
                      <div className="text-sm text-slate-400 text-center py-6">Sin usuarios aún.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator className="bg-slate-200" />

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Crear usuario</p>
              <div className="space-y-2">
                <Label className="text-slate-700">Nombre</Label>
                <Input
                  value={newUser.full_name}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-900"
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Rol</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(val) => setNewUser((prev) => ({ ...prev, role: val as 'owner' | 'cashier' }))}
                >
                  <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">PIN / Contraseña</Label>
                <Input
                  type="password"
                  value={newUser.pin}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, pin: e.target.value }))}
                  className="bg-white border-slate-200 text-slate-900"
                  placeholder={
                    newUser.role === 'cashier'
                      ? 'PIN para cajero (4-6 dígitos)'
                      : 'PIN para owner (4-6 dígitos, opcional pero recomendado)'
                  }
                />
                <p className="text-xs text-slate-500">
                  {newUser.role === 'cashier'
                    ? 'Requerido para cajeros.'
                    : 'Si lo defines, el owner podrá ingresar con este PIN.'}
                </p>
              </div>
              <Button
                className="w-full bg-[#0c81cf] hover:bg-[#0a6fb3] text-white"
                onClick={() => createUserMutation.mutate()}
                disabled={
                  !newUser.full_name ||
                  createUserMutation.isPending ||
                  !userSheetStore ||
                  (newUser.role === 'cashier' && !newUser.pin)
                }
              >
                Crear usuario
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet para cambiar plan */}
      <Sheet open={!!planSheetStore} onOpenChange={(open) => !open && setPlanSheetStore(null)}>
        <SheetContent className="bg-white text-slate-900 border-slate-200 w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-slate-900">Cambiar Plan - {planSheetStore?.name || ''}</SheetTitle>
            <SheetDescription className="text-slate-500">
              Actualiza el plan de suscripción de esta tienda.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Plan Actual</Label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <Badge variant="outline" className="border-slate-200 text-slate-700">
                  {planSheetStore?.license_plan || 'Sin plan'}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Nuevo Plan</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="freemium">🆓 Freemium - GRATIS</SelectItem>
                  <SelectItem value="basico">💼 Básico - $29/mes</SelectItem>
                  <SelectItem value="profesional">🚀 Profesional - $79/mes</SelectItem>
                  <SelectItem value="empresarial">🏢 Empresarial - $199/mes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Fecha de Expiración (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Días desde hoy"
                  value={planExpiryDays}
                  onChange={(e) => setPlanExpiryDays(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900"
                />
                {planExpiryDays && (
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(
                      new Date(Date.now() + Number(planExpiryDays) * 86400000).toISOString()
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Deja vacío para mantener la fecha actual. Ingresa días para extender desde hoy.
              </p>
            </div>

            <Separator className="bg-slate-200" />

            <Button
              className="w-full bg-[#0c81cf] hover:bg-[#0a6fb3] text-white"
              onClick={() => {
                if (!planSheetStore) return;
                const updates: any = { plan: newPlan }
                if (planExpiryDays) {
                  updates.expires_at = new Date(Date.now() + Number(planExpiryDays) * 86400000).toISOString()
                }
                mutation.mutate({
                  storeId: planSheetStore.id,
                  data: updates
                })
                setPlanSheetStore(null)
              }}
              disabled={!newPlan || mutation.isPending}
            >
              Actualizar Plan
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
}
