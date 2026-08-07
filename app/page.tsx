"use client";

import { useEffect, useState, type CSSProperties } from "react";

type IconName = "folder" | "trend" | "ticket" | "alert" | "calendar";

const priorities = [
  {
    index: "01",
    name: "EDAC",
    meta: "Revêtements · B9822",
    action: "En attente du retour de l’équipe marché.",
    status: "En attente",
    tone: "warning",
  },
  {
    index: "02",
    name: "JELDWEN ALLEMAGNE",
    meta: "Menuiserie · D2381",
    action: "Vérifier la trame transmise avant poursuite.",
    status: "Action requise",
    tone: "active",
  },
  {
    index: "03",
    name: "CIB",
    meta: "Dossier marché",
    action: "En attente du retour de l’équipe vente.",
    status: "En attente",
    tone: "warning",
  },
];

const simulations = [
  {
    key: "A",
    month: "Septembre 2026",
    name: "Incontournables de la rentrée",
    state: "Vente à finaliser",
    stateClass: "state-progress",
    summary: "2 étapes finalisées · 1 non applicable · 1 en attente",
    skin: "mint",
    steps: [
      ["Complétude de la trame", "Fait", "done"],
      ["Intégration tarif achat", "Non applicable", "neutral"],
      ["Contrôle tarif achat", "Fait", "done"],
      ["Tarif vente", "En attente", "waiting"],
    ],
  },
  {
    key: "B",
    month: "Octobre 2026",
    name: "Champagne Flooring",
    state: "Délai de traitement dépassé",
    stateClass: "state-alert",
    summary: "Trame reçue · 3 étapes achat toujours en attente",
    skin: "lilac",
    steps: [
      ["Réception de la trame", "Reçue", "done"],
      ["Complétude de la trame", "En attente", "waiting"],
      ["Intégration tarif achat", "En attente", "waiting"],
      ["Contrôle tarif achat", "En attente", "waiting"],
    ],
  },
];

const tariffs = [
  {
    month: "Août",
    color: "violet",
    suppliers: [
      ["D2381", "JELDWEN ALLEMAGNE", ""],
      ["B9822", "EDAC", "Décalage septembre"],
      ["B9642", "THEUMA", ""],
      ["B6515", "BLOCFER", ""],
      ["C8074", "FELDOR", ""],
      ["A5633", "COULIDOOR", ""],
    ],
  },
  {
    month: "Septembre",
    color: "mint",
    suppliers: [
      ["A3453", "SOGAL", ""],
      ["A8226", "GIMM GAM", ""],
      ["D6280", "LEBO DOORS", ""],
      ["A1170", "BEL’M", ""],
    ],
  },
];

const jira = [
  ["Louise Pepin", "3 en attente d’un tiers", "3", "mint"],
  ["Baptiste Plaisir", "1 à faire · 2 en cours", "3", "violet"],
  ["Sarah Daniel", "2 en attente de changement", "2", "aqua"],
];

const alerts = [
  ["JELDWEN", "Trame à contrôler"],
  ["EDAC", "Évolution décalée en septembre"],
  ["PROMO RENTRÉE", "Tarif vente en attente"],
  ["CHAMPAGNE FLOORING", "Délai de traitement dépassé"],
];

function Icon({ name }: { name: IconName }) {
  if (name === "folder") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7.5h6l2 2h10v9.2a2.3 2.3 0 0 1-2.3 2.3H5.3A2.3 2.3 0 0 1 3 18.7Z" />
        <path d="M3 7.5V6.2A2.2 2.2 0 0 1 5.2 4h4.2l2 2H19a2 2 0 0 1 2 2v1.5" />
      </svg>
    );
  }
  if (name === "trend") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        <path d="m3 8 6-4 6 7 6-5" />
      </svg>
    );
  }
  if (name === "ticket") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 13a2 2 0 0 0 0-4V5H4v4a2 2 0 0 1 0 4v4h16Z" />
        <path d="M9 8.5h6M9 12h6M9 15.5h3" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 2.7 20h18.6Z" />
      <path d="M12 9v5M12 17.5v.1" />
    </svg>
  );
}

function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 850;
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown}</>;
}

