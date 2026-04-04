import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Base64url decode helper
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  const binary = atob(base64 + pad)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

// Create JWT for VAPID
async function createVapidJwt(endpoint: string): Promise<string> {
  const origin = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { aud: origin, exp: now + 12 * 3600, sub: 'mailto:noreply@marketayiti.lovable.app' }

  const enc = new TextEncoder()
  const headerB64 = btoa(String.fromCharCode(...enc.encode(JSON.stringify(header))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payloadB64 = btoa(String.fromCharCode(...enc.encode(JSON.stringify(payload))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const unsignedToken = `${headerB64}.${payloadB64}`

  // Import private key
  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY)
  const key = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(unsignedToken)
  )

  // Convert DER signature to raw r||s format if needed
  const sigArray = new Uint8Array(signature)
  let rawSig: Uint8Array
  if (sigArray.length === 64) {
    rawSig = sigArray
  } else {
    // DER format, extract r and s
    const r_len = sigArray[3]
    const r_start = 4
    const s_len = sigArray[r_start + r_len + 1]
    const s_start = r_start + r_len + 2
    
    const r = sigArray.slice(r_start, r_start + r_len)
    const s = sigArray.slice(s_start, s_start + s_len)
    
    rawSig = new Uint8Array(64)
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32))
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32))
  }

  const sigB64 = btoa(String.fromCharCode(...rawSig))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return `${unsignedToken}.${sigB64}`
}

async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const jwt = await createVapidJwt(subscription.endpoint)
  const publicKeyB64 = VAPID_PUBLIC_KEY

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
      'Authorization': `vapid t=${jwt}, k=${publicKeyB64}`,
    },
    body: payload,
  })

  return response
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, title, body, url, tag } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user's push subscriptions
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const payload = JSON.stringify({ title, body: body || '', url: url || '/', tag: tag || 'ayiti-marche' })

    let sent = 0
    let failed = 0
    for (const sub of subs) {
      try {
        const res = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        )
        if (res.status === 201 || res.status === 200) {
          sent++
        } else if (res.status === 410 || res.status === 404) {
          // Subscription expired, remove it
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          failed++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
