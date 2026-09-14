/* ============================================================
   POKER INTUITION TRAINER — UI
   Отрисовка стола, карт, мест, панели действий, модалок.
   Зависит от Engine (глобальный).
   ============================================================ */

const UI = (() => {

  /* ==========================================================
     1. НАСТРОЙКИ ОТОБРАЖЕНИЯ (состояние UI)
     ========================================================== */

  const settings = {
    cardStyle: '4color',        // '4color' | '2color'
    stackDisplay: 'chips',      // 'chips' | 'bb'
    blindGrowth: 'hands',       // 'hands' | 'time'
    turnTime: 0,                // 0 = без времени, 10 или 20 секунд
    showStrategies: false
  };

  // Кэш DOM-узлов
  const el = {};

  // Позиции 9 мест вокруг овала (в процентах от контейнера)
  // 0 — герой снизу по центру. Дальше против часовой стрелки (как в реальном покере).
  const SEAT_POSITIONS = [
    { x: 50, y: 92 },   // 0 — Hero (снизу)
    { x: 14, y: 80 },   // 1 — слева-снизу
    { x: 5,  y: 55 },   // 2 — слева
    { x: 14, y: 25 },   // 3 — слева-сверху
    { x: 35, y: 10 },   // 4 — сверху-слева
    { x: 65, y: 10 },   // 5 — сверху-справа
    { x: 86, y: 25 },   // 6 — справа-сверху
    { x: 95, y: 55 },   // 7 — справа
    { x: 86, y: 80 }    // 8 — справа-снизу
  ];

  // Маппинг масти → CSS-класс
  const SUIT_CLASS = {
    s: 'suit-spades',
    h: 'suit-hearts',
    d: 'suit-diamonds',
    c: 'suit-clubs'
  };

  // Маппинг масти → символ
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };

  // Маппинг ранга → отображение
  const RANK_DISPLAY = { T: '10' };

  /* ==========================================================
     2. ИНИЦИАЛИЗАЦИЯ
     ========================================================== */

  function init() {
    el.app           = document.getElementById('app');
    el.tableWrap     = document.getElementById('table-wrap');
    el.pokerTable    = document.getElementById('poker-table');
    el.seats         = document.getElementById('seats');
    el.boardCards    = document.getElementById('board-cards');
    el.potDisplay    = document.getElementById('pot-display');
    el.heroCards     = document.getElementById('hero-cards');

    el.levelNum      = document.getElementById('level-num');
    el.blindsDisplay = document.getElementById('blinds-display');
    el.anteDisplay   = document.getElementById('ante-display');

    el.statAccuracy  = document.getElementById('stat-accuracy');
    el.statHit       = document.getElementById('stat-hit');
    el.statMiss      = document.getElementById('stat-miss');
    el.statHands     = document.getElementById('stat-hands');
    el.statPlace     = document.getElementById('stat-place');

    el.btnFold       = document.getElementById('btn-fold');
    el.btnCheck      = document.getElementById('btn-check');
    el.btnCall       = document.getElementById('btn-call');
    el.btnRaise      = document.getElementById('btn-raise');
    el.btnAllin      = document.getElementById('btn-allin');

    el.raiseWrap     = document.getElementById('raise-slider-wrap');
    el.raiseSlider   = document.getElementById('raise-slider');
    el.raiseAmount   = document.getElementById('raise-amount');

    el.feedback      = document.getElementById('feedback-banner');
    el.timerBar      = document.getElementById('timer-bar');
    el.timerFill     = document.getElementById('timer-fill');

    el.btnSettings   = document.getElementById('btn-settings');
    el.btnNewSession = document.getElementById('btn-new-session');
    el.settingsModal = document.getElementById('settings-modal');
    el.settingsClose = document.getElementById('settings-close');

    el.setCardStyle      = document.getElementById('set-card-style');
    el.setStackDisplay   = document.getElementById('set-stack-display');
    el.setBlindGrowth    = document.getElementById('set-blind-growth');
    el.setTurnTime       = document.getElementById('set-turn-time');
    el.setShowStrategies = document.getElementById('set-show-strategies');

    el.sessionEndModal = document.getElementById('session-end-modal');
    el.sessionEndTitle = document.getElementById('session-end-title');
    el.sessionEndStats = document.getElementById('session-end-stats');
    el.sessionEndNew   = document.getElementById('session-end-new');

    applyCardStyle();
  }

  /* ==========================================================
     3. ОТРИСОВКА СТОЛА (полная перерисовка)
     ========================================================== */

  // Вызывается при старте сессии и при смене состава игроков
  function renderTable(state) {
    el.seats.innerHTML = '';

    for (const p of state.players) {
      const seat = createSeatElement(p);
      el.seats.appendChild(seat);
    }

    updateStacks(state);
    updatePot(state);
    updateLevel(state);
    updateDealerButton(state);
  }

  function createSeatElement(player) {
    const pos = SEAT_POSITIONS[player.seatIndex] || { x: 50, y: 50 };

    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.id = `seat-${player.id}`;
    seat.style.left = pos.x + '%';
    seat.style.top  = pos.y + '%';

    if (player.isHero) seat.classList.add('hero');
    if (player.eliminated) seat.classList.add('folded');

    seat.innerHTML = `
      <div class="pos-badge hidden" data-role="pos"></div>
      <div class="strat-badge hidden" data-role="strat"></div>
      <div class="name" data-role="name"></div>
      <div class="stack" data-role="stack"></div>
      <div class="seat-cards" data-role="cards"></div>
      <div class="bet-chips hidden" data-role="bet"></div>
    `;

    return seat;
  }

  /* ==========================================================
     4. ОБНОВЛЕНИЕ МЕСТ ИГРОКОВ
     ========================================================== */

  function updateSeats(state) {
    for (const p of state.players) {
      const seat = document.getElementById(`seat-${p.id}`);
      if (!seat) continue;

      // Имя
      seat.querySelector('[data-role="name"]').textContent = p.name;

      // Класс фолда / вылета
      seat.classList.toggle('folded', p.folded || p.eliminated);

      // Позиция (BTN/SB/BB/UTG…)
      const posBadge = seat.querySelector('[data-role="pos"]');
      if (p.position && !p.eliminated) {
        posBadge.textContent = p.position;
        posBadge.classList.remove('hidden');
      } else {
        posBadge.classList.add('hidden');
      }

      // Стратегия бота
      const stratBadge = seat.querySelector('[data-role="strat"]');
      if (settings.showStrategies && p.strategy && !p.isHero) {
        stratBadge.textContent = p.strategy;
        stratBadge.classList.remove('hidden');
      } else {
        stratBadge.classList.add('hidden');
      }

      // Карты: у героя — всегда, у ботов — только на вскрытии
      renderSeatCards(p, state);

      // Ставка на улице
      const betEl = seat.querySelector('[data-role="bet"]');
      if (p.committedThisStreet > 0 && !p.folded && !p.eliminated) {
        betEl.textContent = formatChips(p.committedThisStreet, state);
        betEl.classList.remove('hidden');
      } else {
        betEl.classList.add('hidden');
      }
    }

    updateStacks(state);
    updateActiveHighlight(state);
  }

  function renderSeatCards(player, state) {
    const seat = document.getElementById(`seat-${player.id}`);
    if (!seat) return;
    const cardsEl = seat.querySelector('[data-role="cards"]');
    cardsEl.innerHTML = '';

    if (player.eliminated) return;

    // На вскрытии показываем карты всем не сфолдившим
    const revealAll = state.handOver && !player.folded;

    if (player.isHero || revealAll) {
      for (const c of player.holeCards) {
        cardsEl.appendChild(createCardElement(c, false));
      }
    } else if (!player.folded && player.holeCards.length > 0) {
      // Рубашкой вверх
      for (let i = 0; i < player.holeCards.length; i++) {
        cardsEl.appendChild(createCardBack());
      }
    }
  }

  function updateStacks(state) {
    for (const p of state.players) {
      const seat = document.getElementById(`seat-${p.id}`);
      if (!seat) continue;
      const stackEl = seat.querySelector('[data-role="stack"]');
      stackEl.textContent = formatChips(p.stack, state);
    }
  }

  function updateActiveHighlight(state) {
    for (const p of state.players) {
      const seat = document.getElementById(`seat-${p.id}`);
      if (!seat) continue;
      const isActing = state.actingIndex === p.seatIndex && !state.handOver && !p.folded;
      seat.classList.toggle('active', isActing);
    }
  }

  /* ==========================================================
     5. ДИЛЕРСКАЯ КНОПКА (BTN)
     ========================================================== */

  function updateDealerButton(state) {
    // Кнопка дилера отображается через pos-badge = 'BTN'
    // Отдельный визуальный чип пока не нужен, но можно добавить позже.
  }

  /* ==========================================================
     6. БОРД, БАНК, УРОВЕНЬ
     ========================================================== */

  function updateBoard(state) {
    el.boardCards.innerHTML = '';
    for (const c of state.board) {
      el.boardCards.appendChild(createCardElement(c, false));
    }
  }

  function updatePot(state) {
    el.potDisplay.textContent = 'Банк: ' + formatChips(state.pot, state);
  }

  function updateLevel(state) {
    const b = state.blinds || Engine.getBlindLevel(state.levelIndex);
    el.levelNum.textContent = state.levelIndex;
    el.blindsDisplay.textContent = `${b.sb}/${b.bb}`;
    el.anteDisplay.textContent = b.ante > 0 ? `· анте ${b.ante}` : '';
  }

  /* ==========================================================
     7. КАРТЫ
     ========================================================== */

  function createCardElement(card, isBack) {
    const c = document.createElement('div');
    c.className = 'card';

    if (isBack) {
      c.classList.add('back');
      return c;
    }

    const suitClass = SUIT_CLASS[card.suit] || '';
    const suitSym   = SUIT_SYMBOL[card.suit] || '?';
    const rankTxt   = RANK_DISPLAY[card.rank] || card.rank;

    c.classList.add(suitClass);
    c.innerHTML = `
      <div class="rank">${rankTxt}</div>
      <div class="suit">${suitSym}</div>
    `;
    return c;
  }

  function createCardBack() {
    const c = document.createElement('div');
    c.className = 'card back';
    return c;
  }

  function applyCardStyle() {
    document.body.classList.remove('style-4color', 'style-2color');
    document.body.classList.add('style-' + settings.cardStyle);
  }

  /* ==========================================================
     8. ФОРМАТИРОВАНИЕ ФИШЕК
     ========================================================== */

  function formatChips(amount, state) {
    if (settings.stackDisplay === 'bb') {
      const bb = (state.blinds && state.blinds.bb) || Engine.getBlindLevel(state.levelIndex).bb;
      const bbVal = amount / bb;
      return bbVal.toFixed(bbVal >= 10 ? 0 : 1) + ' BB';
    }
    return amount.toLocaleString('ru-RU');
  }

  /* ==========================================================
     9. ПАНЕЛЬ ДЕЙСТВИЙ
     ========================================================== */

  // Показывает доступные действия для героя.
  // heroIndex — индекс героя в state.players, toCall — сколько нужно доложить.
  // Возвращает объект с коллбэками (их установит main.js).
  function updateActions(state, heroIndex, handlers) {
    const hero = state.players[heroIndex];
    const toCall = Math.max(0, state.currentBet - hero.committedThisStreet);
    const canCheck = toCall === 0;
    const canCall  = toCall > 0 && toCall < hero.stack;
    const canRaise = hero.stack > toCall; // есть чем рейзить

    // Fold: всегда доступен, если есть что фолдить
    el.btnFold.disabled = false;

    // Check
    el.btnCheck.classList.toggle('hidden', !canCheck);
    el.btnCheck.disabled = !canCheck;

    // Call
    el.btnCall.classList.toggle('hidden', canCheck);
    el.btnCall.disabled = !canCall;
    if (canCall) {
      el.btnCall.textContent = 'Колл ' + formatChips(toCall, state);
    }

    // Raise
    el.btnRaise.disabled = !canRaise;

    // All-in
    el.btnAllin.disabled = hero.stack <= 0;

    // Слайдер рейза
    if (canRaise) {
      setupRaiseSlider(state, hero, toCall);
      el.raiseWrap.classList.remove('hidden');
    } else {
      el.raiseWrap.classList.add('hidden');
    }

    // Обработчики (переназначаем каждый раз, чтобы не плодить слушателей)
    bindActionHandlers(state, heroIndex, toCall, handlers);
  }

  function setupRaiseSlider(state, hero, toCall) {
    const minTarget = state.currentBet + state.minRaise;   // минимальный рейз
    const maxTarget = hero.committedThisStreet + hero.stack; // олл-ин

    // Ограничим minTarget, если стек меньше
    const realMin = Math.min(minTarget, maxTarget);
    const realMax = maxTarget;

    el.raiseSlider.min   = realMin;
    el.raiseSlider.max   = realMax;
    el.raiseSlider.step  = state.blinds.bb >= 100 ? 10 : 1;
    el.raiseSlider.value = realMin;

    updateRaiseDisplay(state);
  }

  function updateRaiseDisplay(state) {
    const val = Number(el.raiseSlider.value);
    el.raiseAmount.textContent = formatChips(val, state);
  }

  function bindActionHandlers(state, heroIndex, toCall, handlers) {
    // Клонируем кнопки, чтобы снять старые слушатели
    rebind(el.btnFold,  () => handlers.onFold());
    rebind(el.btnCheck, () => handlers.onCheck());
    rebind(el.btnCall,  () => handlers.onCall());

    rebind(el.btnRaise, () => {
      const val = Number(el.raiseSlider.value);
      handlers.onRaise(val);
    });

    rebind(el.btnAllin, () => handlers.onAllIn());

    // Слайдер
    el.raiseSlider.oninput = () => updateRaiseDisplay(state);

    // Быстрые кнопки
    const quickBtns = el.raiseWrap.querySelectorAll('.quick-btns button');
    quickBtns.forEach(btn => {
      btn.onclick = () => {
        const hero = state.players[heroIndex];
        const potAfterCall = state.pot + Math.min(toCall, hero.stack);
        const maxTarget = hero.committedThisStreet + hero.stack;

        if (btn.dataset.action === 'allin') {
          el.raiseSlider.value = maxTarget;
        } else {
          const mult = parseFloat(btn.dataset.mult);
          const raiseBy = Math.round(potAfterCall * mult);
          const target = Math.min(maxTarget, state.currentBet + raiseBy);
          el.raiseSlider.value = Math.max(Number(el.raiseSlider.min), target);
        }
        updateRaiseDisplay(state);
      };
    });
  }

  // Пересоздаёт DOM-узел, чтобы сбросить все on-обработчики
  function rebind(node, fn) {
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    clone.addEventListener('click', fn);
    // Обновляем кэш
    if (node.id === 'btn-fold')  el.btnFold  = clone;
    if (node.id === 'btn-check') el.btnCheck = clone;
    if (node.id === 'btn-call')  el.btnCall  = clone;
    if (node.id === 'btn-raise') el.btnRaise = clone;
    if (node.id === 'btn-allin') el.btnAllin = clone;
  }

  // Скрыть панель действий (например, когда ходят боты)
  function hideActions() {
    el.btnFold.disabled  = true;
    el.btnCheck.disabled = true;
    el.btnCall.disabled  = true;
    el.btnRaise.disabled = true;
    el.btnAllin.disabled = true;
    el.raiseWrap.classList.add('hidden');
  }

  // Показать карманные карты героя в нижней панели
  function renderHeroCards(hero) {
    el.heroCards.innerHTML = '';
    if (!hero || !hero.holeCards) return;
    for (const c of hero.holeCards) {
      el.heroCards.appendChild(createCardElement(c, false));
    }
  }

  /* ==========================================================
     10. ОБРАТНАЯ СВЯЗЬ (СОВПАЛО / НЕ СОВПАЛО)
     ========================================================== */

  function showFeedback(isHit, text) {
    el.feedback.textContent = (isHit ? '✅ ' : '❌ ') + text;
    el.feedback.classList.remove('hidden', 'hit', 'miss');
    el.feedback.classList.add(isHit ? 'hit' : 'miss');

    // Скрыть через 2.5 сек
    clearTimeout(el._fbTimer);
    el._fbTimer = setTimeout(() => {
      el.feedback.classList.add('hidden');
    }, 2500);
  }

  /* ==========================================================
     11. СТАТИСТИКА
     ========================================================== */

  function updateStats(stats) {
    el.statHit.textContent  = stats.hit;
    el.statMiss.textContent = stats.miss;
    el.statHands.textContent = stats.hands;

    if (stats.hands > 0) {
      const acc = Math.round(stats.hit / (stats.hit + stats.miss) * 100);
      el.statAccuracy.textContent = (isNaN(acc) ? 0 : acc) + '%';
    } else {
      el.statAccuracy.textContent = '—';
    }

    el.statPlace.textContent = stats.place ? `${stats.place}/9` : '—';
  }

  /* ==========================================================
     12. ТАЙМЕР
     ========================================================== */

  function startTimer(seconds, onExpire) {
    if (!seconds || seconds <= 0) {
      el.timerBar.classList.add('hidden');
      return;
    }
    el.timerBar.classList.remove('hidden');
    el.timerFill.style.width = '100%';

    const startTime = performance.now();
    const totalMs = seconds * 1000;

    cancelAnimationFrame(el._timerRaf);

    function tick(now) {
      const elapsed = now - startTime;
      const remain = Math.max(0, totalMs - elapsed);
      el.timerFill.style.width = (remain / totalMs * 100) + '%';
      if (remain <= 0) {
        onExpire();
        return;
      }
      el._timerRaf = requestAnimationFrame(tick);
    }
    el._timerRaf = requestAnimationFrame(tick);
  }

  function stopTimer() {
    cancelAnimationFrame(el._timerRaf);
    el.timerBar.classList.add('hidden');
  }

  /* ==========================================================
     13. МОДАЛКИ
     ========================================================== */

  function openSettings() {
    el.setCardStyle.value      = settings.cardStyle;
    el.setStackDisplay.value   = settings.stackDisplay;
    el.setBlindGrowth.value    = settings.blindGrowth;
    el.setTurnTime.value       = String(settings.turnTime);
    el.setShowStrategies.checked = settings.showStrategies;
    el.settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    settings.cardStyle      = el.setCardStyle.value;
    settings.stackDisplay   = el.setStackDisplay.value;
    settings.blindGrowth    = el.setBlindGrowth.value;
    settings.turnTime       = Number(el.setTurnTime.value);
    settings.showStrategies = el.setShowStrategies.checked;

    applyCardStyle();
    el.settingsModal.classList.add('hidden');

    // Сообщаем main.js, что настройки изменились
    if (settings.onChange) settings.onChange(settings);
  }

  function openSessionEnd(title, stats) {
    el.sessionEndTitle.textContent = title;
    el.sessionEndStats.innerHTML = `
      <div>Раздач: <b>${stats.hands}</b></div>
      <div>✅ Совпало: <b>${stats.hit}</b></div>
      <div>❌ Не совпало: <b>${stats.miss}</b></div>
      <div>Точность: <b>${stats.hands ? Math.round(stats.hit / (stats.hit + stats.miss) * 100) : 0}%</b></div>
      <div>Место: <b>${stats.place || '—'}/9</b></div>
    `;
    el.sessionEndModal.classList.remove('hidden');
  }

  function closeSessionEnd() {
    el.sessionEndModal.classList.add('hidden');
  }

  /* ==========================================================
     14. ЭКСПОРТ
     ========================================================== */

  return {
    settings,
    init,
    renderTable,
    updateSeats,
    updateBoard,
    updatePot,
    updateLevel,
    updateStacks,
    updateActiveHighlight,
    updateActions,
    hideActions,
    renderHeroCards,
    showFeedback,
    updateStats,
    startTimer,
    stopTimer,
    openSettings,
    closeSettings,
    openSessionEnd,
    closeSessionEnd,
    createCardElement,
    formatChips,
    // DOM-узлы (main.js иногда нужно вешать слушатели)
    el
  };

})();

window.UI = UI;