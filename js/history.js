/* ==========================================================================
   history.js
   Renderização da lista de histórico, filtros e tela de detalhes —
   adaptada às regras de Vôlei e Beach Tennis (sets, games, tie-breaks).
   ========================================================================== */

const History = (() => {
  function formatDateTime(ts) {
    const d = new Date(ts);
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} — ${time}`;
  }

  function winnerName(m) {
    if (m.winner === 1) return m.player1;
    if (m.winner === 2) return m.player2;
    if (m.winner === 'draw') return 'Empate';
    return '—';
  }

  function sportLabel(sport) {
    return sport === 'volei' ? 'Vôlei' : 'Beach Tennis';
  }

  function sportIcon(sport) {
    return sport === 'volei' ? '🏐' : '🎾';
  }

  function setsLine(m) {
    const hist = (m.state && m.state.setHistory) || [];
    if (!hist.length) return '';
    return hist.map((s) => `${s.p1}-${s.p2}`).join(', ');
  }

  function filterMatches(matches, { playerQuery, period }) {
    let result = matches;

    if (playerQuery && playerQuery.trim()) {
      const q = playerQuery.trim().toLowerCase();
      result = result.filter((m) =>
        m.player1.toLowerCase().includes(q) || m.player2.toLowerCase().includes(q));
    }

    if (period && period !== 'all') {
      const days = Number(period);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      result = result.filter((m) => m.createdAt >= cutoff);
    }

    return result;
  }

  function renderList(listEl, emptyEl, matches) {
    listEl.innerHTML = '';

    if (!matches.length) {
      emptyEl.classList.remove('hidden');
      listEl.classList.add('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    matches.forEach((m) => {
      const setsWon = (m.state && m.state.setsWon) || [0, 0];
      const li = document.createElement('li');
      li.innerHTML = `
        <button class="match-card" data-action="open-match" data-id="${m.id}">
          <div class="score-line">
            <span class="p1">${escapeHtml(m.player1)} ${setsWon[0]}</span>
            <span class="vs">×</span>
            <span class="p2">${setsWon[1]} ${escapeHtml(m.player2)}</span>
            <span class="sport-tag">${sportIcon(m.sport)}</span>
          </div>
          <div class="date-line">${escapeHtml(setsLine(m))}</div>
          <div class="winner-line">${m.winner ? '🏆 ' + escapeHtml(winnerName(m)) : 'Em andamento'} · ${sportLabel(m.sport)}</div>
          <div class="date-line">${formatDateTime(m.createdAt)}</div>
        </button>
      `;
      listEl.appendChild(li);
    });
  }

  function renderDetail(container, m) {
    const setsWon = (m.state && m.state.setsWon) || [0, 0];
    const hist = (m.state && m.state.setHistory) || [];

    const setsHtml = hist.length
      ? hist.map((s, i) => `<div class="event-row"><span>Set ${i + 1}</span><span class="delta">${s.p1} - ${s.p2}</span></div>`).join('')
      : '<div class="event-row"><span>Nenhum set concluído.</span></div>';

    let lastSet = null;
    const pointEventsHtml = m.events.length
      ? m.events.map((ev) => {
        const name = ev.player === 1 || ev.team === 1 ? m.player1 : m.player2;
        const team = ev.player || ev.team;
        const setNum = ev.setNumber || 1;
        let divider = '';
        if (setNum !== lastSet) {
          divider = `<div class="event-row" style="opacity:.6"><span>Set ${setNum}</span><span></span></div>`;
          lastSet = setNum;
        }
        return `${divider}<div class="event-row"><span>${escapeHtml(name)}</span><span class="delta positive">ponto (${team === 1 ? m.player1 : m.player2})</span></div>`;
      }).join('')
      : '<div class="event-row"><span>Nenhum evento registrado.</span></div>';

    container.innerHTML = `
      <div class="detail-summary">
        <div class="score-line">
          <span style="color:${m.color1 || 'var(--p1)'}">${escapeHtml(m.player1)} ${setsWon[0]}</span>
          &nbsp;×&nbsp;
          <span style="color:${m.color2 || 'var(--p2)'}">${setsWon[1]} ${escapeHtml(m.player2)}</span>
        </div>
        <div class="winner-line">${m.winner ? '🏆 Vencedor: ' + escapeHtml(winnerName(m)) : 'Partida em andamento'}</div>
        <div class="date-line">${sportIcon(m.sport)} ${sportLabel(m.sport)} · ${formatDateTime(m.createdAt)}</div>
      </div>
      <div class="form-section">
        <h3>Sets</h3>
        <div class="event-log">${setsHtml}</div>
      </div>
      <div class="form-section">
        <h3>Histórico de pontos</h3>
        <div class="event-log">${pointEventsHtml}</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { formatDateTime, winnerName, sportLabel, sportIcon, filterMatches, renderList, renderDetail };
})();
