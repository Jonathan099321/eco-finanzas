import { CATS } from './constants.js';

const num = (v) => Number(v || 0);

export function armarCategorias(d = {}){
  return {
    [CATS.vivienda]:     num(d.renta),
    [CATS.servicios]:    num(d.serviciosBasicos),
    [CATS.transporte]:   num(d.transportePublico) + num(d.gasolina),
    [CATS.alimentacion]: num(d.alimentacion),
    [CATS.suscripciones]:num(d.suscripciones),
    [CATS.salud]:        num(d.salud),
    [CATS.deudas]:       num(d.deudas),
    [CATS.apoyo]:        d.activeFlows?.apoyo ? num(d.montoApoyo) : 0,
    [CATS.dependientes]: d.activeFlows?.dep ? ((num(d.educacionDep)+num(d.saludDep)) || num(d.gastoMensualDependientes)) : 0,
    [CATS.pareja]:       (d.activeFlows?.pareja && d.parejaAporta==='no') ? num(d.montoParaPareja) : 0
  };
}

export function totales(d = {}, cats = {}){
  const ingresos = num(d.ingresoMensual) + num(d.otrosIngresos) +
                   ((d.activeFlows?.pareja && d.parejaAporta==='si') ? num(d.montoParejaAporta) : 0);
  const gastos = Object.values(cats).reduce((a,b)=>a+Number(b||0),0);
  return { ingresos, gastos, libre: ingresos - gastos };
}
