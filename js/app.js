'use strict';

// ===== Service Worker 登録 =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// ===== オンライン/オフライン表示 =====
const statusEl = document.getElementById('status');
function updateStatus() {
  statusEl.textContent = navigator.onLine ? 'オンライン' : 'オフライン';
}
addEventListener('online', updateStatus);
addEventListener('offline', updateStatus);
updateStatus();

// ===== インストールボタン =====
let deferred;
const installBtn = document.getElementById('installBtn');
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  installBtn.hidden = true;
});

// ===== iPhone向け: ホーム画面に追加の案内 =====
// iPhoneは自動で追加画面を出せないので、やり方を案内する。閉じたら1週間出さない。
const IOS_HIDE_KEY = 'ios-banner-hidden-until';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const iosBanner = document.getElementById('iosBanner');

function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS は Macと名乗るので、タッチ有無でも判定する
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isSafari() {
  // Chrome(CriOS)・Firefox(FxiOS)・Edge(EdgiOS)などを除く
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(navigator.userAgent);
}
function isStandalone() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}
function hiddenNow() {
  try {
    return Date.now() < Number(localStorage.getItem(IOS_HIDE_KEY) || 0);
  } catch { return false; }
}

if (isIOS() && isSafari() && !isStandalone() && !hiddenNow()) {
  iosBanner.hidden = false;
}
document.getElementById('iosClose').addEventListener('click', () => {
  iosBanner.hidden = true;
  try { localStorage.setItem(IOS_HIDE_KEY, String(Date.now() + WEEK)); } catch { /* 保存できなくても閉じる */ }
});

// ===== チャット =====
const STORAGE_KEY = 'chat-history-v1';
const MAX_SAVED = 200;           // 保存する最大件数
const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const clearBtn = document.getElementById('clearBtn');

let history = load();

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_SAVED)));
  } catch { /* 保存できなくても動く */ }
}

function pad(n) { return String(n).padStart(2, '0'); }
function timeText(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dayText(ts) {
  const d = new Date(ts);
  const w = '日月火水木金土'[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
}
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// 文字は textContent で入れる(HTMLとして解釈させない)
function makeRow(msg) {
  const row = document.createElement('div');
  row.className = `row ${msg.from}`;

  if (msg.from === 'bot') {
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = '🤖';
    row.appendChild(av);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.text;

  const meta = document.createElement('div');
  meta.className = 'meta';
  if (msg.from === 'me') {
    const read = document.createElement('span');
    read.textContent = '既読';
    meta.appendChild(read);
  }
  const t = document.createElement('span');
  t.textContent = timeText(msg.ts);
  meta.appendChild(t);

  if (msg.from === 'me') { row.appendChild(meta); row.appendChild(bubble); }
  else { row.appendChild(bubble); row.appendChild(meta); }
  return row;
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function render() {
  messagesEl.textContent = '';
  let prev = null;
  for (const msg of history) {
    if (!prev || !sameDay(prev.ts, msg.ts)) {
      const d = document.createElement('div');
      d.className = 'date';
      d.textContent = dayText(msg.ts);
      d.style.alignSelf = 'center';
      messagesEl.appendChild(d);
    }
    messagesEl.appendChild(makeRow(msg));
    prev = msg;
  }
  scrollBottom();
}

function add(from, text) {
  const msg = { from, text, ts: Date.now() };
  const last = history[history.length - 1];
  const needDate = !last || !sameDay(last.ts, msg.ts);
  history.push(msg);
  save();
  if (needDate) {
    const d = document.createElement('div');
    d.className = 'date';
    d.textContent = dayText(msg.ts);
    messagesEl.appendChild(d);
  }
  messagesEl.appendChild(makeRow(msg));
  scrollBottom();
}

// ===== ボット(言葉に反応して返事を変える) =====
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const RULES = [
  { re: /おはよ/,                 reply: ['おはよう!', 'おはよう!今日もがんばろう'] },
  { re: /こんにちは|こんちは/,    reply: ['こんにちは!', 'やあ、こんにちは!'] },
  { re: /こんばんは/,             reply: ['こんばんは!', 'こんばんは、おつかれさま'] },
  { re: /おやすみ/,               reply: ['おやすみなさい', 'ゆっくり休んでね'] },
  { re: /ありがと|サンキュ/,      reply: ['どういたしまして!', 'いえいえ!'] },
  { re: /ごめん|すみません|すまん/, reply: ['気にしないで!', '大丈夫だよ'] },
  { re: /おつかれ|お疲れ/,        reply: ['おつかれさま!', '今日もよくがんばったね'] },
  { re: /(ねむ|眠|つかれ|疲)/,    reply: ['無理しないで休んでね', 'ちょっと休もう'] },
  { re: /(うれし|嬉し|やった|たのし|楽し)/, reply: ['それはよかった!', 'いいね!'] },
  { re: /(かなし|悲し|つら|辛|さみし)/,     reply: ['それはつらいね…', '話を聞くよ'] },
  { re: /(笑|w$|ｗ$)/,            reply: ['ふふ、おもしろいね', 'あはは'] },
  { re: /(なまえ|名前)/,          reply: ['ぼくはボットだよ'] },
  { re: /(何時|なんじ)/,          reply: () => `いまは ${timeText(Date.now())} だよ` },
  { re: /(今日|きょう).*(何日|なんにち|日付)/, reply: () => `今日は ${dayText(Date.now())} だよ` },
  { re: /(天気|てんき)/,          reply: ['天気はわからないけど、空を見てみよう'] },
  { re: /(ひま|暇)/,              reply: ['じゃあ、おしゃべりしよう'] },
  { re: /(すき|好き)/,            reply: ['いいね、ぼくも好きだよ'] },
  { re: /(バイバイ|ばいばい|またね|じゃあね)/, reply: ['またね!', 'バイバイ!'] },
];
const QUESTION = ['うーん、どうだろう?', 'どう思う?', 'むずかしい質問だね'];
const FALLBACK = ['そうなんだ!', 'なるほど', 'へえ、それで?', 'うんうん', 'もう少し教えて'];

function botReply(text) {
  const t = text.trim();
  for (const rule of RULES) {
    if (rule.re.test(t)) {
      const r = rule.reply;
      return typeof r === 'function' ? r() : pick(r);
    }
  }
  if (/[?？]$/.test(t)) return pick(QUESTION);
  return pick(FALLBACK);
}

let typingEl = null;
function showTyping() {
  typingEl = document.createElement('div');
  typingEl.className = 'row bot typing';
  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = '🤖';
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = '入力中…';
  typingEl.append(av, b);
  messagesEl.appendChild(typingEl);
  scrollBottom();
}
function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

// ===== 送信 =====
input.addEventListener('input', () => {
  sendBtn.disabled = input.value.trim() === '';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendBtn.disabled = true;
  add('me', text);

  const wait = 600 + Math.random() * 800;   // 少し待ってから返事
  showTyping();
  setTimeout(() => {
    hideTyping();
    add('bot', botReply(text));
  }, wait);
});

clearBtn.addEventListener('click', () => {
  if (!confirm('会話の履歴をすべて消しますか?')) return;
  history = [];
  save();
  render();
  add('bot', 'こんにちは!なんでも話しかけてね');
});

// ===== 起動 =====
if (history.length === 0) {
  history.push({ from: 'bot', text: 'こんにちは!なんでも話しかけてね', ts: Date.now() });
  save();
}
render();
