// app/api/workspaces/route.ts
import { NextResponse } from 'next/server';
import { createServerClient/* , type CookieOptions */ } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Pool } from 'pg'; // For direct DB access to seed columns in a transaction
import { z } from 'zod'; // Import Zod

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required.").max(100, "Workspace name cannot exceed 100 characters."),
});

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('API workspaces/POST: Failed to parse JSON body:', error);
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validationResult = createWorkspaceSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json(
      { success: false, message: "Invalid request data." }, // Generic message
      { status: 400 }
    );
  }

  const { name } = validationResult.data; // Use validated name

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
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API workspaces/POST: Authentication error', authError);
    return NextResponse.json({ success: false, message: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  const userId = user.id;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("API workspaces/POST: DATABASE_URL env var is not set.");
    return NextResponse.json(
      { success: false, message: "Server config error: Database URL not set." },
      { status: 500 }
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertWorkspaceQuery = {
      text: 'INSERT INTO public.workspaces (user_id, name) VALUES ($1, $2) RETURNING id, name, user_id, created_at',
      values: [userId, name.trim()],
    };
    const workspaceResult = await client.query(insertWorkspaceQuery);
    const newWorkspace = workspaceResult.rows[0];

    if (!newWorkspace || !newWorkspace.id) {
      throw new Error('Failed to create workspace or retrieve its ID.');
    }
    const workspaceId = newWorkspace.id;
    console.log(`API workspaces/POST: Workspace created with ID: ${workspaceId} for user ${userId}`);

    const defaultStages = [
      { title: 'To Do', order: 1 },
      { title: 'In Progress', order: 2 },
      { title: 'Done', order: 3 },
    ];

    for (const stage of defaultStages) {
      const insertStageQuery = {
        text: 'INSERT INTO public.stages (workspace_id, title, "order") VALUES ($1, $2, $3)',
        values: [workspaceId, stage.title, stage.order],
      };
      await client.query(insertStageQuery);
    }
    console.log(`API workspaces/POST: Default stages seeded for workspace ID: ${workspaceId}`);

    await client.query('COMMIT');
    
    return NextResponse.json({ success: true, message: 'Workspace and default stages created successfully.', workspace: newWorkspace });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('API workspaces/POST: Error creating workspace and default stages:', error);
    // Return a generic message to the client
    return NextResponse.json({ success: false, message: 'Failed to create workspace due to a server error.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
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
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API workspaces/GET: Authentication error', authError);
    // Return a generic message to the client
    return NextResponse.json({ success: false, message: 'Authentication failed.' }, { status: 401 }); // Generic message
  }

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', user.id) // Filter by user ID
    .order('created_at', { ascending: false });

  if (error) {
    console.error('API workspaces/GET: Error fetching workspaces:', error); // Log full error server-side
    // Return a generic message to the client
    return NextResponse.json({ success: false, message: 'Failed to fetch workspaces due to a server error.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, workspaces });
}
