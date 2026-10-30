'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=__dirname,out=path.join(root,'.tools','site-build');
const pages=['index.html','setting.html','halloween.html'];
const files=new Set([...pages,'assets/music/amen-break.mp3','assets/bao-brand.png']);
for(const page of pages){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const src=match[1].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if(src&&!/^(https?:)?\/\//i.test(src))files.add(src.split('?')[0]);
    if(!src&&match[2].trim())new vm.Script(match[2],{filename:`${page}:inline`});
  }
}
const manifest=[];
for(const file of files){
  const src=path.resolve(root,file);
  if(!src.startsWith(root+path.sep)||!fs.existsSync(src))throw Error(`Missing or unsafe asset: ${file}`);
  const bytes=fs.readFileSync(src);
  if(file.endsWith('.js'))new vm.Script(bytes.toString('utf8'),{filename:file});
  const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  manifest.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Built ${manifest.length} static files in ${out}`);
