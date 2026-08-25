/* ============================================================
   ФК «ДЕРБЕНТ» — админ-панель (no-code блочный редактор)
   Все изменения хранятся локально (предпросмотр) и экспортируются
   в файл data.js, который заменяется в репозитории.
   ============================================================ */
'use strict';

const LS_KEY = 'fcderbent_data_v1';
const SESSION_KEY = 'fcderbent_admin_session';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- Хеш пароля (djb2) ----------
function pwHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// ---------- Состояние ----------
let DATA = null;
let SECTION = 'settings';
let DIRTY = false;
const OPEN = new Set();

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (o[k] == null) o[k] = /^\d+$/.test(keys[keys.indexOf(k) + 1] ?? '') || /^\d+$/.test(k) ? [] : {};
    return o[k];
  }, obj);
  target[last] = val;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Описания секций ----------
const SECTIONS = [
  { id: 'settings', title: 'Общие настройки' },
  { id: 'news', title: 'Новости' },
  { id: 'teams', title: 'Клубы лиги' },
  { id: 'matches', title: 'Матчи' },
  { id: 'players', title: 'Игроки' },
  { id: 'coaches', title: 'Тренерский штаб' },
  { id: 'management', title: 'Руководство' },
  { id: 'vacancies', title: 'Вакансии' },
  { id: 'pages', title: 'Страницы' },
  { id: 'export', title: 'Экспорт / Импорт' }
];

const POS_NAMES = { GK: 'Вратарь', DF: 'Защитник', MF: 'Полузащитник', FW: 'Нападающий' };

