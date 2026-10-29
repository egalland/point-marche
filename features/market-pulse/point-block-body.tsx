"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {AppDialog} from '@/components/app-dialog';
export function PointBlockBody({title,children,detailContent,detailsLabel,editing,onGrow,collapsed=false}:{title:string;children:ReactNode;detailContent?:ReactNode;detailsLabel?:string;editing:boolean;onGrow?:(height:number)=>void;collapsed?:boolean}){
 const [expanded,setExpanded]=useState(false),[overflow,setOverflow]=useState(false);
 const viewport=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null),titleId=useId();
 useEffect(()=>{if(expanded||collapsed)return;const check=()=>{if(!viewport.current||!inner.current)return;const contentHeight=inner.current.scrollHeight;setOverflow(contentHeight>viewport.current.clientHeight+2);if(editing&&!(typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches))onGrow?.(Math.ceil(contentHeight+100));};check();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(check);if(viewport.current)observer.observe(viewport.current);if(inner.current)observer.observe(inner.current);return()=>observer.disconnect();},[expanded,children,collapsed,editing,onGrow]);
 return <div className={`point-block-body ${editing?'is-editing':''} ${overflow?'has-overflow':''}`} hidden={collapsed}>
  <div ref={viewport} className="point-block-viewport"><div ref={inner} className="point-block-inner">{!expanded||detailContent?children:<p className="point-block-open-note">Détail ouvert dans une fenêtre.</p>}</div></div>
  {!editing&&<button type="button" className="point-block-details-button" aria-haspopup="dialog" onClick={event=>{event.stopPropagation();setExpanded(true);}}>{detailsLabel??(overflow?'Voir la suite et les détails':'Voir les détails')} <span aria-hidden="true">↗</span></button>}
  <AppDialog open={expanded} onClose={()=>setExpanded(false)} labelledBy={titleId} className="point-block-dialog"><header className="point-block-dialog-heading"><h2 id={titleId}>{title}</h2></header><div className="point-block-detail-content" onClick={event=>event.stopPropagation()}>{expanded&&(detailContent??children)}</div></AppDialog>
 </div>;
}
