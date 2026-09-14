// Создать стол: герой + 8 ботов
const players = Array.from({length: 9}, (_, i) => ({
  id: i, name: i === 0 ? 'Hero' : 'Bot' + i,
  isHero: i === 0, strategy: i === 0 ? null : 'TAG',
  stack: 1500
}));
const st = Engine.createInitialState(players);
Engine.startHand(st);

console.log('BTN index:', st.buttonIndex);
console.log('Hero cards:', st.players[0].holeCards.map(Engine.cardToString));
console.log('Pot:', st.pot, 'currentBet:', st.currentBet);
console.log('Acting:', st.players[st.actingIndex].name, st.players[st.actingIndex].position);

// Пример: UTG фолдит
Engine.applyAction(st, st.actingIndex, { type: 'fold' });
console.log('Next actor:', st.players[Engine.nextActor(st)].name);