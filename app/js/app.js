import { state, loadSettings, saveSettings, setupKeys, unlock, recover, changePin, lock, isUnlocked, saveEntry, deleteEntry, createTag, tagById, exportAll, deleteEverything } from './store.js';
import { generateRecoveryKey } from './crypto.js';
import { t, L, setLang, getLang, fmtDate, fmtTime } from './i18n.js';
import { EMOTION_FAMILIES, EMOTIONS, PROMPTS, PROMPT_THEMES, EXERCISES, EXERCISE_CATEGORIES, BREATHING, HELPLINES, hasRiskWords } from './content.js';
import { h, s, icon, toast, sheet, debounce } from './ui.js';

const root = document.getElementById('app');
let cleanup = null; // teardown for the current screen (timers etc.)

// ---------- helpers ----------

function applyTheme() {
  const th = state.settings.theme;
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  else delete document.documentElement.dataset.theme;
}

function dayKey(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function seg(options, value, onChange) {
  return h(
    'div',
    { class: 'seg', role: 'group' },
    options.map(([v, label]) =>
      h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, label)
    )
  );
}

function moodScale(value, onPick) {
  const wrap = h('div');
  const row = h('div', { class: 'mood-scale', role: 'group', 'aria-label': t('overallMood') });
  for (let i = 1; i <= 10; i++) {
    row.append(
      h('button', { type: 'button', class: value === i ? 'on' : '', 'aria-pressed': String(value === i), onclick: () => onPick(i) }, String(i))
    );
  }
  wrap.append(row, h('div', { class: 'mood-ends' }, h('span', {}, getLang() === 'el' ? 'Πολύ άσχημα' : 'Very low'), h('span', {}, getLang() === 'el' ? 'Πολύ καλά' : 'Very good')));
  return wrap;
}

function emotionChip(id) {
  const e = EMOTIONS[id];
  return h('span', { class: 'chip static' }, h('span', { class: 'sw', style: { background: e.color } }), L(e));
}

function entryHeading(e) {
  if (e.title) return e.title;
  if (e.type === 'exercise') return L(EXERCISES.find((x) => x.id === e.exerciseId)) || t('types').exercise;
  if (e.type === 'guided' && PROMPTS[e.promptIndex]) return L(PROMPTS[e.promptIndex]);
  if (e.type === 'checkin') return t('types').checkin;
  return t('untitled');
}

function entryText(e) {
  const parts = [e.title, e.body];
  if (e.answers) parts.push(...Object.values(e.answers));
  return parts.filter(Boolean).join('\n');
}

function entryCard(e) {
  const snippet = e.body || (e.answers ? Object.values(e.answers).filter(Boolean).join(' · ') : '');
  return h(
    'a',
    { class: 'card entry-card', href: `#/entry/${e.id}` },
    h(
      'div',
      { class: 'entry-meta' },
      h('span', {}, `${fmtDate(e.created_at)} · ${fmtTime(e.created_at)}`),
      h('span', {}, '·'),
      h('span', {}, t('types')[e.type]),
      e.mood ? h('span', { class: 'mood-pill', title: t('overallMood') }, String(e.mood)) : null
    ),
    h('div', { class: 'entry-title' }, entryHeading(e)),
    snippet ? h('div', { class: 'entry-snippet' }, snippet) : null,
    e.emotions?.length ? h('div', { class: 'chips', style: { marginTop: '8px' } }, e.emotions.slice(0, 4).map((x) => emotionChip(x.id))) : null
  );
}

function page(...children) {
  return h('main', { class: 'page' }, children);
}

function topbar(title, { backTo, actions } = {}) {
  return h(
    'div',
    { class: 'topbar', style: { paddingRight: '64px' } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
      backTo ? h('a', { class: 'icon-btn', href: backTo, 'aria-label': t('back') }, icon('back')) : null,
      h('h1', { style: { margin: 0, fontSize: backTo ? '1.25rem' : '1.6rem' } }, title)
    ),
    actions ? h('div', { class: 'actions' }, actions) : null
  );
}

function nav(active) {
  const items = [
    ['home', '#/home', 'home', t('tabHome')],
    ['journal', '#/journal', 'journal', t('tabJournal')],
    ['new', '#/new', 'plus', t('tabNew')],
    ['exercises', '#/exercises', 'leaf', t('tabExercises')],
    ['insights', '#/insights', 'chart', t('tabInsights')],
  ];
  return h(
    'nav',
    { class: 'nav', 'aria-label': 'Main' },
    h(
      'ul',
      {},
      items.map(([key, href, ic, label]) =>
        h(
          'li',
          {},
          h(
            'a',
            { href, class: (active === key ? 'on ' : '') + (key === 'new' ? 'plus' : ''), 'aria-current': active === key ? 'page' : null },
            key === 'new' ? h('span', { class: 'ring' }, icon(ic)) : icon(ic),
            h('span', {}, label)
          )
        )
      )
    )
  );
}

function sosButton() {
  return h('button', { class: 'sos-btn sos-float', type: 'button', onclick: openSOS, 'aria-label': t('sos') }, t('sos'));
}

