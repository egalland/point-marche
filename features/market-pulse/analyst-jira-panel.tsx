"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SafeDateInput } from "@/components/safe-date-input";
import type { AnalystJiraTicket } from "@/lib/analyst-point";
import { jiraWeekDateLabel, jiraWeekLabel, type AnalystJiraHistory, type JiraChartSettings, type JiraCompletionWeek } from "@/lib/analyst-jira-history";
import { isoWeekForDate } from "@/lib/iso-week";
import { jiraMetricCards } from "@/lib/analyst-jira-metrics";

type Props = {
  analystName: string;
  pointDate: string;
  tickets: AnalystJiraTicket[];
  unavailable: boolean;
  history: { history: AnalystJiraHistory | null; loading: boolean; error: string };
  previousWeek?: { count: number | null; loading: boolean; error: string };
  settings: JiraChartSettings;
  onSettingsChange: (settings: JiraChartSettings) => void;
  onSelectWeek: (week: { year: number; week: number }) => void;
  onRetry: () => void;
};
const countLabel = (count: number) => `${count.toLocaleString("fr-FR")} ticket${count > 1 ? "s" : ""} terminé${count > 1 ? "s" : ""}`;
const shortDate = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));

export function CompletedWeekChart({ weeks, selectedDate, onSelectWeek }: { weeks: JiraCompletionWeek[]; selectedDate: string; onSelectWeek: Props["onSelectWeek"] }) {
  const hintId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState("");
  const selected = isoWeekForDate(selectedDate);
  const active = weeks.find((week) => week.from === hovered) ?? weeks.find((week) => week.from === selected.from) ?? weeks.at(-1);
  const max = Math.max(4, Math.ceil(Math.max(0, ...weeks.map((week) => week.count)) / 4) * 4);
  const stride = Math.max(1, Math.ceil(weeks.length / 13));
  useEffect(() => {
    const scroll = scrollRef.current;
    const button = selectedRef.current;
    if (scroll && button) scroll.scrollLeft = Math.max(0, button.offsetLeft - scroll.clientWidth / 2 + button.offsetWidth / 2);
  }, [selectedDate, weeks]);
  return <div className="analyst-completed-chart">
    <div className="analyst-chart-plot">
      <div className="analyst-chart-scale" aria-hidden="true"><span>{max}</span><span>{max / 2}</span><span>0</span></div>
      <div ref={scrollRef} className="analyst-chart-scroll" tabIndex={0} aria-label="Graphique des tickets terminés par semaine, défilement horizontal">
        <div className="analyst-chart-bars" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(var(--analyst-bar-min, 1.3rem), 1fr))` }}>
          {weeks.map((week, index) => {
            const isSelected = week.from === selected.from;
            const visibleLabel = index % stride === 0 || isSelected || index === weeks.length - 1;
            return <button ref={isSelected ? selectedRef : undefined} type="button" key={week.from} className={isSelected ? "selected" : ""} aria-pressed={isSelected} aria-describedby={hintId}
              aria-label={`${jiraWeekLabel(week)}, ${jiraWeekDateLabel(week)}, ${countLabel(week.count)}. Ouvrir ce point.`}
              onKeyDown={(event) => {
                const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
                const target = event.key === "Home" ? 0 : event.key === "End" ? weeks.length - 1 : Math.max(0, Math.min(weeks.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
                buttons?.[target]?.focus();
              }}
              onMouseEnter={() => setHovered(week.from)} onFocus={() => setHovered(week.from)} onClick={() => { setHovered(week.from); onSelectWeek(week); }}>
              <span className="analyst-chart-bar-track" aria-hidden="true"><i style={{ height: `${week.count / max * 100}%` }}/></span>
              <span className={`analyst-chart-week-label${visibleLabel ? "" : " discreet"}`} aria-hidden="true">S{String(week.week).padStart(2, "0")}<small>{week.year}</small></span>
            </button>;
          })}
        </div>
      </div>
    </div>
    <div className="analyst-chart-inspector" id={hintId} aria-live="polite"><div>{active && <><strong>{jiraWeekLabel(active)} · {countLabel(active.count)}</strong><span>{jiraWeekDateLabel(active)}</span></>}</div><small>Cliquer sur une semaine ouvre son point.</small></div>
  </div>;
}

export function CompletedTicketDisclosure({ tickets }: { tickets: AnalystJiraTicket[] }) {
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(100);
  return <details className="analyst-completed-disclosure" onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span>{tickets.length === 1 ? "Voir le ticket terminé" : `Voir les ${countLabel(tickets.length)}`}</span><span className="analyst-disclosure-chevron" aria-hidden="true">⌄</span></summary>
    {expanded && <div className="analyst-jira-list analyst-jira-resolved-list">
      {tickets.length ? tickets.slice(0, limit).map((ticket) => <a key={ticket.key} className="resolved" href={ticket.link} target="_blank" rel="noreferrer"><span>{ticket.key}</span><div><strong>{ticket.summary}</strong><small>{ticket.status}</small></div><b>Modifié le {shortDate(ticket.updatedAt)}</b></a>) : <p>Aucun ticket terminé pendant cette semaine dans l’import Jira.</p>}
      {tickets.length > limit && <button type="button" className="secondary-button" onClick={() => setLimit((current) => current + 100)}>Afficher les suivants · {limit} sur {tickets.length}</button>}
    </div>}
  </details>;
}

export function AnalystJiraMetrics({ history, pointDate, currentCount, previousCount }: { history: AnalystJiraHistory | null; pointDate: string; currentCount: number | null; previousCount?: number | null }) {
  return <dl className="analyst-jira-metrics" aria-label="Indicateurs des tickets terminés">
    {jiraMetricCards(history, pointDate, currentCount, previousCount).map((card) => <div key={card.id} data-metric={card.id} className={`change-${card.tone}`}>
      <dt>{card.label}</dt><dd><strong>{card.value}</strong><small>{card.detail}</small></dd>
    </div>)}
  </dl>;
}

export function AnalystJiraPanel({ analystName, pointDate, tickets, unavailable, history, previousWeek, settings, onSettingsChange, onSelectWeek, onRetry }: Props) {
  const week = isoWeekForDate(pointDate);
  return <section className="analyst-point-module analyst-jira-module analyst-completed-module">
    <header><div><span>Jira · {jiraWeekLabel(week)}</span><h2>Tickets terminés</h2><p>{analystName} · {jiraWeekDateLabel(week)}</p></div><div className="analyst-completed-total" aria-busy={unavailable}><strong>{unavailable ? "—" : tickets.length.toLocaleString("fr-FR")}</strong><span>cette semaine</span></div></header>
    <section className="analyst-completed-trend" aria-busy={history.loading}>
      <header><h3>Évolution par semaine</h3><label><span>Période du graphique</span><select value={settings.horizon} onChange={(event) => {
        const horizon = event.target.value as JiraChartSettings["horizon"];
        onSettingsChange({ ...settings, ...(horizon === "custom" && history.history ? { from: history.history.from, to: history.history.to } : {}), horizon });
      }}><option value="1">1 mois</option><option value="3">3 mois</option><option value="6">6 mois</option><option value="12">1 an</option><option value="custom">Période donnée</option></select></label></header>
      {settings.horizon === "custom" && <div className="analyst-completed-range"><label><span>Du</span><SafeDateInput value={settings.from} max={settings.to} onCommit={(from) => onSettingsChange({ ...settings, from })}/></label><label><span>Au</span><SafeDateInput value={settings.to} min={settings.from} onCommit={(to) => onSettingsChange({ ...settings, to })}/></label></div>}
      {history.loading ? <div className="analyst-chart-state" role="status">Chargement de l’historique Jira…</div> : history.error ? <div className="analyst-chart-state" role="alert"><span>{history.error}</span><button type="button" className="secondary-button" onClick={onRetry}>Réessayer</button></div> : history.history ? <>
        <AnalystJiraMetrics history={history.history} pointDate={pointDate} currentCount={unavailable ? null : tickets.length} previousCount={previousWeek?.count}/>
        {previousWeek?.loading && <p className="analyst-comparison-state" role="status">Chargement de la semaine précédente…</p>}
        {previousWeek?.error && <p className="analyst-comparison-state" role="alert">Comparaison indisponible. <button type="button" onClick={onRetry}>Réessayer</button></p>}
        <CompletedWeekChart weeks={history.history.weeks} selectedDate={pointDate} onSelectWeek={onSelectWeek}/>
        <p className="analyst-chart-source">Semaines ISO : {jiraWeekDateLabel(history.history)} · Import du {shortDate(history.history.updatedAt)}</p>
      </> : <div className="analyst-chart-state">L’historique sera disponible après un import Jira global.</div>}
    </section>
    <p className="analyst-completed-rule">Tickets rattachés à la semaine de leur dernière modification Jira.</p>
    {unavailable ? <p role="status">La liste attend le chargement des tickets de cette semaine.</p> : <CompletedTicketDisclosure key={`${pointDate}:${analystName}`} tickets={tickets}/>}
  </section>;
}
