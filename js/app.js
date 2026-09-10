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
    const setsLine = m.state.setHistory.map((s) => `${s.p1}-${s.p2}`).join(', ') || '—';
    document.getElementById('victory-winner').textContent = winnerLabel;
    document.getElementById('victory-score').textContent = `${m.state.setsWon[0]} × ${m.state.setsWon[1]} sets`;
    document.getElementById('victory-datetime').textContent = `${setsLine} · ${History.formatDateTime(m.finishedAt || Date.now())}`;
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
  // ESCOLHA DO ESPORTE
  // ------------------------------------------------------------------
  function openSportPicker() {
    showView('sport');
  }

  function sportLabel(sport) {
    return sport === 'volei' ? 'Vôlei' : 'Beach Tennis';
  }

  // ------------------------------------------------------------------
  // NOVA PARTIDA — formulário (campos variam por esporte)
  // ------------------------------------------------------------------
  const newForm = document.getElementById('new-match-form');
  const colorInput = document.getElementById('color-input');
  const voleiFieldsEl = document.getElementById('volei-fields');
  const beachFieldsEl = document.getElementById('beach-fields');
  let colorTargetPlayer = null;
  let pickedColor1 = null;
  let pickedColor2 = null;
  let selectedSport = 'volei';

  function buildVoleiConfigFromSettings(s) {
    return {
      setsToWin: s.volei.setsToWin,
      pointsPerSet: s.volei.pointsPerSet,
      pointsDecider: s.volei.pointsDecider,
    };
  }

  function buildBeachConfigFromSettings(s) {
    return {
      setsToWin: s.beachTennis.setsToWin,
      gamesPerSet: s.beachTennis.gamesPerSet,
      noAd: s.beachTennis.noAd,
      superTiebreak: s.beachTennis.superTiebreak,
    };
  }

  function openNewMatchForm(sport) {
    selectedSport = sport;
    const s = Settings.get();

    document.getElementById('new-match-title').textContent = `Nova partida · ${sportLabel(sport)}`;
    const defaultName1 = sport === 'volei' ? 'Time 1' : 'Dupla 1';
    const defaultName2 = sport === 'volei' ? 'Time 2' : 'Dupla 2';
    document.getElementById('p1-name-label').textContent = defaultName1;
    document.getElementById('p2-name-label').textContent = defaultName2;
    document.getElementById('p1-name').value = defaultName1;
    document.getElementById('p2-name').value = defaultName2;

    voleiFieldsEl.classList.toggle('hidden', sport !== 'volei');
    beachFieldsEl.classList.toggle('hidden', sport !== 'beach-tennis');

    if (sport === 'volei') {
      document.getElementById('volei-format').value = String(s.volei.setsToWin === 1 ? 1 : (s.volei.setsToWin === 3 ? 5 : 3));
      document.getElementById('volei-points').value = s.volei.pointsPerSet;
      document.getElementById('volei-points-decider').value = s.volei.pointsDecider;
    } else {
      document.getElementById('beach-format').value = String(s.beachTennis.setsToWin === 2 ? 3 : 1);
      document.getElementById('beach-games').value = s.beachTennis.gamesPerSet;
      document.getElementById('beach-noad').checked = s.beachTennis.noAd;
      document.getElementById('beach-super-tiebreak').checked = s.beachTennis.superTiebreak;
    }

    pickedColor1 = s.color1;
    pickedColor2 = s.color2;
    document.querySelector('.color-dot[data-player="1"]').style.background = pickedColor1;
    document.querySelector('.color-dot[data-player="2"]').style.background = pickedColor2;
    showView('new');
  }

  newForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const defaultName1 = selectedSport === 'volei' ? 'Time 1' : 'Dupla 1';
    const defaultName2 = selectedSport === 'volei' ? 'Time 2' : 'Dupla 2';
    const player1 = document.getElementById('p1-name').value.trim() || defaultName1;
    const player2 = document.getElementById('p2-name').value.trim() || defaultName2;

    let config;
    if (selectedSport === 'volei') {
      const format = Number(document.getElementById('volei-format').value);
      config = {
        setsToWin: format === 1 ? 1 : (format === 5 ? 3 : 2),
        pointsPerSet: Math.max(5, Number(document.getElementById('volei-points').value) || 25),
        pointsDecider: Math.max(5, Number(document.getElementById('volei-points-decider').value) || 15),
      };
    } else {
      const format = Number(document.getElementById('beach-format').value);
      config = {
        setsToWin: format === 1 ? 1 : 2,
        gamesPerSet: Math.max(2, Number(document.getElementById('beach-games').value) || 6),
        noAd: document.getElementById('beach-noad').checked,
        superTiebreak: document.getElementById('beach-super-tiebreak').checked,
      };
    }

    Scoreboard.createMatch({
      sport: selectedSport,
      player1, player2,
      color1: pickedColor1, color2: pickedColor2,
      config,
    });
    startGameView();
  });

  // ------------------------------------------------------------------
  // TELA DO PLACAR
  // ------------------------------------------------------------------
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const p1NameEl = document.getElementById('p1-display-name');
  const p2NameEl = document.getElementById('p2-display-name');
  const p1SubEl = document.getElementById('p1-sub');
  const p2SubEl = document.getElementById('p2-sub');
  const gameMetaEl = document.getElementById('game-meta');
  const setsP1El = document.getElementById('sets-p1');
  const setsP2El = document.getElementById('sets-p2');
  const scoreUndoEls = document.querySelectorAll('.score-undo');

  function startGameView() {
    renderGame();
    startTimer(true);
    showView('game');
  }

  function renderGame() {
    const m = Scoreboard.getMatch();
    if (!m) return;
    const d = Scoreboard.describe(m);

    p1NameEl.textContent = m.player1;
    p2NameEl.textContent = m.player2;
    p1ScoreEl.textContent = d.big1;
    p2ScoreEl.textContent = d.big2;
    p1SubEl.textContent = d.sub1;
    p2SubEl.textContent = d.sub2;
    setsP1El.textContent = d.setsWon[0];
    setsP2El.textContent = d.setsWon[1];
    gameMetaEl.textContent = d.meta;
    scoreUndoEls.forEach((button) => {
      const player = Number(button.dataset.player);
      button.disabled = !m.events.some((event) => event.team === player);
    });

    document.documentElement.style.setProperty('--p1', m.color1 || '#E24949');
    document.documentElement.style.setProperty('--p2', m.color2 || '#3E7CE0');
  }

  function bumpScore(player) {
    const el = player === 1 ? p1ScoreEl : p2ScoreEl;
    el.classList.remove('bump');
    // força reflow para reiniciar a animação
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function animateSetVictory(player) {
    const panel = document.querySelector(`.player-panel[data-player="${player}"]`);
    if (!panel) return;
    panel.classList.remove('set-victory');
    void panel.offsetWidth;
    panel.classList.add('set-victory');
    panel.addEventListener('animationend', () => panel.classList.remove('set-victory'), { once: true });
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

  // ---------------- Ações do placar ----------------
  async function handleAddPoint(player) {
    const beforeSets = [...Scoreboard.getMatch().state.setsWon];
    const result = Scoreboard.addPoint(player);
    if (result === null) return; // partida já finalizada

    renderGame();
    bumpScore(player);
    const afterSets = Scoreboard.getMatch().state.setsWon;
    afterSets.forEach((sets, index) => {
      if (sets > beforeSets[index]) animateSetVictory(index + 1);
    });
    vibrate(20);
    playBeep(660, 80);

    const s = Settings.get();
    const m = Scoreboard.getMatch();
    const d = Scoreboard.describe(m);
    if (s.voiceEnabled) {
      Voice.announceScore(m.player1, d.big1, m.player2, d.big2);
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
    askConfirm('Finalizar a partida com o placar atual?', async () => {
      stopTimer();
      Scoreboard.finishManually();
      await Scoreboard.persist();
      showVictory(m);
    });
  }

  function handleUndoPlayer(player) {
    const wasVictoryVisible = victoryModal.classList.contains('is-active');
    const ok = Scoreboard.undoPoint(player);
    if (!ok) {
      showToast('Nenhum ponto para anular deste lado');
      return;
    }
    if (wasVictoryVisible) {
      hideVictory();
      startTimer(false);
    }
    renderGame();
    showToast('Ponto anulado');
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

    document.getElementById('def-volei-format').value = String(s.volei.setsToWin === 1 ? 1 : (s.volei.setsToWin === 3 ? 5 : 3));
    document.getElementById('def-volei-points').value = s.volei.pointsPerSet;
    document.getElementById('def-volei-points-decider').value = s.volei.pointsDecider;

    document.getElementById('def-beach-format').value = String(s.beachTennis.setsToWin === 2 ? 3 : 1);
    document.getElementById('def-beach-games').value = s.beachTennis.gamesPerSet;
    document.getElementById('def-beach-noad').checked = s.beachTennis.noAd;
    document.getElementById('def-beach-super-tiebreak').checked = s.beachTennis.superTiebreak;

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

  async function saveVoleiDefaults() {
    const format = Number(document.getElementById('def-volei-format').value);
    await Settings.update({
      volei: {
        setsToWin: format === 1 ? 1 : (format === 5 ? 3 : 2),
        pointsPerSet: Math.max(5, Number(document.getElementById('def-volei-points').value) || 25),
        pointsDecider: Math.max(5, Number(document.getElementById('def-volei-points-decider').value) || 15),
      },
    });
  }

  async function saveBeachDefaults() {
    const format = Number(document.getElementById('def-beach-format').value);
    await Settings.update({
      beachTennis: {
        setsToWin: format === 1 ? 1 : 2,
        gamesPerSet: Math.max(2, Number(document.getElementById('def-beach-games').value) || 6),
        noAd: document.getElementById('def-beach-noad').checked,
        superTiebreak: document.getElementById('def-beach-super-tiebreak').checked,
      },
    });
  }

  ['def-volei-format', 'def-volei-points', 'def-volei-points-decider'].forEach((id) => {
    document.getElementById(id).addEventListener('change', saveVoleiDefaults);
  });
  ['def-beach-format', 'def-beach-games', 'def-beach-noad', 'def-beach-super-tiebreak'].forEach((id) => {
    document.getElementById(id).addEventListener('change', saveBeachDefaults);
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
      case 'new-match': openSportPicker(); break;
      case 'pick-sport':
        openNewMatchForm(btn.dataset.sport);
        break;
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

      case 'add': handleAddPoint(Number(btn.dataset.player)); break;
      case 'undo-player': handleUndoPlayer(Number(btn.dataset.player)); break;
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

      case 'victory-new': {
        const finishedSport = Scoreboard.getMatch() ? Scoreboard.getMatch().sport : 'volei';
        hideVictory();
        stopTimer();
        Scoreboard.clear();
        openNewMatchForm(finishedSport);
        break;
      }
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
