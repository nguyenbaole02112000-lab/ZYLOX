(function (root) {
  'use strict';
  const url='https://ssookklwziszwbigatpw.supabase.co';
  const publishableKey='sb_publishable_6E2DNaA6ENIBAUKmtXZxFg_ajRyvuoz';
  if(!root.supabase?.createClient)throw new Error('Supabase library could not be loaded.');
  const client=root.supabase.createClient(url,publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'baofantasy_auth'}
  });
  async function check(result) { if(result.error)throw result.error; return result.data; }
  async function profile() {
    const session=await check(await client.auth.getSession());
    if(!session.session)return null;
    const auth=await check(await client.auth.getUser());
    if(!auth.user)return null;
    let result=await client.from('profiles').select('id,username,display_name').eq('id',auth.user.id).single();
    if(result.error?.code==='42703')result=await client.from('profiles').select('id,username').eq('id',auth.user.id).single();
    const data=await check(result);
    return {id:data.id,username:data.username,displayName:data.display_name||data.username,email:auth.user.email,isGuest:false};
  }
  async function signup(username,email,password) {
    const redirect=new URL('.',window.location.href).href;
    const result=await check(await client.auth.signUp({email,password,options:{data:{username},emailRedirectTo:redirect}}));
    return {session:result.session,user:result.user};
  }
  async function login(email,password) { return check(await client.auth.signInWithPassword({email,password})); }
  async function logout() { await check(await client.auth.signOut()); }
  async function changeDisplayName(id,displayName) {
    await check(await client.from('profiles').update({display_name:displayName}).eq('id',id));
    return profile();
  }
  async function changePassword(email,currentPassword,newPassword) {
    await login(email,currentPassword);
    await check(await client.auth.updateUser({password:newPassword}));
  }
  async function rpc(name,args={}) { return check(await client.rpc(name,args)); }
  async function getProgress() {
    const [wallet,bestScores]=await Promise.all([rpc('shop_state'),rpc('best_scores')]);
    return {coin:Number(wallet.coin)||0,candy:Number(wallet.candy)||0,bestScores:bestScores||{}};
  }
  async function verifyRun(runId, runReplay) {
    return check(await client.functions.invoke('verify-run',{body:{run_id:runId,replay:runReplay}}));
  }
  root.BaoCloud={client,profile,signup,login,logout,changeDisplayName,changePassword,rpc,getProgress,verifyRun};
})(window);
