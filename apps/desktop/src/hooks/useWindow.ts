import { invoke } from '@tauri-apps/api/tauri';

export interface WindowControls {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
  setSize: (width: number, height: number) => Promise<void>;
  getSize: () => Promise<{ width: number; height: number }>;
  createWindow: (
    label: string,
    title: string,
    url: string,
    width: number,
    height: number,
  ) => Promise<void>;
}

export function useWindow(): WindowControls {
  const minimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Error minimizing window:', error);
    }
  };

  const maximize = async () => {
    try {
      await invoke('maximize_window');
    } catch (error) {
      console.error('Error maximizing window:', error);
    }
  };

  const close = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Error closing window:', error);
    }
  };

  const setAlwaysOnTop = async (alwaysOnTop: boolean) => {
    try {
      await invoke('set_always_on_top', { alwaysOnTop });
    } catch (error) {
      console.error('Error setting always on top:', error);
    }
  };

  const setSize = async (width: number, height: number) => {
    try {
      await invoke('set_window_size', { width, height });
    } catch (error) {
      console.error('Error setting window size:', error);
    }
  };

  const getSize = async (): Promise<{ width: number; height: number }> => {
    try {
      const [width, height] = await invoke<[number, number]>('get_window_size');
      return { width, height };
    } catch (error) {
      console.error('Error getting window size:', error);
      return { width: 0, height: 0 };
    }
  };

  const createWindow = async (
    label: string,
    title: string,
    url: string,
    width: number,
    height: number,
  ) => {
    try {
      await invoke('create_window', { label, title, url, width, height });
    } catch (error) {
      console.error('Error creating window:', error);
    }
  };

  return {
    minimize,
    maximize,
    close,
    setAlwaysOnTop,
    setSize,
    getSize,
    createWindow,
  };
}