// ---------- Поля ----------
function textField(path, label, opts = {}) {
  const val = getPath(DATA, path) ?? '';
  return `<div class="f-field ${opts.full ? 'full' : ''}">
    <label>${esc(label)}</label>
    <input type="text" data-path="${path}" value="${esc(val)}" placeholder="${esc(opts.ph || '')}">
  </div>`;
}
function dateField(path, label) {
  const val = getPath(DATA, path) ?? '';
  return `<div class="f-field"><label>${esc(label)}</label><input type="date" data-path="${path}" value="${esc(val)}"></div>`;
}
function numField(path, label) {
  const val = getPath(DATA, path);
  return `<div class="f-field"><label>${esc(label)}</label><input type="number" data-path="${path}" value="${val == null ? '' : esc(val)}"></div>`;
}
function colorField(path, label) {
  const val = getPath(DATA, path) || '#888888';
  return `<div class="f-field"><label>${esc(label)}</label><input type="color" data-path="${path}" value="${esc(val)}"></div>`;
}
function selectField(path, label, options) {
  const val = getPath(DATA, path) ?? '';
  return `<div class="f-field"><label>${esc(label)}</label>
    <select data-path="${path}">${options.map(o =>
      `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select></div>`;
}
function textareaField(path, label, ph) {
  const val = getPath(DATA, path) ?? '';
  return `<div class="f-field full"><label>${esc(label)}</label>
    <textarea data-path="${path}" placeholder="${esc(ph || '')}">${esc(val)}</textarea></div>`;
}
function imageField(path, label) {
  const val = getPath(DATA, path) ?? '';
  const id = 'f_' + path.replace(/\W/g, '_');
  return `<div class="f-field full"><label>${esc(label)}</label>
    <div class="img-field">
      <img id="${id}_prev" src="${esc(val)}" alt="" onerror="this.style.opacity=.25">
      <div class="col">
        <input type="text" id="${id}_url" data-path="${path}" value="${esc(val)}" placeholder="URL картинки или загрузите файл">
        <div class="img-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('${id}_file').click()">Загрузить файл</button>
          <input type="file" id="${id}_file" accept="image/*" style="display:none" data-img-target="${path}">
        </div>
      </div>
    </div></div>`;
}

// ---------- Карточка-блок ----------
function blockHTML({ id, title, sub, badge, badgeGray, thumb, body }) {
  const open = OPEN.has(id);
  return `<div class="block ${open ? 'open' : ''}" data-block="${id}">
    <div class="block-head" data-action="toggle" data-id="${id}">
      ${thumb ? `<img class="b-thumb" src="${esc(thumb)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
      <div>
        <div class="b-title">${esc(title)}</div>
        ${sub ? `<div class="b-sub">${esc(sub)}</div>` : ''}
      </div>
      <div class="spacer"></div>
      ${badge ? `<span class="b-badge ${badgeGray ? 'gray' : ''}">${esc(badge)}</span>` : ''}
      <button class="icon-btn" title="Вверх" data-action="up" data-id="${id}">↑</button>
      <button class="icon-btn" title="Вниз" data-action="down" data-id="${id}">↓</button>
      <button class="icon-btn del" title="Удалить" data-action="del" data-id="${id}">✕</button>
      <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="block-body">${body}</div>
  </div>`;
}

// ---------- Секции ----------
function sectionSettings() {
  return `
    <div class="hint">Общая информация клуба: название, hero-блок главной страницы, логотип, контакты и пароль админ-панели.</div>
    <div class="block open" data-block="s-main">
      <div class="block-head" data-action="toggle" data-id="s-main"><div><div class="b-title">Клуб и главная страница</div></div><div class="spacer"></div><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></div>
      <div class="block-body"><div class="f-grid">
        ${textField('settings.clubName', 'Название клуба', { full: true })}
        ${textField('settings.tagline', 'Слоган')}
        ${textField('settings.founded', 'Год основания')}
        ${textField('settings.stadium', 'Стадион')}
        ${textField('settings.league', 'Лига / турнир')}
        ${textField('settings.season', 'Сезон')}
        ${textField('settings.heroBadge', 'Hero: бейдж')}
        ${textField('settings.heroTitle', 'Hero: заголовок')}
        ${textField('settings.heroSubtitle', 'Hero: подзаголовок', { full: true })}
        ${imageField('settings.logo', 'Логотип клуба')}
        ${imageField('settings.heroImage', 'Hero: фоновое фото')}
      </div></div>
    </div>
    <div class="block open" data-block="s-contacts" style="margin-top:12px">
      <div class="block-head" data-action="toggle" data-id="s-contacts"><div><div class="b-title">Контакты</div></div><div class="spacer"></div><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></div>
      <div class="block-body"><div class="f-grid">
        ${textField('settings.contacts.address', 'Адрес', { full: true })}
        ${textField('settings.contacts.phone', 'Телефон')}
        ${textField('settings.contacts.phoneExtra', 'Доп. телефон')}
        ${textField('settings.contacts.email', 'E-mail')}
        ${textField('settings.contacts.pressEmail', 'E-mail для СМИ')}
        ${textField('settings.contacts.workHours', 'Часы работы')}
        ${textField('settings.contacts.social.vk', 'ВКонтакте — ссылка')}
        ${textField('settings.contacts.social.telegram', 'Telegram — ссылка')}
        ${textField('settings.contacts.social.youtube', 'YouTube — ссылка')}
      </div></div>
    </div>
    <div class="block open" data-block="s-pass" style="margin-top:12px">
      <div class="block-head" data-action="toggle" data-id="s-pass"><div><div class="b-title">Пароль админ-панели</div></div><div class="spacer"></div><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></div>
      <div class="block-body">
        <div class="f-grid">
          <div class="f-field"><label>Новый пароль</label><input type="password" id="new-pass" placeholder="Оставьте пустым, чтобы не менять"></div>
        </div>
        <p style="font-size:12.5px;color:var(--muted);margin-top:10px">После смены пароля не забудьте экспортировать data.js и обновить его в репозитории.</p>
      </div>
    </div>`;
}

function sectionNews() {
  const news = [...(DATA.news || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
    <div class="hint">Новости для главной страницы. Нажмите на карточку, чтобы отредактировать.</div>
    <div class="blocks">
      ${news.map(n => blockHTML({
        id: `news:${n.id}`,
        title: n.title || 'Без названия',
        sub: n.date || '',
        badge: 'Новость',
        thumb: n.image,
        body: `<div class="f-grid">
          ${textField(`news.${DATA.news.indexOf(n)}.title`, 'Заголовок', { full: true })}
          ${dateField(`news.${DATA.news.indexOf(n)}.date`, 'Дата')}
          ${imageField(`news.${DATA.news.indexOf(n)}.image`, 'Фото новости')}
          ${textareaField(`news.${DATA.news.indexOf(n)}.excerpt`, 'Краткое описание (для карточки)')}
          ${textareaField(`news.${DATA.news.indexOf(n)}.content`, 'Полный текст (абзацы разделяйте переносом строки)')}
        </div>`
      })).join('')}
    </div>
    <button class="btn btn-primary" style="margin-top:16px" data-action="add-news">+ Добавить новость</button>`;
}

function sectionTeams() {
  return `
    <div class="hint">Клубы чемпионата. Откройте карточку любого клуба — здесь можно изменить логотип, название, город, цвет и описание.</div>
    <div class="blocks">
      ${(DATA.teams || []).map((t, i) => blockHTML({
        id: `team:${t.id}`,
        title: t.name || t.id,
        sub: t.city || '',
        badge: t.id === 'derbent' ? 'Наш клуб' : 'Клуб лиги',
        badgeGray: t.id !== 'derbent',
        thumb: t.logo,
        body: `<div class="f-grid">
          ${textField(`teams.${i}.name`, 'Название')}
          ${textField(`teams.${i}.city`, 'Город')}
          ${colorField(`teams.${i}.color`, 'Цвет клуба')}
          ${imageField(`teams.${i}.logo`, 'Логотип')}
          ${textareaField(`teams.${i}.description`, 'Описание клуба')}
        </div>`
      })).join('')}
    </div>`;
}

function sectionMatches() {
  const teamOpts = (DATA.teams || []).map(t => ({ value: t.id, label: t.name }));
  return `
    <div class="hint">Сыгранные матчи. Турнирная таблица на сайте пересчитывается автоматически по этим результатам (правила FIFA: 3–1–0).</div>
    <div class="blocks">
      ${(DATA.matches || []).map((m, i) => blockHTML({
        id: `match:${m.id}`,
        title: `${teamName(m.home)} ${m.homeScore ?? '—'} : ${m.awayScore ?? '—'} ${teamName(m.away)}`,
        sub: m.date || '',
        badge: 'Матч',
        body: `<div class="f-grid">
          ${dateField(`matches.${i}.date`, 'Дата')}
          ${textField(`matches.${i}.venue`, 'Стадион')}
          ${selectField(`matches.${i}.home`, 'Хозяева', teamOpts)}
          ${selectField(`matches.${i}.away`, 'Гости', teamOpts)}
          ${numField(`matches.${i}.homeScore`, 'Голы хозяев')}
          ${numField(`matches.${i}.awayScore`, 'Голы гостей')}
        </div>`
      })).join('')}
    </div>
    <button class="btn btn-primary" style="margin-top:16px" data-action="add-match">+ Добавить матч</button>
    ${miniTableHTML()}`;
}

function teamName(id) { return DATA.teams?.find(t => t.id === id)?.name || id; }

function miniTableHTML() {
  const table = {};
  (DATA.teams || []).forEach(t => table[t.id] = { name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, id: t.id });
  (DATA.matches || []).forEach(m => {
    if (m.homeScore == null || m.awayScore == null) return;
    const h = table[m.home], a = table[m.away];
    if (!h || !a) return;
    h.p++; a.p++; h.gf += +m.homeScore; h.ga += +m.awayScore; a.gf += +m.awayScore; a.ga += +m.homeScore;
    if (+m.homeScore > +m.awayScore) { h.w++; a.l++; h.pts += 3; }
    else if (+m.homeScore < +m.awayScore) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });
  const rows = Object.values(table).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  return `<div class="mini-wrap"><h3>Предпросмотр турнирной таблицы</h3>
    <table class="mini-table"><thead><tr><th>#</th><th style="text-align:left">Клуб</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Мячи</th><th>О</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr class="${r.id === 'derbent' ? 'is-derbent' : ''}"><td>${i + 1}</td><td class="t-left">${esc(r.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`;
}

function sectionPlayers() {
  const groups = [['GK', 'Вратари'], ['DF', 'Защитники'], ['MF', 'Полузащитники'], ['FW', 'Нападающие']];
  return `
    <div class="hint">Игроки сгруппированы по позициям: сначала вратари, затем защитники, полузащитники и нападающие. Порядок внутри группы можно менять стрелками.</div>
    ${groups.map(([pos, label]) => {
      const list = (DATA.players || []).map((p, i) => ({ p, i })).filter(x => x.p.position === pos);
      if (!list.length) return `<div class="hint" style="background:#fff;border-color:var(--line);color:var(--muted)">${label}: пока нет игроков</div>`;
      return `<h3 style="margin:20px 0 10px;font-size:16px">${label}</h3>
      <div class="blocks">${list.map(({ p, i }) => blockHTML({
        id: `player:${p.id}`,
        title: `${p.number ? p.number + '. ' : ''}${p.name || 'Без имени'}`,
        sub: `${POS_NAMES[pos] || ''}${p.birthDate ? ' · ' + p.birthDate : ''}`,
        badge: POS_NAMES[pos],
        thumb: p.photo,
        body: `<div class="f-grid">
          ${textField(`players.${i}.name`, 'Фамилия и имя', { full: true })}
          ${selectField(`players.${i}.position`, 'Позиция', [
            { value: 'GK', label: 'Вратарь' }, { value: 'DF', label: 'Защитник' },
            { value: 'MF', label: 'Полузащитник' }, { value: 'FW', label: 'Нападающий' }
          ])}
          ${numField(`players.${i}.number`, 'Номер')}
          ${dateField(`players.${i}.birthDate`, 'Дата рождения')}
          ${numField(`players.${i}.stats.matches`, 'Матчей')}
          ${numField(`players.${i}.stats.goals`, 'Голов')}
          ${numField(`players.${i}.stats.assists`, 'Ассистов')}
          ${imageField(`players.${i}.photo`, 'Фото игрока')}
          ${textareaField(`players.${i}.bio`, 'Биография (абзацы разделяйте переносом строки)')}
        </div>`
      })).join('')}</div>`;
    }).join('')}
    <button class="btn btn-primary" style="margin-top:16px" data-action="add-player">+ Добавить игрока</button>`;
}

function peopleSection(key, label) {
  return `
    <div class="hint">${label}. Нажмите на карточку для редактирования.</div>
    <div class="blocks">
      ${(DATA[key] || []).map((p, i) => blockHTML({
        id: `${key}:${p.id}`,
        title: p.name || 'Без имени',
        sub: p.role || '',
        badge: 'Персона',
        thumb: p.photo,
        body: `<div class="f-grid">
          ${textField(`${key}.${i}.name`, 'Фамилия и имя', { full: true })}
          ${textField(`${key}.${i}.role`, 'Должность', { full: true })}
          ${imageField(`${key}.${i}.photo`, 'Фото')}
          ${textareaField(`${key}.${i}.bio`, 'Биография (абзацы разделяйте переносом строки)')}
        </div>`
      })).join('')}
    </div>
    <button class="btn btn-primary" style="margin-top:16px" data-action="add-${key}">+ Добавить</button>`;
}

function sectionVacancies() {
  return `
    <div class="hint">Тексты раздела «Вакансии».</div>
    <div class="block open" data-block="vac">
      <div class="block-head" data-action="toggle" data-id="vac"><div><div class="b-title">Тексты</div></div><div class="spacer"></div><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></div>
      <div class="block-body"><div class="f-grid">
        ${textareaField('vacanciesIntro', 'Текст «вакансий нет» (абзацы разделяйте переносом строки)')}
        ${textareaField('vacanciesSuccess', 'Сообщение после отправки формы')}
      </div></div>
    </div>`;
}

function sectionPages() {
  return ['stadium', 'school'].map(key => {
    const page = DATA.pages?.[key] || { title: key, blocks: [] };
    const label = key === 'stadium' ? 'Стадион' : 'Спортивная школа';
    return `<h3 style="margin:20px 0 10px;font-size:16px">${label}</h3>
      <div class="hint">Добавляйте блоки контента: заголовок, текст или картинку. Блоки можно менять местами.</div>
      <div class="blocks">
        ${(page.blocks || []).map((b, i) => blockHTML({
          id: `page:${key}:${i}`,
          title: b.type === 'heading' ? 'Заголовок' : b.type === 'image' ? 'Картинка' : 'Текст',
          sub: String(b.value || '').slice(0, 70),
          badge: `Блок ${i + 1}`,
          badgeGray: true,
          body: `<div class="f-grid">
            ${selectField(`pages.${key}.blocks.${i}.type`, 'Тип блока', [
              { value: 'heading', label: 'Заголовок' }, { value: 'text', label: 'Текст' }, { value: 'image', label: 'Картинка' }
            ])}
            ${b.type === 'image'
              ? imageField(`pages.${key}.blocks.${i}.value`, 'Картинка')
              : textareaField(`pages.${key}.blocks.${i}.value`, 'Содержимое')}
          </div>`
        })).join('')}
      </div>
      <button class="btn btn-outline" style="margin-top:12px" data-action="add-block" data-key="${key}">+ Добавить блок</button>`;
  }).join('');
}

function sectionExport() {
  return `
    <div class="export-grid">
      <div class="export-card">
        <h3>Как опубликовать изменения</h3>
        <p>Сайт статический (GitHub Pages), поэтому изменения публикуются через файл данных:</p>
        <ol>
          <li>Внесите изменения в разделах админки.</li>
          <li>Нажмите <b>«Экспорт data.js»</b> — скачается файл <code>data.js</code>.</li>
          <li>Замените им файл <code>data/data.js</code> в репозитории и сделайте commit + push.</li>
          <li>Через минуту изменения появятся на сайте.</li>
        </ol>
        <button class="btn btn-primary" id="export-btn2">Экспорт data.js</button>
        <p style="margin-top:14px;font-size:12.5px">Кнопка <b>«Сохранить (предпросмотр)»</b> применяет изменения только в вашем браузере — удобно проверить результат до публикации.</p>
      </div>
      <div class="export-card">
        <h3>Импорт данных</h3>
        <p>Загрузите существующий <code>data.js</code> или вставьте его содержимое, чтобы продолжить редактирование с другого устройства.</p>
        <input type="file" id="import-file" accept=".js,.json" style="display:none">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <button class="btn btn-outline" id="import-file-btn">Выбрать файл</button>
          <button class="btn btn-outline" id="import-paste-btn">Импортировать из поля</button>
        </div>
        <textarea id="import-text" placeholder='window.SITE_DATA = { ... }'></textarea>
      </div>
    </div>`;
}

// ---------- Рендер ----------
function render() {
  const sec = SECTIONS.find(s => s.id === SECTION);
  $('#section-title').childNodes[0].textContent = sec.title + ' ';
  const counts = {
    news: (DATA.news || []).length, teams: (DATA.teams || []).length, matches: (DATA.matches || []).length,
    players: (DATA.players || []).length, coaches: (DATA.coaches || []).length, management: (DATA.management || []).length
  };
  $('#side-nav').innerHTML = SECTIONS.map(s =>
    `<button class="side-link ${s.id === SECTION ? 'active' : ''}" data-section="${s.id}">
      ${s.title}${counts[s.id] != null ? `<span class="cnt">${counts[s.id]}</span>` : ''}
    </button>`).join('');
  const root = $('#admin-root');
  switch (SECTION) {
    case 'settings': root.innerHTML = sectionSettings(); break;
    case 'news': root.innerHTML = sectionNews(); break;
    case 'teams': root.innerHTML = sectionTeams(); break;
    case 'matches': root.innerHTML = sectionMatches(); break;
    case 'players': root.innerHTML = sectionPlayers(); break;
    case 'coaches': root.innerHTML = peopleSection('coaches', 'Тренерский штаб'); break;
    case 'management': root.innerHTML = peopleSection('management', 'Руководство клуба'); break;
    case 'vacancies': root.innerHTML = sectionVacancies(); break;
    case 'pages': root.innerHTML = sectionPages(); break;
    case 'export': root.innerHTML = sectionExport(); break;
  }
  bindExportButtons();
}

function bindExportButtons() {
  const b2 = $('#export-btn2');
  if (b2) b2.addEventListener('click', exportData);
  const f = $('#import-file-btn');
  if (f) {
    f.addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => { $('#import-text').value = r.result; importData(r.result); };
      r.readAsText(file);
    });
    $('#import-paste-btn').addEventListener('click', () => importData($('#import-text').value));
  }
}

// ---------- Коллекции: добавление/удаление/перемещение ----------
function findIndexById(collection, id) {
  return DATA[collection].findIndex(x => `${collection.slice(0, -1)}:${x.id}` === id || x.id === id);
}
function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function addNews() {
  DATA.news.unshift({ id: uid(), date: new Date().toISOString().slice(0, 10), title: 'Заголовок новости', excerpt: '', image: '', content: '' });
  refresh('news');
}
function addMatch() {
  const t = DATA.teams || [];
  DATA.matches.push({ id: uid(), date: new Date().toISOString().slice(0, 10), home: t[0]?.id || '', away: t[1]?.id || '', homeScore: 0, awayScore: 0, venue: '', league: 'championat' });
  refresh('matches');
}
function addPlayer() {
  DATA.players.push({ id: uid(), name: 'Новый игрок', position: 'MF', number: 0, birthDate: '2000-01-01', photo: '', stats: { matches: 0, goals: 0 }, bio: '' });
  refresh('players');
}
function addPerson(key) {
  DATA[key].push({ id: uid(), name: 'ФИО', role: 'Должность', photo: '', bio: '' });
  refresh(key);
}

function handleAction(action, id, key) {
  const [coll, itemId] = id ? id.split(/:(.+)/) : [];
  const structChange = () => { markDirty(); render(); };
  switch (action) {
    case 'toggle': OPEN.has(id) ? OPEN.delete(id) : OPEN.add(id); render(); break;
    case 'add-news': addNews(); break;
    case 'add-match': addMatch(); break;
    case 'add-player': addPlayer(); break;
    case 'add-coaches': addPerson('coaches'); break;
    case 'add-management': addPerson('management'); break;
    case 'add-block': {
      const page = DATA.pages[key];
      page.blocks.push({ type: 'text', value: '' });
      OPEN.add(`page:${key}:${page.blocks.length - 1}`);
      structChange();
      break;
    }
    case 'del': {
      if (!confirm('Удалить этот блок?')) return;
      if (coll === 'news') DATA.news = DATA.news.filter(x => x.id !== itemId);
      else if (coll === 'team') { /* команды не удаляем, только редактируем */ toast('Клубы лиги удалять нельзя — можно только редактировать'); return; }
      else if (coll === 'match') DATA.matches = DATA.matches.filter(x => x.id !== itemId);
      else if (coll === 'player') DATA.players = DATA.players.filter(x => x.id !== itemId);
      else if (coll === 'coach') DATA.coaches = DATA.coaches.filter(x => x.id !== itemId);
      else if (coll === 'management') DATA.management = DATA.management.filter(x => x.id !== itemId);
      else if (coll === 'page') {
        const [, , idx] = id.split(':');
        const [pageKey, , ] = id.replace('page:', '').split(':');
        DATA.pages[pageKey].blocks.splice(+idx, 1);
      }
      structChange();
      break;
    }
    case 'up': case 'down': {
      const arr = { news: 'news', match: 'matches', player: 'players', coach: 'coaches', management: 'management' }[coll];
      if (arr) {
        const i = DATA[arr].findIndex(x => x.id === itemId);
        const j = action === 'up' ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= DATA[arr].length) return;
        [DATA[arr][i], DATA[arr][j]] = [DATA[arr][j], DATA[arr][i]];
        structChange();
      } else if (coll === 'page') {
        const parts = id.split(':');
        const pageKey = parts[1], idx = +parts[2];
        const blocks = DATA.pages[pageKey].blocks;
        const j = action === 'up' ? idx - 1 : idx + 1;
        if (j < 0 || j >= blocks.length) return;
        [blocks[idx], blocks[j]] = [blocks[j], blocks[idx]];
        if (OPEN.has(id)) { OPEN.delete(id); OPEN.add(`page:${pageKey}:${j}`); }
        structChange();
      }
      break;
    }
  }
}

