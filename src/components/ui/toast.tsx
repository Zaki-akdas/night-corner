"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; type: "success" | "info" | "error"; message: string };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3500);
  }, []);
  const remove = (id: number) => setToasts((x) => x.filter((y) => y.id !== id));
  return (
    <ToastCtx.Provider value={{ push }}>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
                t.type === "success"
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : t.type === "error"
                  ? "border-rose-400/30 bg-rose-500/10"
                  : "border-sky-400/30 bg-sky-500/10"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
              ) : t.type === "error" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-400" />
              ) : (
                <Info className="mt-0.5 h-5 w-5 text-sky-400" />
              )}
              <p className="flex-1 text-sm text-slate-100">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
