/* ==========================================================================
   voice.js
   Anúncio de pontuação por voz usando a Web Speech API (SpeechSynthesis).
   Funciona apenas se o navegador suportar; caso contrário, é ignorado
   silenciosamente e o app continua funcionando normalmente.
   ========================================================================== */

const Voice = (() => {
  const supported = 'speechSynthesis' in window;

  function speak(text) {
    if (!supported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    } catch (err) {
      // Falha silenciosa — o app deve continuar funcionando sem voz.
      console.warn('Voz indisponível:', err);
    }
  }

  function announceScore(name1, score1, name2, score2) {
    speak(`${name1} ${score1}, ${name2} ${score2}.`);
  }

  function announceWinner(name) {
    speak(`Time ganhador: ${name}.`);
  }

  return { supported, speak, announceScore, announceWinner };
})();