// ---------- Ввод значений ----------
function bindInputs() {
  const root = $('#admin-root');
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.path) {
      let val = el.value;
      if (el.type === 'number') val = val === '' ? null : +val;
      setPath(DATA, el.dataset.path, val);
      markDirty();
      if (SECTION === 'matches') scheduleMiniTable();
      const prev = document.getElementById('f_' + el.dataset.path.replace(/\W/g, '_') + '_prev');
      if (prev) { prev.src = val; prev.style.opacity = 1; }
    }
  });
  root.addEventListener('change', e => {
    const file = e.target;
    if (file.dataset.imgTarget && file.files && file.files[0]) {
      const f = file.files[0];
      if (f.size > 700 * 1024) toast('Внимание: файл больше 700 КБ — data.js станет тяжёлым. Лучше сжать изображение.');
      const r = new FileReader();
      r.onload = () => {
        setPath(DATA, file.dataset.imgTarget, r.result);
        markDirty(); render();
        toast('Картинка загружена. Не забудьте экспортировать data.js.');
      };
      r.readAsDataURL(f);
    }
  });
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    handleAction(btn.dataset.action, btn.dataset.id, btn.dataset.key);
  });
  // Смена пароля
  const np = document.getElementById('new-pass');
  if (np) np.addEventListener('input', () => { if (np.value) { DATA.settings.adminPasswordHash = pwHash(np.value); markDirty(); } });
}

