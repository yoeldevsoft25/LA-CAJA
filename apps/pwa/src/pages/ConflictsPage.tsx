import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { db, LocalConflict } from '@/db/database';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ConflictsPage() {
  const queryClient = useQueryClient();

  // Query para obtener conflictos pendientes
  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ['conflicts', 'pending'],
    queryFn: async () => {
      return await db.conflicts
        .where('status')
        .equals('pending')
        .toArray();
    },
    refetchInterval: 5000, // Refrescar cada 5 segundos
  });

  // Mutation para resolver conflicto
  const resolveConflictMutation = useMutation({
    mutationFn: async ({
      conflictId,
      resolution,
    }: {
      conflictId: string;
      resolution: 'keep_mine' | 'take_theirs';
    }) => {
      // Enviar resolución al servidor
      await api.post('/sync/resolve-conflict', {
        conflict_id: conflictId,
        resolution,
      });

      // Actualizar localmente
      await db.conflicts.update(conflictId, {
        status: 'resolved',
        resolution,
        resolved_at: Date.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    },
  });

  const handleResolve = (conflict: LocalConflict, resolution: 'keep_mine' | 'take_theirs') => {
    resolveConflictMutation.mutate({
      conflictId: conflict.id,
      resolution,
    });
  };

  if (isLoading) {
    return (
      <div className="h-full max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold text-foreground">Conflictos de Sincronización</h1>
        </div>
        <p className="text-muted-foreground">
          {conflicts.length === 0
            ? 'No hay conflictos pendientes ✅'
            : `${conflicts.length} ${conflicts.length === 1 ? 'conflicto' : 'conflictos'} pendiente${conflicts.length === 1 ? '' : 's'} de resolución`}
        </p>
      </div>

      {/* Lista de conflictos */}
      {conflicts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Todo sincronizado correctamente</h3>
            <p className="text-muted-foreground text-center">
              No hay conflictos pendientes de resolución.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onResolve={handleResolve}
              isResolving={resolveConflictMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConflictCard({
  conflict,
  onResolve,
  isResolving,
}: {
  conflict: LocalConflict;
  onResolve: (conflict: LocalConflict, resolution: 'keep_mine' | 'take_theirs') => void;
  isResolving: boolean;
}) {
  const timeAgo = getTimeAgo(conflict.created_at);

  return (
    <Card className="border-l-4 border-l-yellow-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Conflicto en Evento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              ID: <code className="bg-muted px-1 rounded">{conflict.event_id.slice(0, 8)}...</code>
            </p>
          </div>
          <Badge variant={conflict.requires_manual_review ? 'destructive' : 'secondary'}>
            {conflict.requires_manual_review ? 'Requiere revisión' : 'Automático'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Razón del conflicto */}
        <div>
          <h4 className="text-sm font-medium mb-1">Razón:</h4>
          <p className="text-sm text-muted-foreground">{conflict.reason}</p>
        </div>

        {/* Eventos en conflicto */}
        {conflict.conflicting_with.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">En conflicto con:</h4>
            <div className="flex flex-wrap gap-2">
              {conflict.conflicting_with.map((eventId) => (
                <code
                  key={eventId}
                  className="text-xs bg-muted px-2 py-1 rounded"
                >
                  {eventId.slice(0, 8)}...
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          Detectado hace {timeAgo}
        </p>

        {/* Acciones */}
        <div className="flex gap-3 pt-2 border-t">
          <Button
            onClick={() => onResolve(conflict, 'keep_mine')}
            disabled={isResolving}
            variant="default"
            size="sm"
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mantener mi versión
          </Button>
          <Button
            onClick={() => onResolve(conflict, 'take_theirs')}
            disabled={isResolving}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Usar versión del servidor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
