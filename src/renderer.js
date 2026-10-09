const limitsEl = document.querySelector('#limits');
const statusEl = document.querySelector('#status');
const updatedEl = document.querySelector('#updated');

function render(data) {
  statusEl.textContent = data.status;
  updatedEl.textContent = data.updatedAt ? `Cập nhật: ${new Date(data.updatedAt).toLocaleString('vi-VN')}` : '';
  limitsEl.replaceChildren();
  for (const item of data.limits) {
    const card = document.createElement('article');
    const tone = item.remaining <= 10 ? 'danger' : item.remaining <= 20 ? 'warn' : 'ok';
    card.innerHTML = `<div class="row"><strong></strong><b></b></div><div class="bar"><i class="${tone}"></i></div><p></p>`;
    card.querySelector('strong').textContent = item.name;
    card.querySelector('b').textContent = `${item.remaining}%`;
    card.querySelector('i').style.width = `${item.remaining}%`;
    card.querySelector('p').textContent = item.reset;
    limitsEl.append(card);
  }
}

document.querySelector('#refresh').addEventListener('click', () => window.usageApi.refresh());
document.querySelector('#login').addEventListener('click', () => window.usageApi.login());
window.usageApi.onUpdate(render);
window.usageApi.get().then(render);
