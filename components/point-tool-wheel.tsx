"use client";
import {useEffect,useRef,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {AppIcon} from './app-icon';
export type PointTool={label:string;icon:string;run:()=>void;disabled?:boolean;active?:boolean};
export function PointToolWheel({x,y,title,tools,onClose}:{x:number;y:number;title:string;tools:PointTool[];onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
 const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close.current();};
 const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();previous?.focus({preventScroll:true});}};
 const dismiss=()=>close.current();document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',dismiss);window.addEventListener('wheel',dismiss,{passive:true});window.addEventListener('touchmove',dismiss,{passive:true});
 return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',dismiss);window.removeEventListener('wheel',dismiss);window.removeEventListener('touchmove',dismiss);};},[]);
 if(typeof document==='undefined')return null;
 const viewportWidth=document.documentElement.clientWidth||window.innerWidth,viewportHeight=document.documentElement.clientHeight||window.innerHeight;
 const size=Math.min(344,viewportWidth-16,viewportHeight-16),half=size/2,left=Math.max(8,Math.min(x-half,viewportWidth-size-8)),top=Math.max(8,Math.min(y-half,viewportHeight-size-8)),radius=size*.355;
 return createPortal(<div ref={ref} role="menu" aria-label={`Outils : ${title}`} className="point-tool-wheel" style={{left,top,width:size,height:size}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(e.key==='Tab'){onClose();return;}if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],current=buttons.indexOf(document.activeElement as HTMLButtonElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(current+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus();}}>
 {tools.map((tool,index)=>{const angle=(-90+index*360/tools.length)*Math.PI/180;return <button role="menuitem" type="button" key={tool.label} disabled={tool.disabled} data-active={tool.active||undefined} style={{'--tool-x':`${Math.cos(angle)*radius}px`,'--tool-y':`${Math.sin(angle)*radius}px`} as CSSProperties} onClick={()=>{onClose();tool.run();}}><AppIcon name={tool.icon} size={21}/><span>{tool.label}</span></button>;})}
 <button role="menuitem" type="button" className="point-wheel-center" aria-label="Fermer les outils" onClick={onClose}><span>{title}</span><small>Fermer ×</small></button>
 </div>,document.querySelector('.app-shell')??document.body);
}
