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
          persistSession: false
        }
      }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !requestingUser) {
      console.log('Delete user: Authentication failed')
      throw new Error('Authorization failed')
    }

    // Check if requesting user is admin using has_role RPC
    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: requestingUser.id,
      _role: 'admin',
    })

    if (!isAdmin) {
      console.log('Delete user: Non-admin user attempted deletion:', requestingUser.id)
      throw new Error('Authorization failed')
    }

    const { userId } = await req.json()

    if (!userId) {
      console.log('Delete user: Missing userId in request')
      throw new Error('Invalid request')
    }

    // Prevent deleting yourself
    if (userId === requestingUser.id) {
      console.log('Delete user: User attempted to delete own account:', userId)
      throw new Error('Invalid operation')
    }

    // Delete associated invitations first
    const { error: inviteDeleteError } = await supabaseClient
      .from('invitations')
      .delete()
      .eq('used_by', userId)

    if (inviteDeleteError) {
      console.log('Delete user: Warning - failed to delete invitations for user:', userId, inviteDeleteError.message)
    }

    // Delete the user using admin API
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.log('Delete user: Failed to delete user:', userId, deleteError.message)
      throw new Error('Operation failed')
    }
    
    console.log('Delete user: Successfully deleted user:', userId)

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    // Log detailed error server-side only
    console.log('Delete user error:', error instanceof Error ? error.message : 'Unknown error')
    
    // Return generic error message to client
    const isAuthError = error instanceof Error && 
                        (error.message.includes('Authorization') || error.message.includes('Invalid'));
    return new Response(
      JSON.stringify({ 
        error: isAuthError ? error.message : 'An error occurred while processing your request' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isAuthError ? 403 : 400
      }
    )
  }
})
