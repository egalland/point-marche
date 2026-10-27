"use client";

import { useId, useState } from "react";
import { AppDialog } from "@/components/app-dialog";
import { addIsoDays, calendarWeeks, isoWeekForDate } from "@/lib/iso-week";
import { jiraWeekDateLabel, jiraWeekLabel } from "@/lib/analyst-jira-history";

type Week = { year: number; week: number };
type Props = { value: string; savedWeeks: Week[]; disabled?: boolean; onSelect: (week: Week) => void };
const months = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1))));

export function AnalystWeekPicker({ value, savedWeeks, disabled, onSelect }: Props) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const selected = isoWeekForDate(value);
  const [year, monthNumber] = month.split("-").map(Number);
  const firstYear = Math.min(new Date().getUTCFullYear() - 3, selected.year, ...savedWeeks.map((week) => week.year));
  const lastYear = Math.max(new Date().getUTCFullYear() + 3, selected.year, ...savedWeeks.map((week) => week.year));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const saved = new Set(savedWeeks.map((week) => `${week.year}-${week.week}`));
  const changeMonth = (amount: number) => {
    const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12));
    setMonth(next.toISOString().slice(0, 7));
  };
  const choose = (week: Week) => { onSelect(week); setOpen(false); };
  return <>
    <div className="analyst-week-control">
      <button type="button" disabled={disabled || selected.year <= 2020 && selected.week === 1} aria-label="Semaine précédente" onClick={() => onSelect(isoWeekForDate(addIsoDays(selected.from, -7)))}>←</button>
      <button type="button" className="analyst-week-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth(value.slice(0, 7)); setOpen(true); }}>

        <strong>{jiraWeekLabel(selected)}</strong>
        <small>{jiraWeekDateLabel(selected)}</small>
      </button>
      <button type="button" disabled={disabled || selected.year >= 2200 && selected.week >= 52} aria-label="Semaine suivante" onClick={() => onSelect(isoWeekForDate(addIsoDays(selected.from, 7)))}>→</button>
    </div>
    <AppDialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} className="analyst-week-dialog">
      <header><h2 id={titleId}>Choisir la semaine du point</h2><p>Une ligne du calendrier correspond à une semaine.</p></header>
      <label className="field analyst-direct-week"><span>Aller à la semaine</span><input type="week" min="2020-W01" max="2200-W52" value={`${selected.year}-W${String(selected.week).padStart(2, "0")}`} onChange={(event) => { const match = /^(\d{4})-W(\d{2})$/.exec(event.target.value); if (match) choose({ year: Number(match[1]), week: Number(match[2]) }); }}/></label>
      <div className="analyst-calendar-controls">
        <button type="button" aria-label="Mois précédent" disabled={year <= firstYear && monthNumber === 1} onClick={() => changeMonth(-1)}>←</button>
        <label><span>Mois</span><select data-autofocus value={monthNumber} onChange={(event) => setMonth(`${year}-${event.target.value.padStart(2, "0")}`)}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
        <label><span>Année</span><select value={year} onChange={(event) => setMonth(`${event.target.value}-${String(monthNumber).padStart(2, "0")}`)}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button type="button" aria-label="Mois suivant" disabled={year >= lastYear && monthNumber === 12} onClick={() => changeMonth(1)}>→</button>
      </div>
      <div className="analyst-calendar-head" aria-hidden="true"><span>Sem.</span>{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="analyst-calendar-weeks">
        {calendarWeeks(year, monthNumber - 1).map((week) => {
          const isSaved = saved.has(`${week.year}-${week.week}`);
          const isSelected = week.year === selected.year && week.week === selected.week;
          return <button type="button" key={week.from} className={isSelected ? "selected" : ""} disabled={week.year < 2020 || week.year > 2200} aria-pressed={isSelected}
            aria-label={`${jiraWeekLabel(week)}, ${jiraWeekDateLabel(week)}${isSaved ? ", point enregistré" : ", nouveau point"}`} onClick={() => choose(week)}>
            <strong>S{String(week.week).padStart(2, "0")}{isSaved && <i aria-hidden="true"/>}</strong>
            {Array.from({ length: 7 }, (_, day) => {
              const date = addIsoDays(week.from, day);
              return <span className={date.slice(0, 7) === month ? "" : "outside"} key={date}>{Number(date.slice(-2))}</span>;
            })}
          </button>;
        })}
      </div>
      <footer><span><i aria-hidden="true"/> Point enregistré</span><button type="button" className="secondary-button" onClick={() => choose(isoWeekForDate(addIsoDays(new Date().toISOString().slice(0, 10), -7)))}>Semaine dernière</button></footer>
    </AppDialog>
  </>;
}
