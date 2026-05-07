// localStorage service layer — swap this file for API calls when Node.js backend is ready

const PREFIX = 'soda_';

export const storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(PREFIX + key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
  },
  remove: (key) => { localStorage.removeItem(PREFIX + key); },
};

// Generic CRUD helpers
export function getAll(entity) { return storage.get(entity) || []; }
export function saveAll(entity, data) { storage.set(entity, data); }

export function getById(entity, id) {
  return getAll(entity).find(item => item.id === id) || null;
}

export function create(entity, item) {
  const list = getAll(entity);
  list.push(item);
  saveAll(entity, list);
  return item;
}

export function update(entity, id, changes) {
  const list = getAll(entity).map(item => item.id === id ? { ...item, ...changes } : item);
  saveAll(entity, list);
  return list.find(i => i.id === id);
}

export function remove(entity, id) {
  const list = getAll(entity).filter(item => item.id !== id);
  saveAll(entity, list);
}
