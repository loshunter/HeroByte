// ============================================================================
// TOAST HOOK
// ============================================================================
// Hook to manage toast notifications

import { useState, useCallback, useMemo } from "react";
import type { ToastMessage, ToastType } from "../components/ui/Toast";

let toastIdCounter = 0;

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${++toastIdCounter}`;
    const toast: ToastMessage = {
      id,
      type,
      message,
      duration: duration ?? 3000,
    };

    setMessages((prev) => [...prev, toast]);
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => {
      showToast("success", message, duration);
    },
    [showToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      showToast("error", message, duration);
    },
    [showToast],
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      showToast("warning", message, duration);
    },
    [showToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      showToast("info", message, duration);
    },
    [showToast],
  );

  const dismiss = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  return useMemo(
    () => ({
      messages,
      success,
      error,
      warning,
      info,
      dismiss,
    }),
    [messages, success, error, warning, info, dismiss],
  );
}