// ---------- SOS ----------

function openSOS() {
  let country = getLang() === 'el' ? 'cy' : 'intl';
  const body = h('div');
  const draw = () => {
    body.replaceChildren(
      h('h2', {}, t('sosTitle')),
      h('p', { class: 'muted' }, t('sosText')),
      seg(Object.entries(HELPLINES).map(([k, v]) => [k, L(v)]), country, (v) => {
        country = v;
        draw();
      }),
      h(
        'div',
        { class: 'card', style: { marginTop: '14px' } },
        HELPLINES[country].lines.map((ln) =>
          h(
            'div',
            { class: 'line-item' },
            h('div', {}, h('div', {}, L(ln)), ln.tel ? h('div', { class: 'muted small' }, ln.tel) : null),
            ln.tel
              ? h('a', { class: 'btn primary', href: `tel:${ln.tel}` }, t('call'))
              : h('a', { class: 'btn', href: ln.url, target: '_blank', rel: 'noopener' }, t('open'))
          )
        )
      ),
      h('div', { class: 'card' }, h('h3', {}, t('groundingTitle')), h('ol', { style: { margin: 0, paddingLeft: '1.2em' } }, t('grounding').map((g) => h('li', {}, g)))),
      h('p', { class: 'muted small' }, t('helplinesUnverified')),
      h('button', { class: 'btn block', type: 'button', onclick: () => close() }, t('close'))
    );
  };
  draw();
  const close = sheet(body);
}

function maybeRiskNote(text) {
  if (!hasRiskWords(text)) return;
  const close = sheet(
    h(
      'div',
      {},
      h('p', {}, t('riskNote')),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { close(); openSOS(); } }, t('seeHelp')),
        h('button', { class: 'btn', type: 'button', onclick: () => close() }, t('notNow'))
      )
    )
  );
}

// ---------- onboarding ----------

const ob = { step: 0, pin: '', recoveryKey: '' };

function renderOnboarding() {
  const dots = h('div', { class: 'dots' }, [0, 1, 2, 3, 4].map((i) => h('span', { class: i === Math.min(ob.step, 4) ? 'on' : '' })));
  const wrap = h('div', { class: 'center' }, dots);
  const err = h('div', { class: 'error', role: 'alert' });

  if (ob.step === 0) {
    wrap.append(
      h('div', { class: 'logo', 'aria-hidden': 'true' }, 'σ'),
      h('h1', {}, t('appName')),
      h('p', { class: 'muted' }, t('tagline')),
      h('p', {}, t('welcomeIs')),
      h('p', { class: 'muted' }, t('welcomeIsNot')),
      h('button', { class: 'btn primary block', onclick: () => { ob.step = 1; render(); } }, t('start'))
    );
  } else if (ob.step === 1) {
    wrap.append(
      h('h2', {}, t('language')),
      seg([['el', 'Ελληνικά'], ['en', 'English']], getLang(), async (v) => {
        state.settings.lang = v;
        setLang(v);
        await saveSettings();
        render();
      }),
      h('h2', { style: { marginTop: '24px' } }, t('theme')),
      seg([['system', t('themeSystem')], ['light', t('themeLight')], ['dark', t('themeDark')]], state.settings.theme, async (v) => {
        state.settings.theme = v;
        applyTheme();
        await saveSettings();
        render();
      }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary block', onclick: () => { ob.step = 2; render(); } }, t('next')))
    );
  } else if (ob.step === 2 || ob.step === 3) {
    const confirm = ob.step === 3;
    const input = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', class: 'pin-input', 'aria-label': t(confirm ? 'confirmPin' : 'choosePin') });
    const submit = () => {
      const v = input.value.trim();
      if (!/^\d{4,}$/.test(v)) return (err.textContent = t('pinTooShort'));
      if (!confirm) {
        ob.pin = v;
        ob.step = 3;
        return render();
      }
      if (v !== ob.pin) {
        ob.step = 2;
        ob.pin = '';
        render();
        return toast(t('pinMismatch'));
      }
      ob.recoveryKey = generateRecoveryKey();
      btn.disabled = true;
      setupKeys(ob.pin, ob.recoveryKey).then(() => {
        ob.pin = '';
        ob.step = 4;
        render();
      });
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    const btn = h('button', { class: 'btn primary block', onclick: submit }, t('next'));
    wrap.append(
      h('h2', {}, t(confirm ? 'confirmPin' : 'choosePin')),
      h('p', { class: 'muted' }, t('choosePinHint')),
      input,
      err,
      btn,
      confirm ? null : h('p', { class: 'muted small', style: { marginTop: '16px' } }, t('localOnly'))
    );
    setTimeout(() => input.focus());
  } else if (ob.step === 4) {
    wrap.append(
      h('h2', {}, t('recoveryTitle')),
      h('p', {}, t('recoveryText')),
      h('div', { class: 'recovery' }, ob.recoveryKey),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => navigator.clipboard?.writeText(ob.recoveryKey).then(() => toast(t('copied'))) }, t('copy')),
        h('button', {
          class: 'btn primary',
          style: { flex: 1 },
          onclick: async () => {
            ob.recoveryKey = '';
            state.settings.onboarded = true;
            await saveSettings();
            ob.step = 5;
            render();
          },
        }, t('recoverySaved'))
      )
    );
  } else {
    wrap.append(
      h('h2', {}, t('firstCheckin')),
      moodScale(null, async (n) => {
        await saveEntry({ type: 'checkin', mood: n, emotions: [], tagIds: [] });
        toast(t('checkinSaved'));
        ob.step = 0;
        go('#/home');
      }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => { ob.step = 0; go('#/home'); } }, t('next')))
    );
  }
  return wrap;
}

