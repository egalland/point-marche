/** Native dialogs enhance the complete document; without JavaScript everything stays readable. */
export const pointDetailExportCss = `
.export-enhanced .export-jira-details{display:none}
.jira-summary-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
.jira-summary-counts article{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:8px}
.jira-summary-counts article span{font-size:12px;color:var(--muted)}
.jira-summary-counts article strong{font-size:28px}

.export-enhanced .export-module>.export-body{max-height:var(--preview-height,440px);overflow:hidden}
.export-body :where(div,section,article,ul,ol,details){max-height:none!important;overflow:visible!important}
.export-detail-open{display:flex;justify-content:space-between;width:100%;margin-top:6px;padding:10px;border:0;border-top:1px solid var(--line);background:transparent;color:var(--text);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.export-detail-dialog{width:min(1080px,calc(100% - 24px));max-height:calc(100dvh - 40px);padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--text);overflow:auto}
.export-detail-dialog::backdrop{background:#08131ac9}
.export-detail-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px}
.export-detail-dialog h2{margin:0;font-size:20px}
.export-detail-dialog>header button{padding:8px 12px;color:inherit;border:1px solid var(--line);border-radius:8px;background:transparent;cursor:pointer}
.export-detail-dialog table{width:100%;table-layout:fixed;overflow-wrap:anywhere}
.export-enhanced .export-module>.export-body:empty{min-height:100px}
@media print{.export-enhanced .export-jira-details{display:block!important}.export-enhanced .export-module>.export-body{max-height:none!important;overflow:visible!important}.export-detail-open,.export-detail-dialog{display:none!important}}
`;
export const pointDetailExportScript = String.raw`(function(){
 if(typeof HTMLDialogElement==='undefined'||!HTMLDialogElement.prototype.showModal)return;
 var dialog=document.createElement('dialog');dialog.className='export-detail-dialog';dialog.setAttribute('aria-labelledby','export-detail-title');
 var header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.id='export-detail-title';close.type='button';close.textContent='Fermer';header.append(title,close);dialog.append(header);document.body.append(dialog);
 var source=null,content=null,opener=null,marker=null;
 function restore(){if(marker&&content){marker.replaceWith(content);if(source)source.style.minHeight='';}if(opener)opener.focus();source=null;content=null;marker=null;}
 close.addEventListener('click',function(){dialog.close();});dialog.addEventListener('close',restore);
 dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 document.querySelectorAll('.export-module').forEach(function(module){var body=module.querySelector(':scope > .export-body');if(!body)return;var full=body.querySelector('.export-jira-full')||body;var trigger=document.createElement('button');trigger.type='button';trigger.className='export-detail-open';trigger.setAttribute('aria-haspopup','dialog');trigger.textContent=module.dataset.module==='jira'?'Détails des tickets ↗':'Voir les détails ↗';trigger.addEventListener('click',function(){source=module;module.style.minHeight=module.offsetHeight+'px';content=full;marker=document.createComment('detail-position');full.before(marker);opener=trigger;title.textContent=module.querySelector(':scope > summary').textContent;dialog.append(full);dialog.showModal();close.focus();});module.append(trigger);});
 document.documentElement.classList.add('export-enhanced');
 window.addEventListener('beforeprint',function(){if(dialog.open){dialog.close();restore();}});
})();`;
