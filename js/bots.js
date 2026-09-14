/* ============================================================
   POKER INTUITION TRAINER — BOTS
   6 стратегий + GTO-подобные префлоп-чарты.
   Зависит от Engine (глобальный).
   ============================================================ */

const Bots = (() => {

  const R = Engine.RANK_VALUE;

  /* ==========================================================
     1. СТРАТЕГИИ (типы ботов)
     ========================================================== */

  const STRATEGIES = {
    TAG:   { name: 'TAG',   desc: 'Tight-Aggressive',  aggression: 0.70, looseness: 0.35, bluff: 0.20, callThreshold: 0.55 },
    TAP:   { name: 'TAP',   desc: 'Tight-Passive',     aggression: 0.25, looseness: 0.35, bluff: 0.08, callThreshold: 0.50 },
    LAG:   { name: 'LAG',   desc: 'Loose-Aggressive',  aggression: 0.80, looseness: 0.75, bluff: 0.40, callThreshold: 0.40 },
    LAP:   { name: 'LAP',   desc: 'Loose-Passive',     aggression: 0.30, looseness: 0.75, bluff: 0.15, callThreshold: 0.35 },
    NIT:   { name: 'NIT',   desc: 'Rock',              aggression: 0.15, looseness: 0.15, bluff: 0.03, callThreshold: 0.70 },
    MANIAC:{ name: 'MANIAC',desc: 'Maniac',            aggression: 0.95, looseness: 0.95, bluff: 0.65, callThreshold: 0.25 }
  };

  // Распределение: TAG и LAG чаще всего, NIT/MANIAC редко
  const STRATEGY_WEIGHTS = [
    { key: 'TAG',    weight: 30 },
    { key: 'LAG',    weight: 28 },
    { key: 'TAP',    weight: 15 },
    { key: 'LAP',    weight: 14 },
    { key: 'NIT',    weight: 8  },
    { key: 'MANIAC', weight: 5  }
  ];

  /* ==========================================================
     2. ПРЕФЛОП-ЧАРТЫ (GTO-подобные диапазоны)
     Формат: массив строк вида "AKs", "QQ+", "ATo+", "22-99", "T9s+"
     Парсер разворачивает их в Set конкретных хендов.
     ========================================================== */

  const CHARTS = {
    // === ОТКРЫТИЯ (RFI) ===
    OPEN_UTG: [
      '77+','ATs+','KTs+','QTs+','JTs','T9s','98s','87s','76s',
      'AJo+','KQo'
    ],
    OPEN_UTG1: [
      '66+','A9s+','KTs+','QTs+','JTs','T9s','98s','87s','76s','65s',
      'ATo+','KQo'
    ],
    OPEN_MP: [
      '55+','A8s+','K9s+','Q9s+','J9s+','T8s+','98s','87s','76s','65s','54s',
      'ATo+','KJo+','QJo'
    ],
    OPEN_MP1: [
      '44+','A5s+','K8s+','Q9s+','J9s+','T8s+','97s+','86s+','75s+','65s','54s',
      'A9o+','KJo+','QJo','JTo'
    ],
    OPEN_HJ: [
      '33+','A2s+','K7s+','Q8s+','J8s+','T8s+','97s+','86s+','75s+','64s+','54s',
      'A8o+','KTo+','QTo+','JTo'
    ],
    OPEN_CO: [
      '22+','A2s+','K5s+','Q7s+','J7s+','T7s+','96s+','85s+','74s+','63s+','53s+','43s',
      'A5o+','K9o+','Q9o+','J9o+','T9o','98o'
    ],
    OPEN_BTN: [
      '22+','A2s+','K2s+','Q4s+','J5s+','T6s+','95s+','84s+','73s+','62s+','52s+','42s+','32s',
      'A2o+','K7o+','Q8o+','J8o+','T8o+','98o','87o','76o','65o'
    ],
    OPEN_SB: [
      '22+','A2s+','K2s+','Q2s+','J4s+','T6s+','95s+','84s+','73s+','62s+','52s+','43s',
      'A2o+','K5o+','Q7o+','J8o+','T8o+','98o','87o','76o','65o','54o'
    ],

    // === 3-БЕТ (против открытия) ===
    THREE_BET_VS_UTG: [
      'QQ+','AKs','AKo','AQs','JJ'
    ],
    THREE_BET_VS_MP: [
      'TT+','AKs','AKo','AQs','AQo','AJs','KQs'
    ],
    THREE_BET_VS_CO: [
      '99+','AQs+','AKo','AQo','AJs+','ATs','KQs','KJs','QJs'
    ],
    THREE_BET_VS_BTN: [
      '77+','ATs+','AJo+','KTs+','KQo','QTs+','JTs','T9s','98s','A5s','A4s'
    ],
    THREE_BET_VS_SB: [
      '66+','A9s+','ATo+','KTs+','KJo+','QTs+','QJo','JTs','T9s','98s','A5s+'
    ],

    // === КОЛЛ РЕЙЗА (без 3-бета) ===
    CALL_RAISE: [
      '22-99','A2s-AJs','K9s+','Q9s+','J9s+','T8s+','98s','87s','76s','65s',
      'ATo','KJo','QJo','JTo'
    ],

    // === КОЛЛ 3-БЕТА ===
    CALL_3BET: [
      'JJ','TT','99','AQs','AJs','KQs','AQo'
    ],

    // === ПУШИ (короткий стек) ===
    SHOVE_10_15BB: [
      '22+','A2s+','K5s+','Q7s+','J8s+','T8s+','98s','87s','76s',
      'A7o+','K9o+','Q9o+','J9o+','T9o'
    ],
    SHOVE_5_10BB: [
      '22+','A2s+','K2s+','Q4s+','J6s+','T7s+','96s+','85s+','74s+','64s+','54s',
      'A2o+','K7o+','Q8o+','J9o+','T9o','98o'
    ],
    CALL_SHOVE: [
      '77+','AQs+','AKo','TT','JJ','QQ','KK','AA'
    ]
  };

  /* ==========================================================
     3. ПАРСЕР ЧАРТОВ
     ========================================================== */

  // Кэш: chartName -> Set строк вида "AKs"
  const chartCache = {};

  function normalizeHand(c1, c2) {
    // Возвращает строку вида "AKs" / "AKo" / "QQ"
    const r1 = c1.rank, r2 = c2.rank;
    const v1 = R[r1], v2 = R[r2];
    if (v1 === v2) return r1 + r2; // пара
    const [hi, lo] = v1 > v2 ? [r1, r2] : [r2, r1];
    const suited = c1.suit === c2.suit ? 's' : 'o';
    return hi + lo + suited;
  }

  function expandChart(entries) {
    const set = new Set();
    for (const entry of entries) {
      // Диапазон пар: "22-99", "TT+", "77+"
      let m;
      if ((m = entry.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/))) {
        const from = R[m[1]], to = R[m[2]];
        for (let v = from; v <= to; v++) {
          const r = rankFromValue(v);
          set.add(r + r);
        }
        continue;
      }
      if ((m = entry.match(/^([2-9TJQKA])\1\+$/))) {
        const from = R[m[1]];
        for (let v = from; v <= 14; v++) {
          const r = rankFromValue(v);
          set.add(r + r);
        }
        continue;
      }
      if ((m = entry.match(/^([2-9TJQKA])\1$/))) {
        set.add(m[1] + m[1]);
        continue;
      }

      // Не-пары: "AKs", "ATs+", "K9s+", "T9s"
      if ((m = entry.match(/^([2-9TJQKA])([2-9TJQKA])([so])\+$/))) {
        const hi = m[1], lo = m[2], suit = m[3];
        const hiV = R[hi], loV = R[lo];
        for (let v = loV; v < hiV; v++) {
          const r = rankFromValue(v);
          set.add(hi + r + suit);
        }
        continue;
      }
      if ((m = entry.match(/^([2-9TJQKA])([2-9TJQKA])([so])$/))) {
        set.add(m[1] + m[2] + m[3]);
        continue;
      }

      // Диапазон не-пар: "A2s-A5s", "K9s-KQs" и т.п. (простой случай)
      if ((m = entry.match(/^([2-9TJQKA])([2-9TJQKA])([so])-([2-9TJQKA])([2-9TJQKA])([so])$/))) {
        const hi = m[1], loFrom = R[m[2]], loTo = R[m[4]], suit = m[3];
        const hiV = R[hi];
        for (let v = loFrom; v <= loTo; v++) {
          if (v >= hiV) continue;
          const r = rankFromValue(v);
          set.add(hi + r + suit);
        }
        continue;
      }

      console.warn('Не распознан чарт-элемент:', entry);
    }
    return set;
  }

  function rankFromValue(v) {
    for (const r of Engine.RANKS) if (R[r] === v) return r;
    return '?';
  }

  function getChart(name) {
    if (!chartCache[name]) {
      chartCache[name] = expandChart(CHARTS[name] || []);
    }
    return chartCache[name];
  }

  function handInChart(card1, card2, chartName) {
    if (!CHARTS[chartName]) return false;
    const hand = normalizeHand(card1, card2);
    return getChart(chartName).has(hand);
  }

  /* ==========================================================
     4. ВЫБОР СТРАТЕГИЙ ДЛЯ СТОЛА
     ========================================================== */

  function pickWeighted(weights) {
    const total = weights.reduce((s, w) => s + w.weight, 0);
    let r = Engine.cryptoRandomInt(total);
    for (const w of weights) {
      if (r < w.weight) return w.key;
      r -= w.weight;
    }
    return weights[0].key;
  }

  // Возвращает массив из 8 стратегий для 8 ботов (без героя)
  // Правила: максимум 1 MANIAC, максимум 1 NIT
  function assignStrategies(count = 8) {
    const result = [];
    let maniacUsed = false, nitUsed = false;
    const pool = STRATEGY_WEIGHTS.filter(w => w.key !== 'MANIAC' && w.key !== 'NIT');

    for (let i = 0; i < count; i++) {
      let key;
      // С небольшим шансом пытаемся добавить NIT/MANIAC, если ещё не было
      const roll = Engine.cryptoRandomInt(100);
      if (!nitUsed && roll < 8) {
        key = 'NIT'; nitUsed = true;
      } else if (!maniacUsed && roll >= 92) {
        key = 'MANIAC'; maniacUsed = true;
      } else {
        key = pickWeighted(pool);
      }
      result.push(key);
    }
    return result;
  }

  /* ==========================================================
     5. ОЦЕНКА СИЛЫ РУКИ (0..1)
     ========================================================== */

  // Префлоп: простая эвристика по картам
  function preflopStrength(card1, card2) {
    const v1 = R[card1.rank], v2 = R[card2.rank];
    const hi = Math.max(v1, v2), lo = Math.min(v1, v2);
    const suited = card1.suit === card2.suit;
    const pair = v1 === v2;

    if (pair) {
      // 22 -> ~0.5, AA -> 1.0
      return 0.5 + (hi - 2) / 12 * 0.5;
    }

    // Базовая сила по старшей карте
    let s = (hi - 2) / 12 * 0.55 + (lo - 2) / 12 * 0.25;
    if (suited) s += 0.08;
    if (hi === 14) s += 0.05;
    if (Math.abs(hi - lo) === 1) s += 0.04;   // коннекторы
    if (Math.abs(hi - lo) === 2) s += 0.02;

    return Math.min(1, Math.max(0, s));
  }

  // Постфлоп: используем категорию руки от Engine.evaluateHand
  function postflopStrength(handScore) {
    if (!handScore) return 0;
    const cat = handScore.category;
    const rank = handScore.ranks[0] || 0;

    // Маппинг категорий в 0..1
    const base = [
      0.15, // HIGH_CARD
      0.35, // PAIR
      0.55, // TWO_PAIR
      0.70, // TRIPS
      0.78, // STRAIGHT
      0.85, // FLUSH
      0.92, // FULL_HOUSE
      0.97, // QUADS
      0.99, // STRAIGHT_FLUSH
      1.00  // ROYAL_FLUSH
    ][cat] || 0;

    // Небольшая корректировка по старшинству
    return Math.min(1, base + (rank / 14) * 0.05);
  }

  /* ==========================================================
     6. ПРИНЯТИЕ РЕШЕНИЙ
     ========================================================== */

  // Контекст хода
  // ctx = {
  //   card1, card2,            // карманные карты бота
  //   board: [...],            // борд (0, 3, 4 или 5 карт)
  //   street: 'preflop' | ...,
  //   pot,                     // текущий банк
  //   toCall,                  // сколько нужно доложить
  //   minRaise,                // минимальный рейз
  //   myStack,                 // стек бота
  //   bb,                      // размер BB
  //   position,                // 'BTN', 'UTG', ...
  //   numActive,               // сколько игроков ещё в раздаче (не сфолдили)
  //   facingRaise: bool,       // есть ли рейз перед ботом
  //   facing3Bet: bool,        // есть ли 3-бет перед ботом
  //   raiserPosition: str,     // позиция рейзера (если есть)
  //   strategy: 'TAG' | ...
  // }

  // Возвращает: { action: 'fold'|'check'|'call'|'raise'|'allin', amount: number }
  function decide(ctx) {
    const strat = STRATEGIES[ctx.strategy];
    if (!strat) return { action: 'fold', amount: 0 };

    if (ctx.street === 'preflop') {
      return decidePreflop(ctx, strat);
    } else {
      return decidePostflop(ctx, strat);
    }
  }

  /* ---------- ПРЕФЛОП ---------- */

  function decidePreflop(ctx, strat) {
    const { card1, card2, position, myStack, bb, toCall, pot, numActive } = ctx;
    const stackBB = myStack / bb;
    const strength = preflopStrength(card1, card2);

    // === Случай 1: короткий стек — пуш-фолд ===
    if (stackBB <= 15 && !ctx.facingRaise) {
      if (stackBB <= 10) {
        if (handInChart(card1, card2, 'SHOVE_5_10BB')) {
          return { action: 'allin', amount: myStack };
        }
      } else {
        if (handInChart(card1, card2, 'SHOVE_10_15BB')) {
          return { action: 'allin', amount: myStack };
        }
      }
      // Если не в чарте пуша — фолд (или чек, если бесплатно)
      if (toCall === 0) return { action: 'check', amount: 0 };
      return { action: 'fold', amount: 0 };
    }

    // === Случай 2: против шова (facing all-in) ===
    if (ctx.facingRaise && ctx.facingAllin) {
      if (handInChart(card1, card2, 'CALL_SHOVE') ||
          (strat.looseness > 0.7 && strength > 0.55)) {
        return { action: 'call', amount: toCall };
      }
      return { action: 'fold', amount: 0 };
    }

    // === Случай 3: против 3-бета ===
    if (ctx.facing3Bet) {
      if (handInChart(card1, card2, 'CALL_3BET') ||
          (strat.looseness > 0.6 && strength > 0.6)) {
        // 4-бет у агрессивных
        if (strat.aggression > 0.7 && strength > 0.8 && Math.random() < 0.5) {
          const size = Math.min(myStack, Math.round((pot + toCall) * 2.2));
          return { action: 'raise', amount: size };
        }
        return { action: 'call', amount: toCall };
      }
      return { action: 'fold', amount: 0 };
    }

    // === Случай 4: против рейза (2-бет) ===
    if (ctx.facingRaise) {
      const chart3bet = threeBetChartFor(ctx.raiserPosition);
      if (handInChart(card1, card2, chart3bet)) {
        // 3-бет
        const size = Math.min(myStack, Math.round((pot + toCall) * 3));
        return { action: 'raise', amount: size };
      }
      if (handInChart(card1, card2, 'CALL_RAISE') ||
          (strat.looseness > 0.6 && strength > 0.45)) {
        return { action: 'call', amount: toCall };
      }
      // Блеф-3бет у агрессивных
      if (strat.bluff > 0.4 && strength > 0.3 && Math.random() < strat.bluff * 0.3) {
        const size = Math.min(myStack, Math.round((pot + toCall) * 3));
        return { action: 'raise', amount: size };
      }
      return { action: 'fold', amount: 0 };
    }

    // === Случай 5: никто не открывал — RFI ===
    if (toCall === 0 || toCall === bb) {
      const openChart = openChartFor(position);
      if (handInChart(card1, card2, openChart)) {
        // Открываем рейзом
        const openSize = Math.round(bb * (numActive > 5 ? 3 : 2.5));
        return { action: 'raise', amount: Math.min(myStack, openSize) };
      }
      // Блеф-открытие у LAG/MANIAC
      if (strat.looseness > 0.7 && strength > 0.25 && Math.random() < strat.bluff * 0.4) {
        const openSize = Math.round(bb * 2.5);
        return { action: 'raise', amount: Math.min(myStack, openSize) };
      }
      // Чек в BB, если все сфолдили до нас
      if (toCall === 0) return { action: 'check', amount: 0 };
      return { action: 'fold', amount: 0 };
    }

    // Фолд по умолчанию
    return { action: 'fold', amount: 0 };
  }

  function openChartFor(position) {
    switch (position) {
      case 'UTG':  return 'OPEN_UTG';
      case 'UTG1': return 'OPEN_UTG1';
      case 'MP':   return 'OPEN_MP';
      case 'MP1':  return 'OPEN_MP1';
      case 'HJ':   return 'OPEN_HJ';
      case 'CO':   return 'OPEN_CO';
      case 'BTN':  return 'OPEN_BTN';
      case 'SB':   return 'OPEN_SB';
      default:     return 'OPEN_BTN';
    }
  }

  function threeBetChartFor(raiserPos) {
    switch (raiserPos) {
      case 'UTG': case 'UTG1': return 'THREE_BET_VS_UTG';
      case 'MP':  case 'MP1':  return 'THREE_BET_VS_MP';
      case 'CO':                return 'THREE_BET_VS_CO';
      case 'BTN':               return 'THREE_BET_VS_BTN';
      case 'SB':                return 'THREE_BET_VS_SB';
      default:                  return 'THREE_BET_VS_CO';
    }
  }

  /* ---------- ПОСТФЛОП ---------- */

  function decidePostflop(ctx, strat) {
    const { card1, card2, board, toCall, pot, myStack, bb, street } = ctx;
    const allCards = [card1, card2, ...board];
    const handScore = Engine.evaluateHand(allCards);
    const strength = postflopStrength(handScore);

    // Дополнительная корректировка по улице
    const streetBonus = street === 'river' ? 0.05 : 0;

    // === Нет ставки (можно чекнуть) ===
    if (toCall === 0) {
      // Сильная рука — ставим
      if (strength + streetBonus > 0.65) {
        const betSize = Math.round(pot * (0.5 + strat.aggression * 0.3));
        return { action: 'raise', amount: Math.min(myStack, Math.max(bb, betSize)) };
      }
      // Средняя — иногда ставим (агgression)
      if (strength > 0.4 && Math.random() < strat.aggression * 0.5) {
        const betSize = Math.round(pot * 0.5);
        return { action: 'raise', amount: Math.min(myStack, Math.max(bb, betSize)) };
      }
      // Блеф
      if (Math.random() < strat.bluff * 0.25) {
        const betSize = Math.round(pot * 0.6);
        return { action: 'raise', amount: Math.min(myStack, Math.max(bb, betSize)) };
      }
      return { action: 'check', amount: 0 };
    }

    // === Есть ставка ===
    const potOdds = toCall / (pot + toCall);

    // Сильная рука — рейз или колл
    if (strength + streetBonus > 0.75) {
      if (strat.aggression > 0.5 && Math.random() < strat.aggression) {
        const raiseSize = Math.min(myStack, Math.round((pot + toCall) * 2.5));
        return { action: 'raise', amount: raiseSize };
      }
      return { action: 'call', amount: toCall };
    }

    // Средняя — колл по шансам
    if (strength > strat.callThreshold) {
      if (strength > potOdds * 1.5) {
        return { action: 'call', amount: toCall };
      }
    }

    // Блеф-рейз
    if (strength > 0.3 && Math.random() < strat.bluff * 0.15) {
      const raiseSize = Math.min(myStack, Math.round((pot + toCall) * 2.5));
      return { action: 'raise', amount: raiseSize };
    }

    // Слабая — фолд (или чек, если бесплатно — но мы в ветке toCall>0)
    return { action: 'fold', amount: 0 };
  }

  /* ==========================================================
     7. ЭКСПОРТ
     ========================================================== */

  return {
    STRATEGIES,
    STRATEGY_WEIGHTS,
    CHARTS,
    assignStrategies,
    pickWeighted,
    decide,
    preflopStrength,
    postflopStrength,
    handInChart,
    normalizeHand,
    getChart
  };

})();

window.Bots = Bots;