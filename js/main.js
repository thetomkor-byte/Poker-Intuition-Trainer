/* ============================================================
   POKER INTUITION TRAINER — MAIN
   ============================================================ */

(() => {

  const session = {
    state: null,
    heroIndex: 0,
    stats: { hands: 0, hit: 0, miss: 0, place: null },
    waitingForHero: false,
    active: false,
    paused: false,
    heroEntered: false,
    blindTimerId: null,
    turnTimerId: null
  };

  const el = {};

  window.addEventListener('DOMContentLoaded', () => {
    UI.init();
    cacheDom();
    bindGlobalHandlers();

    UI.settings.onChange = (s) => {
      if (session.state) {
        UI.updateSeats(session.state);
        UI.updatePot(session.state);
        UI.updateBoard(session.state);
      }
      restartBlindTimer();
    };
  });

  function cacheDom() {
    el.startOverlay = document.getElementById('start-overlay');
    el.btnStart     = document.getElementById('btn-start');
    el.btnPause     = document.getElementById('btn-pause');
    el.btnStop      = document.getElementById('btn-stop');
    el.btnSettings  = document.getElementById('btn-settings');
    el.btnNewSession= document.getElementById('btn-new-session');
    el.settingsClose= document.getElementById('settings-close');
    el.sessionEndNew= document.getElementById('session-end-new');
    el.settingsModal= document.getElementById('settings-modal');
    el.sessionEndModal = document.getElementById('session-end-modal');
  }

  function bindGlobalHandlers() {
    el.btnStart.addEventListener('click', () => {
      el.startOverlay.classList.add('hidden');
      el.btnPause.classList.remove('hidden');
      el.btnStop.classList.remove('hidden');
      startNewSession();
    });

    el.btnPause.addEventListener('click', () => {
      if (!session.active) return;
      if (!session.paused) {
        session.paused = true;
        el.btnPause.textContent = '▶';
        UI.hideActions();
        UI.stopTimer();
      } else {
        session.paused = false;
        el.btnPause.textContent = '⏸';
        processTurn();
      }
    });

    el.btnStop.addEventListener('click', () => {
      if (!session.active) return;
      if (confirm('Завершить сессию?')) {
        endSession('Сессия остановлена');
      }
    });

    el.btnSettings.addEventListener('click', () => UI.openSettings());
    el.settingsClose.addEventListener('click', () => UI.closeSettings());

    el.btnNewSession.addEventListener('click', () => {
      if (confirm('Начать новую сессию? Текущий прогресс будет потерян.')) {
        startNewSession();
      }
    });

    el.sessionEndNew.addEventListener('click', () => {
      UI.closeSessionEnd();
      el.startOverlay.classList.remove('hidden');
      el.btnStart.textContent = 'Начать игру';
      el.btnPause.classList.add('hidden');
      el.btnStop.classList.add('hidden');
    });
  }

  function startNewSession() {
    stopBlindTimer();
    session.active = true;
    session.paused = false;
    session.stats = { hands: 0, hit: 0, miss: 0, place: null };
    session.waitingForHero = false;
    session.heroEntered = false;
    el.btnPause.textContent = '⏸';
    el.btnPause.classList.remove('hidden');
    el.btnStop.classList.remove('hidden');

    const botStrategies = Bots.assignStrategies(8);

    const players = [{
      id: 'hero', name: 'Ты', isHero: true, strategy: null, stack: Engine.STARTING_STACK
    }];

    for (let i = 0; i < 8; i++) {
      players.push({
        id: 'bot' + (i + 1),
        name: 'Бот ' + (i + 1),
        isHero: false,
        strategy: botStrategies[i],
        stack: Engine.STARTING_STACK
      });
    }

    session.heroIndex = 0;
    session.state = Engine.createInitialState(players);
    session.state.buttonIndex = 8;

    UI.renderTable(session.state);
    UI.updateStats(session.stats);

    restartBlindTimer();
    startHand();
  }

  function startHand() {
    if (!session.active) return;

    const hero = session.state.players[session.heroIndex];
    if (hero.eliminated || hero.stack <= 0) { endSession('Герой вылетел'); return; }

    const alive = session.state.players.filter(p => !p.eliminated);
    if (alive.length <= 1) { endSession('Турнир выигран!'); return; }

    Engine.startHand(session.state);
    session.heroEntered = false;

    UI.renderTable(session.state);
    UI.updateBoard(session.state);
    UI.updatePot(session.state);
    UI.updateSeats(session.state);
    UI.updateLevel(session.state);
    UI.renderHeroCards(session.state.players[session.heroIndex]);

    processTurn();
  }

  function processTurn() {
    const state = session.state;
    if
