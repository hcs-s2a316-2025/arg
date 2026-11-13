// Service Worker 登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// オンライン/オフライン表示
const status = document.getElementById('status');
function updateStatus() {
  status.textContent = navigator.onLine ? 'オンライン' : 'オフライン';
}
addEventListener('online', updateStatus);
addEventListener('offline', updateStatus);
updateStatus();

// インストールボタン
let deferred;
const btn = document.getElementById('installBtn');
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  btn.hidden = false;
});
btn.addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  btn.hidden = true;
});
