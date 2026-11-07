import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, output, pause } from './browser.mjs';

const b = await launchBrowser();
const records = [];
const log = (name, value) => {
  records.push({ name, ...value });
  writeFileSync(join(output, 'interactions.json'), JSON.stringify(records, null, 2));
  console.log(name);
};
async function fault(path = '', delay = 0, fail = false) {
  await fetch('http://127.0.0.1:3101/__qa/fault', {
    method:'POST', body:JSON.stringify({path,delay,fail}),
  });
}
async function key(key, code = key, windowsVirtualKeyCode) {
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode});
  await b.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
}
async function shot(name) { return b.screenshot(name); }
try {
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await b.viewport(1440);
  await b.navigate('demo');
  await b.evaluate('localStorage.setItem("techkasir.appearance",JSON.stringify({palette:"cobalt",mode:"light"}));location.reload();');
  await b.waitFor('!!document.querySelector(".dashboard-home")');
  log('Ambient animation enabled', { value:await b.evaluate('getComputedStyle(document.querySelector(".ambient-gradient"),"::before").animationName') });
  const firstTransform = await b.evaluate('getComputedStyle(document.querySelector(".ambient-gradient"),"::before").transform');
  await pause(1200);
  log('Ambient animation drifts', { first:firstTransform, later:await b.evaluate('getComputedStyle(document.querySelector(".ambient-gradient"),"::before").transform') });
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  log('Reduced motion stops drift', { value:await b.evaluate('getComputedStyle(document.querySelector(".ambient-gradient"),"::before").animationName') });
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await b.page('customers');
  await b.evaluate('window.__qaWrites=[];const originalFetch=window.fetch;window.fetch=async function(url,options){if(options?.method==="POST")window.__qaWrites.push({url,body:options.body});return originalFetch.apply(this,arguments);};');
  await b.click('[data-action="new-customer"]');
  await b.evaluate('document.querySelector("#modal [name=name]").value="Pelanggan batal audit";');
  await b.click('#modal [data-action="close-modal"]:not(.modal-close)');
  log('Cancel does not save valid form', { writes:await b.evaluate('window.__qaWrites.length'), open:await b.evaluate('document.querySelector("#modal").open') });
  await b.click('[data-action="new-customer"]');
  const focusTrail = [];
  for (let index = 0; index < 9; index++) {
    await key('Tab','Tab',9);
    focusTrail.push(await b.evaluate('({inside:!!document.activeElement.closest("#modal"),tag:document.activeElement.tagName,name:document.activeElement.name,action:document.activeElement.dataset.action})'));
  }
  await key('Escape','Escape',27);
  log('Modal keyboard focus and restoration', { focusTrail, restored:await b.evaluate('document.activeElement.dataset.action'), open:await b.evaluate('document.querySelector("#modal").open') });
  await fault('/api/customers',1500);
  await b.click('[data-action="new-customer"]');
  await b.evaluate('document.querySelector("#modal [name=name]").value="QA double click customer";document.querySelector("#modal form").requestSubmit();document.querySelector("#modal form").requestSubmit();');
  await pause(150);
  await key('Escape','Escape',27);
  log('Repeated submit and pending Escape', {
    writes:await b.evaluate('window.__qaWrites.length'),
    state:await b.evaluate('({open:document.querySelector("#modal").open,busy:document.querySelector("#modal form").getAttribute("aria-busy"),label:document.querySelector("#modal [type=submit]").textContent,disabled:document.querySelector("#modal .modal-close").disabled})'),
    screenshot:await shot('saving-pending-1440'),
  });
  await b.waitFor('!document.querySelector("#modal").open');
  await fault('/api/customers',300,true);
  await b.click('[data-action="new-customer"]');
  await b.evaluate('document.querySelector("#modal [name=name]").value="QA failed request";document.querySelector("#modal form").requestSubmit();');
  await b.waitFor('!!document.querySelector("#modal .message.error")');
  log('Failed save keeps data and recovers actions',{
    value:await b.evaluate('({input:document.querySelector("#modal [name=name]").value,label:document.querySelector("#modal [type=submit]").textContent,disabled:document.querySelector("#modal [type=submit]").disabled,focus:document.activeElement.className,message:document.querySelector("#modal .message.error").textContent})'),
    screenshot:await shot('failed-save-1440'),
  });
  await fault();
  await key('Escape','Escape',27);
  for (const width of [320,390,768,1440]) {
    await b.viewport(width);
    await b.navigate('worst');
    await b.page('units');
    await b.click('[data-action="new-unit"]');
    await b.evaluate('document.querySelector("#modal [name=model]").value="Lenovo ThinkPad X1 Carbon Gen 12 Intel Core Ultra 7 RAM 64 GB SSD 2 TB";');
    log('Unit modal at ' + width, {
      screenshot:await shot('unit-modal-top-' + width),
      value:await b.evaluate('({width:innerWidth,dialogWidth:document.querySelector("#modal").clientWidth,scrollWidth:document.querySelector("#modal").scrollWidth,actions:(()=>{const r=document.querySelector("#modal .form-actions").getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()})'),
    });
    await b.evaluate('document.querySelector("#modal").scrollTop=99999');
    log('Unit modal bottom at ' + width, {screenshot:await shot('unit-modal-bottom-' + width)});
    await b.evaluate('document.querySelector("#modal [name=intakeDate]").value="2000-01-01";');
    log('Historical date accepted at ' + width, { valid:await b.evaluate('document.querySelector("#modal [name=intakeDate]").validity.valid') });
    await key('Escape','Escape',27);
    await b.click('#account-trigger');
    log('Account menu at ' + width, {
      screenshot:await shot('account-menu-' + width),
      value:await b.evaluate('(()=>{const n=document.querySelector("#account-options"),r=n.getBoundingClientRect();return {open:n.matches(":popover-open"),left:r.left,right:r.right,bottom:r.bottom,viewport:innerWidth,text:n.textContent};})()'),
    });
    await key('Escape','Escape',27);
  }
  await b.viewport(1440);
  await b.navigate('demo');
  await b.page('units');
  await b.click('[data-action="new-unit"]');
  await b.evaluate('document.querySelector("#modal [name=intakeDate]").showPicker()');
  log('Native date picker',{screenshot:await shot('native-date-picker-1440')});
  await key('Escape','Escape',27);
  await key('Escape','Escape',27);
  await b.page('reports');
  log('Report years exposed by dropdown',{years:await b.evaluate('Array.from(document.querySelector("#report-year").options,option=>option.value)')});
  await b.navigate('demo');
  await fault('/api/search',1000);
  await b.click('[data-action="global-search"]');
  await b.evaluate('var input=document.querySelector("#global-search-query");input.value="Samsung";input.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#global-search form").requestSubmit();');
  await pause(150);
  await b.evaluate('var input=document.querySelector("#global-search-query");input.value="ThinkPad";input.dispatchEvent(new Event("input",{bubbles:true}));');
  await pause(1200);
  log('Edits during search discard old response',{
    value:await b.evaluate('({query:document.querySelector("#global-search-query").value,status:document.querySelector(".search-status").textContent,results:document.querySelector(".search-results").textContent})'),
    screenshot:await shot('search-stale-response'),
  });
  await fault();
  await b.evaluate('document.querySelector("#global-search-query").value="zzznomatchingrecord";document.querySelector("#global-search form").requestSubmit();');
  await b.waitFor('!!document.querySelector(".search-results .empty")');
  log('Search no results',{screenshot:await shot('search-no-results')});
  await fault('/api/search',100,true);
  await b.evaluate('document.querySelector("#global-search-query").value="Samsung";document.querySelector("#global-search form").requestSubmit();');
  await pause(400);
  log('Search API failure',{screenshot:await shot('search-failure'),status:await b.evaluate('document.querySelector(".search-status").textContent')});
  await fault();
  await key('Escape','Escape',27);
  await b.navigate('thousand');
  await b.page('customers');
  log('Thousand-row table pagination',{
    value:await b.evaluate('({summary:document.querySelector(".data-table-summary").textContent,rows:document.querySelector("tbody").rows.length,domNodes:document.getElementsByTagName("*").length,buttons:Array.from(document.querySelectorAll(".data-table-pagination button"),n=>n.getAttribute("aria-label"))})'),
  });
  await b.click('.data-table-pagination [aria-label="Halaman berikutnya"]');
  log('Thousand-row next page',{summary:await b.evaluate('document.querySelector(".data-table-summary").textContent')});
  await b.viewport(1440);
  await b.navigate('worst');
  log('Assets and fonts',{
    value:await b.evaluate('({fontsReady:document.fonts.status,fontLoaded:document.fonts.check("16px Plus Jakarta Sans"),assets:performance.getEntriesByType("resource").map(n=>({name:n.name,duration:n.duration}))})'),
  });
} catch(error) {
  log('Harness failure',{error:error.stack});
} finally {
  await fault();
  writeFileSync(join(output,'interaction-events.json'),JSON.stringify(b.events.filter(event =>
    ['Runtime.exceptionThrown','Network.loadingFailed'].includes(event.method)),null,2));
  b.socket.close();
}

