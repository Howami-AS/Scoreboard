/* ==========================================================================
   scoreboard.js
   Estado e regras da partida em andamento (em memória, salva ao finalizar
   ou a cada alteração relevante para permitir retomada).
   ========================================================================== */

const Scoreboard = (() => {
  let match = null; // objeto da partida atual

  function createMatch({ player1, player2, color1, color2, startScore, target, increment, allowNegative }) {
    match = {
      id: null,
      player1: player1 || 'Jogador 1',
      player2: player2 || 'Jogador 2',
      color1: color1 || '#E24949',
      color2: color2 || '#3E7CE0',
      startScore: Number(startScore) || 0,
      target: target === '' || target === null || target === undefined ? null : Number(target),
      increment: Number(increment) || 1,
      allowNegative: !!allowNegative,
      score1: Number(startScore) || 0,
      score2: Number(startScore) || 0,
      events: [],
      winner: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    return match;
  }

  function getMatch() {
    return match;
  }

  function setMatch(m) {
    match = m;
  }

  function addPoint(player, amount) {
    if (!match || match.winner) return null;
    const key = player === 1 ? 'score1' : 'score2';
    const next = match[key] + amount;

    if (next < 0 && !match.allowNegative) return null;

    match[key] = next;
    match.events.push({ player, amount, at: Date.now() });

    const winner = checkWinner();
    return { winner };
  }

  function undo() {
    if (!match || !match.events.length) return false;
    const last = match.events.pop();
    const key = last.player === 1 ? 'score1' : 'score2';
    match[key] -= last.amount;
    match.winner = null;
    match.finishedAt = null;
    return true;
  }

  function reset() {
    if (!match) return;
    match.score1 = match.startScore;
    match.score2 = match.startScore;
    match.events = [];
    match.winner = null;
    match.finishedAt = null;
  }

  function checkWinner() {
    if (!match || match.target === null || Number.isNaN(match.target) || match.target <= 0) return null;
    if (match.score1 >= match.target && match.score1 > match.score2) {
      match.winner = 1;
    } else if (match.score2 >= match.target && match.score2 > match.score1) {
      match.winner = 2;
    } else if (match.score1 >= match.target && match.score2 >= match.target && match.score1 !== match.score2) {
      match.winner = match.score1 > match.score2 ? 1 : 2;
    }
    if (match.winner) {
      match.finishedAt = Date.now();
    }
    return match.winner;
  }

  function finishManually() {
    if (!match) return null;
    if (match.score1 === match.score2) {
      match.winner = 'draw';
    } else {
      match.winner = match.score1 > match.score2 ? 1 : 2;
    }
    match.finishedAt = Date.now();
    return match.winner;
  }

  async function persist() {
    if (!match) return;
    const id = await Storage.saveMatch(match);
    match.id = id;
    return id;
  }

  function clear() {
    match = null;
  }

  return {
    createMatch, getMatch, setMatch, addPoint, undo, reset,
    checkWinner, finishManually, persist, clear,
  };
})();
