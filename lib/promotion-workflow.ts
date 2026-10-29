import {isIsoDate} from './iso-week';
import {escapeRichText as esc} from './point-rich-content';
export type PromotionAction={id:string;label:string;done:boolean;completedAt?:string};
export type PromotionWorkflow={purchaseStart?:string;purchaseEnd?:string;saleStart?:string;saleEnd?:string;actions?:PromotionAction[]};
export function normalizePromotionWorkflow(item:PromotionWorkflow):PromotionWorkflow{
 const dates=Object.fromEntries((['purchaseStart','purchaseEnd','saleStart','saleEnd'] as const).map(key=>[key,isIsoDate(item[key]??'')?item[key]:'']));
 const seen=new Set<string>();const actions=(Array.isArray(item.actions)?item.actions:[]).flatMap(a=>{if(!a||typeof a.id!=='string'||!a.id||seen.has(a.id))return [];seen.add(a.id);const done=a.done===true;return [{id:a.id,label:typeof a.label==='string'?a.label.slice(0,500):'',done,...(done&&typeof a.completedAt==='string'&&Number.isFinite(Date.parse(a.completedAt))?{completedAt:a.completedAt}:{})}];}).slice(0,100);
 return {...dates,actions};
}
export function togglePromotionAction(action:PromotionAction,done:boolean,at=new Date().toISOString()):PromotionAction{const {completedAt,...rest}=action;return {...rest,done,...(done?{completedAt:at}:{})};}
export function promotionPeriod(start?:string,end?:string){const date=(s?:string)=>s? s.split('-').reverse().join('/'):'…';return start||end?`${date(start)} → ${date(end)}`:'À définir';}
export function promotionWorkflowHtml(item:PromotionWorkflow,full=false){const actions=item.actions??[];return `<div class="promotion-periods"><p><b>Achat :</b> ${esc(promotionPeriod(item.purchaseStart,item.purchaseEnd))}</p><p><b>Vente :</b> ${esc(promotionPeriod(item.saleStart,item.saleEnd))}</p><p>${actions.filter(a=>a.done).length} / ${actions.length} étapes validées</p></div>${full&&actions.length?`<ul>${actions.map(a=>`<li>${a.done?'✓':'○'} ${esc(a.label)}${a.done&&a.completedAt?` · validée le ${esc(a.completedAt.slice(0,10).split('-').reverse().join('/'))}`:''}</li>`).join('')}</ul>`:''}`;}
