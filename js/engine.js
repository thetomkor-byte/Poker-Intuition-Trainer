/* ============================================================
   POKER INTUITION TRAINER — ENGINE
   ============================================================ */

const Engine = (() => {

  const SUITS = ['s', 'h', 'd', 'c'];
  const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];

  const RANK_VALUE = {
    '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
    'T':10,'J':11,'Q':12,'K':13,'A':14
  };

  const HAND_CATEGORIES = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
    FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9
  };

  const CATEGORY_NAMES = [
    'Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит',
    'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш', 'Роял-флеш'
  ];

  const BLIND_LEVELS = [
    { sb: 10, bb: 20, ante: 0 }, { sb: 15, bb: 30, ante: 0 },
    { sb: 25, bb: 50, ante: 0 }, { sb: 50, bb: 100, ante: 10 },
    { sb: 75, bb: 150, ante: 15 }, { sb: 100, bb: 200, ante: 25 },
    { sb: 150, bb: 300, ante: 30 }, { sb: 200, bb: 400, ante: 50 },
    { sb: 300, bb: 600, ante: 75 }, { sb: 400, bb: 800, ante: 100 },
    { sb: 500, bb: 1000, ante: 100 }, { sb: 750, bb: 1500, ante: 150 },
    { sb: 1000, bb: 2000, ante: 200 }, { sb: 1500, bb: 3000, ante: 300 },
    { sb: 2000, bb: 4000, ante: 400 }, { sb: 3000, bb: 6000, ante: 600 }
  ];

  const STARTING_STACK = 1500;
  const SEATS = 9;
  const POSITIONS_9MAX = ['BTN','SB','BB','UTG','UTG1','MP','MP1','HJ','CO'];
  const STREETS = ['preflop', 'flop', 'turn', 'river'];

  function cryptoRandomInt(maxExclusive) {
    if (maxExclusive <= 0) return 0;
    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % maxExclusive;
  }

  function createDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
    return deck;
  }

  function shuffle(deck) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = cryptoRandomInt(i + 1);
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function evaluateHand(cards) {
    if (cards.length < 5) return null;
    const combos = combinations(cards, 5);
    let best = null;
    for (const combo of combos) {
      const score = evaluate5(combo);
      if (!best || compareScores(score, best) > 0) best = score;
    }
    return best;
  }

  function combinations(arr, k) {
    const result = [];
    const combo = [];
    (function recurse(start) {
      if (combo.length === k) { result.push(combo.slice()); return; }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]); recurse(i + 1); combo.pop();
      }
    })(0);
    return result;
  }

  function evaluate5(cards) {
    const values = cards.map(c => RANK_VALUE[c.rank]).sort((a,b) => b - a);
    const suits  = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    const uniqueVals = [...new Set(values)].sort((a,b) => b - a);
    let straightHigh = 0;
    for (let i = 0; i <= uniqueVals.length - 5; i++) {
      if (uniqueVals[i] - uniqueVals[i+4] === 4) { straightHigh = uniqueVals[i]; break; }
    }
    if (!straightHigh && uniqueVals.includes(14) && uniqueVals.includes(2) &&
        uniqueVals.includes(3) && uniqueVals.includes(4) && uniqueVals.includes(5)) {
      straightHigh = 5;
    }

    const freq = {};
    for (const v of values) freq[v] = (freq[v] || 0) + 1;
    const groups = Object.entries(freq)
      .map(([v, c]) => [c, Number(v)])
      .sort((a, b) => b[0] - a[0] || b[1] - a[1]);

    if (isFlush && straightHigh) {
      if (straightHigh === 14) return { category: HAND_CATEGORIES.ROYAL_FLUSH, ranks: [14], cards, name: 'Роял-флеш' };
      return { category: HAND_CATEGORIES.STRAIGHT_FLUSH, ranks: [straightHigh], cards, name: 'Стрит-флеш' };
    }
    if (groups[0][0] === 4) return { category: HAND_CATEGORIES.QUADS, ranks: [groups[0][1], groups[1][1]], cards, name: 'Каре' };
    if (groups[0][0] === 3 && groups[1] && groups[1][0] === 2) return { category: HAND_CATEGORIES.FULL_HOUSE, ranks: [groups[0][1], groups[1][1]], cards, name: 'Фулл-хаус' };
    if (isFlush) return { category: HAND_CATEGORIES.FLUSH, ranks: values, cards, name: 'Флеш' };
    if (straightHigh) return { category: HAND_CATEGORIES.STRAIGHT, ranks: [straightHigh], cards, name: 'Стрит' };
    if (groups[0][0] === 3) return { category: HAND_CATEGORIES.TRIPS, ranks: [groups[0][1], ...groups.slice(1).map(g => g[1])], cards, name: 'Сет' };
    if (groups[0][0] === 2 && groups[1] && groups[1][0] === 2) return { category: HAND_CATEGORIES.TWO_PAIR, ranks: [groups[0][1], groups[1][1], groups[2][1]], cards, name: 'Две пары' };
    if (groups[0][0] === 2) return { category: HAND_CATEGORIES.PAIR, ranks: [groups[0][1], ...groups.slice(1).map(g => g[1])], cards, name: 'Пара' };
    return { category: HAND_CATEGORIES.HIGH_CARD, ranks: values, cards, name: 'Старшая карта' };
  }

  function compareScores(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    const len = Math.max(a.ranks.length, b.ranks.length);
    for (let i = 0; i < len; i++) {
      const ra = a.ranks[i] ?? 0;
      const rb = b.ranks[i] ?? 0;
      if (ra !== rb) return ra - rb;
    }
    return 0;
  }

  function buildSidePots(contributions, activePlayers) {
    const entries = Object.entries(contributions).filter(([_, amt]) => amt > 0).map(([id, amt]) => ({ id, amt }));
    entries.sort((a, b) => a.amt - b.amt);
    const pots = [];
    let prev = 0;
    const remaining = entries.map(e => ({ ...e }));

    while (remaining.length > 0) {
      const minAmt = remaining[0].amt;
      const level = minAmt - prev;
      if (level <= 0) { remaining.shift(); continue; }
      let potAmount = 0;
      const contributors = [];
      for (const e of remaining) { potAmount += level; contributors.push(e.id); e.amt -= level; }
      prev = minAmt;
      const eligible = contributors.filter(id => activePlayers.has(id));
      if (potAmount > 0) pots.push({ amount: potAmount, eligible });
      while (remaining.length > 0 && remaining[0].amt <= 0) remaining.shift();
    }
    return pots;
  }

  function getBlindLevel(levelIndex) {
    return BLIND_LEVELS[Math.min(levelIndex, BLIND_LEVELS.length - 1)];
  }

  function createInitialState(playerConfigs) {
    const players = playerConfigs.map((cfg, i) => ({
      id: cfg.id, seatIndex: i, name: cfg.name, isHero: !!cfg.isHero,
      strategy: cfg.strategy || null, stack: cfg.stack ?? STARTING_STACK,
      holeCards: [], folded: false, allIn: false, eliminated: false,
      committedThisStreet: 0, committedTotal: 0, hasActedThisStreet: false,
      lastAction: null, position: null
    }));

    return {
      handNumber: 0, levelIndex: 0, handsAtLevel: 0, buttonIndex: 0,
      players, deck: [], board: [], pot: 0, currentBet: 0, minRaise: 0,
      street: 'preflop', actingIndex: 0, lastAggressorIndex: null,
      actionLog: [], handOver: false, showdownResults: null,
      blinds: { sb: 10, bb: 20, ante: 0 }
    };
  }

  function dealHoleCards(state) {
    state.deck = shuffle(createDeck());
    let deckIdx = 0;
    const n = state.players.length;
    const sbIndex = (state.buttonIndex + 1) % n;
    for (const p of state.players) p.holeCards = [];
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < n; i++) {
        const idx = (sbIndex + i) % n;
        const p = state.players[idx];
        if (p.eliminated) continue;
        p.holeCards.push(state.deck[deckIdx++]);
      }
    }
    state._deckIdx = deckIdx;
  }

  function burnCard(state) { state._deckIdx += 1; }

  function dealBoard(state, count) {
    burnCard(state);
    for (let i = 0; i < count; i++) state.board.push(state.deck[state._deckIdx++]);
  }

  function assignPositions(state) {
    const n = state.players.length;
    for (let i = 0; i < n; i++) {
      const offset = (i - state.buttonIndex + n) % n;
      state.players[i].position = POSITIONS_9MAX[offset];
    }
  }

  function preflopOrder(state) {
    const n = state.players.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push((state.buttonIndex + 3 + i) % n);
    return order;
  }

  function postflopOrder(state) {
    const n = state.players.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push((state.buttonIndex + 1 + i) % n);
    return order;
  }

  function postBlinds(state) {
    const n = state.players.length;
    const sbIndex = (state.buttonIndex + 1) % n;
    const bbIndex = (state.buttonIndex + 2) % n;
    const { sb, bb, ante } = state.blinds;

    if (ante > 0) {
      for (const p of state.players) {
        if (p.eliminated || p.stack <= 0) continue;
        const pay = Math.min(ante, p.stack);
        p.stack -= pay; p.committedTotal += pay; state.pot += pay;
      }
    }

    const sbPlayer = state.players[sbIndex];
    if (!sbPlayer.eliminated) {
      const pay = Math.min(sb, sbPlayer.stack);
      sbPlayer.stack -= pay; sbPlayer.committedThisStreet += pay;
      sbPlayer.committedTotal += pay; state.pot += pay; sbPlayer.lastAction = 'sb';
    }

    const bbPlayer = state.players[bbIndex];
    if (!bbPlayer.eliminated) {
      const pay = Math.min(bb, bbPlayer.stack);
      bbPlayer.stack -= pay; bbPlayer.committedThisStreet += pay;
      bbPlayer.committedTotal += pay; state.pot += pay; bbPlayer.lastAction = 'bb';
      if (bbPlayer.stack === 0) bbPlayer.allIn = true;
    }

    state.currentBet = bb;
    state.minRaise = bb;
    return { sbIndex, bbIndex };
  }

  function canAct(player) {
    return !player.folded && !player.allIn && !player.eliminated && player.stack > 0;
  }

  function isBettingRoundComplete(state) {
    const active = state.players.filter(p => !p.folded && !p.eliminated);
    if (active.length <= 1) return true;
    for (const p of active) {
      if (p.allIn) continue;
      if (!p.hasActedThisStreet) return false;
      if (p.committedThisStreet < state.currentBet) return false;
    }
    return true;
  }

  function applyAction(state, playerIndex, action) {
    const p = state.players[playerIndex];
    if (!p || p.folded || p.allIn || p.eliminated) return { ok: false, error: 'Игрок не может действовать' };
    const toCall = Math.max(0, state.currentBet - p.committedThisStreet);

    switch (action.type) {
      case 'fold':
        p.folded = true; p.hasActedThisStreet = true; p.lastAction = 'fold';
        logAction(state, p, 'fold', 0);
        break;

      case 'check':
        if (toCall > 0) return { ok: false, error: 'Нельзя чекнуть' };
        p.hasActedThisStreet = true; p.lastAction = 'check';
        logAction(state, p, 'check', 0);
        break;

      case 'call': {
        const pay = Math.min(toCall, p.stack);
        p.stack -= pay; p.committedThisStreet += pay;
        p.committedTotal += pay; state.pot += pay;
        p.hasActedThisStreet = true; p.lastAction = 'call';
        if (p.stack === 0) p.allIn = true;
        logAction(state, p, 'call', pay);
        break;
      }

      case 'raise': {
        const target = action.amount;
        if (target <= state.currentBet) return { ok: false, error: 'Рейз меньше ставки' };
        const need = target - p.committedThisStreet;
        if (need > p.stack) return { ok: false, error: 'Недостаточно фишек' };
        const raiseSize = target - state.currentBet;
        if (raiseSize < state.minRaise && need < p.stack) return { ok: false, error: 'Рейз меньше минимума' };
        p.stack -= need; p.committedThisStreet += need;
        p.committedTotal += need; state.pot += need;
        state.minRaise = Math.max(state.minRaise, raiseSize);
        state.currentBet = target; state.lastAggressorIndex = playerIndex;
        for (const other of state.players) {
          if (other !== p && !other.folded && !other.eliminated && !other.allIn) other.hasActedThisStreet = false;
        }
        p.hasActedThisStreet = true; p.lastAction = 'raise';
        if (p.stack === 0) p.allIn = true;
        logAction(state, p, 'raise', target);
        break;
      }

      case 'allin': {
        const pay = p.stack;
        const target = p.committedThisStreet + pay;
        p.stack = 0; p.committedThisStreet = target;
        p.committedTotal += pay; state.pot += pay;
        p.allIn = true; p.hasActedThisStreet = true; p.lastAction = 'allin';
        if (target > state.currentBet) {
          const raiseSize = target - state.currentBet;
          state.minRaise = Math.max(state.minRaise, raiseSize);
          state.currentBet = target; state.lastAggressorIndex = playerIndex;
          for (const other of state.players) {
            if (other !== p && !other.folded && !other.eliminated && !other.allIn) other.hasActedThisStreet = false;
          }
        }
        logAction(state, p, 'allin', target);
        break;
      }

      default: return { ok: false, error: 'Неизвестное действие: ' + action.type };
    }
    return { ok: true };
  }

  function logAction(state, player, type, amount) {
    state.actionLog.push({ handNumber: state.handNumber, street: state.street, playerId: player.id, playerName: player.name, type, amount });
  }

  function nextActor(state) {
    const n = state.players.length;
    const start = state.actingIndex;
    for (let step = 1; step <= n; step++) {
      const idx = (start + step) % n;
      const p = state.players[idx];
      if (canAct(p)) {
        if (!p.hasActedThisStreet) return idx;
        if (p.committedThisStreet < state.currentBet) return idx;
      }
    }
    return -1;
  }

  function resetStreetState(state) {
    for (const p of state.players) {
      p.committedThisStreet = 0; p.hasActedThisStreet = false;
      if (p.lastAction !== 'fold') p.lastAction = null;
    }
    state.currentBet = 0; state.minRaise = state.blinds.bb; state.lastAggressorIndex = null;
  }

  function startStreet(state, street) {
    state.street = street;
    resetStreetState(state);
    if (street === 'flop')  dealBoard(state, 3);
    if (street === 'turn')  dealBoard(state, 1);
    if (street === 'river') dealBoard(state, 1);
    const actionable = state.players.filter(p => canAct(p) && !p.folded);
    if (actionable.length < 2) return false;
    const order = postflopOrder(state);
    for (const idx of order) {
      if (canAct(state.players[idx])) { state.actingIndex = idx; return true; }
    }
    return false;
  }

  function showdown(state) {
    const contenders = state.players.filter(p => !p.folded && !p.eliminated);
    const scores = new Map();
    for (const p of contenders) {
      const allCards = [...p.holeCards, ...state.board];
      scores.set(p.id, allCards.length >= 5 ? evaluateHand(allCards) : null);
    }
    const contributions = {};
    for (const p of state.players) contributions[p.id] = p.committedTotal;
    const activeIds = new Set(contenders.map(p => p.id));
    const pots = buildSidePots(contributions, activeIds);
    const payouts = {};
    const potResults = [];

    for (const pot of pots) {
      const eligible = pot.eligible.filter(id => scores.get(id));
      if (eligible.length === 0) continue;
      let bestScore = null; let winners = [];
      for (const id of eligible) {
        const sc = scores.get(id);
        if (!bestScore || compareScores(sc, bestScore) > 0) { bestScore = sc; winners = [id]; }
        else if (compareScores(sc, bestScore) === 0) winners.push(id);
      }
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      for (const wid of winners) {
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder--;
        payouts[wid] = (payouts[wid] || 0) + share + extra;
      }
      potResults.push({
        amount: pot.amount,
        winners: winners.map(id => state.players.find(p => p.id === id).name),
        winnersIds: winners
      });
    }

    for (const [id, amount] of Object.entries(payouts)) {
      const p = state.players.find(pl => pl.id === id || pl.id === Number(id));
      if (p) p.stack += amount;
    }

    let topWinnerId = null; let topAmount = -1;
    for (const [id, amount] of Object.entries(payouts)) {
      if (amount > topAmount) { topAmount = amount; topWinnerId = id; }
    }

    state.showdownResults = {
      scores: Object.fromEntries([...scores.entries()].map(([id, sc]) =>
        [id, sc ? { category: sc.category, name: sc.name, ranks: sc.ranks, cards: sc.cards } : null])),
      pots: potResults, payouts, topWinnerId
    };
    state.handOver = true;
    return state.showdownResults;
  }

  function awardToLastStanding(state) {
    const alive = state.players.filter(p => !p.folded && !p.eliminated);
    if (alive.length !== 1) return null;
    const winner = alive[0];
    winner.stack += state.pot;
    state.showdownResults = {
      scores: {}, pots: [{ amount: state.pot, winners: [winner.name], winnersIds: [winner.id] }],
      payouts: { [winner.id]: state.pot }, topWinnerId: winner.id, uncontested: true
    };
    state.handOver = true;
    return state.showdownResults;
  }

  function startHand(state) {
    state.board = []; state.pot = 0; state.currentBet = 0; state.minRaise = 0;
    state.actionLog = []; state.handOver = false; state.showdownResults = null;

    for (const p of state.players) {
      p.folded = p.eliminated; p.allIn = false;
      p.committedThisStreet = 0; p.committedTotal = 0;
      p.hasActedThisStreet = false; p.lastAction = null; p.holeCards = [];
    }

    const n = state.players.length;
    let next = (state.buttonIndex + 1) % n;
    let guard = 0;
    while (state.players[next].eliminated && guard < n) { next = (next + 1) % n; guard++; }
    state.buttonIndex = next;

    state.handNumber += 1;
    state.street = 'preflop';
    state.blinds = getBlindLevel(state.levelIndex);

    assignPositions(state);
    dealHoleCards(state);
    postBlinds(state);

    const order = preflopOrder(state);
    let firstIdx = -1;
    for (const idx of order) if (canAct(state.players[idx])) { firstIdx = idx; break; }
    state.actingIndex = firstIdx >= 0 ? firstIdx : 0;
    return state;
  }

  function advanceStreet(state) {
    const alive = state.players.filter(p => !p.folded && !p.eliminated);
    if (alive.length === 1) { awardToLastStanding(state); return { done: true, results: state.showdownResults }; }

    const idx = STREETS.indexOf(state.street);
    if (idx < 0 || idx >= STREETS.length - 1) { showdown(state); return { done: true, results: state.showdownResults }; }

    const nextStreet = STREETS[idx + 1];
    const canContinue = startStreet(state, nextStreet);

    if (!canContinue) {
      while (STREETS.indexOf(state.street) < STREETS.length - 1) {
        const nIdx = STREETS.indexOf(state.street) + 1;
        startStreet(state, STREETS[nIdx]);
      }
      showdown(state);
      return { done: true, results: state.showdownResults };
    }
    return { done: false, street: state.street };
  }

  function endBettingRound(state) { return advanceStreet(state); }

  function rankValue(r) { return RANK_VALUE[r]; }
  function cardToString(c) { return c.rank + c.suit; }
  function stringToCard(str) { return { rank: str[0], suit: str[1] }; }
  function getActivePlayers(state) { return state.players.filter(p => !p.folded && !p.eliminated); }
  function getActionablePlayers(state) { return state.players.filter(p => canAct(p) && !p.folded); }
  function isHandOver(state) { return state.handOver === true; }

  return {
    SUITS, RANKS, RANK_VALUE, HAND_CATEGORIES, CATEGORY_NAMES,
    BLIND_LEVELS, STARTING_STACK, SEATS, POSITIONS_9MAX, STREETS,
    cryptoRandomInt, createDeck, shuffle, evaluateHand, evaluate5, compareScores,
    buildSidePots, getBlindLevel, createInitialState,
    dealHoleCards, burnCard, dealBoard, assignPositions, preflopOrder, postflopOrder, postBlinds,
    canAct, isBettingRoundComplete, applyAction, nextActor, logAction,
    resetStreetState, startStreet, startHand, advanceStreet, endBettingRound,
    showdown, awardToLastStanding, getActivePlayers, getActionablePlayers, isHandOver,
    rankValue, cardToString, stringToCard
  };

})();

window.Engine = Engine;
