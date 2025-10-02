export function initTheme(trigger){
  const updateLabel = ()=>{
    if(!trigger) return;
    trigger.textContent = document.body.classList.contains('dark') ? 'Modo claro' : 'Modo oscuro';
  };
  trigger?.addEventListener('click', ()=>{
    document.body.classList.toggle('dark');
    updateLabel();
  });
  updateLabel();
}
