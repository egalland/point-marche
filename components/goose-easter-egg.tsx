"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AppDialog } from "@/components/app-dialog";
import { gooseStageAt } from "@/lib/goose-sequence";

function Goose({ thinking = false, portrait = false }: { thinking?: boolean; portrait?: boolean }) {
  return <svg viewBox={portrait ? "100 12 145 150" : "0 0 300 320"} fill="none" aria-hidden="true" className="goose-drawing">
    <g stroke="#17252c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <g className="goose-feet" fill="#ffae42"><path d="m106 257-5 29-31 10 16 5 35-6 3-37M154 258l11 29 30 7-13 9-35-10-12-32"/></g>
      <path fill="#f8f5e9" d="M60 190 22 162l14 48c-14 65 96 85 140 36 24-27 13-68 7-103-5-30-1-41 17-45 34-7 35-57 3-65-35-9-64 10-65 38-1 28 13 34 6 57-8 28-56 17-84 62Z"/>
      <path fill="#e2e5df" d="M51 203c20 7 63 11 84-12-8 48-48 55-73 35"/>
      <path fill="#ffae42" d="m209 65 57 20-54 17-9-15Z"/>
      <path stroke="#d78227" strokeWidth="3" d="m216 86 36-1"/>
      <ellipse cx="190" cy="61" rx="5" ry="7" fill="#17252c" stroke="none"/>
      <circle cx="191" cy="59" r="1.7" fill="white" stroke="none"/>
      <path d="m176 46 16-4" strokeWidth="4"/>
      {thinking ? <g className="goose-thinking-hand">
        <path fill="#f6c79f" d="m140 193 18-54 12-22-4-17c-1-7 9-10 12-4l6 9-1-17c0-8 11-8 12-1l2 14 5-10c3-7 12-3 10 4l-3 13c8-3 13 4 8 10l-20 21-10 60Z"/>
        <path d="m174 118 21 8m-11-21 11 6m2-10 7 9" stroke="#bd896e" strokeWidth="3"/>
      </g> : <path className="goose-wing" fill="#fffdf5" d="M96 170C77 141 43 128 23 136l26 16-21 1 34 34 34 8"/>}
    </g>
  </svg>;
}

export function GooseEasterEgg() {
  const [opened, setOpened] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!opened) return;
    const started = performance.now();
    const previousTitle = document.title;
    document.title = "oie";
    const tick = () => {
      const time = performance.now() - started;
      if (!gooseStageAt(time)) setOpened(false);
      else setElapsed(time);
    };
    const timer = window.setInterval(tick, 50);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      document.title = previousTitle;
    };
  }, [opened]);
  const stage = gooseStageAt(elapsed)!;
  const thinking = ["think", "freeze", "question", "dots", "bref"].includes(stage.id);
  const open = () => { setElapsed(0); setOpened(true); };
  return <>
    <footer className="project-footer"><button type="button" className="hidden-goose" aria-label="Une oie ?" title="Une oie ?" onClick={open}><Goose/></button></footer>
    <AppDialog open={opened} onClose={() => setOpened(false)} labelledBy="goose-title" className="goose-page" backdropClassName="goose-backdrop" closeLabel="Revenir au point marché">
      <h2 id="goose-title" className="sr-only">oie</h2>
      <div className={`goose-scene goose-stage-${stage.id} ${thinking ? "is-thinking" : "is-dancing"}`}>
        <div className="goose-aura" aria-hidden="true"/>
        <div className="goose-floor" aria-hidden="true"/>
        {!thinking && stage.id !== "away" && Array.from({ length: 6 }, (_, index) => <div key={index} className="goose-clone" style={{ "--goose-index": index } as CSSProperties}><Goose/></div>)}
        <div className="goose-star"><Goose thinking={thinking} portrait={thinking}/></div>
        <p className="goose-caption" role="status" aria-live="polite">{stage.text}</p>
      </div>
    </AppDialog>
  </>;
}
