// app/api/user/remove-account/route.ts
import { NextResponse } from 'next/server';
import { createServerClient/* , type CookieOptions */ } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const removeAccountSchema = z.object({
  password: z.string().min(1, "Password is required for account removal."), // Basic check, Supabase handles actual policy
});

export async function DELETE(request: Request) { // Added request parameter
  const cookieStore = cookies(); // cookies() returns the store directly

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const store = await Promise.resolve(cookieStore);
          return store.getAll();
        },
        async setAll(cookiesToSet) {
          const store = await Promise.resolve(cookieStore);
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Error fetching user for removal:', authError);
      return NextResponse.json({ success: false, message: 'Unauthorized: No active session or failed to retrieve user.' }, { status: 401 });
    }

    let rawBody;
    try {
      rawBody = await request.json();
    } catch (jsonError) {
      console.error('API remove-account: Error parsing JSON body:', jsonError);
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const validationResult = removeAccountSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data.' }, // Generic message, removed errors
        { status: 400 }
      );
    }
    const { password } = validationResult.data;

    const email = user.email;
    if (!email) {
        // Should not happen if user object exists, but good to check
        console.error('User email not found for re-authentication.');
        return NextResponse.json({ success: false, message: 'User email not found. Cannot re-authenticate.' }, { status: 500 });
    }

    // Re-authenticate the user with their email and the provided password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (signInError) {
      console.warn(`Re-authentication failed for user ${email} during account removal: ${signInError.message}`);
      // Common error codes for signInWithPassword: 'invalid_grant' for incorrect credentials
      let friendlyMessage = 'Incorrect password. Account removal aborted.';
      if (signInError.message.toLowerCase().includes('rate limit')) {
        friendlyMessage = 'Too many attempts. Please try again later.';
      }
      return NextResponse.json({ success: false, message: friendlyMessage }, { status: 403 }); // 403 Forbidden for wrong password
    }
    
    // Re-authentication successful, proceed with removal using admin client
    const userId = user.id;
    console.log(`Re-authentication successful. Attempting to remove account for user ID: ${userId}`);

    // Ensure SERVICE_ROLE_KEY is set
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
      return NextResponse.json({ success: false, message: 'Server configuration error: Service role key not found.' }, { status: 500 });
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Delete the user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(`Error removing user ${userId} from Supabase Auth:`, deleteError);
      return NextResponse.json({ success: false, message: 'Failed to remove account due to a server error.' }, { status: 500 }); // Generic message
    }

    console.log(`Successfully removed user ${userId} from Supabase Auth.`);
    // Associated data in public tables should be deleted by RLS ON DELETE CASCADE if set up correctly.

    // It's good practice to also sign the user out from the current client perspective,
    // though their session is now invalid. The client-side should handle this.
    // await supabase.auth.signOut(); // This might not be strictly necessary here as client will do it.

    return NextResponse.json({ success: true, message: 'Account successfully removed.' });

  } catch (error) {
    console.error('Unexpected error during account removal:', error);
    return NextResponse.json({ success: false, message: 'An unexpected server error occurred.' }, { status: 500 }); // Generic message
  }
}
