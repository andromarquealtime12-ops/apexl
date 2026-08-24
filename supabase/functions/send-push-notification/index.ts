import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:noreply@marketayiti.shop', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function isSafeUrl(url: unknown) {
  if (!url || typeof url !== 'string') return true
  return (
    url.startsWith('/') ||
    url.startsWith('https://apexl.lovable.app') ||
    url.startsWith('https://marketayiti.shop') ||
    url.startsWith('https://www.marketayiti.shop')
  )
}

async function deliver(userId: string, payloadObj: Record<string, unknown>) {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  const payload = JSON.stringify(payloadObj)
  let sent = 0
  let failed = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400, urgency: 'high' },
      )
      sent++
    } catch (e: any) {
      failed++
      const status = e?.statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return { sent, failed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const body = await req.json().catch(() => ({}))
    const { notification_id, user_id, title, body: text, url, tag } = body ?? {}

    // === Path A: server-side hook (database trigger) — delivers a stored notification once ===
    if (notification_id) {
      const { data: notif } = await admin
        .from('notifications')
        .select('id, user_id, title, message, action_url, push_sent, created_at')
        .eq('id', notification_id)
        .maybeSingle()

      if (!notif) return json({ error: 'Notification not found' }, 404)
      if (notif.push_sent) return json({ sent: 0, message: 'Already delivered' })

      // Only fresh notifications can be pushed (prevents replay of old ids)
      if (Date.now() - new Date(notif.created_at).getTime() > 10 * 60 * 1000) {
        return json({ sent: 0, message: 'Stale notification' })
      }

      await admin.from('notifications').update({ push_sent: true }).eq('id', notif.id)

      const result = await deliver(notif.user_id, {
        title: notif.title,
        body: notif.message ?? '',
        url: isSafeUrl(notif.action_url) ? notif.action_url || '/' : '/',
        tag: `notif-${notif.id}`,
      })
      return json(result)
    }

    // === Path B: authenticated client call ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !authData?.user) return json({ error: 'Unauthorized' }, 401)
    const callerId = authData.user.id

    if (!user_id || !title) return json({ error: 'user_id and title required' }, 400)

    if (user_id !== callerId) {
      const { data: isAdmin } = await supabaseAuth.rpc('has_role', {
        _user_id: callerId,
        _role: 'admin',
      })
      if (!isAdmin) return json({ error: 'Forbidden' }, 403)
    }

    if (!isSafeUrl(url)) return json({ error: 'Invalid url' }, 400)

    const result = await deliver(user_id, {
      title,
      body: text || '',
      url: url || '/',
      tag: tag || 'apexl',
    })
    return json(result)
  } catch (e: any) {
    return json({ error: e?.message ?? 'Unexpected error' }, 500)
  }
})
