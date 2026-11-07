import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, output, pause } from './browser.mjs';

const b = await launchBrowser();
const records = [];
const fixtures = JSON.parse(readFileSync(join(output,'fixtures.json')));
async function record(name, extra = {}) {
  records.push({name,...extra});
  writeFileSync(join(output,'details.json'),JSON.stringify(records,null,2));
}
try {
  await b.viewport(320);
  await b.navigate('worst');
  await b.page('sales');
  await b.click('[data-action="new-sale"]');
  await b.click('#modal select[name="unitId"]');
  await record('Long unit dropdown',{
    options:await b.evaluate('Array.from(document.querySelector("#modal [name=unitId]").options,n=>({label:n.label,length:n.label.length}))'),
    screenshot:await b.screenshot('long-unit-dropdown-320'),
  });
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await b.evaluate('document.querySelector("#modal").close()');
  await b.page('customers');
  await b.evaluate('document.querySelector(".table-wrap").scrollLeft=99999');
  await pause(250);
  await b.click('.data-table-menu');
  await record('Long row action popover',{
    value:await b.evaluate('(()=>{const n=document.querySelector(".data-table-actions:popover-open");if(!n)return null;const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,text:n.textContent};})()'),
    screenshot:await b.screenshot('row-action-popover-320'),
  });
  await b.navigate('worst');
  await b.evaluate('document.querySelector(".revenue-column").focus()');
  await record('First chart tooltip at mobile width',{
    value:await b.evaluate('(()=>{const n=document.querySelector(".chart-tip"),r=n.getBoundingClientRect();return {left:r.left,right:r.right,text:n.textContent};})()'),
    screenshot:await b.screenshot('chart-tooltip-320'),
  });
  for (const name of [fixtures.longName,'J']) {
    const code = '(function(){const original=window.fetch;window.fetch=async function(url,options){const response=await original.apply(this,arguments);if(String(url)==="/api/me"){const user=await response.json();user.name=' + JSON.stringify(name) +
      ';return new Response(JSON.stringify(user),{headers:{"Content-Type":"application/json"}});}return response;};})();';
    const {identifier} = await b.send('Page.addScriptToEvaluateOnNewDocument',{source:code});
    await b.navigate('worst');
    await b.click('#account-trigger');
    await record('Account name ' + name,{
      value:await b.evaluate('({avatar:document.querySelector(".account-avatar").textContent,heading:document.querySelector(".account-menu-heading").textContent})'),
      screenshot:await b.screenshot(name === 'J' ? 'account-one-letter-320' : 'account-long-name-320'),
    });
    await b.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
  }
  await b.viewport(1440);
  await b.navigate('demo');
  await b.send('DOM.enable');
  await b.send('CSS.enable');
  const {root} = await b.send('DOM.getDocument');
  const {nodeId} = await b.send('DOM.querySelector',{nodeId:root.nodeId,selector:'h1'});
  await record('Actual rendered platform fonts',await b.send('CSS.getPlatformFontsForNode',{nodeId}));
  const networkFailures = b.events.filter(event=>event.method==='Network.loadingFailed').map(event=>{
    const request=b.events.find(candidate=>candidate.method==='Network.requestWillBeSent' && candidate.params.requestId===event.params.requestId);
    return {url:request?.params.request.url,error:event.params.errorText};
  });
  await record('Network failures',{failures:networkFailures});
} catch(error) {
  await record('Harness error',{error:error.stack});
} finally { b.socket.close(); }
