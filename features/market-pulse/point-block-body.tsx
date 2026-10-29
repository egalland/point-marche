"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {AppDialog} from '@/components/app-dialog';
export function PointBlockBody({title,children,editing,onEdit,onFinish,collapsed=false}:{title:string;children:ReactNode;editing:boolean;onEdit?:()=>void;onFinish:()=>void;collapsed?:boolean}){
 const [expanded,setExpanded]=useState(false),[overflow,setOverflow]=useState(false);
 const viewport=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null),titleId=useId();
 useEffect(()=>{if(editing)setExpanded(true);},[editing]);
 useEffect(()=>{if(expanded||collapsed)return;const check=()=>{if(viewport.current&&inner.current)setOverflow(inner.current.scrollHeight>viewport.current.clientHeight+2);};check();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(check);if(viewport.current)observer.observe(viewport.current);if(inner.current)observer.observe(inner.current);return()=>observer.disconnect();},[expanded,children,collapsed]);
 const close=()=>{setExpanded(false);if(editing)onFinish();};
 return <div className={`point-block-body ${overflow?'has-overflow':''}`} hidden={collapsed}>
  <div ref={viewport} className="point-block-viewport"><div ref={inner} className="point-block-inner">{!expanded?children:<p className="point-block-open-note">Détail ouvert dans une fenêtre.</p>}</div></div>
  <button type="button" className="point-block-details-button" aria-haspopup="dialog" onClick={event=>{event.stopPropagation();setExpanded(true);}}>{overflow?'Voir la suite et les détails':'Voir les détails'} <span aria-hidden="true">↗</span></button>
  <AppDialog open={expanded} onClose={close} labelledBy={titleId} className="point-block-dialog"><header className="point-block-dialog-heading"><h2 id={titleId}>{title}</h2>{!editing&&onEdit&&<button type="button" className="secondary-button" onClick={onEdit}>Modifier</button>}</header><div className="point-block-detail-content" onClick={event=>event.stopPropagation()}>{expanded&&children}</div></AppDialog>
 </div>;
}
