/* ==========================================================================
   app.js
   Orquestra navegação entre telas, eventos de UI, PWA (instalação, service
   worker) e liga os módulos Storage / Scoreboard / History / Settings / Voice.
   ========================================================================== */

(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Estado de navegação
  // ------------------------------------------------------------------
  const views = document.querySelectorAll('.view');
  let currentDetailId = null;
  let deferredInstallPrompt = null;
  let audioCtx = null;

  function showView(name) {
    views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === name));
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  // Feedback: som (WebAudio, sem arquivos) e vibração
  // ------------------------------------------------------------------
  function playBeep(freq = 660, duration = 90) {
    const s = Settings.get();
    if (!s.soundEnabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration / 1000);
    } catch (err) {
      // ambiente sem suporte a áudio — ignora silenciosamente
    }
  }

  function vibrate(pattern = 25) {
    const s = Settings.get();
    if (!s.vibrationEnabled) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2400);
  }

  // ------------------------------------------------------------------
  // Modal de confirmação genérico
  // ------------------------------------------------------------------
  const confirmModal = document.getElementById('modal-confirm');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmOk = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');
  let confirmCallback = null;

  function askConfirm(message, onConfirm) {
    confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.add('is-active');
  }
  confirmOk.addEventListener('click', () => {
    confirmModal.classList.remove('is-active');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
  confirmCancel.addEventListener('click', () => {
    confirmModal.classList.remove('is-active');
    confirmCallback = null;
  });

  // ------------------------------------------------------------------
  // Modal de vitória
  // ------------------------------------------------------------------
  const victoryModal = document.getElementById('modal-victory');
  function showVictory(m) {
    const name1 = m.player1, name2 = m.player2;
    const winnerLabel = m.winner === 'draw' ? 'Empate!' : `${m.winner === 1 ? name1 : name2} venceu!`;
    document.getElementById('victory-winner').textContent = winnerLabel;
    document.getElementById('victory-score').textContent = `${name1} ${m.score1} × ${m.score2} ${name2}`;
    document.getElementById('victory-datetime').textContent = History.formatDateTime(m.finishedAt || Date.now());
    victoryModal.classList.add('is-active');
    vibrate([30, 40, 30]);
    playBeep(880, 160);
    if (m.winner !== 'draw') {
      Voice.announceWinner(m.winner === 1 ? name1 : name2);
    }
  }
  function hideVictory() {
    victoryModal.classList.remove('is-active');
  }

  // ------------------------------------------------------------------
  // NOVA PARTIDA — formulário
  // ------------------------------------------------------------------
  const newForm = document.getElementById('new-match-form');
  const colorInput = document.getElementById('color-input');
  let colorTargetPlayer = null;
  let pickedColor1 = null;
  let pickedColor2 = null;

  function openNewMatchForm() {
    const s = Settings.get();
    document.getElementById('p1-name').value = 'Jogador 1';
    document.getElementById('p2-name').value = 'Jogador 2';
    document.getElementById('start-score').value = s.defaultStartScore;
    document.getElementById('target-score').value = s.defaultTarget;
    document.getElementById('increment').value = s.defaultIncrement;
    document.getElementById('allow-negative').checked = false;
    pickedColor1 = s.color1;
    pickedColor2 = s.color2;
    document.querySelector('.color-dot[data-player="1"]').style.background = pickedColor1;
    document.querySelector('.color-dot[data-player="2"]').style.background = pickedColor2;
    showView('new');
  }

  newForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const player1 = document.getElementById('p1-name').value.trim() || 'Jogador 1';
    const player2 = document.getElementById('p2-name').value.trim() || 'Jogador 2';
    const startScore = document.getElementById('start-score').value;
    const targetRaw = document.getElementById('target-score').value;
    const increment = document.getElementById('increment').value;
    const allowNegative = document.getElementById('allow-negative').checked;

    Scoreboard.createMatch({
      player1, player2,
      color1: pickedColor1, color2: pickedColor2,
      startScore, target: targetRaw === '' ? null : targetRaw,
      increment, allowNegative,
    });
    startGameView();
  });

  function startQuickMatch() {
    const s = Settings.get();
    Scoreboard.createMatch({
      player1: 'Jogador 1',
      player2: 'Jogador 2',
      color1: s.color1,
      color2: s.color2,
      startScore: 0,
      target: null,
      increment: 1,
      allowNegative: false,
    });
    startGameView();
  }

  // ------------------------------------------------------------------
  // TELA DO PLACAR
  // ------------------------------------------------------------------
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const p1NameEl = document.getElementById('p1-display-name');
  const p2NameEl = document.getElementById('p2-display-name');
  const gameMetaEl = document.getElementById('game-meta');

  function startGameView() {
    renderGame();
    startTimer(true);
    updateCrownBadge();
    showView('game');
  }

  function renderGame() {
    const m = Scoreboard.getMatch();
    if (!m) return;
    p1NameEl.textContent = m.player1;
    p2NameEl.textContent = m.player2;
    p1ScoreEl.textContent = m.score1;
    p2ScoreEl.textContent = m.score2;
    document.documentElement.style.setProperty('--p1', m.color1 || '#E24949');
    document.documentElement.style.setProperty('--p2', m.color2 || '#3E7CE0');
    gameMetaEl.textContent = m.target ? `Meta: ${m.target} pontos` : '';
  }

  function bumpScore(player) {
    const el = player === 1 ? p1ScoreEl : p2ScoreEl;
    el.classList.remove('bump');
    // força reflow para reiniciar a animação
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // ---------------- Cronômetro da partida ----------------
  const timerIconEl = document.getElementById('timer-icon');
  const timerValueEl = document.getElementById('timer-value');
  let timerSeconds = 0;
  let timerRunning = false;
  let timerInterval = null;

  function formatElapsed(total) {
    const hh = String(Math.floor(total / 3600)).padStart(2, '0');
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function renderTimer() {
    timerValueEl.textContent = formatElapsed(timerSeconds);
    timerIconEl.textContent = timerRunning ? '⏸' : '▶';
  }

  function startTimer(fromZero = false) {
    if (fromZero) timerSeconds = 0;
    clearInterval(timerInterval);
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds += 1;
      renderTimer();
    }, 1000);
    renderTimer();
  }

  function pauseTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    renderTimer();
  }

  function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
  }

  function toggleTimer() {
    if (timerRunning) pauseTimer();
    else startTimer(false);
  }

  function resetTimer() {
    timerSeconds = 0;
    renderTimer();
  }

  // ---------------- Edição rápida do nome do jogador ----------------
  function beginEditName(player) {
    const el = player === '1' || player === 1 ? p1NameEl : p2NameEl;
    el.setAttribute('contenteditable', 'true');
    el.focus();
    document.execCommand && document.execCommand('selectAll', false, null);

    const finish = () => {
      el.removeAttribute('contenteditable');
      const value = el.textContent.trim();
      const m = Scoreboard.getMatch();
      if (!m) return;
      if (player === '1' || player === 1) {
        m.player1 = value || m.player1;
      } else {
        m.player2 = value || m.player2;
      }
      renderGame();
      updateCrownBadge();
      el.removeEventListener('blur', finish);
      el.removeEventListener('keydown', onKeydown);
    };
    const onKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    };
    el.addEventListener('blur', finish);
    el.addEventListener('keydown', onKeydown);
  }

  // ---------------- Selo de confrontos diretos (coroa) ----------------
  async function updateCrownBadge() {
    const m = Scoreboard.getMatch();
    const badge = document.getElementById('crown-badge');
    if (!m) return;
    const matches = await Storage.getAllMatches();
    const name1 = m.player1.trim().toLowerCase();
    const name2 = m.player2.trim().toLowerCase();
    let w1 = 0, w2 = 0, found = false;

    matches.forEach((match) => {
      if (!match.winner || match.winner === 'draw') return;
      const names = [match.player1.trim().toLowerCase(), match.player2.trim().toLowerCase()];
      if (names.includes(name1) && names.includes(name2)) {
        found = true;
        const winnerName = match.winner === 1 ? match.player1 : match.player2;
        if (winnerName.trim().toLowerCase() === name1) w1 += 1;
        else if (winnerName.trim().toLowerCase() === name2) w2 += 1;
      }
    });

    document.getElementById('crown-p1').textContent = w1;
    document.getElementById('crown-p2').textContent = w2;
    badge.style.display = found ? 'flex' : 'none';
  }

  async function handleAddPoint(player, amount) {
    const result = Scoreboard.addPoint(player, amount);
    if (result === null) {
      showToast('Não é possível deixar o placar negativo');
      return;
    }
    renderGame();
    bumpScore(player);
    vibrate(20);
    playBeep(amount > 0 ? 660 : 420, 80);

    const s = Settings.get();
    const m = Scoreboard.getMatch();
    if (s.voiceEnabled) {
      Voice.announceScore(m.player1, m.score1, m.player2, m.score2);
    }

    if (result.winner) {
      stopTimer();
      await Scoreboard.persist();
      showVictory(m);
    }
  }

  async function handleFinishManually() {
    const m = Scoreboard.getMatch();
    if (!m) return;
    stopTimer();
    Scoreboard.finishManually();
    await Scoreboard.persist();
    showVictory(m);
  }

  function handleUndo() {
    const ok = Scoreboard.undo();
    if (!ok) {
      showToast('Nada para desfazer');
      return;
    }
    renderGame();
  }

  function handleReset() {
    askConfirm('Reiniciar a pontuação desta partida?', () => {
      Scoreboard.reset();
      renderGame();
      startTimer(true);
      showToast('Partida reiniciada');
    });
  }

  function handleExitGame() {
    const m = Scoreboard.getMatch();
    if (m && m.events.length && !m.winner) {
      askConfirm('Sair sem salvar o progresso da partida?', () => {
        stopTimer();
        Scoreboard.clear();
        showView('home');
      });
    } else {
      stopTimer();
      Scoreboard.clear();
      showView('home');
    }
  }

  // ------------------------------------------------------------------
  // HISTÓRICO
  // ------------------------------------------------------------------
  const matchListEl = document.getElementById('match-list');
  const historyEmptyEl = document.getElementById('history-empty');
  const filterPlayerEl = document.getElementById('filter-player');
  const filterPeriodEl = document.getElementById('filter-period');
  let allMatches = [];

  async function openHistory() {
    allMatches = await Storage.getAllMatches();
    refreshHistoryList();
    showView('history');
  }

  function refreshHistoryList() {
    const filtered = History.filterMatches(allMatches, {
      playerQuery: filterPlayerEl.value,
      period: filterPeriodEl.value,
    });
    History.renderList(matchListEl, historyEmptyEl, filtered);
  }

  filterPlayerEl.addEventListener('input', refreshHistoryList);
  filterPeriodEl.addEventListener('change', refreshHistoryList);

  async function openMatchDetail(id) {
    const m = await Storage.getMatch(id);
    if (!m) return;
    currentDetailId = id;
    History.renderDetail(document.getElementById('detail-content'), m);
    showView('detail');
  }

  function handleDeleteMatch() {
    if (currentDetailId === null) return;
    askConfirm('Excluir esta partida do histórico?', async () => {
      await Storage.deleteMatch(currentDetailId);
      currentDetailId = null;
      showToast('Partida excluída');
      openHistory();
    });
  }

  function handleClearHistory() {
    askConfirm('Limpar todo o histórico de partidas? Esta ação não pode ser desfeita.', async () => {
      await Storage.clearMatches();
      showToast('Histórico limpo');
      openHistory();
    });
  }

  // ------------------------------------------------------------------
  // CONFIGURAÇÕES
  // ------------------------------------------------------------------
  function openSettingsView() {
    const s = Settings.get();
    document.querySelectorAll('.theme-option').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === s.theme));
    });
    document.getElementById('def-start').value = s.defaultStartScore;
    document.getElementById('def-target').value = s.defaultTarget;
    document.getElementById('def-increment').value = s.defaultIncrement;
    document.getElementById('setting-voice').checked = s.voiceEnabled;
    document.getElementById('setting-sound').checked = s.soundEnabled;
    document.getElementById('setting-vibration').checked = s.vibrationEnabled;
    showView('settings');
  }

  document.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.themeChoice;
      await Settings.update({ theme });
      document.querySelectorAll('.theme-option').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn)));
    });
  });

  ['def-start', 'def-target', 'def-increment'].forEach((id) => {
    document.getElementById(id).addEventListener('change', async (e) => {
      const map = { 'def-start': 'defaultStartScore', 'def-target': 'defaultTarget', 'def-increment': 'defaultIncrement' };
      await Settings.update({ [map[id]]: Number(e.target.value) });
    });
  });

  document.getElementById('setting-voice').addEventListener('change', (e) => Settings.update({ voiceEnabled: e.target.checked }));
  document.getElementById('setting-sound').addEventListener('change', (e) => Settings.update({ soundEnabled: e.target.checked }));
  document.getElementById('setting-vibration').addEventListener('change', (e) => Settings.update({ vibrationEnabled: e.target.checked }));

  const voiceQuickToggle = document.getElementById('voice-quick-toggle');
  async function toggleVoiceQuick() {
    const s = Settings.get();
    await Settings.update({ voiceEnabled: !s.voiceEnabled });
    voiceQuickToggle.style.opacity = Settings.get().voiceEnabled ? '1' : '0.45';
    showToast(Settings.get().voiceEnabled ? 'Voz ativada' : 'Voz desativada');
  }

  // Exportar / importar
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await Settings.readFile(file);
      askConfirm('Importar dados substituirá partidas e configurações conflitantes. Deseja mesclar com os dados atuais?', async () => {
        await Storage.importAll(data, { replace: false });
        await Settings.load();
        showToast('Dados importados com sucesso');
      });
    } catch (err) {
      showToast('Arquivo inválido');
    }
    e.target.value = '';
  });

  // ------------------------------------------------------------------
  // Delegação de eventos (data-action)
  // ------------------------------------------------------------------
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    switch (action) {
      case 'new-match': openNewMatchForm(); break;
      case 'quick-match': startQuickMatch(); break;
      case 'go-history': openHistory(); break;
      case 'go-settings': openSettingsView(); break;
      case 'back-home': showView('home'); break;
      case 'back-history': showView('history'); openHistory(); break;
      case 'install': triggerInstall(); break;

      case 'pick-color':
        colorTargetPlayer = btn.dataset.player;
        colorInput.value = colorTargetPlayer === '1' ? (pickedColor1 || '#E24949') : (pickedColor2 || '#3E7CE0');
        colorInput.click();
        break;

      case 'add':
        handleAddPoint(Number(btn.dataset.player), Number(btn.dataset.amount));
        break;
      case 'undo': handleUndo(); break;
      case 'reset-match': handleReset(); break;
      case 'finish-match': handleFinishManually(); break;
      case 'exit-game': handleExitGame(); break;
      case 'toggle-voice': toggleVoiceQuick(); break;
      case 'edit-name': beginEditName(btn.dataset.player); break;
      case 'toggle-timer': toggleTimer(); break;
      case 'reset-timer': resetTimer(); break;

      case 'open-match': openMatchDetail(Number(btn.dataset.id)); break;
      case 'delete-match': handleDeleteMatch(); break;
      case 'clear-history': handleClearHistory(); break;

      case 'victory-new':
        hideVictory();
        stopTimer();
        Scoreboard.clear();
        openNewMatchForm();
        break;
      case 'victory-save':
        hideVictory();
        stopTimer();
        Scoreboard.clear();
        showView('home');
        break;

      case 'export-data':
        await Settings.exportToFile();
        showToast('Backup exportado');
        break;
      case 'import-data':
        document.getElementById('import-file').click();
        break;

      default: break;
    }
  });

  colorInput.addEventListener('input', () => {
    if (colorTargetPlayer === '1') {
      pickedColor1 = colorInput.value;
      document.querySelector('.color-dot[data-player="1"]').style.background = pickedColor1;
    } else if (colorTargetPlayer === '2') {
      pickedColor2 = colorInput.value;
      document.querySelector('.color-dot[data-player="2"]').style.background = pickedColor2;
    }
  });

  // ------------------------------------------------------------------
  // Instalação (PWA)
  // ------------------------------------------------------------------
  const installBtn = document.getElementById('install-btn');

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!isStandalone()) installBtn.classList.add('is-visible');
  });

  async function triggerInstall() {
    if (!deferredInstallPrompt) {
      showToast('Use o menu do navegador para "Adicionar à tela inicial"');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.remove('is-visible');
  }

  window.addEventListener('appinstalled', () => {
    installBtn.classList.remove('is-visible');
    showToast('Aplicativo instalado');
  });

  // ------------------------------------------------------------------
  // Service Worker
  // ------------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        /* funcionamento offline pode não estar disponível; app segue normalmente */
      });
    });
  }

  // ------------------------------------------------------------------
  // Inicialização
  // ------------------------------------------------------------------
  async function init() {
    await Settings.load();
    if (isStandalone()) installBtn.classList.remove('is-visible');
    voiceQuickToggle.style.opacity = Settings.get().voiceEnabled ? '1' : '0.45';
    showView('home');
  }

  init();
})();
