<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: X-Admin-Token, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$visitsFile = __DIR__ . '/data/visits.json';
if (!is_file($visitsFile)) {
  @file_put_contents($visitsFile, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  @chmod($visitsFile, 0664);
}
function djb2($s) {
  $h = 5381; $len = strlen($s);
  for ($i = 0; $i < $len; $i++) $h = ($h * 33 + ord($s[$i])) & 0xFFFFFFFF;
  return dechex($h & 0xFFFFFFFF);
}
function getClientIp() {
  $keys = ['HTTP_X_FORWARDED_FOR','HTTP_X_REAL_IP','HTTP_CLIENT_IP','REMOTE_ADDR'];
  foreach ($keys as $k) {
    if (!empty($_SERVER[$k])) {
      $v = $_SERVER[$k];
      // X-Forwarded-For может содержать список
      $v = explode(',', $v)[0];
      $v = trim($v);
      if (filter_var($v, FILTER_VALIDATE_IP)) return $v;
    }
  }
  return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
  if (preg_match('/bot|crawl|spider|slurp|mediapartners|google|yandex|bing/i', $ua)) {
    echo json_encode(['ok' => true, 'skipped' => 'bot'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $date = date('Y-m-d');
  $ip = getClientIp();
  $hash = hash('sha256', $ip . '|fcderbent_salt_2026');

  $fp = @fopen($visitsFile, 'c+');
  if (!$fp) { http_response_code(500); echo json_encode(['error' => 'open failed'], JSON_UNESCAPED_UNICODE); exit; }
  if (flock($fp, LOCK_EX)) {
    $content = stream_get_contents($fp);
    $data = $content ? json_decode($content, true) : [];
    if (!is_array($data)) $data = [];

    // Нормализуем запись за сегодня к новому формату {count,ips}
    if (!isset($data[$date])) {
      $data[$date] = ['count' => 0, 'ips' => []];
    } elseif (is_int($data[$date]) || is_float($data[$date])) {
      $old = (int)$data[$date];
      $data[$date] = ['count' => $old, 'ips' => []];
    } elseif (!isset($data[$date]['ips']) || !is_array($data[$date]['ips'])) {
      $data[$date]['ips'] = [];
      $data[$date]['count'] = (int)($data[$date]['count'] ?? $data[$date]['hits'] ?? 0);
    }

    // Уникальный визит: один IP в сутки = +1
    if (!isset($data[$date]['ips'][$hash])) {
      $data[$date]['ips'][$hash] = 1;
      $data[$date]['count'] = count($data[$date]['ips']);
    }
    // Хитсы считаем отдельно для справки
    $data[$date]['hits'] = (int)($data[$date]['hits'] ?? $data[$date]['count']) + 1;
    // Ограничиваем размер ips (защита от разрастания) — храним не более 5000 хешей в день
    if (count($data[$date]['ips']) > 5000) {
      $data[$date]['ips'] = array_slice($data[$date]['ips'], -4000, null, true);
    }

    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp); flock($fp, LOCK_UN);
  }
  fclose($fp);
  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['read'])) {
  $token = trim($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
  $currentHash = '';
  $dataFile = __DIR__ . '/data/data.js';
  if (is_file($dataFile)) {
    $cur = @file_get_contents($dataFile);
    if ($cur && preg_match('/"adminPasswordHash"\s*:\s*"([^"]+)"/', $cur, $m)) $currentHash = $m[1];
  }
  if ($currentHash === '') $currentHash = djb2('derbent1966');
  if ($token === '' || $token !== $currentHash) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $content = @file_get_contents($visitsFile);
  if (!$content) $content = json_encode([], JSON_UNESCAPED_UNICODE);
  json_decode($content);
  if (json_last_error() !== JSON_ERROR_NONE) $content = json_encode([], JSON_UNESCAPED_UNICODE);
  header('Content-Type: application/json; charset=utf-8');
  echo $content;
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
