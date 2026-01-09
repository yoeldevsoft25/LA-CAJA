import { useEffect, useCallback } from 'react'
import { UseFormReturn, DefaultValues } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'

export interface UseModalFormOptions<T> {
  isOpen: boolean
  defaultValues: DefaultValues<T>
  entity?: Partial<T> | null
  onSuccess?: () => void
  onClose: () => void
  queryKeysToInvalidate?: string[][]
}

export interface UseModalFormReturn<T> {
  form: UseFormReturn<T>
  handleSuccess: () => void
  queryClient: ReturnType<typeof useQueryClient>
}

/**
 * Hook reutilizable para gestionar formularios en modales
 * 
 * Características:
 * - Limpia el formulario cuando el modal se cierra
 * - Carga datos de la entidad cuando el modal se abre
 * - Invalida queries relacionadas después de operaciones exitosas
 * - Maneja el flujo de onSuccess y onClose de forma consistente
 * 
 * @example
 * ```tsx
 * const { form, handleSuccess, queryClient } = useModalForm({
 *   isOpen,
 *   defaultValues: { name: '', email: '' },
 *   entity: editingCustomer,
 *   onSuccess: () => console.log('Success'),
 *   onClose: () => setIsOpen(false),
 *   queryKeysToInvalidate: [['customers'], ['customers', 'list']],
 * })
 * 
 * const mutation = useMutation({
 *   mutationFn: createCustomer,
 *   onSuccess: handleSuccess,
 * })
 * ```
 */
export function useModalForm<T extends Record<string, any>>(
  form: UseFormReturn<T>,
  options: UseModalFormOptions<T>
): UseModalFormReturn<T> {
  const {
    isOpen,
    defaultValues,
    entity,
    onSuccess,
    onClose,
    queryKeysToInvalidate = [],
  } = options

  const queryClient = useQueryClient()

  // Limpiar formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      form.reset(defaultValues)
    }
  }, [isOpen, form, defaultValues])

  // Cargar datos de la entidad cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return

    if (entity) {
      form.reset(entity as DefaultValues<T>)
    } else {
      form.reset(defaultValues)
    }
  }, [isOpen, entity, form, defaultValues])

  // Manejar éxito: invalidar queries y cerrar modal
  const handleSuccess = useCallback(() => {
    // Invalidar todas las queries relacionadas
    queryKeysToInvalidate.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey })
    })

    // Llamar callback de éxito
    onSuccess?.()

    // Cerrar modal
    onClose()
  }, [queryKeysToInvalidate, queryClient, onSuccess, onClose])

  return {
    form,
    handleSuccess,
    queryClient,
  }
}
