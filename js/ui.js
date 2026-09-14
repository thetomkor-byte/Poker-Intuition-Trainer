/* ============================================================
   POKER INTUITION TRAINER — UI
   ============================================================ */

const UI = (() => {

  const settings = {
    cardStyle: '4color',
    stackDisplay: 'chips',
    blindGrowth: 'hands',
    turnTime: 0,
    showStrategies: false
  };

  const el = {};

  const SEAT_POSITIONS = [
    { x: 50, y: 92 },
    { x: 14, y: 80 },
    { x: 5,  y: 55 },
    { x: 14, y: 25 },
    { x: 35, y: 10 },
    { x: 65, y: 10 },
    { x: 86, y: 25 },
    { x: 95, y: 55 },
    { x: 86, y: 80 }
  ];

  const SUIT_CLASS = { s: 'suit-spades', h: 'suit-hearts', d: 'suit-diamonds', c: 'suit-clubs' };
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RANK_DISPLAY = { T: '10' };

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

  function renderTable(state) {
    el.seats.innerHTML = '';
    for (const p of state.players) el.seats.appendChild(createSeatElement(p));
    updateStacks(state);
    updatePot(state);
    updateLevel(state);
  }

  function createSeatElement(player) {
    const pos = SEAT_POSITIONS[player.seatIndex] || { x: 50, y: 50 };

    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.id = `seat-${player.id}`;
    seat.style.left = pos.x + '%';
    seat.style.top  = pos.y + '%';

    if (pos.y < 35) seat.classList.add('top');
    else if (pos.y > 65) seat.classList.add('bottom');
    else seat.classList.add('middle');

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

  function updateSeats(state) {
    for (const p of state.players) {
      const seat = document.getElementById(`seat-${p.id}`);
      if (!seat) continue;

      seat.querySelector('[data-role="name"]').textContent = p.name;
      seat.classList.toggle('folded', p.folded || p.eliminated);

      const posBadge = seat.querySelector('[data-role="pos"]');
      if (p.position && !p.eliminated) {
        posBadge.textContent = p.position;
        posBadge.classList.remove('hidden');
      } else posBadge.classList.add('hidden');

      const stratBadge = seat.querySelector('[data-role="strat"]');
      if (settings.showStrategies && p.strategy && !p.isHero) {
        stratBadge.textContent = p.strategy;
        stratBadge.classList.remove('hidden');
      } else stratBadge.classList.add('hidden');

      renderSeatCards(p, state);

      const betEl = seat.querySelector('[data-role="bet"]');
      if (p.committedThisStreet > 0 && !p.folded && !p.eliminated) {
        betEl.textContent = formatChips(p.committedThisStreet, state);
        betEl.classList.remove('hidden');
      } else betEl.classList.add('hidden');
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

    const revealAll = state.handOver && !player.folded;
    if (player.isHero || revealAll) {
      for (const c of player.holeCards) cardsEl.appendChild(createCardElement(c, false));
    } else if (!player.folded && player.holeCards.length > 0) {
      for (let i = 0; i < player.holeCards.length; i++) cardsEl.appendChild(createCardBack());
    }
  }

  function updateStacks(state) {
    for (const p of state.players) {
      const seat = document.getElementById(`seat-${p.id}`);
      if (!seat) continue;
      seat.querySelector('[data-role="stack"]').textContent = formatChips(p.stack, state);
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

  function updateBoard(state) {
    el.boardCards.innerHTML = '';
    for (const c of state.board) el.boardCards.appendChild(createCardElement(c, false));
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

  function createCardElement(card, isBack) {
    const c = document.createElement('div');
    c.className = 'card';
    if (isBack) { c.classList.add('back'); return c; }
    const suitClass = SUIT_CLASS[card.suit] || '';
    const suitSym   = SUIT_SYMBOL[card.suit] || '?';
    const rankTxt   = RANK_DISPLAY[card.rank] || card.rank;
    c.classList.add(suitClass);
    c.innerHTML = `<div class="rank">${rankTxt}</div><div class="suit">${suitSym}</div>`;
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

  function formatChips(amount, state) {
    if (settings.stackDisplay === 'bb') {
      const bb = (state.blinds && state.blinds.bb) || Engine.getBlindLevel(state.levelIndex).bb;
      const bbVal = amount / bb;
      return bbVal.toFixed(bbVal >= 10 ? 0 : 1) + ' BB';
    }
    return amount.toLocaleString('ru-RU');
  }

  function updateActions(state, heroIndex, handlers) {
    const hero = state.players[heroIndex];
    const toCall = Math.max(0, state.currentBet - hero.committedThisStreet);
    const canCheck = toCall === 0;
    const canCall  = toCall > 0 && toCall < hero.stack;
    const canRaise = hero.stack > toCall;

    el.btnFold.disabled = false;
    el.btnCheck.classList.toggle('hidden', !canCheck);
    el.btnCheck.disabled = !canCheck;
    el.btnCall.classList.toggle('hidden', canCheck);
    el.btnCall.disabled = !canCall;
    if (canCall) el.btnCall.textContent = 'Колл ' + formatChips(toCall, state);
    el.btnRaise.disabled = !canRaise;
    el.btnAllin.disabled = hero.stack <= 0;

    if (canRaise) { setupRaiseSlider(state, hero, toCall); el.raiseWrap.classList.remove('hidden'); }
    else el.raiseWrap.classList.add('hidden');

    bindActionHandlers(state, heroIndex, toCall, handlers);
  }

  function setupRaiseSlider(state, hero, toCall) {
    const minTarget = state.currentBet + state.minRaise;
    const maxTarget = hero.committedThisStreet + hero.stack;
    const realMin = Math.min(minTarget, maxTarget);
    const realMax = maxTarget;

    el.raiseSlider.min   = realMin;
    el.raiseSlider.max   = realMax;
    el.raiseSlider.step  = state.blinds.bb >= 100 ? 10 : 1;
    el.raiseSlider.value = realMin;
    updateRaiseDisplay(state);
  }

  function updateRaiseDisplay(state) {
    el.raiseAmount.textContent = formatChips(Number(el.raiseSlider.value), state);
  }

  function bindActionHandlers(state, heroIndex, toCall, handlers) {
    rebind(el.btnFold,  () => handlers.onFold());
    rebind(el.btnCheck, () => handlers.onCheck());
    rebind(el.btnCall,  () => handlers.onCall());
    rebind(el.btnRaise, () => handlers.onRaise(Number(el.raiseSlider.value)));
    rebind(el.btnAllin, () => handlers.onAllIn());

    el.raiseSlider.oninput = () => updateRaiseDisplay(state);

    const quickBtns = el.raiseWrap.querySelectorAll('.quick-btns button');
    quickBtns.forEach(btn => {
      btn.onclick = () => {
        const hero = state.players[heroIndex];
        const potAfterCall = state.pot + Math.min(toCall, hero.stack);
        const maxTarget = hero.committedThisStreet + hero.stack;
        if (btn.dataset.action === 'allin') el.raiseSlider.value = maxTarget;
        else {
          const mult = parseFloat(btn.dataset.mult);
          const raiseBy = Math.round(potAfterCall * mult);
          const target = Math.min(maxTarget, state.currentBet + raiseBy);
          el.raiseSlider.value = Math.max(Number(el.raiseSlider.min), target);
        }
        updateRaiseDisplay(state);
      };
    });
  }

  function rebind(node, fn) {
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    clone.addEventListener('click', fn);
    if (node.id === 'btn-fold')  el.btnFold  = clone;
    if (node.id === 'btn-check') el.btnCheck = clone;
    if (node.id === 'btn-call')  el.btnCall  = clone;
    if (node.id === 'btn-raise') el.btnRaise = clone;
    if (node.id === 'btn-allin') el.btnAllin = clone;
  }

  function hideActions() {
    el.btnFold.disabled  = true;
    el.btnCheck.disabled = true;
    el.btnCall.disabled  = true;
    el.btnRaise.disabled = true;
    el.btnAllin.disabled = true;
    el.raiseWrap.classList.add('hidden');
  }

  function renderHeroCards(hero) {
    el.heroCards.innerHTML = '';
    if (!hero || !hero.holeCards) return;
    for (const c of hero.holeCards) el.heroCards.appendChild(createCardElement(c, false));
  }

  function showFeedback(isHit, text) {
    el.feedback.textContent = (isHit ? '✅ ' : '❌ ') + text;
    el.feedback.classList.remove('hidden', 'hit', 'miss');
    el.feedback.classList.add(isHit ? 'hit' : 'miss');
    clearTimeout(el._fbTimer);
    el._fbTimer = setTimeout(() => el.feedback.classList.add('hidden'), 2500);
  }

  function updateStats(stats) {
    el.statHit.textContent  = stats.hit;
    el.statMiss.textContent = stats.miss;
    el.statHands.textContent = stats.hands;
    if (stats.hands > 0) {
      const acc = Math.round(stats.hit / (stats.hit + stats.miss) * 100);
      el.statAccuracy.textContent = (isNaN(acc) ? 0 : acc) + '%';
    } else el.statAccuracy.textContent = '—';
    el.statPlace.textContent = stats.place ? `${stats.place}/9` : '—';
  }

  function startTimer(seconds, onExpire) {
    if (!seconds || seconds <= 0) { el.timerBar.classList.add('hidden'); return; }
    el.timerBar.classList.remove('hidden');
    el.timerFill.style.width = '100%';
    const startTime = performance.now();
    const totalMs = seconds * 1000;
    cancelAnimationFrame(el._timerRaf);
    function tick(now) {
      const remain = Math.max(0, totalMs - (now - startTime));
      el.timerFill.style.width = (remain / totalMs * 100) + '%';
      if (remain <= 0) { onExpire(); return; }
      el._timerRaf = requestAnimationFrame(tick);
    }
    el._timerRaf = requestAnimationFrame(tick);
  }

  function stopTimer() {
    cancelAnimationFrame(el._timerRaf);
    el.timerBar.classList.add('hidden');
  }

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

  function closeSessionEnd() { el.sessionEndModal.classList.add('hidden'); }

  return {
    settings, init, renderTable, updateSeats, updateBoard, updatePot, updateLevel,
    updateStacks, updateActiveHighlight, updateActions, hideActions, renderHeroCards,
    showFeedback, updateStats, startTimer, stopTimer, openSettings, closeSettings,
    openSessionEnd, closeSessionEnd, createCardElement, formatChips, el
  };

})();

window.UI = UI;