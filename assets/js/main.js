/* ============================================================
   ФК «ДЕРБЕНТ» — ядро сайта
   ============================================================ */
'use strict';

// ---------- Данные (с приоритетом локального предпросмотра из админки) ----------
const LS_KEY = 'fcderbent_data_v1';
try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) window.SITE_DATA = JSON.parse(saved);
} catch (e) { /* ignore */ }
const DATA = window.SITE_DATA || {};

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
}
function formatShortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}
function age(birthIso) {
  if (!birthIso) return '';
  const b = new Date(birthIso);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}
function paragraphs(text) {
  return String(text || '').split(/\n+/).filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`).join('');
}

// ---------- Команды / матчи ----------
function teamById(id) { return (DATA.teams || []).find(t => t.id === id); }
function teamInitials(name) {
  return String(name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function teamBadge(id) {
  const t = teamById(id);
  if (!t) return '<span class="team-badge"></span>';
  const fb = (extra) => `<span class="fallback" style="background:${esc(t.color || '#555')}${extra}">${esc(teamInitials(t.name))}</span>`;
  if (t.logo) {
    return `<span class="team-badge"><img src="${esc(t.logo)}" alt="${esc(t.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${fb(';display:none')}</span>`;
  }
  return `<span class="team-badge">${fb('')}</span>`;
}
function sortedMatches() {
  return [...(DATA.matches || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
// Турнирная таблица по регламенту FIFA: победа — 3, ничья — 1, поражение — 0
function computeStandings() {
  const table = {};
  (DATA.teams || []).forEach(t => {
    table[t.id] = { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
  });
  (DATA.matches || []).forEach(m => {
    if (m.homeScore == null || m.awayScore == null) return;
    const h = table[m.home], a = table[m.away];
    if (!h || !a) return;
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.won++; a.lost++; h.points += 3; }
    else if (m.homeScore < m.awayScore) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points += 1; a.points += 1; }
  });
  return Object.values(table).sort((x, y) =>
    y.points - x.points ||
    (y.gf - y.ga) - (x.gf - x.ga) ||
    y.gf - x.gf ||
    x.team.name.localeCompare(y.team.name, 'ru')
  );
}

// ---------- Игроки / люди ----------
const POS_ORDER = ['GK', 'DF', 'MF', 'FW'];
const POS_NAMES = { GK: 'Вратари', DF: 'Защитники', MF: 'Полузащитники', FW: 'Нападающие' };
const POS_SINGLE = { GK: 'Вратарь', DF: 'Защитник', MF: 'Полузащитник', FW: 'Нападающий' };
function playerById(id) { return (DATA.players || []).find(p => p.id === id); }
function personById(id) {
  return (DATA.management || []).find(p => p.id === id) ||
         (DATA.coaches || []).find(p => p.id === id) || null;
}
function avatarHTML(p) {
  const initials = esc(String(p.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());
  if (p.photo) {
    return `<img src="${esc(p.photo)}" alt="${esc(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="avatar-fallback" style="display:none">${initials}</div>`;
  }
  return `<div class="avatar-fallback">${initials}</div>`;
}

// ---------- SVG-иконки ----------
const ICONS = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3L4.3 7.6l5.3-.8z"/><path d="M7.5 21.5l1.9-5.6M16.5 21.5l-1.9-5.6M2.5 9.5l5.9 2.1M21.5 9.5l-5.9 2.1"/></svg>',
  vk: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.16 17.86c-5.61 0-8.81-3.85-8.95-10.28h2.81c.1 4.71 2.17 6.71 3.82 7.12V7.58h2.64v4.07c1.63-.17 3.34-2.03 3.91-4.07h2.64c-.44 2.51-2.3 4.37-3.62 5.13 1.32.61 3.44 2.24 4.24 5.15h-2.9c-.63-1.97-2.21-3.5-4.37-3.7v3.7h-.22z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.6 18.9 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-.9.5l.3-4.6L18.3 7c.4-.3-.1-.5-.6-.2L7.3 13.3 2.9 12c-1-.3-1-1 .2-1.4l17.5-6.7c.8-.3 1.5.2 1.3.7z"/></svg>',
  yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2c-.3-1-1-1.8-2-2C19.2 4.7 12 4.7 12 4.7s-7.2 0-9 .5c-1 .3-1.8 1-2 2C.5 9 .5 12 .5 12s0 3 .5 4.8c.3 1 1 1.8 2 2 1.8.5 9 .5 9 .5s7.2 0 9-.5c1-.3 1.8-1 2-2 .5-1.8.5-4.8.5-4.8s0-3-.5-4.8zM9.8 15.3V8.7L15.7 12l-5.9 3.3z"/></svg>'
};

// ---------- Шапка ----------
const NAV = [
  { label: 'Главная', href: 'index.html', key: 'home' },
  {
    label: 'Клуб', key: 'club', children: [
      { label: 'Визитная карточка', href: 'club-card.html' },
      { label: 'Руководство', href: 'club-management.html' },
      { label: 'Вакансии', href: 'club-vacancies.html' },
      { label: 'Стадион', href: 'club-stadium.html' }
    ]
  },
  {
    label: 'Команда', key: 'team', children: [
      { label: 'Состав команды', href: 'team-squad.html' },
      { label: 'Тренерский штаб', href: 'team-staff.html' }
    ]
  },
  { label: 'Спортивная школа', href: 'school.html', key: 'school' },
  { label: 'Контакты', href: 'contacts.html', key: 'contacts' }
];
function pageKey() {
  const p = location.pathname.split('/').pop() || 'index.html';
  if (['index.html', ''].includes(p)) return 'home';
  if (['news.html'].includes(p)) return 'home';
  if (['player.html', 'person.html', 'team-squad.html', 'team-staff.html'].includes(p)) return 'team';
  if (p.startsWith('club-')) return 'club';
  if (p === 'school.html') return 'school';
  if (p === 'contacts.html') return 'contacts';
  return '';
}
function renderChrome() {
  const key = pageKey();
  const header = $('#site-header');
  if (header) {
    header.innerHTML = `
      <div class="container header-inner">
        <a class="brand" href="index.html">
          <img src="${esc(DATA.settings?.logo || 'images/logo.png')}" alt="${esc(DATA.settings?.clubName || 'ФК Дербент')}">
          <span class="brand-text"><span class="brand-name">ФК Дербент</span><span class="brand-sub">с 1966 года</span></span>
        </a>
        <nav class="nav">
          ${NAV.map(item => item.children
            ? `<div class="nav-item${key === item.key ? ' active' : ''}">
                 <a class="nav-link" href="${item.children[0].href}" onclick="return false;">${item.label}
                   <svg class="nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
                 </a>
                 <div class="dropdown">${item.children.map(c =>
                   `<a href="${c.href}" class="${location.pathname.endsWith(c.href) ? 'active' : ''}">${c.label}</a>`).join('')}
                 </div>
               </div>`
            : `<div class="nav-item${key === item.key ? ' active' : ''}"><a class="nav-link" href="${item.href}">${item.label}</a></div>`
          ).join('')}
        </nav>
        <button class="burger" id="burger" aria-label="Меню"><span></span><span></span><span></span></button>
      </div>`;
    const mobile = document.createElement('div');
    mobile.className = 'mobile-nav';
    mobile.id = 'mobile-nav';
    mobile.innerHTML = NAV.map(item => {
      if (!item.children) return `<a href="${item.href}" class="${key === item.key ? 'active' : ''}">${item.label}</a>`;
      return `<div class="m-label">${item.label}</div>` +
        item.children.map(c => `<a class="m-sub ${location.pathname.endsWith(c.href) ? 'active' : ''}" href="${c.href}">${c.label}</a>`).join('');
    }).join('');
    document.body.appendChild(mobile);
    const burger = $('#burger');
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobile.classList.toggle('open');
    });
    mobile.addEventListener('click', e => {
      if (e.target.tagName === 'A') { burger.classList.remove('open'); mobile.classList.remove('open'); }
    });
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const footer = $('#site-footer');
  if (footer) {
    const c = DATA.settings?.contacts || {};
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <img src="${esc(DATA.settings?.logo || 'images/logo.png')}" alt="ФК Дербент">
            <h5 style="font-size:16px;color:#fff;margin-bottom:10px;">ФК «Дербент»</h5>
            <p>${esc(DATA.settings?.tagline || '')} Основан в ${esc(DATA.settings?.founded || '1966')} году. Выступаем в ${esc(DATA.settings?.league || '')}.</p>
            <div class="socials" style="margin-top:18px">
              ${c.social?.vk ? `<a href="${esc(c.social.vk)}" target="_blank" rel="noopener" aria-label="ВКонтакте">${ICONS.vk}</a>` : ''}
              ${c.social?.telegram ? `<a href="${esc(c.social.telegram)}" target="_blank" rel="noopener" aria-label="Telegram">${ICONS.tg}</a>` : ''}
              ${c.social?.youtube ? `<a href="${esc(c.social.youtube)}" target="_blank" rel="noopener" aria-label="YouTube">${ICONS.yt}</a>` : ''}
            </div>
          </div>
          <div class="footer-col">
            <h5>Разделы</h5>
            <a href="index.html">Главная</a>
            <a href="team-squad.html">Состав команды</a>
            <a href="team-staff.html">Тренерский штаб</a>
            <a href="school.html">Спортивная школа</a>
            <a href="contacts.html">Контакты</a>
          </div>
          <div class="footer-col">
            <h5>Клуб</h5>
            <a href="club-card.html">Визитная карточка</a>
            <a href="club-management.html">Руководство</a>
            <a href="club-vacancies.html">Вакансии</a>
            <a href="club-stadium.html">Стадион</a>
          </div>
          <div class="footer-col">
            <h5>Контакты</h5>
            <span>${esc(c.address || '')}</span>
            <a href="tel:${esc((c.phone || '').replace(/[^+\d]/g, ''))}">${esc(c.phone || '')}</a>
            <a href="mailto:${esc(c.email || '')}">${esc(c.email || '')}</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ФК «Дербент». Все права защищены.</span>
          <span>Основан в ${esc(DATA.settings?.founded || '1966')} году · Дербент, Дагестан</span>
        </div>
      </div>`;
  }

  // Плашка предпросмотра (если включены локальные изменения из админки)
  if (localStorage.getItem(LS_KEY) && !document.getElementById('preview-bar')) {
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.id = 'preview-bar';
    bar.innerHTML = `<span>Включён предпросмотр изменений из админ-панели</span>
      <button onclick="localStorage.removeItem('${LS_KEY}');location.reload()">Сбросить</button>
      <a href="admin.html" style="text-decoration:underline">Админка</a>`;
    document.body.appendChild(bar);
  }
}

// ---------- Анимации появления ----------
function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  $$('.reveal').forEach(el => io.observe(el));
}

// ---------- Рендереры секций ----------
function renderNews(limit = 6) {
  const grid = $('#news-grid');
  if (!grid) return;
  const news = [...(DATA.news || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, limit);
  grid.innerHTML = news.map((n, i) => `
    <a class="news-card reveal" style="transition-delay:${i * 60}ms" href="news.html?id=${esc(n.id)}">
      <div class="news-media">
        <img src="${esc(n.image || 'images/news/news-1.jpg')}" alt="${esc(n.title)}" loading="lazy"
             onerror="this.src='images/news/news-1.jpg'">
        <span class="news-date">${formatDate(n.date)}</span>
      </div>
      <div class="news-body">
        <div class="news-title">${esc(n.title)}</div>
        <div class="news-excerpt">${esc(n.excerpt)}</div>
        <span class="link-arrow">Читать полностью
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </span>
      </div>
    </a>`).join('');
}

function matchRowHTML(m, i) {
  const home = teamById(m.home), away = teamById(m.away);
  const isDerbent = m.home === 'derbent' || m.away === 'derbent';
  const score = (m.homeScore == null || m.awayScore == null) ? '— : —' : `${m.homeScore} : ${m.awayScore}`;
  return `
    <div class="match-row${isDerbent ? ' is-derbent' : ''} reveal" style="transition-delay:${Math.min(i, 8) * 40}ms">
      <div class="match-date"><span class="d">${formatShortDate(m.date)}</span>${formatDate(m.date).replace(/ \d{4}/, '')}</div>
      <div class="match-team home">${esc(home?.name || m.home)}${teamBadge(m.home)}</div>
      <div class="match-score">${score}</div>
      <div class="match-team away">${teamBadge(m.away)}${esc(away?.name || m.away)}</div>
      ${m.venue ? `<div class="match-venue">${ICONS.pin}${esc(m.venue)}</div>` : ''}
    </div>`;
}

function renderMatches() {
  const list = $('#matches-list');
  if (!list) return;
  const tabs = $$('.tab');
  const state = { filter: 'all', limit: 10 };
  function draw() {
    let ms = sortedMatches();
    if (state.filter === 'derbent') ms = ms.filter(m => m.home === 'derbent' || m.away === 'derbent');
    const shown = ms.slice(0, state.limit);
    list.innerHTML = shown.map(matchRowHTML).join('') ||
      '<div style="padding:40px;text-align:center;color:var(--muted)">Матчей пока нет</div>';
    const more = $('#matches-more');
    if (ms.length > state.limit) {
      more.style.display = '';
      more.querySelector('span').textContent = `Показать все матчи (${ms.length})`;
    } else more.style.display = 'none';
    initReveal();
  }
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    state.filter = t.dataset.filter;
    state.limit = 10;
    draw();
  }));
  $('#matches-more')?.addEventListener('click', () => { state.limit = 1000; draw(); });
  draw();
}

function renderStandings() {
  const body = $('#standings-body');
  if (!body) return;
  const rows = computeStandings();
  body.innerHTML = rows.map((r, i) => `
    <tr class="${r.team.id === 'derbent' ? 'is-derbent' : ''}">
      <td class="pos">${i + 1}</td>
      <td class="t-left"><span class="club-cell">${teamBadge(r.team.id)}${esc(r.team.name)}</span></td>
      <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
      <td>${r.gf}:${r.ga}</td>
      <td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
      <td class="pts">${r.points}</td>
    </tr>`).join('');
}

// ---------- Страницы ----------
function renderSquad() {
  const wrap = $('#squad-groups');
  if (!wrap) return;
  wrap.innerHTML = POS_ORDER.map(pos => {
    const players = (DATA.players || []).filter(p => p.position === pos)
      .sort((a, b) => (a.number || 99) - (b.number || 99));
    if (!players.length) return '';
    return `
      <div class="pos-group">
        <div class="pos-title"><h3>${POS_NAMES[pos]}</h3><span class="count">${players.length}</span></div>
        <div class="people-grid">
          ${players.map((p, i) => `
            <a class="person-card reveal" style="transition-delay:${i * 50}ms" href="player.html?id=${esc(p.id)}">
              <div class="person-photo">
                ${avatarHTML(p)}
                <span class="person-number">${esc(p.number ?? '')}</span>
              </div>
              <div class="person-body">
                <div class="person-name">${esc(p.name)}</div>
                <div class="person-meta">${POS_SINGLE[pos]} · ${formatDate(p.birthDate)}</div>
              </div>
            </a>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderPeople(listElId, source, rolePrefix) {
  const wrap = $(listElId);
  if (!wrap) return;
  wrap.innerHTML = (source || []).map((p, i) => `
    <a class="person-card reveal" style="transition-delay:${i * 60}ms" href="person.html?id=${esc(p.id)}">
      <div class="person-photo">
        ${avatarHTML(p)}
        <span class="person-role">${esc(p.role || rolePrefix || '')}</span>
      </div>
      <div class="person-body">
        <div class="person-name">${esc(p.name)}</div>
        <div class="person-meta">${esc((p.bio || '').split('\n')[0].slice(0, 80))}…</div>
      </div>
    </a>`).join('');
}

function renderPlayerPage() {
  const p = playerById(new URLSearchParams(location.search).get('id'));
  const root = $('#player-root');
  if (!root) return;
  if (!p) { root.innerHTML = emptyStateHTML('Игрок не найден'); return; }
  document.title = `${p.name} — ФК «Дербент»`;
  root.innerHTML = `
    <section class="profile-hero">
      <div class="container">
        <div class="breadcrumbs"><a href="index.html">Главная</a><span class="sep">/</span><a href="team-squad.html">Состав команды</a><span class="sep">/</span><span>${esc(p.name)}</span></div>
        <div class="profile-layout">
          <div class="profile-photo">${avatarHTML(p)}</div>
          <div>
            <h1 class="profile-name">${esc(p.name)}</h1>
            <div class="profile-role">${POS_SINGLE[p.position] || ''} · «Дербент»</div>
            <div class="profile-facts">
              <div class="fact"><div class="f-lbl">Номер</div><div class="f-val">${esc(p.number ?? '—')}</div></div>
              <div class="fact"><div class="f-lbl">Дата рождения</div><div class="f-val" style="font-size:15px">${formatDate(p.birthDate)}</div></div>
              <div class="fact"><div class="f-lbl">Возраст</div><div class="f-val">${age(p.birthDate)}</div></div>
              <div class="fact"><div class="f-lbl">Матчей</div><div class="f-val">${esc(p.stats?.matches ?? '—')}</div></div>
              <div class="fact"><div class="f-lbl">Голов</div><div class="f-val">${esc(p.stats?.goals ?? '—')}</div></div>
            </div>
            <div class="profile-bio prose">${paragraphs(p.bio)}</div>
          </div>
        </div>
      </div>
    </section>`;
}

function renderPersonPage() {
  const p = personById(new URLSearchParams(location.search).get('id'));
  const root = $('#person-root');
  if (!root) return;
  if (!p) { root.innerHTML = emptyStateHTML('Страница не найдена'); return; }
  const isCoach = (DATA.coaches || []).some(c => c.id === p.id);
  document.title = `${p.name} — ФК «Дербент»`;
  root.innerHTML = `
    <section class="profile-hero">
      <div class="container">
        <div class="breadcrumbs">
          <a href="index.html">Главная</a><span class="sep">/</span>
          ${isCoach
            ? '<a href="team-staff.html">Тренерский штаб</a>'
            : '<a href="club-management.html">Руководство</a>'}
          <span class="sep">/</span><span>${esc(p.name)}</span>
        </div>
        <div class="profile-layout">
          <div class="profile-photo">${avatarHTML(p)}</div>
          <div>
            <h1 class="profile-name">${esc(p.name)}</h1>
            <div class="profile-role">${esc(p.role || '')}</div>
            <div class="profile-facts">
              <div class="fact"><div class="f-lbl">Клуб</div><div class="f-val" style="font-size:15px">ФК «Дербент»</div></div>
              <div class="fact"><div class="f-lbl">Город</div><div class="f-val" style="font-size:15px">Дербент</div></div>
            </div>
            <div class="profile-bio prose">${paragraphs(p.bio)}</div>
          </div>
        </div>
      </div>
    </section>`;
}

function renderNewsPage() {
  const n = (DATA.news || []).find(x => x.id === new URLSearchParams(location.search).get('id'));
  const root = $('#news-root');
  if (!root) return;
  if (!n) { root.innerHTML = emptyStateHTML('Новость не найдена'); return; }
  document.title = `${n.title} — ФК «Дербент»`;
  root.innerHTML = `
    <section class="profile-hero">
      <div class="container" style="max-width:860px">
        <div class="breadcrumbs"><a href="index.html">Главная</a><span class="sep">/</span><a href="index.html#news">Новости</a><span class="sep">/</span><span>${formatDate(n.date)}</span></div>
        <h1 class="page-title" style="font-size:clamp(24px,4vw,38px)">${esc(n.title)}</h1>
        <div style="color:var(--muted);margin-top:12px;font-weight:600">${formatDate(n.date)}</div>
      </div>
    </section>
    <section class="section" style="padding-top:40px">
      <div class="container" style="max-width:860px">
        <img src="${esc(n.image)}" alt="${esc(n.title)}" style="border-radius:var(--radius);margin-bottom:32px" onerror="this.style.display='none'">
        <div class="prose" style="font-size:17px">${paragraphs(n.content)}</div>
        <div style="margin-top:40px"><a class="btn btn-ghost btn-sm" href="index.html#news">← Все новости</a></div>
      </div>
    </section>`;
}

function renderBlocksPage(pageKey, rootSel) {
  const root = $(rootSel);
  if (!root) return;
  const page = DATA.pages?.[pageKey];
  const blocks = page?.blocks || [];
  if (!blocks.length) {
    root.innerHTML = `
      <section class="section">
        <div class="container">
          ${emptyStateHTML('Раздел скоро появится', 'Мы готовим информацию для этого раздела. Загляните позже — здесь появится подробное описание.')}
        </div>
      </section>`;
    return;
  }
  root.innerHTML = `
    <section class="section">
      <div class="container" style="max-width:860px">
        <div class="prose" style="font-size:17px">
          ${blocks.map(b => {
            if (b.type === 'heading') return `<h3>${esc(b.value)}</h3>`;
            if (b.type === 'image') return `<img src="${esc(b.value)}" style="border-radius:var(--radius);margin:18px 0" alt="">`;
            return paragraphs(b.value);
          }).join('')}
        </div>
      </div>
    </section>`;
}

function emptyStateHTML(title, text) {
  return `
    <div class="empty-state">
      <div class="es-icon">${ICONS.ball}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text || '')}</p>
    </div>`;
}

// ---------- Формы ----------
function bindForm(formSel, successSel, successText) {
  const form = $(formSel);
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    form.reset();
    const ok = $(successSel);
    if (ok) { ok.classList.add('show'); ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
}

// ---------- Инициализация страницы ----------
document.addEventListener('DOMContentLoaded', () => {
  renderChrome();
  const page = document.body.dataset.page;
  switch (page) {
    case 'home':
      {
        const s = DATA.settings || {};
        if (s.heroTitle && $('#hero-title')) $('#hero-title').textContent = s.heroTitle;
        if (s.heroSubtitle && $('#hero-sub')) $('#hero-sub').textContent = s.heroSubtitle;
        if (s.heroBadge && $('#hero-badge-text')) $('#hero-badge-text').textContent = s.heroBadge;
        if (s.heroImage && $('#hero-img')) $('#hero-img').src = s.heroImage;
      }
      renderNews(6);
      renderMatches();
      renderStandings();
      break;
    case 'news': renderNewsPage(); break;
    case 'club-card': break;
    case 'management': renderPeople('#management-grid', DATA.management, 'Руководство'); break;
    case 'vacancies': {
      const intro = $('#vacancies-intro');
      if (intro) intro.innerHTML = paragraphs(DATA.vacanciesIntro);
      const ok = $('#vacancies-success');
      if (ok && DATA.vacanciesSuccess) ok.querySelector('span').textContent = DATA.vacanciesSuccess;
      bindForm('#vacancies-form', '#vacancies-success');
      break;
    }
    case 'squad': renderSquad(); break;
    case 'staff': renderPeople('#staff-grid', DATA.coaches, 'Тренерский штаб'); break;
    case 'player': renderPlayerPage(); break;
    case 'person': renderPersonPage(); break;
    case 'school': renderBlocksPage('school', '#school-root'); break;
    case 'stadium': renderBlocksPage('stadium', '#stadium-root'); break;
    case 'contacts': {
      const c = DATA.settings?.contacts || {};
      const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
      set('#c-address', c.address);
      set('#c-phone', c.phone);
      set('#c-phone-extra', c.phoneExtra);
      set('#c-email', c.email);
      set('#c-press', c.pressEmail);
      set('#c-hours', c.workHours);
      const soc = $('#c-social');
      if (soc && c.social) soc.innerHTML = [
        c.social.vk ? `<a href="${esc(c.social.vk)}" target="_blank" rel="noopener" aria-label="ВКонтакте">${ICONS.vk}</a>` : '',
        c.social.telegram ? `<a href="${esc(c.social.telegram)}" target="_blank" rel="noopener" aria-label="Telegram">${ICONS.tg}</a>` : '',
        c.social.youtube ? `<a href="${esc(c.social.youtube)}" target="_blank" rel="noopener" aria-label="YouTube">${ICONS.yt}</a>` : ''
      ].join('');
      const tel = $('#c-phone-link'); if (tel) { tel.href = 'tel:' + (c.phone || '').replace(/[^+\d]/g, ''); }
      const tel2 = $('#c-phone-extra-link'); if (tel2) { tel2.href = 'tel:' + (c.phoneExtra || '').replace(/[^+\d]/g, ''); }
      const mail = $('#c-email-link'); if (mail) { mail.href = 'mailto:' + (c.email || ''); }
      bindForm('#contacts-form', '#contacts-success');
      break;
    }
  }
  initReveal();
});
