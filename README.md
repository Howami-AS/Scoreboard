# Scoreboard

Marcador de pontuação universal, instalável como PWA, para partidas entre 2 jogadores ou equipes — cartas, sinuca, dominó, truco, futebol, vôlei, basquete, tênis e qualquer outro jogo com placar.

## Recursos

- Placar grande, tátil e rápido de usar (+1 / +5 / +10 / −1)
- Metas de pontos com detecção automática de vitória
- Desfazer, reiniciar e finalizar partida manualmente
- Histórico completo com filtros por jogador e período
- Detalhe de cada partida com o histórico de pontos evento a evento
- Personalização: nomes, cores dos jogadores, tema claro/escuro, pontuação inicial, incremento, meta padrão
- Anúncio de pontuação por voz (Web Speech API), efeitos sonoros e vibração — todos opcionais
- Exportação e importação de backup em JSON
- 100% local: sem login, sem cadastro, sem servidor, sem anúncios
- PWA instalável (Android, Windows, navegadores compatíveis) com funcionamento offline completo

## Tecnologia

HTML5, CSS3 e JavaScript puro (vanilla), sem frameworks. Essa escolha mantém o aplicativo leve, rápido de carregar e simples de auditar/manter, o que é especialmente importante para uma PWA que precisa funcionar 100% offline e ser instalada em qualquer dispositivo sem etapa de build.

- **Persistência:** IndexedDB (via `js/storage.js`), para armazenar partidas e configurações sem depender de servidor.
- **Voz:** Web Speech API (`SpeechSynthesis`), com verificação de suporte e falha silenciosa.
- **Som:** gerado em tempo real com a Web Audio API (nenhum arquivo de áudio precisa ser baixado ou cacheado).
- **Offline:** Service Worker com cache do app shell (`service-worker.js`).

## Estrutura do projeto

```
/scoreboard
│
├── index.html            Estrutura de todas as telas (SPA com troca de view)
├── manifest.json          Manifesto da PWA
├── service-worker.js       Cache offline
│
├── assets/
│   ├── icons/              Ícones do app (72–512px + ícone maskable)
│   └── sounds/              Reservado (os efeitos sonoros são sintetizados via Web Audio API)
│
├── css/
│   └── style.css            Design tokens + estilos de todas as telas
│
├── js/
│   ├── app.js                Roteamento, eventos, PWA, orquestração geral
│   ├── scoreboard.js         Estado e regras da partida em andamento
│   ├── storage.js            Camada IndexedDB (partidas + configurações)
│   ├── history.js            Listagem, filtros e detalhe do histórico
│   ├── settings.js           Preferências, tema, backup/restauração
│   └── voice.js              Anúncio de pontuação por voz
│
└── README.md
```

## Como executar localmente

Como o app usa Service Worker e `fetch`, ele precisa ser servido por HTTP (não abra o `index.html` diretamente com `file://`). Qualquer servidor estático simples funciona, por exemplo:

```bash
cd scoreboard
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080` no navegador.

## Publicar

O projeto é 100% estático e pode ser publicado em qualquer hospedagem estática, incluindo **GitHub Pages**:

1. Envie a pasta `scoreboard` para um repositório no GitHub.
2. Ative o GitHub Pages apontando para a branch/pasta do projeto.
3. Acesse a URL gerada — a instalação como PWA funcionará normalmente (é necessário HTTPS, que o GitHub Pages já fornece).

Para gerar um APK/TWA (Trusted Web Activity) para a Google Play Store, o projeto publicado (com manifest.json e service worker funcionando sob HTTPS) pode ser usado diretamente com ferramentas como o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) ou o [PWABuilder](https://www.pwabuilder.com/).

## Privacidade

O Scoreboard não tem login, não exige cadastro e não envia nenhum dado para servidores. Todas as partidas e configurações ficam salvas apenas no dispositivo (IndexedDB), exceto quando o usuário exporta manualmente um backup em JSON.

---

© Alisson Salvador 2026
