// Utilidades de localStorage
export const get = (key, fallback = {}) =>
  JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));

export const set = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));
