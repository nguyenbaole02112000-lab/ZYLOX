import './game-replay.js';

const replay = (globalThis as any).BaoReplay;
const project = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const allowedOrigins = new Set([
  'https://nguyenbaole02112000-lab.github.io',
  'http://[::1]:8080', 'http://localhost:8080', 'http://127.0.0.1:8080'
]);

Deno.serve(async (request: Request) => {
  const origin=request.headers.get('origin') || '';
  const headers: Record<string,string> = { 'Content-Type':'application/json', 'Vary':'Origin' };
  if(allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods']='POST, OPTIONS';
  const response=(status:number, data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return response(405,{error:'Method not allowed'});
  if(origin&&!allowedOrigins.has(origin))return response(403,{error:'Origin not allowed'});
  try {
    const authorization=request.headers.get('authorization') || '';
    if(!/^Bearer\s+\S+$/i.test(authorization))return response(401,{error:'Sign in required'});
    if(!project||!publicKey||!serverKey)return response(503,{error:'Game verification is unavailable'});
    const userResponse=await fetch(`${project}/auth/v1/user`,{headers:{apikey:publicKey,authorization}});
    if(!userResponse.ok)return response(401,{error:'Your session has expired'});
    const user=await userResponse.json();
    if(!user?.id||user.is_anonymous)return response(403,{error:'A registered account is required'});
    const raw=await request.text();
    if(raw.length>600000)return response(413,{error:'Replay is too large'});
    let body: any;
    try{body=JSON.parse(raw)}catch{return response(400,{error:'Invalid request'})}
    if(typeof body?.run_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.run_id))return response(400,{error:'Invalid game session'});
    const challengeResponse=await fetch(`${project}/rest/v1/rpc/run_challenge`,{
      method:'POST',headers:{apikey:publicKey,authorization,'Content-Type':'application/json'},body:JSON.stringify({run_id:body.run_id})
    });
    if(!challengeResponse.ok)return response(403,{error:'Game session unavailable'});
    const challenge=await challengeResponse.json();
    if(challenge.completed_at)return response(200,{accepted:false,completed:true});
    if(challenge.admin_mode)return response(200,{accepted:false,practice:true});
    const elapsed=(Date.now()-Date.parse(challenge.started_at))/1000;
    if(!Number.isFinite(elapsed)||Number(body?.replay?.ticks)/Number(challenge.fps)>elapsed+4)return response(400,{error:'Invalid game timing'});
    let result: any;
    try{result=replay.simulate(challenge,body.replay)}catch{return response(400,{error:'Invalid game replay'})}
    const saved=await fetch(`${project}/rest/v1/rpc/apply_verified_run`,{
      method:'POST',headers:{apikey:serverKey,authorization:`Bearer ${serverKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({run_id:body.run_id,player_id:user.id,tick_count:result.ticks,score_value:result.score,candy_value:result.candy,finished:result.dead})
    });
    if(!saved.ok)return response(409,{error:'Could not save the verified game'});
    return response(200,await saved.json());
  }catch(_){return response(500,{error:'Game verification failed'})}
});
