import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const output = process.env.QA_OUTPUT_DIR || import.meta.dirname;
mkdirSync(join(output, 'screenshots'), { recursive: true });
export const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
export async function launchBrowser() {
  const process = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=9325', '--remote-allow-origins=*',
    '--user-data-dir=' + join(import.meta.dirname, 'browser-profile'),
    '--window-size=1440,1000', 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  process.unref();
  let targets;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      targets = await (await fetch('http://127.0.0.1:9325/json/list')).json();
      if (targets.some(target => target.type === 'page')) break;
    } catch {}
    await pause(100);
  }
  if (!targets) throw Error('Headless Edge did not start');
  const target = targets.find(target => target.type === 'page');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const events = [];
  socket.onmessage = message => {
    const value = JSON.parse(message.data);
    if (value.id) {
      const task = pending.get(value.id);
      if (!task) return;
      pending.delete(value.id);
      clearTimeout(task.timer);
      if (value.error) task.reject(Error(JSON.stringify(value.error)));
      else task.resolve(value.result);
    } else events.push(value);
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const value = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result?.value;
  }
  async function waitFor(expression, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (await evaluate(expression)) return; } catch {}
      await pause(100);
    }
    throw Error('Wait failed: ' + expression);
  }
  async function navigate(mode = 'worst') {
    await send('Page.navigate', { url: 'http://127.0.0.1:3101/?data=' + mode });
    await waitFor("document.querySelector('.dashboard-home') || document.querySelector('.message.error')");
    await pause(200);
  }
  async function click(selector) {
    const rect = await evaluate('(() => { const node = document.querySelector(' + JSON.stringify(selector) +
      '); if (!node) throw Error("Missing click target"); node.scrollIntoView({block:"center"});' +
      'const r=node.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...rect });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...rect });
    await pause(100);
  }
  async function page(name) {
    const prefix = (await evaluate('innerWidth')) <= 760 ? '.mobile-nav ' : '.sidebar ';
    await click(prefix + '[data-page="' + name + '"]');
    await waitFor('!!document.querySelector(' + JSON.stringify('.nav [data-page="' + name + '"].active') + ')');
    await pause(200);
  }
  async function screenshot(name) {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = join(output, 'screenshots', name + '.png');
    writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  }
  async function viewport(width, height = 950) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await pause(150);
  }
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  return { process, send, evaluate, waitFor, navigate, click, page, screenshot, viewport, events, socket };
}
