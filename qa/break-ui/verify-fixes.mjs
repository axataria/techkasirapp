import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, output, pause } from './browser.mjs';

const b = await launchBrowser();
const records = [];
async function record(name, value, screenshot) {
  records.push({ name, value, screenshot });
  writeFileSync(join(output, 'verification.json'), JSON.stringify(records, null, 2));
  console.log(name);
}
async function escape() {
  await b.send('Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
  await b.send('Input.dispatchKeyEvent', {type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
}
try {
  const matrix = JSON.parse(readFileSync(join(output, 'results.json')));
  assert.equal(matrix.length, 160);
  assert(matrix.every(row => !row.error && row.layout.scrollWidth <= row.layout.width));
  assert(matrix.every(row => row.layout.currency.every(amount => amount.lines === 1)));
  assert(matrix.every(row => row.layout.currency.every(amount => amount.scrollWidth <= amount.clientWidth + 1)));
  await record('160 layout cases keep amounts intact and avoid page overflow', { cases:matrix.length });
  for (const width of [320,390,768,1440]) {
    await b.viewport(width);
    await b.navigate('worst');
    assert.equal(await b.evaluate('document.querySelector(".account-avatar").textContent'), '👩🏽‍💻');
    await b.page('units');
    await b.click('[data-action="new-unit"]');
    const bounds = await b.evaluate('(() => {const dialog=document.querySelector("#modal").getBoundingClientRect();return Array.from(document.querySelectorAll("#modal .form-actions button"),node=>{const r=node.getBoundingClientRect();return {text:node.textContent,top:r.top,bottom:r.bottom,dialogTop:dialog.top,dialogBottom:dialog.bottom};});})()');
    assert(bounds.every(rect => rect.top >= rect.dialogTop && rect.bottom <= rect.dialogBottom));
    assert.equal(await b.evaluate('document.querySelector("#modal [name=code]").maxLength'), 96);
    await record('Visible modal buttons and input limits at ' + width, bounds, await b.screenshot('verified-modal-' + width));
    await escape();
  }
  await b.viewport(320);
  await b.navigate('thousand');
  await b.page('sales');
  await b.click('[data-action="new-sale"]');
  const labels = await b.evaluate('Array.from(document.querySelector("#modal [name=unitId]").options).slice(1).map(option=>option.textContent)');
  assert(labels.length >= 100);
  assert.equal(new Set(labels).size, labels.length);
  assert(labels.every(label => label.length <= 23));
  await b.click('#modal [name=unitId]');
  await record('101 distinct compact unit options', { count:labels.length, examples:labels.slice(0,3) }, await b.screenshot('verified-unit-options-320'));
  await escape();
  await b.evaluate('var select=document.querySelector("#modal [name=unitId]");select.value=select.options[1].value;select.dispatchEvent(new Event("change",{bubbles:true}));');
  const detail = await b.evaluate('document.querySelector("#unit-choice-preview").textContent');
  assert(detail.includes('CORPORATE'));
  assert(detail.includes('Lenovo ThinkPad'));
  await record('Full selected-unit details remain readable', detail, await b.screenshot('verified-unit-detail-320'));
  await escape();
  await b.navigate('worst');
  await b.page('sales');
  const dates = await b.evaluate('Array.from(document.querySelectorAll("tbody .date-cell"),node=>{const range=document.createRange();range.selectNodeContents(node);return {date:node.textContent,lines:range.getClientRects().length,whiteSpace:getComputedStyle(node).whiteSpace};})');
  assert(dates.length);
  assert(dates.every(row => row.lines === 1 && row.whiteSpace === 'nowrap'));
  await record('Dates remain intact in mobile tables', dates, await b.screenshot('verified-table-dates-320'));
  await b.page('reports');
  assert(await b.evaluate('Array.from(document.querySelector("#report-year").options,option=>option.value).includes("1970")'));
  await b.evaluate('var year=document.querySelector("#report-year");year.value="1970";year.dispatchEvent(new Event("change",{bubbles:true}));');
  await b.waitFor('document.querySelector("#report-year").value === "1970" && document.querySelector("tbody").textContent.includes("1970-")');
  await record('Historical report year is selectable', await b.evaluate('document.querySelector("#report-year").value'), await b.screenshot('verified-report-1970'));
  await b.navigate('worst');
  await b.click('[data-chart-month="0"]');
  const selection = await b.evaluate('({text:document.querySelector("#chart-selection").textContent,label:document.querySelector("[data-chart-month]").getAttribute("aria-label"),pressed:document.querySelector("[data-chart-month]").getAttribute("aria-pressed")})');
  assert(selection.text.includes('Jan'));
  assert(selection.label.includes('9.876.543.210.987'));
  assert.equal(selection.pressed, 'true');
  await b.send('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await b.send('Input.dispatchKeyEvent', {type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert((await b.evaluate('document.querySelector("#chart-selection").textContent')).includes('Feb'));
  await record('Monthly values respond to mobile click and keyboard focus', selection, await b.screenshot('verified-chart-details-320'));
  assert.equal(b.events.filter(event => event.method === 'Runtime.exceptionThrown').length, 0);
  await record('No fatal JavaScript exceptions', { count:0 });
} catch (error) {
  await record('Verification failure', { error:error.stack });
  process.exitCode = 1;
} finally { b.socket.close(); }
