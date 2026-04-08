import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Test Webflow connection: Missing Authorization header')
      throw new Error('Authorization failed')
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.log('Test Webflow connection: Authentication failed', authError?.message)
      throw new Error('Authorization failed')
    }

    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })

    if (!isAdmin) {
      console.log('Test Webflow connection: Non-admin user attempted test:', user.id)
      throw new Error('Authorization failed')
    }

    const body = await req.json().catch(() => null)
    const collectionId = body?.collectionId as string | undefined

    if (!collectionId) {
      console.log('Test Webflow connection: Missing collectionId in request')
      return new Response(
        JSON.stringify({ error: 'collectionId is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const webflowApiToken = Deno.env.get('WEBFLOW_API_TOKEN')

    if (!webflowApiToken) {
      console.log('Test Webflow connection: WEBFLOW_API_TOKEN not configured')
      return new Response(
        JSON.stringify({ error: 'WEBFLOW_API_TOKEN not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const url = `https://api.webflow.com/v2/collections/${collectionId}/items?limit=1`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${webflowApiToken}`,
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.log('Test Webflow connection: Webflow API error', response.status, errorText)

      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          body: errorText || null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const data = await response.json().catch(() => null)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.log(
      'Test Webflow connection: Unexpected error',
      error instanceof Error ? error.message : 'Unknown error',
    )

    const isAuthError =
      error instanceof Error &&
      (error.message.includes('Authorization') || error.message.includes('Invalid'))

    return new Response(
      JSON.stringify({
        success: false,
        error: isAuthError
          ? error.message
          : 'An error occurred while testing the Webflow connection',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isAuthError ? 403 : 500,
      }
    )
  }
})