// ---------- lock screen ----------

let recovering = false;

function renderLock() {
  const err = h('div', { class: 'error', role: 'alert' });
  const wrap = h('div', { class: 'center' }, h('div', { class: 'logo', 'aria-hidden': 'true' }, icon('lock')));

  if (!recovering) {
    const input = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'current-password', class: 'pin-input', 'aria-label': t('enterPin') });
    const submit = async () => {
      btn.disabled = true;
      try {
        await unlock(input.value.trim());
        go(location.hash && location.hash !== '#/' ? location.hash : '#/home');
      } catch {
        err.textContent = t('wrongPin');
        input.value = '';
        btn.disabled = false;
        input.focus();
      }
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    const btn = h('button', { class: 'btn primary block', onclick: submit }, t('unlock'));
    wrap.append(
      h('h2', {}, t('enterPin')),
      input,
      err,
      btn,
      h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => { recovering = true; render(); } }, t('forgotPin'))
    );
    setTimeout(() => input.focus());
  } else {
    const rk = h('input', { type: 'text', autocomplete: 'off', spellcheck: false, 'aria-label': t('enterRecovery'), placeholder: 'XXXX-XXXX-…' });
    const np = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', class: 'pin-input', 'aria-label': t('newPin') });
    const submit = async () => {
      if (!/^\d{4,}$/.test(np.value.trim())) return (err.textContent = t('pinTooShort'));
      try {
        await recover(rk.value, np.value.trim());
        recovering = false;
        toast(t('pinChanged'));
        go('#/home');
      } catch {
        err.textContent = t('wrongRecovery');
      }
    };
    wrap.append(
      h('h2', {}, t('enterRecovery')),
      h('label', { class: 'field' }, rk),
      h('label', { class: 'field' }, h('span', {}, t('newPin')), np),
      err,
      h('button', { class: 'btn primary block', onclick: submit }, t('unlock')),
      h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => { recovering = false; render(); } }, t('back'))
    );
  }
  return wrap;
}

// ---------- home ----------

function promptOfDay() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const doy = Math.floor((d - start) / 86400000);
  return doy % PROMPTS.length;
}

function renderHome() {
  const hr = new Date().getHours();
  const greet = hr < 12 ? t('goodMorning') : hr < 18 ? t('goodAfternoon') : t('goodEvening');
  const pIdx = promptOfDay();
  const recent = state.entries.slice(0, 5);
  const todayCheckin = state.entries.find((e) => e.type === 'checkin' && dayKey(e.created_at) === dayKey(new Date()));

  return page(
    topbar(greet, { actions: h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': t('settings') }, icon('gear')) }),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, t('quickCheckin')),
      h('p', { class: 'muted small' }, t('howAreYou')),
      moodScale(todayCheckin?.mood ?? null, async (n) => {
        await saveEntry({ type: 'checkin', mood: n, emotions: [], tagIds: [] });
        toast(t('checkinSaved'));
        render();
      })
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'muted small' }, t('promptOfDay')),
      h('p', { style: { fontSize: '1.1rem', margin: '6px 0 12px' } }, L(PROMPTS[pIdx])),
      h('a', { class: 'btn', href: `#/write/guided/${pIdx}` }, t('writeAboutIt'))
    ),
    h('div', { class: 'section-label' }, t('recent')),
    recent.length ? recent.map(entryCard) : h('p', { class: 'muted' }, t('noEntries')),
    nav('home')
  );
}

// ---------- new entry ----------

function renderNew() {
  const opt = (href, title, desc) => h('a', { class: 'card ex-card', href }, h('div', {}, h('h3', {}, title), h('div', { class: 'muted small' }, desc)), icon('right'));
  return page(
    topbar(t('newEntry')),
    opt('#/write/free', t('freeText'), t('freeTextDesc')),
    opt('#/prompts', t('guided'), t('guidedDesc')),
    opt('#/exercises', t('exercise'), t('exerciseDesc')),
    nav('new')
  );
}

function renderPrompts() {
  const byTheme = {};
  PROMPTS.forEach((p, i) => (byTheme[p.theme] ||= []).push([p, i]));
  return page(
    topbar(t('guided'), { backTo: '#/new' }),
    Object.entries(byTheme).map(([theme, list]) => [
      h('div', { class: 'section-label' }, L(PROMPT_THEMES[theme])),
      list.map(([p, i]) => h('a', { class: 'card ex-card', href: `#/write/guided/${i}` }, h('div', {}, L(p)), icon('right'))),
    ]),
    nav('new')
  );
}

