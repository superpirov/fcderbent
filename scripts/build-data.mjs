// Генератор data/data.js из WordPress-экспорта (_import/*.xml) и шаблона (data/template.json)
// Запуск: node scripts/build-data.mjs
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG_BY_ID = {
  142: 'derbent', 150: 'leki', 151: 'khas-rayon', 152: 'kaspiysk', 153: 'dinamo-dag',
  154: 'kyure', 155: 'dinamo-2009', 156: 'yulduz', 157: 'rdyussh', 158: 'pobeda-2',
  159: 'kizlyar', 160: 'uor-kaspiysk'
};
const TEAM_COLORS = {
  derbent: '#f0831e', leki: '#1e88e5', 'khas-rayon': '#2e7d32', kaspiysk: '#0288d1',
  'dinamo-dag': '#1565c0', kyure: '#c62828', 'dinamo-2009': '#00695c', yulduz: '#8e24aa',
  rdyussh: '#546e7a', 'pobeda-2': '#ad1457', kizlyar: '#ef6c00', 'uor-kaspiysk': '#283593'
};
const TEAM_CITIES = {
  derbent: 'Дербент', leki: 'Леваши', 'khas-rayon': 'Хасавюрт', kaspiysk: 'Каспийск',
  'dinamo-dag': 'Махачкала', kyure: 'Касумкент', 'dinamo-2009': 'Махачкала', yulduz: 'Хив',
  rdyussh: 'Махачкала', 'pobeda-2': 'Хасавюрт', kizlyar: 'Кизляр', 'uor-kaspiysk': 'Каспийск'
};

function items(xml) {
  return xml.split(/<item>/).slice(1).map(s => s.split('</item>')[0]);
}
function cdata(item, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const m = item.match(re);
  return m ? m[1] : '';
}
function plain(item, tag) {
  const m = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`));
  if (!m) return '';
  return m[1] !== undefined ? m[1] : m[2];
}
function metaPairs(item) {
  const out = [];
  const re = /<wp:meta_key><!\[CDATA\[([^\]]+)\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_value>/g;
  let m;
  while ((m = re.exec(item))) out.push({ key: m[1], value: m[2] });
  return out;
}
function normalizeVenue(v) {
  if (!v) return '';
  return v.replace(/"([^"]+)"/g, '«$1»');
}

// --- Команды ---
const teamsXml = readFileSync(resolve(ROOT, '_import/teams.xml'), 'utf8');
const attachments = {};
const teams = [];
for (const it of items(teamsXml)) {
  const type = plain(it, 'wp:post_type');
  const id = plain(it, 'wp:post_id');
  if (type === 'attachment') {
    const m = it.match(/<wp:attachment_url><!\[CDATA\[([\s\S]*?)\]\]><\/wp:attachment_url>/);
    if (m) attachments[id] = m[1];
  }
}
for (const it of items(teamsXml)) {
  if (plain(it, 'wp:post_type') !== 'sp_team') continue;
  const id = parseInt(plain(it, 'wp:post_id'), 10);
  const slug = SLUG_BY_ID[id];
  if (!slug) continue;
  const title = cdata(it, 'title');
  let thumb = '';
  for (const p of metaPairs(it)) if (p.key === '_thumbnail_id') thumb = p.value;
  teams.push({
    id: slug,
    name: title,
    city: TEAM_CITIES[slug] || '',
    logo: slug === 'derbent' ? 'images/logo.png' : `images/teams/${slug}.png`,
    color: TEAM_COLORS[slug] || '#888888',
    description: ''
  });
}

// --- Матчи ---
const matchesXml = readFileSync(resolve(ROOT, '_import/matches.xml'), 'utf8');
const matches = [];
for (const it of items(matchesXml)) {
  if (plain(it, 'wp:post_type') !== 'sp_event') continue;
  const id = plain(it, 'wp:post_id');
  const date = plain(it, 'wp:post_date').slice(0, 10);
  const teamIds = metaPairs(it).filter(p => p.key === 'sp_team').map(p => p.value);
  if (teamIds.length < 2) continue;
  const [homeId, awayId] = teamIds;
  const home = SLUG_BY_ID[parseInt(homeId, 10)];
  const away = SLUG_BY_ID[parseInt(awayId, 10)];
  if (!home || !away) continue;
  let homeScore = null, awayScore = null;
  const results = metaPairs(it).find(p => p.key === 'sp_results');
  if (results) {
    const rh = results.value.match(new RegExp(`i:${homeId};a:4:\\{[^}]*?s:5:"goals";s:\\d+:"(\\d+)"`));
    const ra = results.value.match(new RegExp(`i:${awayId};a:4:\\{[^}]*?s:5:"goals";s:\\d+:"(\\d+)"`));
    if (rh) homeScore = parseInt(rh[1], 10);
    if (ra) awayScore = parseInt(ra[1], 10);
  }
  const venueCat = it.match(/<category domain="sp_venue"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/category>/);
  matches.push({
    id: `m${id}`,
    date,
    home,
    away,
    homeScore,
    awayScore,
    venue: normalizeVenue(venueCat ? venueCat[1] : ''),
    league: 'championat'
  });
}
matches.sort((a, b) => a.date.localeCompare(b.date));

// --- Сборка ---
const tpl = JSON.parse(readFileSync(resolve(ROOT, 'data/template.json'), 'utf8'));
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
tpl.settings.adminPasswordHash = hash('derbent1966');

const data = { ...tpl, teams, matches };
const banner = `// ============================================================
// ДАННЫЕ САЙТА ФК «ДЕРБЕНТ»
// Этот файл редактируется через админ-панель (admin.html):
// внесите изменения и нажмите «Экспорт data.js», затем
// замените этим файлом data/data.js в репозитории.
// ============================================================
window.SITE_DATA = `;
writeFileSync(resolve(ROOT, 'data/data.js'), banner + JSON.stringify(data, null, 2) + ';\n', 'utf8');
console.log(`OK: ${teams.length} команд, ${matches.length} матчей -> data/data.js`);
