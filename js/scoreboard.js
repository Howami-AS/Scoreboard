/* ==========================================================================
   scoreboard.js
   Motores de pontuação para os dois esportes suportados: Vôlei e Beach
   Tennis, seguindo as regras oficiais (FIVB / ITF-CBBT).

   VÔLEI
     - Sistema rally point: cada rally vale 1 ponto, não importa quem sacou.
     - Sets até 25 pontos (configurável), vencendo por 2 de diferença, sem teto.
     - Set decisivo (tie-break) até 15 pontos (configurável), também por 2.
     - Partida em melhor de 5 sets (vence quem fechar 3) ou melhor de 3
       (vence quem fechar 2) — configurável.

   BEACH TENNIS
     - Pontuação 0 / 15 / 30 / 40 / game, com "sem vantagem": em 40-40 o
       ponto seguinte (Golden Point) decide o game — configurável.
     - Set até 6 games (configurável) com 2 de vantagem; em N-1 x N-1 (ex.
       5x5 para set de 6 games) disputa-se um tie-break de 7 pontos, também
       com 2 de vantagem.
     - Partida em melhor de 3 sets; se ficar 1 set a 1, em vez de um 3º set
       joga-se um match tie-break (super tie-break) de 10 pontos — regra
       adotada pela ITF desde 2020 (configurável). Também é possível jogar
       em set único.

   O placar de cada partida (match.state) é sempre reconstruído a partir da
   lista de eventos (match.events), o que torna "Desfazer" e "Reiniciar"
   simples e confiáveis mesmo com regras de set/tie-break complexas.
   ========================================================================== */

