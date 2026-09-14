/* ============================================================
   POKER INTUITION TRAINER — MAIN
   Связывает Engine + Bots + UI. Запускает сессию и раздачи.
   ============================================================ */

(() => {

  /* ==========================================================
     1. СОСТОЯНИЕ СЕССИИ
     ========================================================== */

  const session = {
    state: null,             // состояние движка
    heroIndex: 0,            // индекс героя в state.players
    stats: {
      hands: 0,
      hit: 0,
      miss: 0,
      place: null
    },
    // Ожидание действия героя
    waitingForHero: false,
    // Флаг, что сессия активна
    active: false,
    // "Предсказание" героя на текущую раздачу (для обратной связи)
    // true = герой вошёл в раздачу, false = не вошёл
    heroEntered: false,
    // Таймер блайндов (если режим 'time')
    blindTimerId: null,
    // Таймер хода героя
    turnTimerId: null
  };

  // Быстрый доступ к DOM
  const el = {};

  /* ==========================================================
     2. ТОЧКА ВХОДА
     ========================================================== */

  window.addEventListener('DOMContentLoaded', () => {
    UI.init();
    cacheDom();
    bindGlobalHandlers();

    // Сообщаем UI, что делать при изменении настроек
    UI.settings.onChange = (s) => {
      // Перерисовать стеки/карты с учётом нового формата
      if (session.state) {
        UI.updateSeats(session.state);
        UI.updatePot(session.state);
        UI.updateBoard(session.state);
      }
      // Перезапустить таймер блайндов, если он в режиме 'time'
      restartBlindTimer();
    };

    startNewSession();
  });

  function cacheDom() {
    el.btnSettings   = document.getElementById('btn-settings');
    el.btnNewSession = document.getElementById('btn-new-session');
    el.settingsClose = document.getElementById('settings-close');
    el.sessionEndNew = document.getElementById('session-end-new');
    el.settingsModal = document.getElementById('settings-modal');
    el.sessionEndModal = document.getElementById('session-end-modal');
  }

  function bindGlobalHandlers() {
    el.btnSettings.addEventListener('click', () => UI.openSettings());
    el.settingsClose.addEventListener('click', () => UI.closeSettings());
    el.btnNewSession.addEventListener('click', () => {
      if (confirm('Начать новую сессию? Текущий прогресс будет потерян.')) {
        startNewSession();
      }
    });
    el.sessionEndNew.addEventListener('click', () => {
      UI.closeSessionEnd();
      startNewSession();
    });
  }

  /* ==========================================================
     3. СТАРТ СЕССИИ
     ========================================================== */

  function startNewSession() {
    stopBlindTimer();
    session.active = true;
    session.stats = { hands: 0, hit: 0, miss: 0, place: null };
    session.waitingForHero = false;

    // Создаём 9 игроков: герой (seat 0) + 8 ботов
    const botStrategies = Bots.assignStrategies(8);

    const players = [];
    players.push({
      id: 'hero',
      name: 'Ты',
      isHero: true,
      strategy: null,
      stack: Engine.STARTING_STACK
    });

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
    session.state.buttonIndex = 8; // герой стартует с BTN? Нет: следующий startHand сдвинет BTN на 0

    UI.renderTable(session.state);
    UI.updateStats(session.stats);

    // Запускаем таймер блайндов, если режим 'time'
    restartBlindTimer();

    // Первая раздача
    startHand();
  }

  /* ==========================================================
     4. СТАРТ РАЗДАЧИ
     ========================================================== */

  function startHand() {
    if (!session.active) return;

    // Проверка: герой жив?
    const hero = session.state.players[session.heroIndex];
    if (hero.eliminated || hero.stack <= 0) {
      endSession('Герой вылетел');
      return;
    }

    // Проверка: остались ли другие игроки?
    const alive = session.state.players.filter(p => !p.eliminated);
    if (alive.length <= 1) {
      endSession('Турнир выигран!');
      return;
    }

    // Новая раздача
    Engine.startHand(session.state);
    session.heroEntered = false;

    // Обновляем UI
    UI.renderTable(session.state);   // перерисовываем полностью (BTN сменился)
    UI.updateBoard(session.state);
    UI.updatePot(session.state);
    UI.updateSeats(session.state);
    UI.updateLevel(session.state);
    UI.renderHeroCards(session.state.players[session.heroIndex]);

    // Переходим к обработке ходов
    processTurn();
  }

  /* ==========================================================
     5. ЦИКЛ ХОДОВ
     ========================================================== */

  function processTurn() {
    const state = session.state;

    // Раздача завершена?
    if (state.handOver) {
      finishHand();
      return;
    }

    // Кто должен действовать?
    const idx = state.actingIndex;
    const player = state.players[idx];

    if (!player || player.folded || player.eliminated || player.allIn) {
      // Никто не может действовать — двигаем улицу
      advanceOrFinish();
      return;
    }

    UI.updateActiveHighlight(state);

    if (player.isHero) {
      // Ход героя
      session.waitingForHero = true;
      heroTurn(player);
    } else {
      // Ход бота
      session.waitingForHero = false;
      UI.hideActions();
      botTurn(player, idx);
    }
  }

  /* ==========================================================
     6. ХОД ГЕРОЯ
     ========================================================== */

  function heroTurn(hero) {
    const state = session.state;
    const toCall = Math.max(0, state.currentBet - hero.committedThisStreet);

    // Показываем кнопки
    UI.updateActions(state, session.heroIndex, {
      onFold:  () => heroAct({ type: 'fold' }),
      onCheck: () => heroAct({ type: 'check' }),
      onCall:  () => heroAct({ type: 'call' }),
      onRaise: (amount) => heroAct({ type: 'raise', amount }),
      onAllIn: () => heroAct({ type: 'allin' })
    });

    // Таймер хода
    UI.stopTimer();
    if (UI.settings.turnTime > 0) {
      UI.startTimer(UI.settings.turnTime, () => {
        // Время вышло: авто-фолд или авто-чек
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

    // Фиксируем «вошёл ли герой в раздачу»
    if (action.type !== 'fold' && action.type !== 'check') {
      session.heroEntered = true;
    }
    if (action.type === 'call' || action.type === 'raise' || action.type === 'allin') {
      session.heroEntered = true;
    }
    if (action.type === 'fold') {
      session.heroEntered = false;
    }

    const res = Engine.applyAction(state, session.heroIndex, action);
    if (!res.ok) {
      console.warn('Неверное действие героя:', res.error);
      // Возвращаем панель
      session.waitingForHero = true;
      heroTurn(hero);
      return;
    }

    UI.updateSeats(state);
    UI.updatePot(state);

    advanceOrFinish();
  }

  /* ==========================================================
     7. ХОД БОТА
     ========================================================== */

  function botTurn(bot, idx) {
    const state = session.state;

    // Небольшая задержка для визуализации
    const delay = 400 + Engine.cryptoRandomInt(500);

    setTimeout(() => {
      if (state.handOver || !session.active) return;

      const ctx = buildBotContext(bot, idx);
      const decision = Bots.decide(ctx);

      // Проверка на валидность: если фолд при toCall=0 — заменяем на чек
      let action = decision;
      const toCall = Math.max(0, state.currentBet - bot.committedThisStreet);
      if (action.action === 'check' && toCall > 0) {
        action = { action: 'fold', amount: 0 };
      }
      if (action.action === 'raise') {
        const minTarget = state.currentBet + state.minRaise;
        const maxTarget = bot.committedThisStreet + bot.stack;
        if (action.amount < minTarget) action.amount = minTarget;
        if (action.amount > maxTarget) action.amount = maxTarget;
        if (action.amount <= state.currentBet) {
          // Нечего рейзить — колл
          action = toCall > 0 ? { action: 'call', amount: toCall } : { action: 'check', amount: 0 };
        }
      }

      const res = Engine.applyAction(state, idx, action);
      if (!res.ok) {
        // Запасной вариант: фолд или чек
        const fallback = toCall > 0 ? { type: 'fold' } : { type: 'check' };
        Engine.applyAction(state, idx, fallback);
      }

      UI.updateSeats(state);
      UI.updatePot(state);
      UI.updateActiveHighlight(state);

      advanceOrFinish();
    }, delay);
  }

  // Собирает контекст для Bots.decide
  function buildBotContext(bot, idx) {
    const state = session.state;
    const toCall = Math.max(0, state.currentBet - bot.committedThisStreet);
    const raiser = state.lastAggressorIndex !== null
      ? state.players[state.lastAggressorIndex]
      : null;

    // Есть ли рейз перед ботом?
    const facingRaise = state.currentBet > state.blinds.bb ||
                        (state.street === 'preflop' && state.currentBet > state.blinds.bb);

    // Есть ли 3-бет?
    const facing3Bet = state.street === 'preflop' &&
                       state.currentBet > state.blinds.bb * 3;

    // Олл-ин перед ботом?
    const facingAllin = state.players.some(p =>
      p !== bot && !p.folded && p.allIn && p.committedThisStreet > state.currentBet - 1
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

  /* ==========================================================
     8. ПРОДВИЖЕНИЕ ИГРЫ
     ========================================================== */

  function advanceOrFinish() {
    const state = session.state;

    // Раздача завершена (все сфолдили или вскрытие)?
    if (state.handOver) {
      finishHand();
      return;
    }

    // Раунд ставок завершён?
    if (Engine.isBettingRoundComplete(state)) {
      // Переход на следующую улицу
      const res = Engine.endBettingRound(state);
      UI.updateBoard(state);
      UI.updatePot(state);

      if (res.done) {
        finishHand();
        return;
      }

      // Новая улица: перерисовываем, начинаем с первого игрока
      UI.updateSeats(state);
      UI.updateActiveHighlight(state);
      processTurn();
      return;
    }

    // Ищем следующего активного игрока
    const next = Engine.nextActor(state);
    if (next < 0) {
      // Никого — двигаем улицу
      const res = Engine.endBettingRound(state);
      UI.updateBoard(state);
      UI.updatePot(state);
      if (res.done) {
        finishHand();
        return;
      }
      UI.updateSeats(state);
      processTurn();
      return;
    }

    state.actingIndex = next;
    processTurn();
  }

  /* ==========================================================
     9. ЗАВЕРШЕНИЕ РАЗДАЧИ
     ========================================================== */

  function finishHand() {
    const state = session.state;

    // Обновляем UI: показываем все карты, доску, победителя
    UI.updateSeats(state);
    UI.updateBoard(state);
    UI.updatePot(state);
    UI.updateActiveHighlight(state);
    UI.hideActions();

    // Определяем, выиграл ли герой на вскрытии
    const hero = state.players[session.heroIndex];
    const heroWon = didHeroWin(state, hero);

    // Обратная связь: совпало / не совпало
    // Логика:
    //  Вошёл → выиграл: ✅
    //  Вошёл → проиграл: ❌
    //  Не вошёл → выиграл бы: ❌ (пропустил)
    //  Не вошёл → проиграл бы: ✅
    const predictedWin = session.heroEntered;
    const actualWin = heroWon;
    const isHit = predictedWin === actualWin;

    if (isHit) session.stats.hit++;
    else session.stats.miss++;
    session.stats.hands++;

    UI.updateStats(session.stats);

    // Показываем баннер
    if (predictedWin && actualWin)       UI.showFeedback(true,  'Совпало (вошёл и выиграл)');
    else if (predictedWin && !actualWin) UI.showFeedback(false, 'Не совпало (вошёл и проиграл)');
    else if (!predictedWin && actualWin) UI.showFeedback(false, 'Не совпало (пропустил победу)');
    else                                 UI.showFeedback(true,  'Совпало (правильно сфолдил)');

    // Обновляем стеки (движок уже начислил выигрыши)
    UI.updateStacks(state);

    // Проверяем вылеты
    checkEliminations();

    // Следующая раздача через паузу
    setTimeout(() => {
      if (!session.active) return;

      // Обновляем уровень блайндов по количеству раздач
      if (UI.settings.blindGrowth === 'hands') {
        state.handsAtLevel++;
        if (state.handsAtLevel >= 10) {
          state.handsAtLevel = 0;
          state.levelIndex = Math.min(state.levelIndex + 1, Engine.BLIND_LEVELS.length - 1);
        }
      }

      // Проверяем условия конца сессии
      const heroP = state.players[session.heroIndex];
      if (heroP.eliminated || heroP.stack <= 0) {
        endSession('Герой вылетел');
        return;
      }
      const alive = state.players.filter(p => !p.eliminated);
      if (alive.length <= 1) {
        endSession('Турнир выигран!');
        return;
      }

      startHand();
    }, 3000);
  }

  function didHeroWin(state, hero) {
    if (!state.showdownResults) return false;
    const payouts = state.showdownResults.payouts || {};
    return (payouts[hero.id] || 0) > 0;
  }

  function checkEliminations() {
    const state = session.state;
    for (const p of state.players) {
      if (!p.eliminated && p.stack <= 0) {
        p.eliminated = true;
        p.folded = true;
      }
    }
    UI.updateSeats(state);
  }

  /* ==========================================================
     10. КОНЕЦ СЕССИИ
     ========================================================== */

  function endSession(title) {
    session.active = false;
    stopBlindTimer();
    UI.stopTimer();
    UI.hideActions();

    // Место героя: сколько игроков ещё живо + 1
    const alive = session.state.players.filter(p => !p.eliminated).length;
    const heroAlive = !session.state.players[session.heroIndex].eliminated;
    session.stats.place = heroAlive ? alive : (alive + 1);

    UI.updateStats(session.stats);
    UI.openSessionEnd(title, session.stats);
  }

  /* ==========================================================
     11. ТАЙМЕР БЛАЙНДОВ
     ========================================================== */

  function restartBlindTimer() {
    stopBlindTimer();
    if (UI.settings.blindGrowth !== 'time') return;

    // Каждые 5 минут повышаем уровень
    session.blindTimerId = setInterval(() => {
      if (!session.active) return;
      const state = session.state;
      state.levelIndex = Math.min(state.levelIndex + 1, Engine.BLIND_LEVELS.length - 1);
      state.handsAtLevel = 0;
      UI.updateLevel(state);
    }, 5 * 60 * 1000);
  }

  function stopBlindTimer() {
    if (session.blindTimerId) {
      clearInterval(session.blindTimerId);
      session.blindTimerId = null;
    }
  }

})();