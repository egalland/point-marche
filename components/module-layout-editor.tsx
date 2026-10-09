"use client";

import { useState, type DragEvent } from "react";

export type ModuleWidth = "quarter" | "half" | "three-quarters" | "two-thirds" | "full";

type ModuleDefinition<T extends string> = {
  id: T;
  label: string;
  detail: string;
};

type Props<T extends string> = {
  modules: ModuleDefinition<T>[];
  order: T[];
  widths: Record<T, ModuleWidth>;
  onChangeOrder: (order: T[]) => void;
  onChangeWidth: (id: T, width: ModuleWidth) => void;
};

export function ModuleLayoutEditor<T extends string>({ modules, order, widths, onChangeOrder, onChangeWidth }: Props<T>) {
  const [dragged, setDragged] = useState<T | null>(null);
  const definitions = new Map(modules.map((module) => [module.id, module]));
  const normalized = [...order.filter((id) => definitions.has(id)), ...modules.map((module) => module.id).filter((id) => !order.includes(id))];
  const move = (id: T, amount: number) => {
    const index = normalized.indexOf(id);
    const target = Math.max(0, Math.min(normalized.length - 1, index + amount));
    if (index === target) return;
    const next = normalized.slice();
    next.splice(index, 1);
    next.splice(target, 0, id);
    onChangeOrder(next);
  };
  const drop = (event: DragEvent<HTMLElement>, target: T) => {
    event.preventDefault();
    if (!dragged || dragged === target) return;
    const next = normalized.filter((id) => id !== dragged);
    next.splice(next.indexOf(target), 0, dragged);
    onChangeOrder(next);
    setDragged(null);
  };

  return <div className="module-layout-editor">
    <header><div><span>Ordre du rendu</span><strong>Déplace les blocs du point</strong></div><small>Glisse une ligne ou utilise les flèches. La largeur s’applique à la lecture.</small></header>
    <div>{normalized.map((id, index) => {
      const definition = definitions.get(id);
      if (!definition) return null;
      return <article key={id} draggable onDragStart={() => setDragged(id)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, id)} className={dragged === id ? "is-dragging" : ""}>
        <span className="module-drag-handle" aria-hidden="true">⋮⋮</span>
        <div><strong>{definition.label}</strong><small>{definition.detail}</small></div>
        <div className="module-width-toggle" aria-label={`Largeur du bloc ${definition.label}`}><button type="button" className={widths[id] === "half" ? "active" : ""} onClick={() => onChangeWidth(id, "half")}>1/2</button><button type="button" className={widths[id] === "two-thirds" ? "active" : ""} onClick={() => onChangeWidth(id, "two-thirds")}>2/3</button><button type="button" className={widths[id] === "full" ? "active" : ""} onClick={() => onChangeWidth(id, "full")}>Pleine</button></div>
        <div className="module-order-buttons"><button type="button" disabled={index === 0} aria-label={`Monter ${definition.label}`} onClick={() => move(id, -1)}>↑</button><button type="button" disabled={index === normalized.length - 1} aria-label={`Descendre ${definition.label}`} onClick={() => move(id, 1)}>↓</button></div>
      </article>;
    })}</div>
  </div>;
}
