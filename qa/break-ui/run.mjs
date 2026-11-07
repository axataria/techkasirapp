import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, output, pause } from './browser.mjs';

const browser = await launchBrowser();
const results = [];
const pages = ['dashboard','customers','units','sales','services','payments','finance','reports','settings','audit','staff'];
const palettes = ['paper','sage','ocean','clay','cobalt','cyan','violet','emerald','graphite'];
const evaluate = expression => browser.evaluate(expression);
async function capture(label, detail = {}) {
  const layout = await evaluate('(() => {' +
    'const lineCount = node => {const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length;};' +
    'const rect = node => {const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};' +
    'return {width:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,' +
    'active:document.activeElement?.outerHTML?.slice(0,300),' +
    'currency:Array.from(document.querySelectorAll(".bento-value,.metric-value,.revenue-summary>strong")).map(node=>({text:node.textContent,lines:lineCount(node),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,rect:rect(node)})),' +
    'overflow:Array.from(document.querySelectorAll(".main h1,.page-head,.card,.modal-heading,.form-actions,.account-options")).filter(node=>{const r=node.getBoundingClientRect();return r.width&& (r.right>innerWidth+1||r.left< -1);}).map(node=>({tag:node.className,text:node.textContent.slice(0,100),rect:rect(node)})),' +
    'tableRows:Array.from(document.querySelectorAll("tbody")).map(body=>body.rows.length),' +
    'tableSummary:Array.from(document.querySelectorAll(".data-table-summary")).map(node=>node.textContent),' +
    'animation:getComputedStyle(document.querySelector(".ambient-gradient"),"::before").animationName};})()');
  const screenshot = await browser.screenshot(label);
  results.push({ label, ...detail, layout, screenshot });
  writeFileSync(join(output, 'results.json'), JSON.stringify(results, null, 2));
}
try {
  await browser.navigate('worst');
  await evaluate('localStorage.setItem("techkasir.sidebarCollapsed","false");location.reload();');
  await browser.waitFor('!!document.querySelector(".dashboard-home") && !document.querySelector(".sidebar-collapsed")');
  for (const width of [320,390,768,1440]) {
    await browser.viewport(width);
    await browser.navigate('worst');
    for (const page of pages) {
      if (page !== 'dashboard') await browser.page(page);
      await evaluate('scrollTo(0,0)');
      await capture('worst-' + page + '-' + width, { mode:'worst', page, width });
    }
    console.log('Worst-case screens complete at ' + width + 'px');
  }
  for (const mode of ['demo','empty','one','thousand']) {
    for (const width of [320,390,768,1440]) {
      await browser.viewport(width);
      const start = Date.now();
      await browser.navigate(mode);
      await capture(mode + '-dashboard-' + width, {mode,width});
      await browser.page('customers');
      await evaluate('scrollTo(0,0)');
      await capture(mode + '-customers-' + width, {mode,width,loadMilliseconds:Date.now()-start});
      if (mode === 'thousand') {
        await browser.page('units');
        await capture(mode + '-units-' + width,{mode,width});
      }
    }
    console.log('Dataset checks complete: ' + mode);
  }
  for (const width of [320,390,768,1440]) {
    await browser.viewport(width);
    await browser.navigate('worst');
    for (const mode of ['light','dark']) {
      for (const palette of palettes) {
        await evaluate('localStorage.setItem("techkasir.appearance",' + JSON.stringify(JSON.stringify({palette,mode})) + ');location.reload();');
        await browser.waitFor('!!document.querySelector(".dashboard-home") && document.documentElement.dataset.palette === ' + JSON.stringify(palette));
        await capture('theme-' + mode + '-' + palette + '-' + width,{width,mode,palette});
      }
    }
    console.log('All 18 theme/mode combinations complete at ' + width + 'px');
  }
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await capture('reduced-motion-dark-1440');
  await browser.send('Emulation.setEmulatedMedia',{features:[]});
  await browser.viewport(720,450);
  await browser.send('Emulation.setDeviceMetricsOverride',{width:720,height:450,deviceScaleFactor:2,mobile:false});
  await browser.navigate('worst');
  await capture('zoom-200-equivalent-dashboard',{zoom:'200% reflow equivalent, physical 1440x900'});
  await browser.page('units');
  await browser.click('[data-action="new-unit"]');
  await capture('zoom-200-equivalent-modal');
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await browser.viewport(1440);
  await browser.navigate('worst');
  await browser.click('[data-action="toggle-sidebar"]');
  await pause(400);
  await capture('sidebar-collapsed-dark-1440',{
    surface:await evaluate('(() => {const n=document.querySelector(".sidebar-surface");return {clip:getComputedStyle(n).clipPath,gradientOnContainer:getComputedStyle(document.querySelector(".sidebar")).backgroundImage};})()')
  });
  await browser.click('[data-action="toggle-sidebar"]');
  await pause(400);
  await capture('sidebar-expanded-dark-1440');
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.click('[data-action="toggle-sidebar"]');
  await capture('sidebar-reduced-motion');
  await browser.send('Emulation.setEmulatedMedia',{features:[]});
  await browser.viewport(320);
  await browser.navigate('empty');
  await browser.page('sales');
  await browser.click('[data-action="new-sale"]');
  await capture('empty-sale-dropdowns-320');
  await evaluate('document.querySelector("#modal").scrollTop=99999');
  await capture('empty-sale-actions-320');
  console.log('Finished layout, themes, motion, sidebar and empty-dropdown checks.');
} catch (error) {
  results.push({error:error.stack});
  console.error(error.stack);
} finally {
  writeFileSync(join(output,'results.json'),JSON.stringify(results,null,2));
  writeFileSync(join(output,'browser-events.json'),JSON.stringify(browser.events.filter(event =>
    ['Runtime.exceptionThrown','Network.loadingFailed'].includes(event.method)),null,2));
  browser.socket.close();
}
