const refresh = document.querySelector('#refresh');
const frame = document.querySelector('main');
let current = {}, pointer = null, pendingFrame = null;

function resetText(limit, weekly) {
  const at = Number(limit?.resetAt);
  if (!Number.isFinite(at) || at <= 0) return '↻ --:--';
  if (at <= Date.now()) return '↻ Chờ cập nhật';
  const date = new Date(at);
  const time = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  const day = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `↻ ${time}${weekly ? ` ${day}` : ''}`;
}

function render(data) {
  current = data;
  for (const [id, kind] of [['five', 'fiveHour'], ['week', 'weekly']]) {
    const limit = data.limits?.find(item => item.kind === kind);
    document.querySelector(`#${id}`).textContent = `${limit?.remaining ?? '--'}%`;
    const reset = document.querySelector(`#${id}-reset`);
    reset.textContent = resetText(limit, kind === 'weekly');
    reset.title = limit?.resetAt ? `Reset: ${new Date(limit.resetAt).toLocaleString('vi-VN')}` : 'Chưa có thời gian reset';
  }
  const updated = document.querySelector('#updated');
  updated.textContent = data.updatedAt ? `C\u1eadp nh\u1eadt ${new Date(data.updatedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})}` : 'C\u1eadp nh\u1eadt --:--';
  updated.title = data.updatedAt ? `D\u1eef li\u1ec7u nh\u1eadn l\u00fac ${new Date(data.updatedAt).toLocaleString('vi-VN')}` : 'Ch\u01b0a c\u00f3 th\u1eddi gian c\u1eadp nh\u1eadt';
  refresh.disabled = data.connection === 'loading';
  refresh.title = refresh.disabled ? 'Đang làm mới quota' : 'Làm mới quota';
}

function endGesture() {
  if (pointer === null) return;
  const id = pointer;
  pointer = null;
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  pendingFrame = null;
  window.usageApi.taskbarGesture('end');
  if (frame.hasPointerCapture(id)) frame.releasePointerCapture(id);
  document.body.classList.remove('adjusting');
}

frame.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest('#refresh')) return;
  event.preventDefault();
  pointer = event.pointerId;
  frame.setPointerCapture(pointer);
  document.body.classList.add('adjusting');
  window.usageApi.taskbarGesture(event.target.closest('#resize') ? 'resize-start' : 'move-start');
});
frame.addEventListener('pointermove', event => {
  if (pointer !== event.pointerId) return;
  if (!event.buttons) return endGesture();
  if (pendingFrame !== null) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = null;
    window.usageApi.taskbarGesture('update');
  });
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) frame.addEventListener(event, endGesture);
window.addEventListener('blur', endGesture);
window.addEventListener('pagehide', endGesture);
refresh.addEventListener('click', () => {refresh.disabled = true; window.usageApi.refresh()});
window.usageApi.get().then(render);
window.usageApi.onUpdate(render);
setInterval(() => render(current), 30000);