// Shared editor for free, guided and exercise entries (new or existing).
function renderEditor(entry) {
  entry.emotions ||= [];
  entry.tagIds ||= [];
  const exercise = entry.type === 'exercise' ? EXERCISES.find((x) => x.id === entry.exerciseId) : null;
  if (exercise) entry.answers ||= {};
  const status = h('span', { class: 'muted small', 'aria-live': 'polite' });

  const hasContent = () =>
    !!(entry.title || entry.body || entry.mood || entry.emotions.length || (entry.answers && Object.values(entry.answers).some(Boolean)));

  const persist = async () => {
    if (!hasContent()) return;
    await saveEntry(entry);
    status.textContent = t('autosaved');
  };
  const autosave = debounce(persist, 700);
  cleanup = () => autosave.flush();

  // Step 1: feelings
  const feel = h('section', { class: 'card' });
  const drawFeel = () => {
    const selected = new Map(entry.emotions.map((x) => [x.id, x.intensity]));
    const toggle = (id) => {
      if (selected.has(id)) entry.emotions = entry.emotions.filter((x) => x.id !== id);
      else entry.emotions.push({ id, intensity: 5 });
      drawFeel();
      autosave();
    };
    const families = h('div', { class: 'chips' });
    const subs = h('div');
    for (const f of EMOTION_FAMILIES) {
      const on = selected.has(f.key);
      families.append(
        h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => toggle(f.key) }, h('span', { class: 'sw', style: { background: f.color } }), L(f))
      );
      const open = on || f.children.some(([id]) => selected.has(id));
      if (open) {
        subs.append(
          h(
            'div',
            { class: 'chip-sub' },
            h('div', { class: 'muted small', style: { marginBottom: '6px' } }, L(f)),
            h(
              'div',
              { class: 'chips' },
              f.children.map(([id]) =>
                h('button', { type: 'button', class: 'chip' + (selected.has(id) ? ' on' : ''), 'aria-pressed': String(selected.has(id)), onclick: () => toggle(id) }, L(EMOTIONS[id]))
              )
            )
          )
        );
      }
    }
    const sliders = entry.emotions.map((x) => {
      const val = h('span', { class: 'small' }, String(x.intensity));
      return h(
        'div',
        { class: 'emo-row' },
        h('span', { class: 'small' }, L(EMOTIONS[x.id])),
        h('input', {
          type: 'range', min: 1, max: 10, value: x.intensity, 'aria-label': `${t('intensity')}: ${L(EMOTIONS[x.id])}`,
          oninput: (e) => { x.intensity = Number(e.target.value); val.textContent = e.target.value; autosave(); },
        }),
        val
      );
    });
    feel.replaceChildren(
      h('h2', {}, `1. ${t('stepFeel')}`),
      h('div', { class: 'muted small', style: { marginBottom: '8px' } }, t('overallMood')),
      moodScale(entry.mood ?? null, (n) => { entry.mood = entry.mood === n ? null : n; drawFeel(); autosave(); }),
      h('p', { class: 'muted small', style: { margin: '16px 0 8px' } }, t('pickEmotions')),
      families,
      subs,
      sliders.length ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'muted small' }, t('intensity')), sliders) : null
    );
  };
  drawFeel();

  // Step 2: what is going on
  const what = h('section', { class: 'card' }, h('h2', {}, `2. ${t('stepWhat')}`));
  if (exercise) {
    for (const st of exercise.steps) {
      what.append(
        h(
          'label',
          { class: 'field' },
          h('div', { class: 'step-q' }, L(st)),
          h('textarea', { class: 'short', value: entry.answers[st.key] || '', oninput: (e) => { entry.answers[st.key] = e.target.value; autosave(); } })
        )
      );
    }
  } else {
    if (entry.type === 'guided' && PROMPTS[entry.promptIndex]) what.append(h('p', { style: { fontSize: '1.05rem' } }, L(PROMPTS[entry.promptIndex])));
    what.append(
      h('label', { class: 'field' }, h('input', { type: 'text', placeholder: t('title'), 'aria-label': t('title'), value: entry.title || '', oninput: (e) => { entry.title = e.target.value; autosave(); } })),
      h('textarea', { placeholder: t('body'), 'aria-label': t('body'), value: entry.body || '', oninput: (e) => { entry.body = e.target.value; autosave(); } })
    );
  }

  // Step 3: tags
  const tagsSec = h('section', { class: 'card' });
  const drawTags = () => {
    const input = h('input', { type: 'text', placeholder: t('newTag'), 'aria-label': t('newTag') });
    const addTag = async () => {
      const tag = await createTag(input.value);
      if (tag && !entry.tagIds.includes(tag.id)) entry.tagIds.push(tag.id);
      drawTags();
      autosave();
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), addTag()));
    tagsSec.replaceChildren(
      h('h2', {}, `3. ${t('stepTags')}`),
      h(
        'div',
        { class: 'chips', style: { marginBottom: '12px' } },
        state.tags.map((tg) => {
          const on = entry.tagIds.includes(tg.id);
          return h('button', {
            type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on),
            onclick: () => { entry.tagIds = on ? entry.tagIds.filter((x) => x !== tg.id) : [...entry.tagIds, tg.id]; drawTags(); autosave(); },
          }, h('span', { class: 'sw', style: { background: tg.color } }), tg.name);
        })
      ),
      h('div', { style: { display: 'flex', gap: '8px' } }, input, h('button', { class: 'btn', type: 'button', onclick: addTag }, t('add')))
    );
  };
  drawTags();

  const finish = async () => {
    await autosave.flush();
    cleanup = null;
    if (!hasContent()) return go('#/home');
    go(`#/entry/${entry.id}`);
    if (hasRiskWords(entryText(entry))) maybeRiskNote(entryText(entry));
    else toast(t('savedThanks'));
  };

  const heading = exercise ? L(exercise) : entry.type === 'guided' ? t('guided') : entry.id ? t('edit') : t('freeText');
  return page(
    topbar(heading, { backTo: entry.id ? `#/entry/${entry.id}` : '#/new' }),
    feel,
    what,
    tagsSec,
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, h('button', { class: 'btn primary', onclick: finish }, t('done')), status)
  );
}

