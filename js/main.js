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
    if (session.paused) return;

    if (state.handOver) { finishHand(); return; }

    const idx = state.actingIndex;
    const player = state.players[idx];

    if (!player || player.folded || player.eliminated || player.allIn) {
      advanceOrFinish();
      return;
    }

    UI.updateActiveHighlight(state);

    if (player.isHero) {
      session.waitingForHero = true;
      heroTurn(player);
    } else {
      session.waitingForHero = false;
      UI.hideActions();
      botTurn(player, idx);
    }
  }

  function heroTurn(hero) {
    const state = session.state;
    const toCall = Math.max(0, state.currentBet - hero.committedThisStreet);

    UI.updateActions(state, session.heroIndex, {
      onFold:  () => heroAct({ type: 'fold' }),
      onCheck: () => heroAct({ type: 'check' }),
      onCall:  () => heroAct({ type: 'call' }),
      onRaise: (amount) => heroAct({ type: 'raise', amount }),
      onAllIn: () => heroAct({ type: 'allin' })
    });

    UI.stopTimer();
    if (UI.settings.turnTime > 0) {
      UI.startTimer(UI.settings.turnTime, () => {
        if (toCall === 0) heroAct({ type: 'check' });
        else heroAct({ type: 'fold' });
      });
    }
  }

  function heroAct(action) {
    if (!session.waitingForHero) return;
    session.waitingForHero = false;
    UI.stopTimer();
    UI.hideActions();

    const state = session.state;
    const hero = state.players[session.heroIndex];

    if (action.type === 'call' || action.type === 'raise' || action.type === 'allin') {
      session.heroEntered = true;
    }

    const res = Engine.applyAction(state, session.heroIndex, action);
    if (!res.ok) {
      console.warn('Неверное действие героя:', res.error);
      session.waitingForHero = true;
      heroTurn(hero);
      return;
    }

    UI.updateSeats(state);
    UI.updatePot(state);
    advanceOrFinish();
  }

  // Преобразует решение бота { action, amount } в действие движка { type, amount }
  function botDecisionToEngineAction(decision) {
    return {
      type: decision.action,
      amount: decision.amount || 0
    };
  }

  function botTurn(bot, idx) {
    const state = session.state;
    const delay = 500 + Engine.cryptoRandomInt(700);

    setTimeout(() => {
      if (state.handOver || !session.active || session.paused) return;

      const ctx = buildBotContext(bot, idx);
      const decision = Bots.decide(ctx);
      const toCall = Math.max(0, state.currentBet - bot.committedThisStreet);

      let engineAction = botDecisionToEngineAction(decision);

      if (engineAction.type === 'check' && toCall > 0) {
        engineAction = { type: 'fold', amount: 0 };
      }

      if (engineAction.type === 'raise') {
        const minTarget = state.currentBet + state.minRaise;
        const maxTarget = bot.committedThisStreet + bot.stack;
        let target = engineAction.amount;
        if (target < minTarget) target = minTarget;
        if (target > maxTarget) target = maxTarget;
        if (target <= state.currentBet) {
          engineAction = toCall > 0
            ? { type: 'call', amount: toCall }
            : { type: 'check', amount: 0 };
        } else {
          engineAction.amount = target;
        }
      }

      const res = Engine.applyAction(state, idx, engineAction);
      if (!res.ok) {
        const fallback = toCall > 0 ? { type: 'fold' } : { type: 'check' };
        Engine.applyAction(state, idx, fallback);
      }

      UI.updateSeats(state);
      UI.updatePot(state);
      UI.updateActiveHighlight(state);

      advanceOrFinish();
    }, delay);
  }

  function buildBotContext(bot, idx) {
    const state = session.state;
    const toCall = Math.max(0, state.currentBet - bot.committedThisStreet);
    const raiser = state.lastAggressorIndex !== null ? state.players[state.lastAggressorIndex] : null;

    let facingRaise;
    if (state.street === 'preflop') {
      facingRaise = state.currentBet > state.blinds.bb;
    } else {
      facingRaise = state.currentBet > 0;
    }

    const facing3Bet = state.street === 'preflop' && state.currentBet > state.blinds.bb * 3;

    const facingAllin = state.players.some(p =>
      p !== bot && !p.folded && p.allIn && p.committedThisStreet >= state.currentBet
    );

    return {
      card1: bot.holeCards[0],
      card2: bot.holeCards[1],
      board: state.board,
      street: state.street,
      pot: state.pot,
      toCall: toCall,
      minRaise: state.minRaise,
      myStack: bot.stack,
      bb: state.blinds.bb,
      position: bot.position,
      numActive: state.players.filter(p => !p.folded && !p.eliminated).length,
      facingRaise: facingRaise,
      facing3Bet: facing3Bet,
      facingAllin: facingAllin,
      raiserPosition: raiser ? raiser.position : null,
      strategy: bot.strategy
    };
  }

  function advanceOrFinish() {
    const state = session.state;
    if (session.paused) return;

    if (state.handOver) { finishHand(); return; }

    if (Engine.isBettingRoundComplete(state)) {
      const res = Engine.endBettingRound(state);
      UI.updateBoard(state);
      UI.updatePot(state);
      if (res.done) { finishHand(); return; }
      UI.updateSeats(state);
      UI.updateActiveHighlight(state);
      processTurn();
      return;
    }

    const next = Engine.nextActor(state);
    if (next < 0) {
      const res = Engine.endBettingRound(state);
      UI.updateBoard(state);
      UI.updatePot(state);
      if (res.done) { finishHand(); return; }
      UI.updateSeats(state);
      processTurn();
      return;
    }

    state.actingIndex = next;
    processTurn();
  }

  function finishHand() {
    const state = session.state;

    UI.updateSeats(state);
    UI.updateBoard(state);
    UI.updatePot(state);
    UI.updateActiveHighlight(state);
    UI.hideActions();

    const hero = state.players[session.heroIndex];
    const heroWon = didHeroWin(state, hero);

    const predictedWin = session.heroEntered;
    const actualWin = heroWon;
    const isHit = predictedWin === actualWin;

    if (isHit) session.stats.hit++;
    else session.stats.miss++;
    session.stats.hands++;
    UI.updateStats(session.stats);

    if (predictedWin && actualWin)       UI.showFeedback(true,  'Совпало (вошёл и выиграл)');
    else if (predictedWin && !actualWin) UI.showFeedback(false, 'Не совпало (вошёл и проиграл)');
    else if (!predictedWin && actualWin) UI.showFeedback(false, 'Не совпало (пропустил победу)');
    else                                 UI.showFeedback(true,  'Совпало (правильно сфолдил)');

    UI.updateStacks(state);
    checkEliminations();

    setTimeout(() => {
      if (!session.active || session.paused) return;

      if (UI.settings.blindGrowth === 'hands') {
        state.handsAtLevel++;
        if (state.handsAtLevel >= 10) {
          state.handsAtLevel = 0;
          state.levelIndex = Math.min(state.levelIndex + 1, Engine.BLIND_LEVELS.length - 1);
        }
      }

      const heroP = state.players[session.heroIndex];
      if (heroP.eliminated || heroP.stack <= 0) { endSession('Герой вылетел'); return; }
      const alive = state.players.filter(p => !p.eliminated);
      if (alive.length <= 1) { endSession('Турнир выигран!'); return; }

      startHand();
    }, 3000);
  }

  function didHeroWin(state, hero) {
    if (!state.showdownResults) return false;
    return ((state.showdownResults.payouts || {})[hero.id] || 0) > 0;
  }

  function checkEliminations() {
    const state = session.state;
    for (const p of state.players) {
      if (!p.eliminated && p.stack <= 0) { p.eliminated = true; p.folded = true; }
    }
    UI.updateSeats(state);
  }

  function endSession(title) {
    session.active = false;
    stopBlindTimer();
    UI.stopTimer();
    UI.hideActions();

    const alive = session.state.players.filter(p => !p.eliminated).length;
    const heroAlive = !session.state.players[session.heroIndex].eliminated;
    session.stats.place = heroAlive ? alive : (alive + 1);

    UI.updateStats(session.stats);
    UI.openSessionEnd(title, session.stats);

    el.btnPause.classList.add('hidden');
    el.btnStop.classList.add('hidden');
  }

  function restartBlindTimer() {
    stopBlindTimer();
    if (UI.settings.blindGrowth !== 'time') return;
    session.blindTimerId = setInterval(() => {
      if (!session.active || session.paused) return;
      const state = session.state;
      state.levelIndex = Math.min(state.levelIndex + 1, Engine.BLIND_LEVELS.length - 1);
      state.handsAtLevel = 0;
      UI.updateLevel(state);
    }, 5 * 60 * 1000);
  }

  function stopBlindTimer() {
    if (session.blindTimerId) { clearInterval(session.blindTimerId); session.blindTimerId = null; }
  }

})();
