/** localStorage seguro (Safari iOS modo privado puede lanzar excepción). */
export const safeStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k) } catch { return null }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v) } catch { /* noop */ }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k) } catch { /* noop */ }
  },
}