let miniTimer = null;
function scheduleMiniTable() {
  clearTimeout(miniTimer);
  miniTimer = setTimeout(() => {
    const wrap = $('.mini-wrap');
    if (wrap) wrap.outerHTML = miniTableHTML().replace('<div class="mini-wrap">', '<div class="mini-wrap">').replace(/<h3>/, '<h3>');
  }, 400);
}

// ---------- Сохранение / экспорт / импорт ----------
function markDirty() { DIRTY = true; $('#dirty-dot').classList.add('show'); }
function clearDirty() { DIRTY = false; $('#dirty-dot').classList.remove('show'); }

function savePreview() {
  localStorage.setItem(LS_KEY, JSON.stringify(DATA));
  clearDirty();
  toast('Сохранено! Откройте сайт — изменения видны в этом браузере.');
}
function exportData() {
  const text = '// Данные сайта ФК «Дербент» (сгенерировано в админ-панели)\n// Замените этим файлом data/data.js в репозитории и сделайте push.\nwindow.SITE_DATA = ' + JSON.stringify(DATA, null, 2) + ';\n';
  const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.js';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Файл data.js скачан. Замените им data/data.js в репозитории.');
}
function importData(text) {
  try {
    const json = String(text).replace(/^\s*(\/\/[^\n]*\n)*\s*window\.SITE_DATA\s*=\s*/, '').replace(/;\s*$/, '');
    const parsed = JSON.parse(json);
    if (!parsed.settings) throw new Error('bad');
    DATA = parsed;
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
    clearDirty();
    render();
    toast('Данные импортированы!');
  } catch (e) {
    toast('Ошибка: не удалось разобрать файл. Нужен содержимое data.js или JSON.');
  }
}
function resetChanges() {
  if (!confirm('Сбросить все изменения предпросмотра и вернуть данные из data.js?')) return;
  localStorage.removeItem(LS_KEY);
  DATA = deepClone(window.SITE_DATA_ORIG);
  clearDirty();
  render();
  toast('Изменения сброшены.');
}

