import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, Info, GitCompare, Smartphone, Server } from 'lucide-react';
import { db, LocalConflict } from '@/db/database';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '@/lib/toast';

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
    refetchInterval: 5000,
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
      toast.success('Conflicto resuelto exitosamente');
    },
    onError: () => {
      toast.error('Error al resolver el conflicto');
    }
  });

  const handleResolve = (conflict: LocalConflict, resolution: 'keep_mine' | 'take_theirs') => {
    resolveConflictMutation.mutate({
      conflictId: conflict.id,
      resolution,
    });
  };

  if (isLoading) {
    return (
      <div className="h-full max-w-7xl mx-auto p-6 flex items-center justify-center">
        <Clock className="h-12 w-12 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="h-full max-w-5xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-10 text-center sm:text-left">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex p-3 bg-amber-50 rounded-2xl border border-amber-200 mb-6"
        >
          <GitCompare className="h-8 w-8 text-amber-600" />
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Resolución de Conflictos
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Detectamos discrepancias entre tus cambios locales y los del servidor.
          Elige qué versión deseas conservar para mantener la integridad de tus datos.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {conflicts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-dashed border-2 bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
                  <CheckCircle className="h-10 w-10 text-success" />
                </div>
                <h3 className="text-2xl font-bold mb-2">¡Todo al día!</h3>
                <p className="text-muted-foreground text-center text-lg">
                  No tienes conflictos pendientes de resolución.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {conflicts.map((conflict, index) => (
              <motion.div
                key={conflict.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ConflictCard
                  conflict={conflict}
                  onResolve={handleResolve}
                  isResolving={resolveConflictMutation.isPending}
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
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
  return (
    <Card className="overflow-hidden border-2 border-amber-100 shadow-xl shadow-amber-900/5 hover:border-amber-200 transition-all">
      <CardHeader className="bg-amber-50/50 border-b border-amber-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">
                Evento: {conflict.event_id.slice(0, 12)}...
              </CardTitle>
              <p className="text-xs text-amber-700 font-medium">Detectado el {new Date(conflict.created_at).toLocaleString()}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white text-amber-700 border-amber-200">
            {conflict.requires_manual_review ? 'Revisión Crítica' : 'Conflicto Estándar'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8 space-y-8">
        <div className="p-4 bg-muted rounded-xl text-sm border border-border/50">
          <div className="flex items-center gap-2 mb-2 font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
            <Info className="h-4 w-4" /> Razón
          </div>
          <p className="text-foreground font-medium">{conflict.reason}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-stretch">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-border flex items-center justify-center font-bold text-muted-foreground shadow-sm">
              VS
            </div>
          </div>

          {/* Local Version */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl bg-primary/[0.03] border border-primary/10 relative">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
              <Smartphone className="h-4 w-4" /> Versión Local (Mía)
            </div>
            <div className="flex-1 bg-white rounded-xl p-4 border border-primary/5 shadow-inner">
              <p className="text-xs font-medium text-muted-foreground italic">Tus cambios guardados en este dispositivo.</p>
            </div>
            <Button
              onClick={() => onResolve(conflict, 'keep_mine')}
              disabled={isResolving}
              className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-11"
            >
              Mantener mi versión
            </Button>
          </div>

          {/* Server Version */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl bg-muted/50 border border-border relative">
            <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs uppercase tracking-widest">
              <Server className="h-4 w-4" /> Versión del Servidor
            </div>
            <div className="flex-1 bg-white rounded-xl p-4 border border-border/50 shadow-inner">
              <p className="text-xs font-medium text-muted-foreground italic">La versión que otros dispositivos han sincronizado.</p>
            </div>
            <Button
              onClick={() => onResolve(conflict, 'take_theirs')}
              disabled={isResolving}
              variant="outline"
              className="w-full border-2 hover:bg-muted h-11"
            >
              Usar del servidor
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
