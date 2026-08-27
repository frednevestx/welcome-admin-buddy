CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;

SELECT cron.unschedule(jobname) FROM cron.job
WHERE jobname IN ('luud-check-alerts','luud-daily-summary','luud-check-reminders');

SELECT cron.schedule('luud-check-alerts', '0 */4 * * *', $$
  SELECT extensions.http_post(
    url := 'https://luudpro.app/api/public/whatsapp/gemini',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"command": "__SYSTEM_CHECK_ALERTS__"}'::jsonb
  );
$$);

SELECT cron.schedule('luud-daily-summary', '0 0 * * *', $$
  SELECT extensions.http_post(
    url := 'https://luudpro.app/api/public/whatsapp/gemini',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"command": "__SYSTEM_DAILY_SUMMARY__"}'::jsonb
  );
$$);

SELECT cron.schedule('luud-check-reminders', '5 * * * *', $$
  SELECT extensions.http_post(
    url := 'https://luudpro.app/api/public/whatsapp/gemini',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"command": "__SYSTEM_CHECK_REMINDERS__"}'::jsonb
  );
$$);