// ---------- Тост ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

// ---------- Вход ----------
function tryLogin(pw) {
  const expected = DATA.settings?.adminPasswordHash || pwHash('derbent1966');
  return pwHash(pw) === expected;
}
function showAdmin() {
  $('#login-screen').style.display = 'none';
  $('#admin-layout').style.display = '';
  render();
  bindInputs();
}
function init() {
  window.SITE_DATA_ORIG = window.SITE_DATA;
  DATA = deepClone(window.SITE_DATA);
  // Локальный предпросмотр в админке не нужен — работаем всегда с оригиналом + несохранённые правки
  const saved = localStorage.getItem(LS_KEY);
  if (saved) { try { DATA = JSON.parse(saved); } catch (e) {} }

  $('#side-nav').addEventListener('click', e => {
    const b = e.target.closest('[data-section]');
    if (b) { SECTION = b.dataset.section; render(); window.scrollTo({ top: 0 }); }
  });
  $('#save-btn').addEventListener('click', savePreview);
  $('#export-btn').addEventListener('click', exportData);
  $('#reset-btn').addEventListener('click', resetChanges);
  $('#logout-btn').addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); location.reload(); });
  $('#login-form').addEventListener('submit', e => {
    e.preventDefault();
    const pw = $('#login-password').value;
    if (tryLogin(pw)) { sessionStorage.setItem(SESSION_KEY, '1'); showAdmin(); }
    else $('#login-error').textContent = 'Неверный пароль';
  });
  if (sessionStorage.getItem(SESSION_KEY) === '1') showAdmin();
  else $('#login-screen').style.display = '';
}
document.addEventListener('DOMContentLoaded', init);
