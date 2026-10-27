"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PointToolWheel, type PointTool } from "@/components/point-tool-wheel";
import type { ModuleWidth } from "@/components/module-layout-editor";
import { analystPointModules, type AnalystPointModule } from "@/lib/analyst-point";

const widths: ModuleWidth[] = ["quarter", "half", "two-thirds", "three-quarters", "full"];
const columns = [3, 6, 8, 9, 12];
const interactive = 'button,a,input,select,textarea,summary,[contenteditable="true"],[role="button"]';
type Props = {
  order: AnalystPointModule[];
  widths: Record<AnalystPointModule, ModuleWidth>;
  visible: Record<AnalystPointModule, boolean>;
  includeCycle20: boolean;
  editing: AnalystPointModule | null;
  disabled?: boolean;
  onEdit: (id: AnalystPointModule | null) => void;
  onOrder: (order: AnalystPointModule[]) => void;
  onWidth: (id: AnalystPointModule, width: ModuleWidth) => void;
  onVisibility: (id: AnalystPointModule, visible: boolean) => void;
  onSettings: () => void;
  children: (id: AnalystPointModule) => ReactNode;
};

/** Uses the same persisted order and widths as the analyst mail and web exports. */
export function AnalystPointCanvas(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [wheel, setWheel] = useState<{ x: number; y: number; id: AnalystPointModule | null } | null>(null);
  const [dragged, setDragged] = useState<AnalystPointModule | null>(null);
  const [resizing, setResizing] = useState<{ id: AnalystPointModule; start: number; width: number; grid: number; target: ModuleWidth; pointer: number } | null>(null);
  const edit = useRef(props.onEdit); edit.current = props.onEdit;
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.point-tool-wheel,[role="dialog"]')) return;
      if (!root.current?.contains(event.target)) edit.current(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { edit.current(null); setWheel(null); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const shown = props.order.filter(id => props.visible[id] && (id !== "cycle20" || props.includeCycle20));
  const label = (id: AnalystPointModule) => analystPointModules.find(item => item.id === id)!.label;
  const move = (id: AnalystPointModule, amount: number) => {
    const next = [...props.order], index = next.indexOf(id), target = shown[shown.indexOf(id) + amount];
    if (!target) return;
    next.splice(index, 1); next.splice(next.indexOf(target) + (amount > 0 ? 1 : 0), 0, id); props.onOrder(next);
  };
  const tools: PointTool[] = wheel?.id ? [
    { label: props.editing === wheel.id ? "Terminer" : "Modifier", icon: "edit", run: () => props.onEdit(props.editing === wheel.id ? null : wheel.id) },
    { label: "Monter", icon: "upload", disabled: shown.indexOf(wheel.id) === 0, run: () => move(wheel.id!, -1) },
    { label: "Descendre", icon: "download", disabled: shown.indexOf(wheel.id) === shown.length - 1, run: () => move(wheel.id!, 1) },
    { label: "Largeur", icon: "monitor", run: () => props.onWidth(wheel.id!, widths[(widths.indexOf(props.widths[wheel.id!]) + 1) % widths.length]) },
    { label: "Masquer", icon: "eye", run: () => { props.onVisibility(wheel.id!, false); props.onEdit(null); } },
    { label: "Options", icon: "settings", run: props.onSettings },
  ] : [
    { label: "Options du point", icon: "settings", run: props.onSettings },
    { label: "Terminer", icon: "edit", run: () => props.onEdit(null) },
    { label: "Afficher les blocs", icon: "eye", run: props.onSettings },
  ];
  return <div ref={root} className="analyst-point-canvas" onContextMenu={event => {
    if (props.disabled || (event.target as Element).closest('input,textarea,select,[contenteditable="true"]')) return;
    event.preventDefault(); const block = (event.target as Element).closest<HTMLElement>('[data-analyst-block]');
    setWheel({ x: event.clientX, y: event.clientY, id: block?.dataset.analystBlock as AnalystPointModule ?? null });
  }} onClick={event => { if (!(event.target as Element).closest('[data-analyst-block],button')) props.onEdit(null); }}>
    <div className="analyst-canvas-hint"><span>Clique sur un bloc pour le modifier · clic droit pour les outils</span><button type="button" className="secondary-button" aria-haspopup="menu" disabled={props.disabled} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setWheel({ x: rect.left, y: rect.bottom, id: null }); }}>Outils du point</button></div>
    <div className="analyst-canvas-grid">{shown.map(id => <article key={id} data-analyst-block={id} className={`analyst-canvas-block${props.editing === id ? " is-selected" : ""}`} style={{ gridColumn: `span ${columns[widths.indexOf(resizing?.id === id ? resizing.target : props.widths[id])] ?? 12}` }}
      onClick={event => { if (!props.disabled && !(event.target as Element).closest(interactive)) props.onEdit(id); }}
      onDragOver={event => { if (dragged) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!dragged || dragged === id) return; const next = props.order.filter(item => item !== dragged); next.splice(next.indexOf(id), 0, dragged); props.onOrder(next); setDragged(null); }}>
      <div className="analyst-block-tools">
        <button type="button" className="analyst-move-handle" draggable={!props.disabled} disabled={props.disabled} aria-label={`Déplacer ${label(id)}`} onDragStart={event => { setDragged(id); event.dataTransfer.setData("text/plain", id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragged(null)}>⠿</button>
        <strong>{label(id)}</strong>
        {props.editing === id && <button type="button" onClick={() => props.onEdit(null)}>Terminer</button>}
        <button type="button" aria-haspopup="menu" disabled={props.disabled} aria-label={`Outils ${label(id)}`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setWheel({ x: rect.left, y: rect.bottom, id }); }}>•••</button>
      </div>
      <div className="analyst-block-content">{props.children(id)}</div>
      <button type="button" className="analyst-resize-handle" role="slider" aria-label={`Largeur ${label(id)}`} aria-valuemin={25} aria-valuemax={100} aria-valuenow={Math.round((columns[widths.indexOf(props.widths[id])] ?? 12) / 12 * 100)} aria-valuetext={props.widths[id]} disabled={props.disabled}
        onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const index = widths.indexOf(props.widths[id]); props.onWidth(id, widths[event.key === "Home" ? 0 : event.key === "End" ? 4 : Math.max(0, Math.min(4, index + (event.key === "ArrowLeft" ? -1 : 1)))]); }}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); const grid = root.current!.querySelector('.analyst-canvas-grid')!.getBoundingClientRect().width; const width = event.currentTarget.parentElement!.getBoundingClientRect().width; event.currentTarget.setPointerCapture(event.pointerId); setResizing({ id, start: event.clientX, width, grid, target: props.widths[id], pointer: event.pointerId }); }}
        onPointerMove={event => { if (!resizing || resizing.id !== id || event.pointerId !== resizing.pointer) return; const desired = (resizing.width + event.clientX - resizing.start) / resizing.grid * 12; const index = columns.reduce((best, col, index) => Math.abs(col - desired) < Math.abs(columns[best] - desired) ? index : best, 0); setResizing({ ...resizing, target: widths[index] }); }}
        onPointerUp={event => { if (resizing && resizing.pointer === event.pointerId) { props.onWidth(id, resizing.target); setResizing(null); } }} onPointerCancel={() => setResizing(null)} onClick={event => event.stopPropagation()}><span aria-hidden="true">⋮</span></button>
    </article>)}</div>
    {!shown.length && <p className="analyst-module-empty">Aucun bloc visible. Ouvre les options pour en afficher.</p>}
    {wheel && <PointToolWheel {...wheel} title={wheel.id ? label(wheel.id) : "Point analyste"} tools={tools} onClose={() => setWheel(null)}/>}
  </div>;
}
