/* ==========================================================================
   storage.js
   Camada de persistência local usando IndexedDB.
   Stores:
     - matches   { id, player1, player2, color1, color2, startScore,
                   target, increment, allowNegative, score1, score2,
                   events: [{player, amount, at}], winner, createdAt, finishedAt }
     - settings  { key: 'app', value: {...} }
   Toda a API é assíncrona (Promises).
   ========================================================================== */

const Storage = (() => {
  const DB_NAME = 'scoreboard-db';
  const DB_VERSION = 1;
  const STORE_MATCHES = 'matches';
  const STORE_SETTINGS = 'settings';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB não suportado'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_MATCHES)) {
          const store = db.createObjectStore(STORE_MATCHES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  return {
    // ---------- Partidas ----------
    async saveMatch(match) {
      const store = await tx(STORE_MATCHES, 'readwrite');
      const record = { ...match };
      if (!match.id) delete record.id;
      return new Promise((resolve, reject) => {
        const req = match.id ? store.put(record) : store.add(record);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getMatch(id) {
      const store = await tx(STORE_MATCHES, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getAllMatches() {
      const store = await tx(STORE_MATCHES, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = (e) => resolve((e.target.result || []).sort((a, b) => b.createdAt - a.createdAt));
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async deleteMatch(id) {
      const store = await tx(STORE_MATCHES, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async clearMatches() {
      const store = await tx(STORE_MATCHES, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    },

    // ---------- Configurações ----------
    async getSettings() {
      const store = await tx(STORE_SETTINGS, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get('app');
        req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async saveSettings(value) {
      const store = await tx(STORE_SETTINGS, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({ key: 'app', value });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    },

    // ---------- Backup / restauração ----------
    async exportAll() {
      const [matches, settings] = await Promise.all([this.getAllMatches(), this.getSettings()]);
      return {
        app: 'scoreboard',
        exportedAt: Date.now(),
        version: DB_VERSION,
        settings,
        matches,
      };
    },

    async importAll(data, { replace = false } = {}) {
      if (!data || !Array.isArray(data.matches)) {
        throw new Error('Arquivo de backup inválido');
      }
      if (replace) {
        await this.clearMatches();
      }
      const store = await tx(STORE_MATCHES, 'readwrite');
      await Promise.all(data.matches.map((m) => new Promise((resolve, reject) => {
        const clone = { ...m };
        if (!replace) delete clone.id; // evita conflito de chave ao mesclar
        const req = clone.id ? store.put(clone) : store.add(clone);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      })));
      if (data.settings) {
        await this.saveSettings(data.settings);
      }
    },
  };
})();
