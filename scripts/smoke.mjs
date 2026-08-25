// Смоук-тест админки и главной без браузера: node scripts/smoke.mjs
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const els = {};
let elCount = 0;
function makeEl(id) {
  return {
    id: id || 'el' + elCount++,
    style: {}, value: '', textContent: '', dataset: {}, _html: '', _h: {},
    childNodes: [{ textContent: '' }],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    addEventListener(t, f) { this._h[t] = f; },
    appendChild() {},
    querySelector() { return makeEl('sub' + elCount++); },
    querySelectorAll() { return []; },
    scrollIntoView() {}, closest() { return null; }
  };
}
function getEl(sel) { if (!els[sel]) els[sel] = makeEl(sel); return els[sel]; }
const mkStore = () => ({ s: {}, getItem(k) { return k in this.s ? this.s[k] : null; }, setItem(k, v) { this.s[k] = String(v); }, removeItem(k) { delete this.s[k]; } });

function run(file, sandbox) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

// ---------- Админка ----------
{
  const doc = { _h: {}, body: makeEl('body'), addEventListener(t, f) { this._h[t] = f; }, querySelector: s => getEl(s), querySelectorAll: () => [], createElement: () => makeEl('c' + elCount++), getElementById: id => getEl('#' + id) };
  doc.body.dataset.page = 'home';
  const sb = {
    console, setTimeout, clearTimeout, confirm: () => true, scrollTo: () => {},
    document: doc, localStorage: mkStore(), sessionStorage: mkStore(),
    FileReader: class { readAsDataURL() {} readAsText() {} },
    Blob: class {}, URL: { createObjectURL: () => 'b', revokeObjectURL: () => {} }
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  run('data/data.js', sb);
  run('assets/js/admin.js', sb);
  doc._h['DOMContentLoaded']();
  getEl('#login-password').value = 'derbent1966';
  getEl('#login-form')._h['submit']({ preventDefault() {} });
  if (getEl('#admin-layout').style.display !== '') throw new Error('admin: layout not shown after login');
  for (const s of ['settings', 'news', 'teams', 'matches', 'players', 'coaches', 'management', 'vacancies', 'pages', 'export']) {
    getEl('#side-nav')._h['click']({ target: { closest: () => ({ dataset: { section: s } }) } });
    const html = getEl('#admin-root').innerHTML;
    if (!html || html.length < 50) throw new Error('admin: section "' + s + '" rendered empty');
  }
  console.log('ADMIN SMOKE OK — вход и все 10 секций рендерятся');
}

// ---------- Главная ----------
{
  const doc = { _h: {}, body: makeEl('body'), addEventListener(t, f) { this._h[t] = f; }, querySelector: s => getEl(s), querySelectorAll: () => [], createElement: () => makeEl('c' + elCount++), getElementById: id => getEl('#' + id) };
  doc.body.dataset.page = 'home';
  const sb = {
    console, setTimeout, clearTimeout,
    document: doc, localStorage: mkStore(), sessionStorage: mkStore(),
    location: { pathname: '/fcderbent/index.html' },
    IntersectionObserver: class { observe() {} unobserve() {} },
    addEventListener() {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  run('data/data.js', sb);
  run('assets/js/main.js', sb);
  doc._h['DOMContentLoaded']();
  const news = getEl('#news-grid').innerHTML;
  const matches = getEl('#matches-list').innerHTML;
  const table = getEl('#standings-body').innerHTML;
  const lb = getEl('#lb-grid').innerHTML;
  for (const [name, html] of [['news', news], ['matches', matches], ['standings', table], ['leaderboards', lb]]) {
    if (!html || html.length < 100) throw new Error('home: "' + name + '" rendered empty');
  }
  if (!lb.includes('Бомбардиры') || !lb.includes('Ассистенты') || !lb.includes('Гол + пас')) throw new Error('home: leaderboard titles missing');
  if (!lb.includes('lb-more')) throw new Error('home: "show all" button missing');
  console.log('HOME SMOKE OK — новости, матчи, таблица и лидеры рендерятся');
}