// ---------- entry view ----------

function renderEntry(id) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return renderNotFound();
  const exercise = e.type === 'exercise' ? EXERCISES.find((x) => x.id === e.exerciseId) : null;
  const del = () => {
    const close = sheet(
      h(
        'div',
        {},
        h('p', {}, t('confirmDeleteEntry')),
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn danger', onclick: async () => { await deleteEntry(id); close(); go('#/journal'); } }, t('delete')),
          h('button', { class: 'btn', onclick: () => close() }, t('cancel'))
        )
      )
    );
  };
  return page(
    topbar(entryHeading(e), { backTo: '#/journal' }),
    h(
      'div',
      { class: 'entry-meta' },
      h('span', {}, `${fmtDate(e.created_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtTime(e.created_at)}`),
      h('span', {}, '·'),
      h('span', {}, t('types')[e.type])
    ),
    e.mood || e.emotions?.length
      ? h(
          'section',
          { class: 'card' },
          e.mood ? h('p', {}, `${t('overallMood')}: `, h('span', { class: 'mood-pill' }, `${e.mood}/10`)) : null,
          e.emotions?.length ? h('div', { class: 'chips' }, e.emotions.map((x) => h('span', { class: 'chip static' }, h('span', { class: 'sw', style: { background: EMOTIONS[x.id].color } }), `${L(EMOTIONS[x.id])} · ${x.intensity}`))) : null
        )
      : null,
    e.type === 'guided' && PROMPTS[e.promptIndex] && e.title ? h('p', { class: 'muted' }, L(PROMPTS[e.promptIndex])) : null,
    e.body ? h('section', { class: 'card prose' }, e.body) : null,
    exercise && e.answers
      ? h('section', { class: 'card' }, exercise.steps.filter((st) => e.answers[st.key]).map((st) => h('div', { style: { marginBottom: '14px' } }, h('div', { class: 'step-q' }, L(st)), h('div', { class: 'prose' }, e.answers[st.key]))))
      : null,
    e.tagIds?.length ? h('div', { class: 'chips' }, e.tagIds.map(tagById).filter(Boolean).map((tg) => h('span', { class: 'chip static' }, h('span', { class: 'sw', style: { background: tg.color } }), tg.name))) : null,
    h(
      'div',
      { class: 'btn-row' },
      e.type !== 'checkin' ? h('a', { class: 'btn', href: `#/edit/${e.id}` }, t('edit')) : null,
      h('button', { class: 'btn danger', onclick: del }, t('delete'))
    ),
    nav('journal')
  );
}

// ---------- journal ----------

const jf = { month: null, day: null, q: '', tagId: '', family: '' };

