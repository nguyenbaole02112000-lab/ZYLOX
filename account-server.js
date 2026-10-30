'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');

const scrypt = promisify(crypto.scrypt);
const root = fs.realpathSync(__dirname);
const dataDir = path.resolve(process.env.FANTASY_DATA_DIR || path.join(os.homedir(), '.fantasy-game'));
if (dataDir === root || dataDir.startsWith(root + path.sep)) throw new Error('Account data must be outside the public game directory.');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const dataReal = fs.realpathSync(dataDir);
if (dataReal === root || dataReal.startsWith(root + path.sep)) throw new Error('Account data must be outside the public game directory.');
const db = new DatabaseSync(path.join(dataReal, 'accounts.sqlite'));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL, password_salt TEXT, password_hash TEXT,
    is_guest INTEGER NOT NULL DEFAULT 0, progress TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS candy_operations (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id TEXT NOT NULL, PRIMARY KEY(user_id,operation_id)
  );`);

const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/setting.html', ['setting.html', 'text/html; charset=utf-8']],
  ['/halloween.html', ['halloween.html', 'text/html; charset=utf-8']],
  ['/music.js', ['music.js', 'text/javascript; charset=utf-8']],
  ['/game-replay.js', ['game-replay.js', 'text/javascript; charset=utf-8']],
  ['/online-runs.js', ['online-runs.js', 'text/javascript; charset=utf-8']],
  ['/online-ui.js', ['online-ui.js', 'text/javascript; charset=utf-8']],
  ['/admin.js', ['admin.js', 'text/javascript; charset=utf-8']],
  ['/entities-preview.js', ['entities-preview.js', 'text/javascript; charset=utf-8']],
  ['/entity-art.js', ['entity-art.js', 'text/javascript; charset=utf-8']],
  ['/supabase-client.js', ['supabase-client.js', 'text/javascript; charset=utf-8']],
  ['/vendor/supabase-js-2.57.4.js', ['vendor/supabase-js-2.57.4.js', 'text/javascript; charset=utf-8']],
  ['/account.js', ['account.js', 'text/javascript; charset=utf-8']],
  ['/volume.js', ['volume.js', 'text/javascript; charset=utf-8']],
  ['/assets/music/amen-break.mp3', ['assets/music/amen-break.mp3', 'audio/mpeg']]
]);
const failures = new Map();
const lifetime = 30 * 24 * 60 * 60;
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function publicUser(user) { return { id: user.id, username: user.username, displayName: user.display_name, isGuest: !!user.is_guest }; }
function cookie(req, name) {
  const part = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return part ? part.slice(name.length + 1) : '';
}
function sessionUser(req) {
  const token = cookie(req, 'fantasy_session');
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires>?').get(sha(token), Math.floor(Date.now()/1000)) || null;
}
function setCookie(req, res, token, maxAge) {
  res.setHeader('Set-Cookie', `fantasy_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${req.socket.encrypted ? '; Secure' : ''}`);
}
function issueSession(req, res, user) {
  const old = cookie(req, 'fantasy_session');
  if (/^[a-f0-9]{64}$/.test(old)) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(old));
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires<=?').run(Math.floor(Date.now()/1000));
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(sha(token), user.id, Math.floor(Date.now()/1000)+lifetime);
  setCookie(req, res, token, lifetime);
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let value;
  try { value = new URL(origin); } catch { fail(403, 'Invalid origin.'); }
  const protocol = req.socket.encrypted ? 'https:' : 'http:';
  if (value.protocol !== protocol || value.host !== req.headers.host) fail(403, 'Cross-origin requests are not allowed.');
}
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'Use application/json.');
  let size=0, chunks=[];
  for await (const chunk of req) { size += chunk.length; if (size > 65536) fail(413, 'Request is too large.'); chunks.push(chunk); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { fail(400, 'Invalid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Expected a JSON object.');
  return value;
}
function limit(req) {
  const ip = req.socket.remoteAddress || 'unknown', now = Date.now();
  const recent = (failures.get(ip) || []).filter(t => now-t < 15*60*1000);
  if (recent.length >= 12) fail(429, 'Too many attempts. Please try again later.');
  recent.push(now); failures.set(ip,recent);
  if (failures.size > 10000) for (const [key,times] of failures) if (now-times[times.length-1] >= 15*60*1000) failures.delete(key);
}
function passwordValid(password) { return typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password,'utf8') <= 256; }
async function hashPassword(password, salt) { return (await scrypt(password, Buffer.from(salt,'hex'), 64)).toString('hex'); }
function ipv6(req) {
  const ip = req.socket.remoteAddress || '';
  if (req.socket.remoteFamily !== 'IPv6' || ip.toLowerCase().startsWith('::ffff:')) fail(400, 'Guest login requires a direct IPv6 connection.');
  return ip.toLowerCase().split('%')[0];
}
function requireUser(req) {
  const user = sessionUser(req);
  if (!user) fail(401, 'Please sign in.');
  if (req.headers['x-zylox-account']!==user.id) fail(409, 'The active account changed. Please reload.');
  return user;
}
function readProgress(user) { try { const p=JSON.parse(user.progress); return p && typeof p==='object' && !Array.isArray(p) ? p : {}; } catch { return {}; } }
function updateProgress(user, update) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row=db.prepare('SELECT progress FROM users WHERE id=?').get(user.id);
    if (!row) fail(401,'Please sign in.');
    const progress=readProgress(row); update(progress);
    db.prepare('UPDATE users SET progress=? WHERE id=?').run(JSON.stringify(progress),user.id);
    db.exec('COMMIT'); return progress;
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}

async function api(req,res,url) {
  sameOrigin(req);
  const route=url.pathname, method=req.method;
  if (method==='GET' && route==='/api/account/me') {
    const user=sessionUser(req); return send(res,200,{account:user ? publicUser(user) : null});
  }
  if (method==='POST' && route==='/api/account/signup') {
    limit(req); const {username,password}=await body(req);
    if (typeof username!=='string' || !/^[A-Za-z0-9_]{3,32}$/.test(username)) fail(400,'Username must contain 3–32 letters, numbers or underscores.');
    if (!passwordValid(password)) fail(400,'Password must be at least 8 characters and no more than 256 bytes.');
    const salt=crypto.randomBytes(16).toString('hex'), hash=await hashPassword(password,salt), id=crypto.randomUUID();
    try { db.prepare('INSERT INTO users(id,username,display_name,password_salt,password_hash) VALUES(?,?,?,?,?)').run(id,username,username,salt,hash); }
    catch(e) { if (String(e.message).includes('UNIQUE constraint failed')) fail(409,'Username is already taken.'); throw e; }
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(id); issueSession(req,res,user); return send(res,201,{account:publicUser(user)});
  }
  if (method==='POST' && route==='/api/account/login') {
    limit(req); const {username,password}=await body(req);
    if (typeof username!=='string' || !passwordValid(password)) fail(401,'Invalid username or password.');
    const user=db.prepare('SELECT * FROM users WHERE username=? AND is_guest=0').get(username);
    const salt=user?.password_salt || '00000000000000000000000000000000';
    const actual=Buffer.from(await hashPassword(password,salt),'hex');
    const expected=Buffer.from(user?.password_hash || '0'.repeat(128),'hex');
    if (!crypto.timingSafeEqual(actual,expected) || !user) fail(401,'Invalid username or password.');
    issueSession(req,res,user); return send(res,200,{account:publicUser(user)});
  }
  if (method==='POST' && route==='/api/account/guest') {
    limit(req); await body(req); const name='Guest#'+sha(ipv6(req));
    db.prepare('INSERT OR IGNORE INTO users(id,username,display_name,is_guest) VALUES(?,?,?,1)').run('guest:'+name,name,name);
    const user=db.prepare('SELECT * FROM users WHERE username=? AND is_guest=1').get(name);
    issueSession(req,res,user); return send(res,200,{account:publicUser(user)});
  }
  if (method==='POST' && route==='/api/account/logout') {
    await body(req); requireUser(req); const token=cookie(req,'fantasy_session');
    if (/^[a-f0-9]{64}$/.test(token)) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));
    setCookie(req,res,'',0); return send(res,200,{account:null});
  }
  if (method==='PATCH' && route==='/api/account/display-name') {
    const user=requireUser(req), {displayName}=await body(req);
    if (typeof displayName!=='string' || !displayName.trim() || [...displayName.trim()].length>32) fail(400,'Display name must be 1–32 characters.');
    db.prepare('UPDATE users SET display_name=? WHERE id=?').run(displayName.trim(),user.id);
    return send(res,200,{account:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});
  }
  if (method==='POST' && route==='/api/account/password') {
    limit(req); const user=requireUser(req), {currentPassword,newPassword}=await body(req);
    if (user.is_guest) fail(400,'Guest accounts do not have passwords.');
    if (!passwordValid(currentPassword) || !passwordValid(newPassword)) fail(400,'Passwords must be at least 8 characters and no more than 256 bytes.');
    const actual=Buffer.from(await hashPassword(currentPassword,user.password_salt),'hex'), expected=Buffer.from(user.password_hash,'hex');
    if (!crypto.timingSafeEqual(actual,expected)) fail(403,'Current password is incorrect.');
    const salt=crypto.randomBytes(16).toString('hex'), hash=await hashPassword(newPassword,salt);
    db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').run(salt,hash,user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); issueSession(req,res,user);
    return send(res,200,{account:publicUser(user)});
  }
  if (method==='GET' && route==='/api/progress') return send(res,200,{progress:readProgress(requireUser(req))});
  if (method==='POST' && route==='/api/progress/candy') {
    const user=requireUser(req), {delta,operationId}=await body(req);
    if (!Number.isSafeInteger(delta) || delta<1 || delta>100000) fail(400,'Candy increment must be between 1 and 100000.');
    if (operationId!==undefined && (typeof operationId!=='string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(operationId))) fail(400,'Invalid operation ID.');
    if (delta>1 && operationId===undefined) fail(400,'A unique operation ID is required to import Candy.');
    const progress=updateProgress(user,p=>{
      if(operationId!==undefined && db.prepare('INSERT OR IGNORE INTO candy_operations(user_id,operation_id) VALUES(?,?)').run(user.id,operationId).changes===0)return;
      p.candy=Math.min(Number.MAX_SAFE_INTEGER,(Number.isSafeInteger(p.candy)&&p.candy>=0?p.candy:0)+delta);
    });
    return send(res,200,{progress});
  }
  if (method==='POST' && route==='/api/progress/best') {
    const user=requireUser(req), {key,value}=await body(req);
    if (typeof key!=='string' || !/^halloween_best_[a-z0-9_]{1,80}$/.test(key) || !Number.isSafeInteger(value) || value<0 || value>1000000000) fail(400,'Invalid score.');
    const progress=updateProgress(user,p=>{if(!p.bestScores || typeof p.bestScores!=='object' || Array.isArray(p.bestScores))p.bestScores=Object.create(null);p.bestScores[key]=Math.max(Number(p.bestScores[key])||0,value);});
    return send(res,200,{progress});
  }
  fail(404,'Not found.');
}
const handler=async (req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req,res,url);
    if (req.method!=='GET' && req.method!=='HEAD') return send(res,405,{error:'Method not allowed.'});
    const entry=publicFiles.get(url.pathname);
    if(!entry)return send(res,404,{error:'Not found.'});
    const file=path.join(root,entry[0]);
    const resolved=fs.realpathSync(file);
    if(!resolved.startsWith(root+path.sep))return send(res,404,{error:'Not found.'});
    const stat=fs.statSync(resolved);
    if(!stat.isFile())return send(res,404,{error:'Not found.'});
    res.writeHead(200,{'Content-Type':entry[1], 'Content-Length':stat.size, 'X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(resolved).on('error',()=>res.destroy()).pipe(res);
  } catch(error) {
    if(res.headersSent)return res.destroy();
    if(error.code==='ENOENT')return send(res,404,{error:'Not found.'});
    if(!error.status)console.error('Request error:',error);
    send(res,error.status || 500,{error:error.status ? error.message : 'Internal server error.'});
  }
};
const host=process.env.FANTASY_HOST || '::1', port=Number(process.env.PORT || 8080);
const keyPath=process.env.FANTASY_TLS_KEY, certPath=process.env.FANTASY_TLS_CERT;
if (!!keyPath !== !!certPath) throw new Error('Both FANTASY_TLS_KEY and FANTASY_TLS_CERT are required for HTTPS.');
const tls=!!keyPath;
if (!tls && !['::1','127.0.0.1','localhost'].includes(host) && process.env.FANTASY_ALLOW_INSECURE_HTTP!=='1') {
  throw new Error('Public listening requires HTTPS. Set FANTASY_TLS_KEY and FANTASY_TLS_CERT.');
}
const server=tls ? https.createServer({key:fs.readFileSync(keyPath),cert:fs.readFileSync(certPath)},handler) : http.createServer(handler);
server.listen(port,host,()=>console.log(`Fantasy game running at ${tls?'https':'http'}://${host.includes(':')?'['+host+']':host}:${port}`));
