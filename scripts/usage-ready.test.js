const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../src/main-v2.js'), 'utf8');
const readyFunction = source.match(/async function usageReady\(tab\)\{.*?(?=\r?\nasync function refreshUsage)/s)[0];

for (const [text, state, expected] of [
  ['95% remaining\n94% remaining', 'complete', true],
  ['Còn lại 95%\nCòn lại 94%', 'complete', true],
  ['remaining 95%\nremaining 94%', 'complete', true],
  ['95% remaining', 'complete', false],
  ['Loading usage…', 'complete', false],
  ['95% remaining\n94% remaining', 'loading', false]
]) {
  test(`reload readiness: ${JSON.stringify(text)} (${state})`, async () => {
    const cdp = async (_, method, params) => {
      assert.equal(method, 'Runtime.evaluate');
      const value = vm.runInNewContext(params.expression, {document: {body: {innerText: text}, readyState: state}});
      return {result: {value}};
    };
    const ready = vm.runInNewContext(`(${readyFunction})`, {cdp});
    assert.equal(await ready({webSocketDebuggerUrl: 'mock'}), expected);
  });
}
