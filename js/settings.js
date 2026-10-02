/* ==========================================================================
   settings.js
   Preferências do usuário: tema, padrões de nova partida, voz, som,
   vibração, além de exportação/importação de backup em JSON.
   ========================================================================== */

const Settings = (() => {
  const DEFAULTS = {
    theme: 'dark',
    voiceEnabled: false,
    soundEnabled: true,
    vibrationEnabled: true,
    color1: '#2196F3',
    color2: '#F44336',
    volei: {
      setsToWin: 3,        // 3 = melhor de 5 (oficial); 2 = melhor de 3
      pointsPerSet: 25,
      pointsDecider: 15,
    },
    beachTennis: {
      setsToWin: 2,        // 2 = melhor de 3 (oficial); 1 = set único
      gamesPerSet: 6,
      noAd: true,
      superTiebreak: true,
    },
  };

  let current = { ...DEFAULTS };

  async function load() {
    const saved = await Storage.getSettings();
    current = { ...DEFAULTS, ...(saved || {}) };
    applyTheme(current.theme);
    return current;
  }

  function get() {
    return current;
  }

  async function update(patch) {
    current = { ...current, ...patch };
    await Storage.saveSettings(current);
    if (patch.theme) applyTheme(patch.theme);
    return current;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }

  async function exportToFile() {
    const data = await Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `scoreboard-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  return { load, get, update, applyTheme, exportToFile, readFile, DEFAULTS };
})();
