/* ==========================================================================
   history.js
   Renderização da lista de histórico, filtros e tela de detalhes.
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
      const li = document.createElement('li');
      li.innerHTML = `
        <button class="match-card" data-action="open-match" data-id="${m.id}">
          <div class="score-line">
            <span class="p1">${escapeHtml(m.player1)} ${m.score1}</span>
            <span class="vs">×</span>
            <span class="p2">${m.score2} ${escapeHtml(m.player2)}</span>
          </div>
          <div class="winner-line">${m.winner ? '🏆 ' + escapeHtml(winnerName(m)) : 'Em andamento'}</div>
          <div class="date-line">${formatDateTime(m.createdAt)}</div>
        </button>
      `;
      listEl.appendChild(li);
    });
  }

  function renderDetail(container, m) {
    const eventsHtml = m.events.length
      ? m.events.map((ev) => {
        const name = ev.player === 1 ? m.player1 : m.player2;
        const sign = ev.amount > 0 ? '+' : '';
        const cls = ev.amount > 0 ? 'positive' : 'negative';
        return `<div class="event-row"><span>${escapeHtml(name)}</span><span class="delta ${cls}">${sign}${ev.amount}</span></div>`;
      }).join('')
      : '<div class="event-row"><span>Nenhum evento registrado.</span></div>';

    container.innerHTML = `
      <div class="detail-summary">
        <div class="score-line">
          <span style="color:${m.color1 || 'var(--p1)'}">${escapeHtml(m.player1)} ${m.score1}</span>
          &nbsp;×&nbsp;
          <span style="color:${m.color2 || 'var(--p2)'}">${m.score2} ${escapeHtml(m.player2)}</span>
        </div>
        <div class="winner-line">${m.winner ? '🏆 Vencedor: ' + escapeHtml(winnerName(m)) : 'Partida em andamento'}</div>
        <div class="date-line">${formatDateTime(m.createdAt)}</div>
      </div>
      <div class="form-section">
        <h3>Histórico de pontos</h3>
        <div class="event-log">${eventsHtml}</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { formatDateTime, winnerName, filterMatches, renderList, renderDetail };
})();
