import React from 'react';
import { useWindow } from '../hooks/useWindow';
import './WindowControls.css';

export function WindowControls() {
  const { minimize, maximize, close, setAlwaysOnTop } = useWindow();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = React.useState(false);

  const handleMaximize = async () => {
    await maximize();
  };

  const handleMinimize = async () => {
    await minimize();
  };

  const handleClose = async () => {
    await close();
  };

  const handleToggleAlwaysOnTop = async () => {
    const newValue = !isAlwaysOnTop;
    await setAlwaysOnTop(newValue);
    setIsAlwaysOnTop(newValue);
  };

  return (
    <div className="window-controls" data-tauri-drag-region>
      <button
        className="window-control-btn minimize"
        onClick={handleMinimize}
        title="Minimizar"
        aria-label="Minimizar ventana"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M0 6h12" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        className="window-control-btn maximize"
        onClick={handleMaximize}
        title="Maximizar/Restaurar"
        aria-label="Maximizar o restaurar ventana"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M1 1h10v10H1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      <button
        className="window-control-btn close"
        onClick={handleClose}
        title="Cerrar"
        aria-label="Cerrar ventana"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M1 1l10 10M11 1L1 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        className={`window-control-btn always-on-top ${isAlwaysOnTop ? 'active' : ''}`}
        onClick={handleToggleAlwaysOnTop}
        title={isAlwaysOnTop ? 'Desactivar siempre encima' : 'Activar siempre encima'}
        aria-label="Alternar siempre encima"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M6 1v10M1 6h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

