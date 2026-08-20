import React, { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  message: string;
  type?: "success" | "error" | "info" | "default";
  icon?: string;
}

interface ToastContextValue {
  showToast: (
    message: string,
    options?: { type?: Toast["type"]; icon?: string; duration?: number }
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (
      message: string,
      options?: { type?: Toast["type"]; icon?: string; duration?: number }
    ) => {
      const id = ++toastIdCounter;
      const duration = options?.duration ?? 2800;

      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          type: options?.type ?? "default",
          icon: options?.icon,
        },
      ]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-feedback${
              toast.type && toast.type !== "default" ? ` ${toast.type}` : ""
            }`}
            role="status"
            style={{ pointerEvents: "auto" }}
          >
            {toast.icon && <span aria-hidden="true">{toast.icon}</span>}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so components never crash if used outside provider
    return {
      showToast: (message, opts) => {
        console.info("[Toast]", message, opts);
      },
    };
  }
  return ctx;
}
