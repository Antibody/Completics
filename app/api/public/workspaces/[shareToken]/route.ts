// app/api/public/workspaces/[shareToken]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define simple types for the data fetched for public view
interface PublicProject {
  id: string;
  name: string;
  color: string | null;
}

interface PublicVer {
  id: string;
  name: string;
}

/* -------------------------------------------------------------------------- */
/*  GET handler to fetch a publicly shared workspace by token                 */
/* -------------------------------------------------------------------------- */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shareToken: string }> }
): Promise<NextResponse> {
  void request; // Request object not currently used
  const { shareToken } = await context.params;

  if (!shareToken) {
    return NextResponse.json({ error: 'Share token is required.' }, { status: 400 });
  }

  // Ensure SERVICE_ROLE_KEY is set for admin operations
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    console.error('API public workspace GET: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  // Create Supabase admin client to bypass RLS for this specific read operation
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Find the workspace using the share token and check if it's shared
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, user_id, created_at, public_share_mode, is_shared_publicly') // Include public_share_mode
      .eq('share_token', shareToken)
      .eq('is_shared_publicly', true)
      // We no longer filter by public_share_mode here, client will decide behavior
      .maybeSingle(); 

    if (workspaceError) {
      console.error(`API public workspace GET: Error fetching workspace with token ${shareToken}`, workspaceError);
      return NextResponse.json({ error: 'Failed to retrieve workspace information.' }, { status: 500 });
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Shared workspace not found or sharing is disabled.' }, { status: 404 });
    }

    const workspaceId = workspace.id;

    // 2. Fetch stages for the workspace
    const { data: stages, error: stagesError } = await supabaseAdmin
      .from('stages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('order', { ascending: true });

    if (stagesError) {
      console.error(`API public workspace GET: Error fetching stages for workspace ${workspaceId}`, stagesError);
      return NextResponse.json({ error: 'Failed to retrieve workspace stages.' }, { status: 500 });
    }

    // 3. Fetch non-archived tasks for the workspace
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('id, title, description, stage_id, order, due_date, project_id, ver_id, created_at') // Exclude is_archived=true
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false) // Only fetch non-archived tasks for public view
      .order('stage_id')
      .order('order', { ascending: true });

    if (tasksError) {
      console.error(`API public workspace GET: Error fetching tasks for workspace ${workspaceId}`, tasksError);
      return NextResponse.json({ error: 'Failed to retrieve workspace tasks.' }, { status: 500 });
    }
    
    // 4. Fetch associated Projects and Vers referenced by the tasks
    // Get unique IDs from the fetched tasks
    const projectIds = [...new Set(tasks?.map(t => t.project_id).filter((id): id is string => id !== null))];
    const verIds = [...new Set(tasks?.map(t => t.ver_id).filter((id): id is string => id !== null))];

    let projects: PublicProject[] = []; // Explicitly type the array
    if (projectIds.length > 0) {
        const { data: fetchedProjects, error: projectsError } = await supabaseAdmin
            .from('projects')
            .select('id, name, color') // Only fetch necessary fields for display
            .in('id', projectIds);
        if (projectsError) {
            console.warn(`API public workspace GET: Error fetching projects for workspace ${workspaceId}`, projectsError);
            // Non-critical, proceed without projects if fetch fails
        } else {
            projects = fetchedProjects || [];
        }
    }

    let vers: PublicVer[] = []; // Explicitly type the array
    if (verIds.length > 0) {
        const { data: fetchedVers, error: versError } = await supabaseAdmin
            .from('vers')
            .select('id, name') // Only fetch necessary fields for display
            .in('id', verIds);
        if (versError) {
            console.warn(`API public workspace GET: Error fetching vers for workspace ${workspaceId}`, versError);
            // Non-critical, proceed without vers if fetch fails
        } else {
            vers = fetchedVers || [];
        }
    }


    // 5. Combine and return the data
    return NextResponse.json({
      success: true,
      workspace,
      stages: stages || [],
      tasks: tasks || [],
      projects: projects, // Include fetched projects
      vers: vers, // Include fetched vers
    });

  } catch (error) {
    console.error(`API public workspace GET: Unexpected error for token ${shareToken}`, error);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 }); // Generic message
  }
}
