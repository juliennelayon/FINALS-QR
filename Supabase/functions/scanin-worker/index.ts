// Deploy with Supabase CLI. Service credentials stay inside this Edge Function.
import {createClient} from 'npm:@supabase/supabase-js@2';
Deno.serve(async(req:Request)=>{
 const secret=Deno.env.get('SCANIN_WORKER_SECRET');
 if(req.method!=='POST'||!secret||req.headers.get('x-scanin-worker-secret')!==secret)return new Response('Unauthorized',{status:401});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 try{
 const tick=await db.rpc('scanin_tick');if(tick.error)throw tick.error;
 const {data:pending,error}=await db.rpc('scanin_claim_push');if(error)throw error;
 let sent=0;
 for(const n of pending||[]){
  const {data:profile}=await db.from('profiles').select('status,suspended,reminder_start,reminder_end').eq('id',n.user_id).single();
  let skip=!profile||profile.status!=='approved'||profile.suspended;
  if(n.event_id&&(n.dedupe_key.startsWith('start:')||n.dedupe_key.startsWith('end:'))){
   const {data:e}=await db.from('events').select('*').eq('id',n.event_id).single();
   skip ||= !e||e.status!=='open'||e.archived||Date.parse(e.end_time)<=Date.now();
   if(n.dedupe_key.startsWith('end:')){const {data:a}=await db.from('attendance').select('id').eq('event_id',n.event_id).eq('student_id',n.user_id).maybeSingle();skip ||= !!a||!profile?.reminder_end;}
   else {skip ||= !profile?.reminder_start||Date.parse(e?.start_time)<=Date.now();const {data:s}=await db.from('saved_events').select('event_id').eq('event_id',n.event_id).eq('student_id',n.user_id).maybeSingle();skip ||= !e?.required&&!s;}
  }
  if(skip){await db.from('notifications').update({push_sent:true}).eq('id',n.id);continue;}
  const {data:tokens,error:tokenError}=await db.from('push_tokens').select('token').eq('user_id',n.user_id);if(tokenError)throw tokenError;
  if(!tokens?.length){await db.from('notifications').update({push_sent:true}).eq('id',n.id);continue;}
  const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify(tokens.map(t=>({to:t.token,title:n.title,body:n.body,sound:'default',channelId:'default',data:{notificationId:n.id,eventId:n.event_id,requestId:n.request_id}})))});
  const result=await response.json();const tickets=Array.isArray(result.data)?result.data:[];let failed=!response.ok||!!result.errors||tickets.length!==tokens.length;
  for(let i=0;i<tickets.length;i++){if(tickets[i].status==='error'){if(tickets[i].details?.error==='DeviceNotRegistered')await db.from('push_tokens').delete().eq('token',tokens[i].token);else failed=true;}}
  await db.from('notifications').update({push_sent:!failed,push_error:failed?JSON.stringify(result).slice(0,500):null,push_claimed_at:null}).eq('id',n.id);if(!failed)sent++;
 }
 return Response.json({ok:true,sent});
 }catch(e){const message=e instanceof Error?e.message:String(e);console.error(message);
 const {data:admins}=await db.from('profiles').select('id').eq('role','administrator').eq('status','approved').eq('suspended',false);
 const hour=new Date().toISOString().slice(0,13);if(admins?.length)await db.from('notifications').upsert(admins.map(a=>({user_id:a.id,title:'Background processing needs attention',body:'A scheduled ScanIn task failed. Check server function logs and retry.',dedupe_key:`worker-error:${hour}:${a.id}`})),{onConflict:'dedupe_key',ignoreDuplicates:true});
 return Response.json({ok:false,error:'Background processing failed; inspect function logs.'},{status:500});}
});
