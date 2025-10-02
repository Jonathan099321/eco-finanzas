// Mostrar como dinero
export const money = (x) => (x || x === 0) ? `$${Number(x).toLocaleString()}` : '—';

// Quitar $ y separadores -> número
export function parseMoney(str){
  if (str == null) return 0;
  const clean = String(str).replace(/[^\d.-]/g, '');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// Aplicar formato al perder foco, y limpiar al enfocar
export function attachMoneyMask(input){
  if(!input) return;
  input.addEventListener('focus', ()=> {
    // al enfocar, vuelve a número crudo
    input.value = String(parseMoney(input.value) || '');
  });
  input.addEventListener('blur', ()=> {
    // al salir, muestra con formato si hay valor
    const val = parseMoney(input.value);
    input.value = val ? val : '';
    if(input.value !== '') input.value = Number(input.value); // normaliza
    if(input.value !== '') input.value = Number(input.value); // idempotente
    if(input.value !== '') input.value = money(input.value).replace('$','').replace(/,/g,''); // mantenemos número plano? -> No: preferimos ver el número plano
    // Nota: si prefieres VER $1,200 en el input, descomenta la línea siguiente y quita la de arriba:
    // input.value = val ? money(val) : '';
  });
}