export default function Home() {
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.setAttribute("data-visible", "true");
        });
      },
      { threshold: 0.08 },
    );

    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    window.addEventListener("pointermove", pointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", pointer);
      observer.disconnect();
    };
  }, []);

  const metrics = [
    [5, "Dossiers suivis", "folder", "mint"],
    [10, "Évolutions", "trend", "violet"],
    [8, "Tickets Jira", "ticket", "aqua"],
    [4, "Vigilances", "alert", "peach"],
  ] as const;

  return (
    <div className="dashboard-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="pointer-glow" />

      <main className="page">
        <header className="hero reveal" style={{ "--delay": "0ms" } as CSSProperties}>
          <div>
            <div className="market-badge"><span /> MARKET PULSE <b>/</b> REV-MEN</div>
            <h1>Point marché</h1>
            <div className="hero-meta">
              <strong>Revêtements &amp; Menuiserie</strong>
              <span>Dossiers · simulations · évolutions · Jira</span>
            </div>
          </div>
          <div className="week-block">
            <div className="week-number">S31</div>
            <div className="week-divider" />
            <div>
              <strong>27 JUIL</strong>
              <b>2026</b>
              <span>Point hebdomadaire</span>
            </div>
          </div>
        </header>

        <section className="kpi-grid" aria-label="Indicateurs du point marché">
          {metrics.map(([value, label, icon, tone], index) => (
            <article
              className={`metric-card glass-card reveal tone-${tone}`}
              data-tilt
              key={label}
              style={{ "--delay": `${90 + index * 65}ms` } as CSSProperties}
            >
              <div className="metric-icon"><Icon name={icon} /></div>
              <div>
                <div className="metric-index">0{index + 1}</div>
                <div className="metric-number"><Counter value={value} /></div>
                <div className="metric-label">{label}</div>
              </div>
              <div className="metric-orbit" aria-hidden="true"><span /></div>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <article className="focus-panel reveal" style={{ "--delay": "180ms" } as CSSProperties}>
            <div className="focus-shimmer" />
            <div className="panel-heading light-heading">
              <div className="heading-index">01</div>
              <div>
                <p>Dossiers</p>
                <h2>En cours</h2>
              </div>
              <span className="focus-chip">Focus de la semaine</span>
            </div>

            <div className="section-kicker">Priorités à traiter</div>
            <div className="priority-list">
              {priorities.map((item) => (
                <div className="priority-row" key={item.index}>
                  <div className={`timeline-node ${item.tone}`}><span /></div>
                  <div className="priority-index">{item.index}</div>
                  <div className="priority-name">
                    <strong>{item.name}</strong>
                    <span>{item.meta}</span>
                  </div>
                  <div className="priority-action">{item.action}</div>
                  <span className={`status-pill ${item.tone}`}>{item.status}</span>
                </div>
              ))}
            </div>

            <div className="section-kicker simulations-kicker">Simulations &amp; opérations</div>
            <div className="simulation-grid">
              {simulations.map((simulation) => (
                <section className={`simulation-card ${simulation.skin}`} key={simulation.key}>
                  <div className="simulation-top">
                    <span className="simulation-key">{simulation.key}</span>
                    <span className={`simulation-state ${simulation.stateClass}`}><i />{simulation.state}</span>
                  </div>
                  <div className="simulation-month">{simulation.month}</div>
                  <h3>{simulation.name}</h3>
                  <p className="simulation-summary">{simulation.summary}</p>
                  <div className="step-list">
                    {simulation.steps.map(([name, value, state]) => (
                      <div className="step-row" key={name}>
                        <span>{name}</span>
                        <strong className={state}><i />{value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <aside className="side-column">
            <article className="side-card glass-card tariff-card reveal" style={{ "--delay": "240ms" } as CSSProperties}>
              <div className="dark-heading">
                <div><span>02</span><h2>Évolutions tarifaires</h2></div>
                <b>10 total</b>
              </div>
              {tariffs.map((group) => (
                <section className="tariff-month" key={group.month}>
                  <h3 className={group.color}>{group.month}<span>{group.suppliers.length} fournisseurs</span></h3>
                  <div className="supplier-list">
                    {group.suppliers.map(([code, name, note]) => (
                      <div className="supplier-row" key={code}>
                        <code>{code}</code>
                        <strong>{name}</strong>
                        {note && <small>{note}</small>}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </article>

            <article className="side-card glass-card jira-card reveal" style={{ "--delay": "300ms" } as CSSProperties}>
              <div className="dark-heading compact-heading">
                <div><span>03</span><h2>Jira</h2></div>
                <div className="ticket-total"><b>8</b><small>tickets ouverts</small></div>
              </div>
              <div className="jira-content">
                <div className="jira-ring"><div><strong>8</strong><span>tickets</span></div></div>
                <div className="jira-people">
                  {jira.map(([name, detail, total, color]) => (
                    <div className="jira-person" key={name}>
                      <i className={color} />
                      <div><strong>{name}</strong><span>{detail}</span></div>
                      <b className={color}>{total}</b>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="watch-card reveal" style={{ "--delay": "360ms" } as CSSProperties}>
              <div className="watch-heading"><span>04</span><h2>Vigilances</h2><b>4</b></div>
              <div className="watch-list">
                {alerts.map(([name, detail], index) => (
                  <div className="watch-row" key={name}>
                    <span>0{index + 1}</span>
                    <div><strong>{name}</strong><small>{detail}</small></div>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <footer>
          <span>Market Pulse · Revêtements &amp; Menuiserie</span>
          <span>Point du 27.07.2026 · Concept web 2026</span>
        </footer>
      </main>
    </div>
  );
}
