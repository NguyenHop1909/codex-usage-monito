const test = require('node:test');
const assert = require('node:assert/strict');
const {taskbarBounds, TaskbarController} = require('../src/taskbar-layout');

function setup(settings = {}) {
  let display = {bounds: {x: 0, y: 0, width: 1280, height: 720}, workArea: {x: 0, y: 0, width: 1280, height: 672}};
  let cursor = {x: 1100, y: 700}, bounds = taskbarBounds(display, settings), top = true, visible = true;
  const calls = {bounds: 0, top: 0, show: 0, save: 0};
  const win = {
    getBounds: () => ({...bounds}),
    setBounds: next => {bounds = {...next}; calls.bounds++},
    isAlwaysOnTop: () => top,
    setAlwaysOnTop: value => {top = value; calls.top++},
    isVisible: () => visible,
    showInactive: () => {visible = true; calls.show++}
  };
  const controller = new TaskbarController(win, {display: () => display, cursor: () => cursor, settings: () => settings, save: () => calls.save++});
  return {controller, calls, win, settings, cursor: value => {cursor = value}, display: value => {display = value}, visibility: (isTop, isVisible) => {top = isTop; visible = isVisible}};
}

test('long drag stays on the taskbar without timer snaps or repeated redraws', () => {
  const s = setup();
  s.controller.begin('move');
  s.cursor({x: 800, y: 50});
  for (let i = 0; i < 300; i++) {s.controller.update(); s.controller.ensureVisible()}
  assert.deepEqual(s.win.getBounds(), {x: 720, y: 676, width: 260, height: 44});
  assert.deepEqual(s.calls, {bounds: 1, top: 0, show: 0, save: 0});
  s.controller.end();
  s.controller.end();
  assert.equal(s.calls.save, 1);
  assert.equal(s.settings.taskbarX, 720);
});

test('resize grows and shrinks both dimensions, saves them, and keeps the bottom edge fixed', () => {
  const s = setup({taskbarX: 400});
  s.controller.begin('resize');
  s.cursor({x: 1200, y: 650});
  s.controller.update();
  s.controller.end();
  assert.deepEqual(s.win.getBounds(), {x: 400, y: 672, width: 360, height: 48});
  assert.deepEqual(taskbarBounds({bounds: {x: 0, y: 0, width: 1280, height: 720}, workArea: {x: 0, y: 0, width: 1280, height: 672}}, s.settings), s.win.getBounds());
  s.controller.begin('resize');
  s.cursor({x: 200, y: 1000});
  s.controller.end();
  assert.deepEqual(s.win.getBounds(), {x: 400, y: 680, width: 220, height: 40});
  assert.equal(s.calls.save, 2);
});

test('off-screen dragging and resizing are clamped, including after display changes', () => {
  const s = setup();
  s.controller.begin('move'); s.cursor({x: -4000, y: -4000}); s.controller.end();
  assert.equal(s.win.getBounds().x, 0);
  s.controller.begin('resize'); s.cursor({x: 4000, y: -6000}); s.controller.end();
  assert.equal(s.win.getBounds().width, 480);
  s.controller.begin('move'); s.cursor({x: 9000, y: 0}); s.controller.end();
  assert.equal(s.win.getBounds().x, 800);
  s.display({bounds: {x: -800, y: 0, width: 800, height: 600}, workArea: {x: -800, y: 0, width: 800, height: 568}});
  s.controller.reposition();
  assert.deepEqual(s.win.getBounds(), {x: -480, y: 560, width: 480, height: 40});
});

test('visibility recovery changes only the missing visibility or topmost state', () => {
  const s = setup();
  for (let i = 0; i < 100; i++) s.controller.ensureVisible();
  assert.deepEqual(s.calls, {bounds: 0, top: 0, show: 0, save: 0});
  s.visibility(false, false);
  for (let i = 0; i < 100; i++) s.controller.ensureVisible();
  assert.deepEqual(s.calls, {bounds: 0, top: 1, show: 1, save: 0});
});
