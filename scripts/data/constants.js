// scripts/data/constants.js

// Claves de storage
export const KEYS = {
  WIZARD:  'eco_wizard_v5',
  GOALS:   'eco_goals_v1',
  DAILIES: 'eco_dailies_v1' // gastos diarios / imprevistos
};

// Mapeo de categorías legibles usadas en el resumen
export const CATS = {
  vivienda:     'Renta / Hipoteca',
  servicios:    'Servicios básicos',
  transporte:   'Transporte',
  alimentacion: 'Alimentación',
  suscripciones:'Suscripciones',
  salud:        'Salud',
  deudas:       'Deudas',
  apoyo:        'Apoyo a terceros',
  dependientes: 'Dependientes',
  pareja:       'Pareja (si no aporta)',
  imprevistos:  'Gastos diarios / imprevistos' // NUEVO
};

// Límites por categoría (para el semáforo de alertas)
export const LIMITS = {
  'Renta / Hipoteca':             0.35,
  'Servicios básicos':            0.10,
  'Transporte':                   0.15,
  'Alimentación':                 0.20,
  'Suscripciones':                0.08,
  'Salud':                        0.10,
  'Deudas':                       0.20,
  'Apoyo a terceros':             0.10,
  'Dependientes':                 0.15,
  'Pareja (si no aporta)':        0.10,
  'Gastos diarios / imprevistos': 0.05
};
