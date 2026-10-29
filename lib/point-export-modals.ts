/** Native dialogs enhance the complete document; without JavaScript everything stays readable. */
export const pointDetailExportCss = `
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
@media print{.export-enhanced .export-module>.export-body{max-height:none!important;overflow:visible!important}.export-detail-open,.export-detail-dialog{display:none!important}}
`;
export const pointDetailExportScript = String.raw`(function(){
 if(typeof HTMLDialogElement==='undefined'||!HTMLDialogElement.prototype.showModal)return;
 var dialog=document.createElement('dialog');dialog.className='export-detail-dialog';dialog.setAttribute('aria-labelledby','export-detail-title');
 var header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.id='export-detail-title';close.type='button';close.textContent='Fermer';header.append(title,close);dialog.append(header);document.body.append(dialog);
 var source=null,content=null,opener=null;
 function restore(){if(source&&content){source.insertBefore(content,source.querySelector('.export-detail-open'));source.style.minHeight='';}if(opener)opener.focus();source=null;content=null;}
 close.addEventListener('click',function(){dialog.close();});dialog.addEventListener('close',restore);
 dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 document.querySelectorAll('.export-module').forEach(function(module){var body=module.querySelector(':scope > .export-body');if(!body)return;var trigger=document.createElement('button');trigger.type='button';trigger.className='export-detail-open';trigger.setAttribute('aria-haspopup','dialog');trigger.textContent='Voir les détails ↗';trigger.addEventListener('click',function(){source=module;module.style.minHeight=module.offsetHeight+'px';content=body;opener=trigger;title.textContent=module.querySelector(':scope > summary').textContent;dialog.append(body);dialog.showModal();close.focus();});module.append(trigger);});
 document.documentElement.classList.add('export-enhanced');
 window.addEventListener('beforeprint',function(){if(dialog.open){dialog.close();restore();}});
})();`;
