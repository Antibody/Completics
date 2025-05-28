// app/api/workspaces/[workspaceId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> } // ← params is a Promise in Next.js 15+
) {
  const { workspaceId } = await params; // ← await it here

  const cookieStore = cookies();
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
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error(`DELETE /workspaces/${workspaceId}: auth failed`, authError);
    return NextResponse.json(
      { success: false, message: 'Authentication failed.' }, // Generic message
      { status: 401 }
    );
  }

  const userId = user.id;

  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('id, user_id')
    .eq('id', workspaceId)
    .single();

  if (fetchError || !workspace) {
    console.error(`DELETE /workspaces/${workspaceId}: fetch error or not found`, fetchError);
    return NextResponse.json(
      { success: false, message: 'Workspace not found or access denied.' }, // Generic message
      { status: 404 }
    );
  }

  if (workspace.user_id !== userId) {
    console.warn(`DELETE /workspaces/${workspaceId}: permission denied (owner ${workspace.user_id})`);
    return NextResponse.json(
      { success: false, message: 'You do not have permission to delete this workspace.' },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (deleteError) {
    console.error(`DELETE /workspaces/${workspaceId}: deletion error`, deleteError);
    return NextResponse.json(
      { success: false, message: 'Failed to delete workspace due to a server error.' }, // Generic message
      { status: 500 }
    );
  }

  console.log(`Workspace ${workspaceId} deleted by user ${userId}`);
  return NextResponse.json({ success: true, message: 'Workspace deleted successfully.' });
}
