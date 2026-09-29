<?php
// ФК «Дербент» — приём сообщений с формы «Контакты» (contacts.html)
// Отправляет письмо на info@fcderbent.ru и пишет копию в data/messages.json
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

$TO = 'info@fcderbent.ru';

$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) $in = $_POST;

function clean($v, $max) {
  $v = trim(strip_tags((string)($v ?? '')));
  $v = str_replace(["\r", "\n"], ' ', $v);
  if (mb_strlen($v, 'UTF-8') > $max) $v = mb_substr($v, 0, $max, 'UTF-8');
  return $v;
}

$name    = clean($in['name'] ?? '', 120);
$contact = clean($in['contact'] ?? '', 120);
$message = trim(strip_tags((string)($in['message'] ?? '')));
if (mb_strlen($message, 'UTF-8') > 5000) $message = mb_substr($message, 0, 5000, 'UTF-8');

if (mb_strlen($name, 'UTF-8') < 2) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Укажите имя'], JSON_UNESCAPED_UNICODE);
  exit;
}
if (mb_strlen($contact, 'UTF-8') < 5) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Укажите телефон или e-mail'], JSON_UNESCAPED_UNICODE);
  exit;
}
if (mb_strlen($message, 'UTF-8') < 10) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Сообщение слишком короткое'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Простой rate-limit: не более 5 сообщений в час с одного IP
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$ip = trim(explode(',', (string)$ip)[0]);
$rateFile = __DIR__ . '/data/form-ratelimit.json';
$key = 'contact:' . hash('sha256', $ip . '|fcderbent_salt_2026');
$now = time();
$rate = [];
if (is_file($rateFile)) {
  $rate = json_decode(@file_get_contents($rateFile), true);
  if (!is_array($rate)) $rate = [];
}
$rate[$key] = array_values(array_filter($rate[$key] ?? [], function ($t) use ($now) { return ($now - (int)$t) < 3600; }));
if (count($rate[$key]) >= 5) {
  http_response_code(429);
  echo json_encode(['ok' => false, 'error' => 'Слишком много сообщений. Попробуйте позже.'], JSON_UNESCAPED_UNICODE);
  exit;
}
$rate[$key][] = $now;
@file_put_contents($rateFile, json_encode($rate, JSON_UNESCAPED_UNICODE), LOCK_EX);

// Лог сообщений (резервная копия, если письмо не дойдёт)
$entry = [
  'type' => 'contact',
  'date' => date('Y-m-d H:i:s'),
  'name' => $name,
  'contact' => $contact,
  'message' => $message,
  'ip' => $ip,
  'ua' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
];
$logFile = __DIR__ . '/data/messages.json';
$log = [];
if (is_file($logFile)) {
  $log = json_decode(@file_get_contents($logFile), true);
  if (!is_array($log)) $log = [];
}
$log[] = $entry;
if (count($log) > 2000) $log = array_slice($log, -2000);
$logged = @file_put_contents($logFile, json_encode($log, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;

$replyTo = filter_var($contact, FILTER_VALIDATE_EMAIL) ? $contact : '';
$subject = 'ФК Дербент — сообщение с формы «Контакты»';
if (function_exists('mb_encode_mimeheader')) {
  $subject = mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n");
}
$body = "Новое сообщение с сайта fcderbent.ru (форма «Контакты»)\n"
  . "Дата: " . $entry['date'] . "\n"
  . "Имя: " . $name . "\n"
  . "Телефон или e-mail: " . $contact . "\n"
  . "Сообщение:\n" . $message . "\n"
  . "---\nIP: " . $ip . "\n";
$headers = "From: FC Derbent <info@fcderbent.ru>\r\n"
  . "Content-Type: text/plain; charset=utf-8\r\n"
  . "Content-Transfer-Encoding: 8bit\r\n";
if ($replyTo !== '') {
  $headers .= "Reply-To: " . $replyTo . "\r\n";
}
$mailed = @mail($TO, $subject, $body, $headers);

if (!$logged && !$mailed) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить сообщение'], JSON_UNESCAPED_UNICODE);
  exit;
}
echo json_encode(['ok' => true, 'mailed' => (bool)$mailed], JSON_UNESCAPED_UNICODE);
