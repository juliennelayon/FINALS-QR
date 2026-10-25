-- Optional: install pg_cron and pg_net through Supabase integrations first.
-- Create two Vault secrets in the dashboard, NEVER commit the secret values:
-- scanin_worker_url = https://YOUR_PROJECT.supabase.co/functions/v1/scanin-worker
-- scanin_worker_secret = same random value as the Edge Function SCANIN_WORKER_SECRET
-- Run this once after deploying the worker. Cron invokes it every minute.
select cron.schedule('scanin-minute-worker','* * * * *',
$$select net.http_post(
 url := (select decrypted_secret from vault.decrypted_secrets where name='scanin_worker_url'),
 headers := jsonb_build_object('Content-Type','application/json','x-scanin-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='scanin_worker_secret')),
 body := '{}'::jsonb
);$$);
-- To remove: select cron.unschedule('scanin-minute-worker');
