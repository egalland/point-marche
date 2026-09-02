"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppIcon } from "./app-icon";

export function ActionMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => { if (ref.current) ref.current.open = false; };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <details ref={ref} className="header-more" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="icon-button" aria-label="Autres actions du point" title="Autres actions du point"><AppIcon name="more"/></summary>
    <div onClick={(event) => { if (event.target instanceof Element && event.target.closest("button") && ref.current) ref.current.open = false; }}>{children}</div>
  </details>;
}