const Scoreboard = (() => {
  let match = null;

  // ------------------------------------------------------------------
  // Estado inicial por esporte
  // ------------------------------------------------------------------
  function initState(sport) {
    if (sport === 'volei') {
      return { currentSet: 1, setsWon: [0, 0], points: [0, 0], setHistory: [] };
    }
    // beach-tennis
    return {
      currentSet: 1,
      setsWon: [0, 0],
      games: [0, 0],
      points: [0, 0],
      isTiebreak: false,
      tiebreakPoints: [0, 0],
      isMatchTiebreak: false,
      matchTiebreakPoints: [0, 0],
      setHistory: [],
    };
  }

  function createMatch({ sport, player1, player2, color1, color2, config }) {
    match = {
      id: null,
      sport,
      player1: player1 || (sport === 'volei' ? 'Time 1' : 'Dupla 1'),
      player2: player2 || (sport === 'volei' ? 'Time 2' : 'Dupla 2'),
      color1: color1 || '#2196F3',
      color2: color2 || '#F44336',
      config,
      state: initState(sport),
      events: [],
      winner: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    return match;
  }

  function getMatch() { return match; }
  function setMatch(m) { match = m; }

  // ------------------------------------------------------------------
  // Regras — Vôlei
  // ------------------------------------------------------------------
  function applyPointVolei(m, team) {
    const st = m.state;
    const other = team === 1 ? 2 : 1;
    st.points[team - 1] += 1;

    const totalSets = m.config.setsToWin * 2 - 1;
    const isDecider = m.config.setsToWin > 1 && st.currentSet === totalSets;
    const target = isDecider ? m.config.pointsDecider : m.config.pointsPerSet;
    const mine = st.points[team - 1];
    const opp = st.points[other - 1];

    if (mine >= target && mine - opp >= 2) {
      st.setHistory.push({ p1: st.points[0], p2: st.points[1] });
      st.setsWon[team - 1] += 1;
      st.points = [0, 0];
      if (st.setsWon[team - 1] >= m.config.setsToWin) {
        m.winner = team;
        m.finishedAt = Date.now();
      } else {
        st.currentSet += 1;
      }
    }
  }

  // ------------------------------------------------------------------
  // Regras — Beach Tennis
  // ------------------------------------------------------------------
  function finishSetOrMatchBeach(m, team) {
    const st = m.state;
    const cfg = m.config;
    if (st.setsWon[team - 1] >= cfg.setsToWin) {
      m.winner = team;
      m.finishedAt = Date.now();
      return;
    }
    st.currentSet += 1;
    if (cfg.setsToWin === 2 && cfg.superTiebreak && st.setsWon[0] === 1 && st.setsWon[1] === 1) {
      st.isMatchTiebreak = true;
      st.matchTiebreakPoints = [0, 0];
    }
  }

  function applyPointBeach(m, team) {
    const st = m.state;
    const cfg = m.config;
    const other = team === 1 ? 2 : 1;

    if (st.isMatchTiebreak) {
      st.matchTiebreakPoints[team - 1] += 1;
      const mine = st.matchTiebreakPoints[team - 1];
      const opp = st.matchTiebreakPoints[other - 1];
      if (mine >= 10 && mine - opp >= 2) {
        st.setHistory.push({ p1: `STB ${st.matchTiebreakPoints[0]}`, p2: `STB ${st.matchTiebreakPoints[1]}` });
        st.setsWon[team - 1] += 1;
        m.winner = team;
        m.finishedAt = Date.now();
      }
      return;
    }

    if (st.isTiebreak) {
      st.tiebreakPoints[team - 1] += 1;
      const mine = st.tiebreakPoints[team - 1];
      const opp = st.tiebreakPoints[other - 1];
      if (mine >= 7 && mine - opp >= 2) {
        st.games[team - 1] += 1;
        st.setHistory.push({ p1: st.games[0], p2: st.games[1] });
        st.setsWon[team - 1] += 1;
        st.games = [0, 0];
        st.isTiebreak = false;
        st.tiebreakPoints = [0, 0];
        finishSetOrMatchBeach(m, team);
      }
      return;
    }

    st.points[team - 1] += 1;
    const mine = st.points[team - 1];
    const opp = st.points[other - 1];
    const gameWon = cfg.noAd ? (mine >= 4 && mine > opp) : (mine >= 4 && mine - opp >= 2);

    if (gameWon) {
      st.games[team - 1] += 1;
      st.points = [0, 0];
      const g1 = st.games[0];
      const g2 = st.games[1];
      const target = cfg.gamesPerSet;

      if (g1 === target - 1 && g2 === target - 1) {
        st.isTiebreak = true;
        st.tiebreakPoints = [0, 0];
        return;
      }
      if (st.games[team - 1] >= target && st.games[team - 1] - st.games[other - 1] >= 2) {
        st.setHistory.push({ p1: g1, p2: g2 });
        st.setsWon[team - 1] += 1;
        st.games = [0, 0];
        finishSetOrMatchBeach(m, team);
      }
    }
  }

  function applyPoint(m, team) {
    if (m.sport === 'volei') applyPointVolei(m, team);
    else applyPointBeach(m, team);
  }

  // ------------------------------------------------------------------
  // API de jogo: adicionar ponto, desfazer, reiniciar
  // ------------------------------------------------------------------
  function addPoint(team) {
    if (!match || match.winner) return null;
    match.events.push({ team, at: Date.now(), setNumber: match.state.currentSet });
    applyPoint(match, team);
    return { winner: match.winner };
  }

  function rebuildFromEvents() {
    const events = match.events;
    match.state = initState(match.sport);
    match.winner = null;
    match.finishedAt = null;
    match.events = [];
    events.forEach((ev) => applyPoint(match, ev.team));
    match.events = events;
  }

  function undo() {
    if (!match || !match.events.length) return false;
    match.events.pop();
    rebuildFromEvents();
    return true;
  }

  function undoPoint(team) {
    if (!match || !match.events.length) return false;
    const eventIndex = match.events.findLastIndex((event) => event.team === team);
    if (eventIndex < 0) return false;
    match.events.splice(eventIndex, 1);
    rebuildFromEvents();
    return true;
  }

  function reset() {
    if (!match) return;
    match.events = [];
    rebuildFromEvents();
  }

  function finishManually() {
    if (!match) return null;
    const st = match.state;
    if (st.setsWon[0] !== st.setsWon[1]) {
      match.winner = st.setsWon[0] > st.setsWon[1] ? 1 : 2;
    } else {
      // Empate em sets: decide pelo placar do set em andamento.
      const cur1 = match.sport === 'volei' ? st.points[0] : (st.games ? st.games[0] : 0);
      const cur2 = match.sport === 'volei' ? st.points[1] : (st.games ? st.games[1] : 0);
      match.winner = cur1 === cur2 ? 'draw' : (cur1 > cur2 ? 1 : 2);
    }
    match.finishedAt = Date.now();
    return match.winner;
  }

  // ------------------------------------------------------------------
  // Exibição — converte o estado bruto em textos prontos para a tela
  // ------------------------------------------------------------------
  function pointLabel(mine, other, noAd) {
    const labels = ['0', '15', '30', '40'];
    if (noAd) return labels[Math.min(mine, 3)];
    if (mine < 3 || other < 3) return labels[Math.min(mine, 3)];
    if (mine === other) return '40';
    return mine > other ? 'AD' : '40';
  }

  function describe(m) {
    const st = m.state;
    const cfg = m.config;

    if (m.sport === 'volei') {
      const totalSets = cfg.setsToWin * 2 - 1;
      return {
        big1: String(st.points[0]),
        big2: String(st.points[1]),
        sub1: `${st.setsWon[0]} set${st.setsWon[0] === 1 ? '' : 's'}`,
        sub2: `${st.setsWon[1]} set${st.setsWon[1] === 1 ? '' : 's'}`,
        setsWon: st.setsWon,
        meta: `Set ${Math.min(st.currentSet, totalSets)} de ${totalSets} · Vôlei`,
      };
    }

    // beach-tennis
    let big1, big2, metaPrefix;
    if (st.isMatchTiebreak) {
      big1 = String(st.matchTiebreakPoints[0]);
      big2 = String(st.matchTiebreakPoints[1]);
      metaPrefix = 'Match tie-break (10 pontos)';
    } else if (st.isTiebreak) {
      big1 = String(st.tiebreakPoints[0]);
      big2 = String(st.tiebreakPoints[1]);
      metaPrefix = 'Tie-break (7 pontos)';
    } else {
      big1 = pointLabel(st.points[0], st.points[1], cfg.noAd);
      big2 = pointLabel(st.points[1], st.points[0], cfg.noAd);
      metaPrefix = `Set ${st.currentSet}`;
    }
    return {
      big1, big2,
      sub1: st.isMatchTiebreak ? '' : `${st.games[0]} game${st.games[0] === 1 ? '' : 's'}`,
      sub2: st.isMatchTiebreak ? '' : `${st.games[1]} game${st.games[1] === 1 ? '' : 's'}`,
      setsWon: st.setsWon,
      meta: `${metaPrefix} · Beach Tennis`,
    };
  }

  async function persist() {
    if (!match) return;
    const id = await Storage.saveMatch(match);
    match.id = id;
    return id;
  }

  function clear() { match = null; }

  return {
    createMatch, getMatch, setMatch, addPoint, undo, undoPoint, reset,
    finishManually, persist, clear, describe, pointLabel,
  };
})();
