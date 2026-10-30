'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'.tools','site-build');
const files=new Set(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).map(entry=>entry.file));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mp3':'audio/mpeg','.png':'image/png'};
http.createServer((req,res)=>{
  let name;
  try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html'}catch(_){res.writeHead(400).end();return}
  if(!['GET','HEAD'].includes(req.method)||!files.has(name)){res.writeHead(404).end();return}
  const file=path.join(root,name);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return}fs.createReadStream(file).pipe(res);
}).listen(8080,'127.0.0.1',()=>process.stdout.write('Preview ready on http://127.0.0.1:8080/index.html?auth=cloud\n'));