function renderJournal() {
  const now = new Date();
  if (!jf.month) jf.month = new Date(now.getFullYear(), now.getMonth(), 1);
  const m = jf.month;

  const byDay = {};
  for (const e of state.entries) (byDay[dayKey(e.created_at)] ||= []).push(e);

  const list = h('div');
  const drawList = () => {
    const q = jf.q.trim().toLowerCase();
    const rows = state.entries.filter((e) => {
      if (jf.day && dayKey(e.created_at) !== jf.day) return false;
      if (jf.tagId && !e.tagIds?.includes(jf.tagId)) return false;
      if (jf.family && !e.emotions?.some((x) => EMOTIONS[x.id]?.family === jf.family)) return false;
      if (q && !entryText(e).toLowerCase().includes(q) && !entryHeading(e).toLowerCase().includes(q)) return false;
      return true;
    });
    list.replaceChildren(...(rows.length ? rows.map(entryCard) : [h('p', { class: 'muted' }, t('noEntries'))]));
  };

  // Calendar
  const cal = h('div', { class: 'cal', role: 'grid' }, t('weekdays').map((w) => h('div', { class: 'wd' }, w)));
  const firstDow = (m.getDay() + 6) % 7; // Monday first
  const daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++) cal.append(h('div'));
  for (let d = 1; d <= daysIn; d++) {
    const key = dayKey(new Date(m.getFullYear(), m.getMonth(), d));
    const items = byDay[key] || [];
    cal.append(
      h(
        'button',
        {
          type: 'button',
          class: (key === dayKey(now) ? 'today ' : '') + (key === jf.day ? 'sel' : ''),
          'aria-pressed': String(key === jf.day),
          'aria-label': `${fmtDate(key + 'T12:00:00')}: ${items.length} ${t('entriesCount')}`,
          onclick: () => { jf.day = jf.day === key ? null : key; render(); },
        },
        h('span', {}, String(d)),
        h('span', { class: 'dot' + (items.length ? '' : ' empty') })
      )
    );
  }
  const shift = (n) => { jf.month = new Date(m.getFullYear(), m.getMonth() + n, 1); jf.day = null; render(); };

  const search = h('input', { type: 'search', placeholder: t('search'), 'aria-label': t('search'), value: jf.q, oninput: (e) => { jf.q = e.target.value; drawList(); } });
  const tagSel = h(
    'select',
    { 'aria-label': t('allTags'), onchange: (e) => { jf.tagId = e.target.value; drawList(); } },
    h('option', { value: '' }, t('allTags')),
    state.tags.map((tg) => h('option', { value: tg.id, selected: jf.tagId === tg.id }, tg.name))
  );
  const famSel = h(
    'select',
    { 'aria-label': t('allEmotions'), onchange: (e) => { jf.family = e.target.value; drawList(); } },
    h('option', { value: '' }, t('allEmotions')),
    EMOTION_FAMILIES.map((f) => h('option', { value: f.key, selected: jf.family === f.key }, L(f)))
  );
  drawList();

  return page(
    topbar(t('tabJournal')),
    h(
      'section',
      { class: 'card' },
      h(
        'div',
        { class: 'cal-head' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': '‹', onclick: () => shift(-1) }, icon('left')),
        h('h2', { style: { margin: 0 } }, fmtDate(m, { month: 'long', year: 'numeric' })),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': '›', onclick: () => shift(1) }, icon('right'))
      ),
      cal
    ),
    h('div', { class: 'filters' }, search, tagSel, famSel),
    jf.day || jf.q || jf.tagId || jf.family
      ? h('button', { class: 'btn ghost', style: { marginBottom: '8px' }, onclick: () => { Object.assign(jf, { day: null, q: '', tagId: '', family: '' }); render(); } }, t('clearFilters'))
      : null,
    list,
    nav('journal')
  );
}

// ---------- exercises ----------

function renderExercises() {
  return page(
    topbar(t('exercisesLib')),
    Object.entries(EXERCISE_CATEGORIES).map(([cat, label]) => {
      const list = EXERCISES.filter((x) => x.category === cat);
      if (!list.length) return null;
      return [
        h('div', { class: 'section-label' }, L(label)),
        list.map((x) =>
          h('a', { class: 'card ex-card', href: x.breathing ? '#/breathe' : `#/write/exercise/${x.id}` }, h('div', {}, h('h3', {}, L(x)), h('div', { class: 'muted small' }, L(x.desc))), icon('right'))
        ),
      ];
    }),
    nav('exercises')
  );
}

let breathPattern = 'box';

function renderBreathe() {
  const pattern = BREATHING[breathPattern];
  const circle = h('div', { class: 'breath-circle' }, h('div', {}, h('div', { class: 'breath-label' }, ''), h('div', { class: 'breath-count' }, '')));
  const label = circle.querySelector('.breath-label');
  const count = circle.querySelector('.breath-count');
  let timer = null;
  let cycles = 0;

  const stop = () => {
    clearTimeout(timer);
    timer = null;
    circle.style.transitionDuration = '1s';
    circle.style.transform = 'scale(0.55)';
    label.textContent = '';
    btn.textContent = t('begin');
  };
  const run = (i) => {
    const [key, secs, target] = pattern.phases[i];
    label.textContent = t(key);
    count.textContent = cycles ? `${cycles} ${t('cycles')}` : '';
    circle.style.transitionDuration = `${secs}s`;
    circle.style.transform = `scale(${target ? 1 : 0.55})`;
    timer = setTimeout(() => {
      const next = (i + 1) % pattern.phases.length;
      if (next === 0) cycles++;
      run(next);
    }, secs * 1000);
  };
  const btn = h('button', { class: 'btn primary', onclick: () => (timer ? stop() : run(0)) }, t('begin'));
  cleanup = () => clearTimeout(timer);

  return page(
    topbar(L(EXERCISES.find((x) => x.id === 'breathing')), { backTo: '#/exercises' }),
    seg(Object.entries(BREATHING).map(([k, v]) => [k, L(v)]), breathPattern, (v) => { breathPattern = v; render(); }),
    h('div', { class: 'breath-stage' }, circle),
    h('div', { style: { textAlign: 'center' } }, btn),
    nav('exercises')
  );
}

