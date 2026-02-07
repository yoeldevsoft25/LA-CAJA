import type { CSSProperties, ReactNode, MouseEvent } from 'react';

export type ToastOptions = {
    duration?: number;
    icon?: string | ReactNode;
    id?: string;
    style?: CSSProperties;
    description?: string | ReactNode;
    action?: {
        label: string;
        onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    };
};

export type ToastFunction = {
    (message: string, options?: ToastOptions): string | number;
    success: (message: string, options?: ToastOptions) => string | number;
    error: (message: string, options?: ToastOptions) => string | number;
    warning: (message: string, options?: ToastOptions) => string | number;
    info: (message: string, options?: ToastOptions) => string | number;
    dismiss: (toastId?: string | number) => void;
    dismissAll: () => void;
    loading: (message: string, options?: ToastOptions) => string | number;
    promise: <T>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string | ((data: T) => string);
            error: string | ((error: any) => string);
        }
    ) => Promise<T>;
};

let currentToast: ToastFunction | null = null;

const noopToast: ToastFunction = ((message: string) => {
    return `toast:${message}`;
}) as ToastFunction;

noopToast.success = (message: string) => `toast:success:${message}`;
noopToast.error = (message: string) => `toast:error:${message}`;
noopToast.warning = (message: string) => `toast:warning:${message}`;
noopToast.info = (message: string) => `toast:info:${message}`;
noopToast.dismiss = () => undefined;
noopToast.dismissAll = () => undefined;
noopToast.loading = (message: string) => `toast:loading:${message}`;
noopToast.promise = async <T>(promise: Promise<T>) => promise;

export const setToast = (toastImpl: ToastFunction): void => {
    currentToast = toastImpl;
};

export const getToast = (): ToastFunction => currentToast ?? noopToast;

export const toast: ToastFunction = new Proxy(noopToast, {
    get(_target, prop) {
        const impl = getToast();
        const value = (impl as any)[prop];
        if (typeof value === 'function') return value.bind(impl);
        return value;
    },
}) as ToastFunction;

export default toast;
