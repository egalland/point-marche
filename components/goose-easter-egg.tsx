"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AppDialog } from "@/components/app-dialog";
import { gooseStageAt } from "@/lib/goose-sequence";

function Goose({ thinking = false, portrait = false }: { thinking?: boolean; portrait?: boolean }) {
  return <span className={`goose-drawing redline-goose ${portrait ? "is-portrait" : ""}`} aria-hidden="true">
    <span className="redline-goose-sprite"/>
    {thinking && <svg className="redline-thinker-hand" viewBox="0 0 100 150" fill="none">
      <path d="M13 148 29 77l10-19-3-20c-1-7 9-9 12-3l7 14-1-24c0-8 11-8 12 0l2 22 7-17c3-7 13-3 10 5l-5 24 7-9c5-6 14 0 9 7L75 89l-9 59Z" fill="#dfc3a1" stroke="#564b42" strokeWidth="4" strokeLinejoin="round"/>
      <path d="m40 65 29 16M55 49l11 15m2-17 9 17" stroke="#a38b70" strokeWidth="3" strokeLinecap="round"/>
    </svg>}
  </span>;
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
