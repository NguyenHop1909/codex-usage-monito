const {app,BrowserWindow}=require('electron');
const path=require('path'),fs=require('fs');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:290,height:182,show:false,webPreferences:{preload:path.join(__dirname,'ui-smoke-preload.js'),contextIsolation:true,nodeIntegration:false}});
  await win.loadFile(path.join(__dirname,'..','src','mini.html'));
  await new Promise(r=>setTimeout(r,500));
  const checks=await win.webContents.executeJavaScript(`({five:document.querySelector('#five').textContent,week:document.querySelector('#week').textContent,state:document.querySelector('#state').className,close:!!document.querySelector('#close'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})`);
  if(checks.five!=='42%'||checks.week!=='68%'||checks.state!=='online'||!checks.close||checks.overflow)throw Error(`Mini smoke assertion failed: ${JSON.stringify(checks)}`);
  const image=await win.webContents.capturePage(),out=path.join(__dirname,'..','ui-smoke-mini.png');
  fs.writeFileSync(out,image.toPNG());
  console.log(`MINI_SMOKE_OK ${JSON.stringify(checks)} ${out}`);
  app.quit();
});
