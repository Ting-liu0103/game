// ===== app.js =====
(() => {
  let state = { level: 0, flags: [], hintCount: 0 };
  let story = null;

  const logEl = document.getElementById('log');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('send');

  function append(text) {
    logEl.textContent += text + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function init() {
    story = await fetch('scripts/story.json').then(r => r.json());
    handleCommand('/start');
  }

  function handleCommand(cmd) {
    if (story.globals[cmd]) {
      const g = story.globals[cmd];
      append(g.response || g.response_template);
      if (g.action === 'reset_state_to_level_1') state = { level: 1, flags: [], hintCount: 0 };
      if (g.action === 'increment_hint_count') state.hintCount++;
      return;
    }
    handleInput(cmd);
  }

  function handleInput(text) {
    const lvl = story.levels.find(l => l.id === state.level);
    // branches
    if (lvl.branches) {
      for (let b of lvl.branches) {
        if (text === b.trigger && (!b.requires_flags || b.requires_flags.every(f => state.flags.includes(f)))) {
          if (b.flag) state.flags.push(b.flag);
          append(b.response);
          return;
        }
      }
    }
    // answers
    for (let a of lvl.answers) {
      if (a.values.includes(text) && (!a.requires_flags || a.requires_flags.every(f => state.flags.includes(f)))) {
        append(a.response);
        if (a.flag) state.flags.push(a.flag);
        if (a.next_level) state.level = a.next_level;
        return;
      }
    }
    // wrong
    append(lvl.wrong.response);
  }

  sendBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (!text) return;
    append('> ' + text);
    if (text.startsWith('/')) handleCommand(text);
    else handleInput(text);
    inputEl.value = '';
  });

  init();
})();
