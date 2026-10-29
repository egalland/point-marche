"use client";
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {AppIcon} from './app-icon';
export type PointTool={label:string;icon:string;run:()=>void;disabled?:boolean;active?:boolean};
export function PointToolWheel({x,y,title,tools,onClose}:{x:number;y:number;title:string;tools:PointTool[];onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('button[role=menuitem]:not(:disabled)')?.focus({preventScroll:true});
 const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close.current();};
 const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();previous?.focus({preventScroll:true});}};
 const dismiss=()=>close.current();document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',dismiss);window.addEventListener('wheel',dismiss,{passive:true});window.addEventListener('touchmove',dismiss,{passive:true});
 return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',dismiss);window.removeEventListener('wheel',dismiss);window.removeEventListener('touchmove',dismiss);};},[]);
 if(typeof document==='undefined')return null;
 const viewportWidth=document.documentElement.clientWidth||window.innerWidth,viewportHeight=document.documentElement.clientHeight||window.innerHeight;
 const width=Math.min(280,viewportWidth-16),height=Math.min(52+tools.length*38,viewportHeight-16),left=Math.max(8,Math.min(x,viewportWidth-width-8)),top=Math.max(8,Math.min(y,viewportHeight-height-8));
 return createPortal(<div ref={ref} role="menu" aria-label={`Outils : ${title}`} className="point-tool-wheel point-context-menu" style={{left,top,width,maxHeight:height}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(e.key==='Tab'){onClose();return;}if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...ref.current!.querySelectorAll<HTMLButtonElement>('button[role=menuitem]:not(:disabled)')],current=buttons.indexOf(document.activeElement as HTMLButtonElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(current+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus();}}>
 <div className="point-context-menu-heading"><strong>{title}</strong><button type="button" aria-label="Fermer les outils" onClick={onClose}>×</button></div>
 {tools.map(tool=><button role="menuitem" type="button" key={tool.label} disabled={tool.disabled} data-active={tool.active||undefined} onClick={()=>{onClose();tool.run();}}><AppIcon name={tool.icon} size={17}/><span>{tool.label}</span></button>)}
 </div>,document.querySelector('.app-shell')??document.body);
}
