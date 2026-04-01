"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SnackbarVariant = "success" | "error";

type SnackbarContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const DEFAULT_MS = 5200;

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<SnackbarVariant>("success");
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback((v: SnackbarVariant, msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVariant(v);
    setMessage(msg);
    setOpen(true);
    timerRef.current = setTimeout(() => {
      setOpen(false);
      timerRef.current = null;
    }, DEFAULT_MS);
  }, []);

  const showSuccess = useCallback((msg: string) => show("success", msg), [show]);
  const showError = useCallback((msg: string) => show("error", msg), [show]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({ showSuccess, showError }),
    [showSuccess, showError],
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div className="snackbar-region" aria-live="polite" aria-atomic="true">
        {open ? (
          <div
            className={`snackbar ${variant === "success" ? "snackbar--success" : "snackbar--error"}`}
            role={variant === "error" ? "alert" : "status"}
          >
            <span className="snackbar__text">{message}</span>
            <button type="button" className="snackbar__close" onClick={hide} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
      </div>
    </SnackbarContext.Provider>
  );
}
