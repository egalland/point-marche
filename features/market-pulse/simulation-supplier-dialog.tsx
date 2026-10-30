"use client";
import {useId,useMemo} from 'react';
import {AppDialog} from '../../components/app-dialog';
import {InteractiveChart} from '../../components/interactive-chart';
import {chartNumber} from '../../lib/interactive-chart';
import {latestSupplierVariations} from '../../lib/supplier-variations';
import {formatSupplierTurnover} from '../../lib/supplier-turnover';
import type {CommercialOperation} from './point-model';
import {SimulationDetails} from './simulation-details';
export function SimulationSupplierDialog({item,onClose}:{item:CommercialOperation;onClose:()=>void}){
 const titleId=useId(),points=useMemo(()=>latestSupplierVariations(item.plannerSource?.variationHistory??[]),[item.plannerSource?.variationHistory]);
 const metrics=item.plannerSource?.metrics,label=item.plannerSource?.supplierLabel||item.name;
 const categories=points.map(p=>({key:p.period,label:p.period,detail:p.taskName}));
 const series=[{id:'global',label:'Variation GLOBAL',color:'#2584d6',summary:points.at(-1)?.globalVariation??null,values:points.map(p=>p.globalVariation)},{id:'weighted',label:'Variation pondérée',color:'#23977a',summary:points.at(-1)?.weightedVariation??null,values:points.map(p=>p.weightedVariation)}];
 return <AppDialog open onClose={onClose} labelledBy={titleId} className="simulation-supplier-dialog"><header className="simulation-supplier-header"><span>Fournisseur · {metrics?.supplierCode||points[0]?.supplierCode||'Code non renseigné'}</span><h2 id={titleId}>{label}</h2><p>{item.month} · {item.state}</p></header><dl className="simulation-supplier-kpis"><div><dt>Variation GLOBAL</dt><dd>{chartNumber(metrics?.globalVariation,'%')}</dd></div><div><dt>Variation pondérée</dt><dd>{chartNumber(metrics?.weightedVariation,'%')}</dd></div><div><dt>Achats 12 mois</dt><dd>{formatSupplierTurnover(metrics?.purchases12m)}</dd></div></dl>
 {points.length?<InteractiveChart title="Historique des évolutions du fournisseur" categories={categories} series={series} unit="%" formats={['line','area','bar']} pieBy="series"/>:<p className="ic-empty">Aucun historique fournisseur enregistré dans cette simulation.</p>}
 <p className="ic-note">La légende indique la dernière observation de l’historique. Informations conservées avec ce point marché. L’ouverture de cette fiche ne remplace pas les données enregistrées par celles d’un nouvel import.</p>
 {item.summary&&<section><h3>Commentaire du point</h3><p>{item.summary}</p></section>}<details><summary>Dates et suivi de cette simulation</summary><SimulationDetails item={item} showHistory={false}/></details>
 </AppDialog>;
}
