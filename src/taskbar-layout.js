const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function taskbarBounds(display, settings = {}) {
  const b = display.bounds, a = display.workArea;
  const strip = b.y + b.height - (a.y + a.height);
  // Windows can enforce a native minimum near 38 DIP even on frameless windows.
  const maxHeight = Math.min(64, Math.max(40, strip >= 32 ? strip : 48), b.height);
  const width = clamp(Number(settings.taskbarWidth) || 260, Math.min(220, b.width), Math.min(480, b.width));
  const height = clamp(Number(settings.taskbarHeight) || 44, Math.min(40, maxHeight), maxHeight);
  const right = b.x + b.width - width;
  const x = Number.isFinite(settings.taskbarX) ? clamp(settings.taskbarX, b.x, right) : right;
  return {x: Math.round(x), y: b.y + b.height - height, width: Math.round(width), height: Math.round(height)};
}

class TaskbarController {
  constructor(win, {display, cursor, settings, save}) {
    Object.assign(this, {win, display, cursor, settings, save});
    this.gesture = null;
  }
  apply(bounds) {
    const current = this.win.getBounds();
    if (['x', 'y', 'width', 'height'].some(key => current[key] !== bounds[key])) this.win.setBounds(bounds);
  }
  ensureVisible() {
    if (this.gesture) return;
    // Explorer can cover another topmost window without changing either flag.
    // Raise it without hiding, resizing, toggling topmost or taking keyboard focus.
    if (!this.win.isAlwaysOnTop()) this.win.setAlwaysOnTop(true, 'screen-saver');
    if (!this.win.isVisible()) this.win.showInactive();
    this.win.moveTop();
  }
  reposition() {
    this.end();
    this.apply(taskbarBounds(this.display(), this.settings()));
  }
  begin(mode) {
    if (mode !== 'move' && mode !== 'resize') return;
    this.end();
    this.gesture = {mode, cursor: this.cursor(), bounds: this.win.getBounds()};
  }
  update() {
    if (!this.gesture) return;
    const start = this.gesture, cursor = this.cursor();
    const next = {...this.settings(), taskbarX: start.bounds.x, taskbarWidth: start.bounds.width, taskbarHeight: start.bounds.height};
    if (start.mode === 'move') next.taskbarX += cursor.x - start.cursor.x;
    else {
      next.taskbarWidth += cursor.x - start.cursor.x;
      // Resize from the top-right corner; the lower edge stays on the taskbar.
      next.taskbarHeight -= cursor.y - start.cursor.y;
    }
    this.apply(taskbarBounds(this.display(), next));
  }
  end() {
    if (!this.gesture) return;
    this.update();
    this.gesture = null;
    const b = this.win.getBounds();
    Object.assign(this.settings(), {taskbarX: b.x, taskbarWidth: b.width, taskbarHeight: b.height});
    this.save();
  }
}

module.exports = {taskbarBounds, TaskbarController};