// ---------- insights ----------

let insightRange = 30;

function renderInsights() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (insightRange - 1));
  const inRange = state.entries.filter((e) => new Date(e.created_at) >= since);

  const daily = {};
  for (const e of inRange) if (e.mood) (daily[dayKey(e.created_at)] ||= []).push(e.mood);
  const points = Object.entries(daily)
    .map(([k, v]) => ({ key: k, mood: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const moods = inRange.filter((e) => e.mood).map((e) => e.mood);
  const avg = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : '–';

  const counts = {};
  for (const e of inRange) for (const x of e.emotions || []) counts[x.id] = (counts[x.id] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCount = top.length ? top[0][1] : 1;

  return page(
    topbar(t('tabInsights')),
    seg([[30, t('last30')], [90, t('last90')]], insightRange, (v) => { insightRange = v; render(); }),
    h(
      'div',
      { class: 'stats', style: { marginTop: '16px' } },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, String(inRange.length)), h('div', { class: 'k' }, t('entriesCount'))),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, avg), h('div', { class: 'k' }, t('avgMood')))
    ),
    h('section', { class: 'card' }, h('h2', {}, t('moodOverTime')), points.length >= 2 ? moodChart(points, since) : h('p', { class: 'muted' }, t('notEnoughData'))),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, t('frequentEmotions')),
      top.length
        ? h(
            'div',
            { class: 'bars' },
            top.map(([id, n]) =>
              h(
                'div',
                { class: 'bar-row' },
                h('span', {}, L(EMOTIONS[id])),
                h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${(n / maxCount) * 100}%` } })),
                h('span', { class: 'n' }, String(n))
              )
            )
          )
        : h('p', { class: 'muted' }, t('notEnoughData'))
    ),
    nav('insights')
  );
}

function moodChart(points, since) {
  const W = 360, H = 180, padL = 24, padR = 12, padT = 12, padB = 26;
  const days = insightRange;
  const x = (key) => {
    const i = Math.round((new Date(key + 'T12:00:00') - since) / 86400000);
    return padL + (i / (days - 1)) * (W - padL - padR);
  };
  const y = (v) => padT + (1 - (v - 1) / 9) * (H - padT - padB);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('moodOverTime') });
  for (const v of [1, 5, 10]) {
    svg.append(s('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }), s('text', { class: 'axis', x: padL - 8, y: y(v) + 4, 'text-anchor': 'end' }, String(v)));
  }
  const end = new Date(since);
  end.setDate(end.getDate() + days - 1);
  [[since, 'start'], [end, 'end']].forEach(([d, anchor]) =>
    svg.append(s('text', { class: 'axis', x: x(dayKey(d)), y: H - 6, 'text-anchor': anchor }, fmtDate(d, { day: 'numeric', month: 'short' })))
  );
  svg.append(s('path', { class: 'line', d: points.map((p, i) => `${i ? 'L' : 'M'}${x(p.key).toFixed(1)},${y(p.mood).toFixed(1)}`).join(' ') }));
  const cross = s('line', { class: 'cross', y1: padT, y2: H - padB, visibility: 'hidden' });
  svg.append(cross);
  for (const p of points) svg.append(s('circle', { class: 'pt', cx: x(p.key), cy: y(p.mood), r: 4 }));

  const wrap = h('div', { class: 'chart-wrap' }, svg);
  const tip = h('div', { class: 'tooltip hidden' });
  wrap.append(tip);

  const show = (clientX) => {
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(x(p.key) - vx) < Math.abs(x(best.key) - vx)) best = p;
    const px = x(best.key);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('visibility', 'visible');
    tip.textContent = `${fmtDate(best.key + 'T12:00:00', { day: 'numeric', month: 'short' })} · ${best.mood.toFixed(1)}/10`;
    tip.style.left = `${(px / W) * 100}%`;
    tip.style.top = `${(y(best.mood) / H) * r.height}px`;
    tip.classList.remove('hidden');
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.classList.add('hidden'); };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', hide);
  return wrap;
}

// ---------- settings ----------

function renderSettings() {
  const st = state.settings;
  const update = async (patch) => {
    Object.assign(st, patch);
    setLang(st.lang);
    applyTheme();
    await saveSettings();
    render();
  };

  const changePinSheet = () => {
    const err = h('div', { class: 'error', role: 'alert' });
    const cur = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'current-password' });
    const np = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password' });
    const np2 = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password' });
    const close = sheet(
      h(
        'div',
        {},
        h('h2', {}, t('changePin')),
        h('label', { class: 'field' }, h('span', {}, t('currentPin')), cur),
        h('label', { class: 'field' }, h('span', {}, t('newPin')), np),
        h('label', { class: 'field' }, h('span', {}, t('confirmPin')), np2),
        err,
        h(
          'div',
          { class: 'btn-row' },
          h('button', {
            class: 'btn primary',
            onclick: async () => {
              if (!/^\d{4,}$/.test(np.value)) return (err.textContent = t('pinTooShort'));
              if (np.value !== np2.value) return (err.textContent = t('pinMismatch'));
              try {
                await changePin(cur.value, np.value);
                close();
                toast(t('pinChanged'));
              } catch {
                err.textContent = t('wrongPin');
              }
            },
          }, t('save')),
          h('button', { class: 'btn', onclick: () => close() }, t('cancel'))
        )
      )
    );
  };

  const exportData = () => {
    const data = exportAll();
    data.entries = data.entries.map((e) => ({ ...e, emotions: (e.emotions || []).map((x) => ({ ...x, name: L(EMOTIONS[x.id]) })), tags: (e.tagIds || []).map((id) => tagById(id)?.name).filter(Boolean) }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `skepsis-${dayKey(new Date())}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const deleteAllSheet = () => {
    const input = h('input', { type: 'text', autocomplete: 'off', 'aria-label': t('deleteWord') });
    const btn = h('button', {
      class: 'btn danger',
      disabled: true,
      onclick: async () => {
        await deleteEverything();
        location.hash = '';
        location.reload();
      },
    }, t('deleteAll'));
    input.addEventListener('input', () => (btn.disabled = input.value.trim() !== t('deleteWord')));
    const close = sheet(h('div', {}, h('h2', {}, t('deleteAll')), h('p', {}, t('deleteAllConfirm')), input, h('div', { class: 'btn-row' }, btn, h('button', { class: 'btn', onclick: () => close() }, t('cancel')))));
  };

  return page(
    topbar(t('settings'), { backTo: '#/home' }),
    h(
      'section',
      { class: 'card' },
      h('h3', {}, t('language')),
      seg([['el', 'Ελληνικά'], ['en', 'English']], st.lang, (v) => update({ lang: v })),
      h('h3', { style: { marginTop: '18px' } }, t('theme')),
      seg([['system', t('themeSystem')], ['light', t('themeLight')], ['dark', t('themeDark')]], st.theme, (v) => update({ theme: v }))
    ),
    h(
      'section',
      { class: 'card' },
      h('h3', {}, t('security')),
      h('label', { class: 'toggle', style: { marginBottom: '14px' } }, h('span', {}, t('autoLock')), h('input', { type: 'checkbox', checked: st.autoLock, onchange: (e) => update({ autoLock: e.target.checked }) })),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: changePinSheet }, t('changePin')), h('button', { class: 'btn', onclick: () => { lock(); go('#/home'); } }, t('lockNow')))
    ),
    h(
      'section',
      { class: 'card' },
      h('h3', {}, t('data')),
      h('p', { class: 'muted small' }, t('exportHint')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: exportData }, t('exportData')), h('button', { class: 'btn danger', onclick: deleteAllSheet }, t('deleteAll')))
    ),
    h('section', { class: 'card' }, h('h3', {}, t('about')), h('p', {}, t('disclaimer')), h('p', { class: 'muted small' }, t('localOnly')))
  );
}

