export function initSupport(trigger){
  const modal = document.getElementById('supportModal');
  const closeBtn = document.getElementById('closeSupport');
  const sendBtn = document.getElementById('sendSupport');
  const toast = document.getElementById('toast');
  const open = ()=>{ modal?.classList.add('open'); modal?.setAttribute('aria-hidden','false'); };
  const close = ()=>{ modal?.classList.remove('open'); modal?.setAttribute('aria-hidden','true'); };

  trigger?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  sendBtn?.addEventListener('click', ()=>{
    close();
    if(toast){
      toast.style.display='block';
      setTimeout(()=> toast.style.display='none', 1800);
    } else {
      alert('Se ha enviado tu reporte satisfactoriamente');
    }
  });
}
