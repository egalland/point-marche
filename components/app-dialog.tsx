"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { activateDialog, isTopDialog } from "@/lib/dialog-controller";
import { createPortal } from "react-dom";

type AppDialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  busy?: boolean;
  closeLabel?: string;
};

export function AppDialog({ open, onClose, labelledBy, children, className = "", backdropClassName = "", busy = false, closeLabel = "Fermer" }: AppDialogProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const backdropPointerRef = useRef<number | null>(null);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    return activateDialog(panelRef.current, () => closeRef.current(), () => busyRef.current);
  }, [open]);

  if (!open) return null;
  const closeFromBackdrop = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === backdropPointerRef.current && event.target === event.currentTarget && !busy && isTopDialog(panelRef.current)) onClose();
    backdropPointerRef.current = null;
  };

  const dialog = <div className={`app-dialog-backdrop ${backdropClassName}`.trim()} onPointerDown={(event) => { backdropPointerRef.current = event.target === event.currentTarget ? event.pointerId : null; }} onPointerUp={closeFromBackdrop} onPointerCancel={() => { backdropPointerRef.current = null; }}>
    <section ref={panelRef} className={`app-dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
      <button className="app-dialog-close" type="button" aria-label={closeLabel} title={closeLabel} disabled={busy} onClick={onClose}>×</button>
      {children}
    </section>
  </div>;
  return typeof document !== "undefined" && document.body ? createPortal(dialog, document.querySelector(".app-shell") ?? document.body) : dialog;
}