function renderNotFound() {
  return page(topbar('—', { backTo: '#/home' }), nav(''));
}

// ---------- router ----------

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const [r, a, b] = parts;
  switch (r) {
    case '':
    case 'home': return renderHome();
    case 'journal': return renderJournal();
    case 'new': return renderNew();
    case 'prompts': return renderPrompts();
    case 'write':
      if (a === 'free') return renderEditor({ type: 'free' });
      if (a === 'guided') return renderEditor({ type: 'guided', promptIndex: Number(b) || 0 });
      if (a === 'exercise' && EXERCISES.some((x) => x.id === b && !x.breathing)) return renderEditor({ type: 'exercise', exerciseId: b });
      return renderNotFound();
    case 'edit': {
      const e = state.entries.find((x) => x.id === a);
      return e ? renderEditor(structuredClone(e)) : renderNotFound();
    }
    case 'entry': return renderEntry(a);
    case 'exercises': return renderExercises();
    case 'breathe': return renderBreathe();
    case 'insights': return renderInsights();
    case 'settings': return renderSettings();
    default: return renderNotFound();
  }
}

let lastHash = null;

function render() {
  if (cleanup) {
    const c = cleanup;
    cleanup = null;
    c();
  }
  let view;
  if (!state.settings.onboarded) view = renderOnboarding();
  else if (!isUnlocked()) view = renderLock();
  else view = route();
  root.replaceChildren(view, sosButton());
  if (location.hash !== lastHash) window.scrollTo(0, 0);
  lastHash = location.hash;
}

// Auto-lock after the app has been in the background for a minute.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    cleanup?.(); // flush pending autosave
  } else if (state.settings.autoLock && isUnlocked() && Date.now() - hiddenAt > 60000) {
    lock();
    render();
  }
});

window.addEventListener('hashchange', render);

(async function init() {
  await loadSettings();
  setLang(state.settings.lang);
  applyTheme();
  if (state.settings.onboarded && !state.keyring) state.settings.onboarded = false;
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
