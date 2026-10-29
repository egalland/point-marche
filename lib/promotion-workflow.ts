import {isIsoDate} from './iso-week';
import {escapeRichText as esc} from './point-rich-content';
export type PromotionStepState='todo'|'done'|'no'|'blocked'|'progress';
export const promotionStepStates={todo:{label:'À faire',icon:'○',color:'#73838b'},done:{label:'Validée',icon:'✓',color:'#23835c'},no:{label:'Non réalisée',icon:'✕',color:'#b34954'},blocked:{label:'Bloquée',icon:'⛔',color:'#b56018'},progress:{label:'En cours',icon:'◷',color:'#287bac'}};
export function promotionStepState(a:PromotionAction):PromotionStepState{return a.state&&Object.hasOwn(promotionStepStates,a.state)?a.state:a.done?'done':'todo';}
export type PromotionAction={id:string;label:string;done:boolean;state?:PromotionStepState;completedAt?:string};
export type PromotionWorkflow={purchaseStart?:string;purchaseEnd?:string;saleStart?:string;saleEnd?:string;actions?:PromotionAction[]};
export function normalizePromotionWorkflow(item:PromotionWorkflow):PromotionWorkflow{
 const dates=Object.fromEntries((['purchaseStart','purchaseEnd','saleStart','saleEnd'] as const).map(key=>[key,isIsoDate(item[key]??'')?item[key]:'']));
 const seen=new Set<string>();const actions=(Array.isArray(item.actions)?item.actions:[]).flatMap(a=>{if(!a||typeof a.id!=='string'||!a.id||seen.has(a.id))return [];seen.add(a.id);const state=promotionStepState(a),done=state==='done';return [{id:a.id,label:typeof a.label==='string'?a.label.slice(0,500):'',done,state,...(done&&typeof a.completedAt==='string'&&Number.isFinite(Date.parse(a.completedAt))?{completedAt:a.completedAt}:{})}];}).slice(0,100);
 return {...dates,actions};
}
export function togglePromotionAction(action:PromotionAction,done:boolean,at=new Date().toISOString()):PromotionAction{const {completedAt,...rest}=action;return {...rest,done,state:done?'done':'todo',...(done?{completedAt:action.completedAt??at}:{})};}
export function promotionPeriod(start?:string,end?:string){const date=(s?:string)=>s? s.split('-').reverse().join('/'):'…';return start||end?`${date(start)} → ${date(end)}`:'À définir';}
export function promotionWorkflowHtml(item:PromotionWorkflow,full=false){const actions=item.actions??[];return `<div class="promotion-periods"><p><b>Achat :</b> ${esc(promotionPeriod(item.purchaseStart,item.purchaseEnd))}</p><p><b>Vente :</b> ${esc(promotionPeriod(item.saleStart,item.saleEnd))}</p><p>${actions.filter(a=>a.done).length} / ${actions.length} étapes validées</p></div>${full&&actions.length?`<ul>${actions.map(a=>`<li style="color:${promotionStepStates[promotionStepState(a)].color}">${promotionStepStates[promotionStepState(a)].icon} ${esc(a.label)} · ${promotionStepStates[promotionStepState(a)].label}${a.done&&a.completedAt?` · validée le ${esc(a.completedAt.slice(0,10).split('-').reverse().join('/'))}`:''}</li>`).join('')}</ul>`:''}`;}

export function setPromotionStepState(action:PromotionAction,state:PromotionStepState,at=new Date().toISOString()):PromotionAction{const next=togglePromotionAction(action,state==='done',at);return {...next,state};}
export function promotionStatusColor(status:string){return /bloqu/i.test(status)?'#b56018':/annul|non r[eé]alis/i.test(status)?'#b34954':/termin|fait|valid/i.test(status)?'#23835c':/en cours/i.test(status)?'#287bac':'#73838b';}
export function promotionStatusHtml(status:string){const value=status||'À préparer';return `<span style="display:inline-block;padding:5px 9px;border:1px solid ${promotionStatusColor(value)};border-radius:6px;color:${promotionStatusColor(value)};font-weight:700">${esc(value)}</span>`;}
