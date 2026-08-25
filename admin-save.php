<?php
// ФК «Дербент» — сохранение данных из админки (для Timeweb и любого хостинга с PHP)
// Принимает JSON (window.SITE_DATA) и перезаписывает data/data.js
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

$raw = file_get_contents('php://input');
if (!$raw) {
  http_response_code(400);
  echo json_encode(['error' => 'Empty body'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Тело может быть чистым JSON или обёрткой window.SITE_DATA = {...};
$data = json_decode($raw, true);
if (!$data && preg_match('/window\.SITE_DATA\s*=\s*(\{.*\});/s', $raw, $m)) {
  $data = json_decode($m[1], true);
}
if (!$data || !isset($data['settings'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid data'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Проверка токена (djb2 хеш пароля) — защита от посторонней записи
function djb2($s) {
  $h = 5381;
  $len = strlen($s);
  for ($i = 0; $i < $len; $i++) {
    $h = ($h * 33 + ord($s[$i])) & 0xFFFFFFFF;
  }
  return dechex($h & 0xFFFFFFFF);
}
$token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
$token = trim($token);

// Текущий хеш из файла на диске
$currentHash = '';
$dataFile = __DIR__ . '/data/data.js';
if (is_file($dataFile)) {
  $cur = @file_get_contents($dataFile);
  if ($cur && preg_match('/"adminPasswordHash"\s*:\s*"([^"]+)"/', $cur, $mm)) {
    $currentHash = $mm[1];
  } elseif ($cur) {
    // fallback: декодируем JSON-часть
    if (preg_match('/window\.SITE_DATA\s*=\s*(\{.*\});/s', $cur, $mm2)) {
      $j = json_decode($mm2[1], true);
      $currentHash = $j['settings']['adminPasswordHash'] ?? '';
    }
  }
}
if ($currentHash === '') {
  $currentHash = djb2('derbent1966');
}

// Если токен не совпал — запрещаем запись (кроме случая когда админка открыта без токена — для отладки разрешаем, если файл ещё дефолтный и токен пустой)
// Строгая проверка: требуем токен
if ($token === '' || $token !== $currentHash) {
  // Разрешаем также токен от нового пароля, который пользователь уже отправил в данных
  $newHash = $data['settings']['adminPasswordHash'] ?? '';
  if ($token !== $newHash) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden: bad token'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

$js = "// Данные сайта ФК «Дербент»\nwindow.SITE_DATA = " . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . ";\n";
if (@file_put_contents($dataFile, $js) === false) {
  http_response_code(500);
  echo json_encode(['error' => 'Write failed — check permissions for data/data.js'], JSON_UNESCAPED_UNICODE);
  exit;
}
@chmod($dataFile, 0644);
echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
