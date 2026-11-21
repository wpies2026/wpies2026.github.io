const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const frames = [];
  const timers = new Map();
  let timerId = 0;
  const outer = {};
  outer.parent = outer;
  const window = {addEventListener() {}};
  const context = vm.createContext({
    window,
    location: {origin: 'https://wpies2026.github.io'},
    crypto: {getRandomValues: bytes => bytes.fill(7)},
    Uint8Array,
    document: {
      createElement: () => ({contentWindow: outer}),
      body: {appendChild: frame => frames.push(frame)}
    },
    setTimeout: callback => {timers.set(++timerId, callback); return timerId;},
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8'), context);
  const bridge = new window.WPIES_API.GoogleBridge('https://script.google.com/macros/s/test/exec');
  const requests = [];
  const source = {parent: outer, postMessage: message => requests.push(message)};
  const origin = 'https://service.googleusercontent.com';
  const send = (sender, data, senderOrigin = origin) => bridge.onMessage({
    source: sender, origin: senderOrigin, data: {channel: bridge.channel, ...data}
  });
  send(source, {type: 'wpies:ready'});
  return {bridge, source, outer, requests, send, timers};
}

test('resposta de outra janela interna conclui a chamada e permite login', async () => {
  const f = fixture();
  const call = f.bridge.call('publicConfig');
  await Promise.resolve();
  const replacement = {parent: f.outer};
  f.send(replacement, {
    type: 'wpies:result', id: f.requests[0].id, result: {ok: true, data: {edition: '2026'}}
  });
  assert.equal((await call).edition, '2026');
  const login = f.bridge.login('code', 'challenge');
  await Promise.resolve();
  f.send(replacement, {
    type: 'wpies:result', id: f.requests[1].id, result: {ok: true, data: {session: 'session'}}
  });
  assert.equal((await login).session, 'session');
  assert.equal(f.bridge.session, 'session');
  assert.equal(f.timers.size, 0);
});

test('origem, canal, pedido e vínculo ao iframe são exigidos', async () => {
  const f = fixture();
  const call = f.bridge.call('publicConfig');
  await Promise.resolve();
  const id = f.requests[0].id;
  const data = {type: 'wpies:result', id, result: {ok: true, data: 'accepted'}};
  const unrelated = {};
  unrelated.parent = unrelated;
  f.send(unrelated, data);
  f.send({parent: f.outer}, data, 'https://other.googleusercontent.com');
  f.send(f.source, {...data, channel: 'wrong-channel'});
  f.send(f.source, {...data, id: 'unknown-request'});
  f.send(f.source, {...data, type: 'wpies:ready'});
  assert.equal(f.bridge.pending.has(id), true);
  f.send(f.source, data);
  assert.equal(await call, 'accepted');
  assert.equal(f.timers.size, 0);
});

test('falhas do serviço em outra janela interna rejeitam a chamada', async () => {
  const f = fixture();
  const call = f.bridge.call('publicConfig');
  await Promise.resolve();
  f.send({parent: f.outer}, {
    type: 'wpies:result', id: f.requests[0].id,
    result: {ok: false, error: {code: 'SERVICE_ERROR', message: 'Falha do serviço'}}
  });
  await assert.rejects(call, error => error.code === 'SERVICE_ERROR');
  assert.equal(f.bridge.pending.size, 0);
  assert.equal(f.timers.size, 0);
});