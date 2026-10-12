const {app,BrowserWindow}=require('electron');
const path=require('path'),fs=require('fs');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:520,height:620,show:false,webPreferences:{preload:path.join(__dirname,'ui-smoke-preload.js'),contextIsolation:true,nodeIntegration:false}});
  await win.loadFile(path.join(__dirname,'..','src','index-update.html'));
  await new Promise(r=>setTimeout(r,800));
  const checks=await win.webContents.executeJavaScript(`({cards:document.querySelectorAll('#limits article').length,panels:document.querySelectorAll('details').length,thresholds:document.querySelectorAll('.threshold:checked').length,health:document.querySelectorAll('#health .health.online').length,widget:document.querySelector('#widget').checked,version:document.querySelector('#version').textContent,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})`);
  if(checks.cards!==2||checks.panels!==3||checks.thresholds!==3||checks.health!==3||checks.widget||checks.version!=='vtest'||checks.overflow)throw Error(`UI smoke assertion failed: ${JSON.stringify(checks)}`);
  const image=await win.webContents.capturePage();
  const out=path.join(__dirname,'..','ui-smoke.png');
  fs.writeFileSync(out,image.toPNG());
  console.log(`UI_SMOKE_OK ${JSON.stringify(checks)} ${out}`);
  app.quit();
});
