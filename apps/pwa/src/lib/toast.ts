/**
 * Wrapper para mantener compatibilidad con react-hot-toast
 * Usa Sonner internamente para notificaciones más estéticas
 */
import { toast as sonnerToast } from 'sonner'
import React from 'react'

type ToastOptions = {
  duration?: number
  icon?: string | React.ReactNode
  id?: string
  style?: React.CSSProperties
  description?: string | React.ReactNode
  action?: {
    label: string
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  }
}

type ToastFunction = {
  (message: string, options?: ToastOptions): string | number
  success: (message: string, options?: ToastOptions) => string | number
  error: (message: string, options?: ToastOptions) => string | number
  warning: (message: string, options?: ToastOptions) => string | number
  info: (message: string, options?: ToastOptions) => string | number
  dismiss: (toastId?: string | number) => void
  dismissAll: () => void
  loading: (message: string, options?: ToastOptions) => string | number
  promise: <T, >(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => Promise<T>
}

/**
 * Función principal de toast (compatible con react-hot-toast)
 */
const toastFunction: ToastFunction = ((message: string, options?: ToastOptions) => {
  const duration = options?.duration === Infinity ? undefined : (options?.duration || 3000)
  return sonnerToast(message, {
    duration,
    id: options?.id,
    description: options?.description,
    action: options?.action,
  })
}) as ToastFunction

/**
 * Objeto toast con métodos específicos
 */
toastFunction.success = (message: string, options?: ToastOptions) => {
  const duration = options?.duration === Infinity ? undefined : (options?.duration || 3000)
  return sonnerToast.success(message, {
    duration,
    id: options?.id,
    description: options?.description,
    action: options?.action,
  })
}

toastFunction.error = (message: string, options?: ToastOptions) => {
  const duration = options?.duration === Infinity ? undefined : (options?.duration || 4000)
  return sonnerToast.error(message, {
    duration,
    id: options?.id,
    description: options?.description,
    action: options?.action,
  })
}

toastFunction.warning = (message: string, options?: ToastOptions) => {
  const duration = options?.duration === Infinity ? undefined : (options?.duration || 3000)
  return sonnerToast.warning(message, {
    duration,
    id: options?.id,
  })
}

toastFunction.info = (message: string, options?: ToastOptions) => {
  const duration = options?.duration === Infinity ? undefined : (options?.duration || 3000)
  return sonnerToast.info(message, {
    duration,
    id: options?.id,
  })
}

toastFunction.dismiss = (toastId?: string | number) => {
  sonnerToast.dismiss(toastId)
}

toastFunction.dismissAll = () => {
  sonnerToast.dismiss()
}

toastFunction.loading = (message: string, options?: ToastOptions) => {
  const duration = options?.duration === Infinity ? undefined : (options?.duration || Infinity)
  return sonnerToast.loading(message, {
    duration,
    id: options?.id,
  })
}

toastFunction.promise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: any) => string)
  }
): Promise<T> => {
  sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  })
  return promise
}

// Exportar como default para compatibilidad
export default toastFunction
export const toast = toastFunction
