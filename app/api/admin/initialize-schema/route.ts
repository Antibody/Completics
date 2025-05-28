// app/api/admin/initialize-schema/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";     
import { Pool } from "pg";

/**
 * Route handler to set up initial database schema for a multi-user Kanban app.
 * Only callable by the ADMIN_ALLOWED_EMAIL user (via JWT) or via service_role invocation.
 */
export async function POST(request: NextRequest) {
  // init Supabase SSR client with headers & cookies so we can call auth.getUser()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,            
    process.env.SUPABASE_SERVICE_ROLE_KEY!,           
    {
      cookies: {
        getAll: () => request.cookies.getAll(),      
        setAll: () => { /* no-op in this route */ }   
      }
    }
  );

  // authenticate the incoming request and verify ADMIN_ALLOWED_EMAIL
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("API setup tables: supabase.auth.getUser() error", authError);
    return NextResponse.json(
      { success: false, message: "Authentication failed." },
      { status: 401 }
    );
  }

  const ADMIN = process.env.ADMIN_ALLOWED_EMAIL!;
  if (!user || user.email !== ADMIN) {
    console.warn(`API setup tables: unauthorized attempt by ${user?.email}`);
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 403 }
    );
  }

  // when service_role or ADMIN is verified; proceed with raw SQL 
  const databaseUrl = process.env.DATABASE_URL!;
  if (!databaseUrl) {
    console.error("API setup tables: DATABASE_URL env var is not set.");
    return NextResponse.json(
      { success: false, message: "Server config error: DATABASE_URL not set." },
      { status: 500 }
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  // Advisory lock key (64-bit integer)
  const ADVISORY_LOCK_KEY = '1673536767096532345678939857045442143457656';

  try {
    await client.query("BEGIN");

    // Acquire advisory lock for this transaction
    await client.query(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY});`);
    console.log("API setup tables: Advisory lock acquired.");

    console.log("API setup tables: Skipping direct modification of 'auth.users'.");

    // Create 'workspaces' table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.workspaces (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        share_token TEXT UNIQUE,
        is_shared_publicly BOOLEAN DEFAULT FALSE NOT NULL,
        public_share_mode TEXT,
        CONSTRAINT workspaces_pkey PRIMARY KEY (id)
      );
    `);
    console.log("API setup tables: Table 'workspaces' ensured.");

    // Ensure sharing columns exist if table already existed
    await client.query(`
      ALTER TABLE public.workspaces
      ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS is_shared_publicly BOOLEAN DEFAULT FALSE NOT NULL,
      ADD COLUMN IF NOT EXISTS public_share_mode TEXT;
    `);
    console.log("API setup tables: Sharing columns ensured on 'workspaces'.");

    // Enable RLS on workspaces
    await client.query(`ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;`);
    console.log("API setup tables: RLS enabled for 'workspaces'.");

    // RLS policies for workspaces
    await client.query(`DROP POLICY IF EXISTS "Users can select their own boards" ON public.workspaces;`);
    await client.query(`
      CREATE POLICY "Users can select their own boards"
      ON public.workspaces FOR SELECT USING (auth.uid() = user_id);
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can insert their own boards" ON public.workspaces;`);
    await client.query(`
      CREATE POLICY "Users can insert their own boards"
      ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can update their own boards" ON public.workspaces;`);
    await client.query(`
      CREATE POLICY "Users can update their own boards"
      ON public.workspaces FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can delete their own boards" ON public.workspaces;`);
    await client.query(`
      CREATE POLICY "Users can delete their own boards"
      ON public.workspaces FOR DELETE USING (auth.uid() = user_id);
    `);
    await client.query(`DROP POLICY IF EXISTS "Authenticated users can select editable shared boards" ON public.workspaces;`);
    await client.query(`
      CREATE POLICY "Authenticated users can select editable shared boards"
      ON public.workspaces FOR SELECT
      USING (
        is_shared_publicly = TRUE
        AND public_share_mode = 'editable'
        AND auth.role() = 'authenticated'
      );
    `);
    console.log("API setup tables: RLS policies set for 'workspaces'.");

    // --- Create 'stages' table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.stages (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        title text NOT NULL,
        "order" integer NOT NULL,
        workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
        CONSTRAINT stages_pkey PRIMARY KEY (id)
      );
    `);
    console.log("API setup tables: Table 'stages' ensured.");

    await client.query(`
      ALTER TABLE public.stages
      ADD COLUMN IF NOT EXISTS workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
    `);
    console.log("API setup tables: Column 'workspace_id' ensured on 'stages'.");

    // Enable RLS on stages and set policy
    await client.query(`ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.stages FORCE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS "Users can manage columns on shared or owned boards" ON public.stages;`);
    await client.query(`
      CREATE POLICY "Users can manage columns on shared or owned boards"
      ON public.stages FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspaces w
          WHERE w.id = public.stages.workspace_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.workspaces w
          WHERE w.id = public.stages.workspace_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      );
    `);
    console.log("API setup tables: RLS policy set for 'stages'.");

    // --- Create 'projects' table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.projects (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        color text,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        start_date date,
        finish_date date,
        CONSTRAINT projects_pkey PRIMARY KEY (id)
      );
    `);
    console.log("API setup tables: Table 'projects' ensured.");

    await client.query(`
      ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS start_date date,
      ADD COLUMN IF NOT EXISTS finish_date date;
    `);
    console.log("API setup tables: Columns ensured on 'projects'.");

    // Enable RLS on projects
    await client.query(`ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS "Users can manage their own epics" ON public.projects;`);
    await client.query(`
      CREATE POLICY "Users can manage their own epics"
      ON public.projects FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    `);
    console.log("API setup tables: RLS policy set for 'projects'.");

    // --- Create 'vers' table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.vers (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        status text,
        start_date date,
        release_date date,
        project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL ON UPDATE CASCADE,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT vers_pkey PRIMARY KEY (id)
      );
    `);
    console.log("API setup tables: Table 'vers' ensured.");

    await client.query(`
      ALTER TABLE public.vers
      ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("API setup tables: Columns ensured on 'vers'.");

    // Add index on vers.project_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vers_project_id ON public.vers(project_id);
    `);
    console.log("API setup tables: Index 'idx_vers_project_id' ensured.");

    // Enable RLS on vers
    await client.query(`ALTER TABLE public.vers ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.vers FORCE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS "Users can manage their own versions" ON public.vers;`);
    await client.query(`
      CREATE POLICY "Users can manage their own versions"
      ON public.vers FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    `);
    console.log("API setup tables: RLS policy set for 'vers'.");

    // --- Create 'tasks' table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tasks (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        title text NOT NULL,
        description text,
        stage_id uuid REFERENCES public.stages(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
        "order" integer NOT NULL,
        due_date date,
        is_archived BOOLEAN DEFAULT FALSE,
        project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
        ver_id uuid REFERENCES public.vers(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT tasks_pkey PRIMARY KEY (id)
      );
    `);
    console.log("API setup tables: Table 'tasks' ensured.");

    await client.query(`
      ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS due_date date,
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS ver_id uuid REFERENCES public.vers(id) ON DELETE SET NULL;
    `);
    console.log("API setup tables: Columns ensured on 'tasks'.");

    // Enable RLS on tasks
    await client.query(`ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS "Users can manage cards on shared or owned boards" ON public.tasks;`);
    await client.query(`
      CREATE POLICY "Users can manage cards on shared or owned boards"
      ON public.tasks FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspaces w
          WHERE w.id = public.tasks.workspace_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.workspaces w
          WHERE w.id = public.tasks.workspace_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      );
    `);
    console.log("API setup tables: RLS policy set for 'tasks'.");

    // --- Create 'tags' table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tags (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name text NOT NULL,
        color text,
        is_global BOOLEAN NOT NULL DEFAULT FALSE,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT tags_pkey PRIMARY KEY (id),
        CONSTRAINT tags_user_id_name_key UNIQUE (user_id, name)
      );
    `);
    console.log("API setup tables: Table 'tags' ensured.");

    await client.query(`
      ALTER TABLE public.tags
      ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log("API setup tables: Column 'is_global' ensured on 'tags'.");

    // Insert predefined global tags for admin user
    await client.query(
      `
      INSERT INTO public.tags (user_id, name, color, is_global)
      SELECT u.id, v.name, v.color, TRUE
      FROM auth.users AS u
      CROSS JOIN (
        VALUES
          ('Urgent',    'red'),
          ('Requested', 'lightblue'),
          ('Abandoned', '#8B8000')
      ) AS v(name, color)
      WHERE u.email = $1
      ON CONFLICT (user_id, name)
      DO UPDATE SET color = EXCLUDED.color, is_global = TRUE;
      `,
      [ADMIN]
    );
    console.log("API setup tables: Predefined global tags inserted or updated.");

    // --- Create 'task_tags' junction table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.task_tags (
        task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
        assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT task_tags_pkey PRIMARY KEY (task_id, tag_id)
      );
    `);
    console.log("API setup tables: Table 'task_tags' ensured.");

    // Create shared_tag_access table (Moved earlier)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.shared_tag_access (
        tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
        shared_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        shared_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
        CONSTRAINT shared_tag_access_pkey PRIMARY KEY (tag_id, workspace_id)
      );
    `);
    console.log("API setup tables: Table 'shared_tag_access' ensured.");

    // Enable RLS on tags
    await client.query(`ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.tags FORCE ROW LEVEL SECURITY;`);
    console.log("API setup tables: RLS enabled for 'tags'.");

    // RLS policies for tags
    await client.query(`DROP POLICY IF EXISTS "Users can select their own or global labels" ON public.tags;`);
    await client.query(`
      CREATE POLICY "Users can select their own or global labels"
      ON public.tags FOR SELECT
      USING (
        auth.uid() = user_id
        OR is_global = TRUE
        OR EXISTS (
          SELECT 1
          FROM public.shared_tag_access sta
          JOIN public.workspaces w ON sta.workspace_id = w.id
          WHERE sta.tag_id = public.tags.id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      );
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can insert their own labels" ON public.tags;`);
    await client.query(`
      CREATE POLICY "Users can insert their own labels"
      ON public.tags FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can update their own labels" ON public.tags;`);
    await client.query(`
      CREATE POLICY "Users can update their own labels"
      ON public.tags FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can delete their own labels" ON public.tags;`);
    await client.query(`
      CREATE POLICY "Users can delete their own labels"
      ON public.tags FOR DELETE
      USING (auth.uid() = user_id);
    `);
    console.log("API setup tables: RLS policies set for 'tags'.");

    // Enable RLS on task_tags
    await client.query(`ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.task_tags FORCE ROW LEVEL SECURITY;`);

    // RLS policies for task_tags
    await client.query(`DROP POLICY IF EXISTS "Users can select card_labels for their cards" ON public.task_tags;`);
    await client.query(`
      CREATE POLICY "Users can select card_labels for their cards"
      ON public.task_tags FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.workspaces w ON t.workspace_id = w.id
          WHERE t.id = public.task_tags.task_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      );
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can assign their own or global labels to their cards" ON public.task_tags;`);
    await client.query(`
      CREATE POLICY "Users can assign their own or global labels to their cards"
      ON public.task_tags FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.workspaces w ON t.workspace_id = w.id
          WHERE t.id = public.task_tags.task_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
        AND EXISTS (
          SELECT 1
          FROM public.tags tg
          LEFT JOIN public.tasks t2 ON t2.id = public.task_tags.task_id
          WHERE tg.id = public.task_tags.tag_id
            AND (
              tg.user_id = auth.uid()
              OR tg.is_global = TRUE
              OR EXISTS (
                SELECT 1
                FROM public.shared_tag_access sta
                WHERE sta.tag_id = tg.id
                  AND sta.workspace_id = t2.workspace_id
              )
            )
        )
      );
    `);
    await client.query(`DROP POLICY IF EXISTS "Users can delete card_labels for their cards" ON public.task_tags;`);
    await client.query(`
      CREATE POLICY "Users can delete card_labels for their cards"
      ON public.task_tags FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          JOIN public.workspaces w ON t.workspace_id = w.id
          WHERE t.id = public.task_tags.task_id
            AND (
              w.user_id = auth.uid()
              OR (
                w.is_shared_publicly = TRUE
                AND w.public_share_mode = 'editable'
                AND auth.role() = 'authenticated'
              )
            )
        )
      );
    `);
    console.log("API setup tables: RLS policies set for 'task_tags'.");

    // Grant broad permissions to authenticated role
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspaces TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stages TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vers TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tags TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT, DELETE ON TABLE public.task_tags TO authenticated;`);
    console.log("API setup tables: Permissions granted to 'authenticated' role.");

    // --- Create RPC function for inserting a stage at the start ---
    await client.query(`
      CREATE OR REPLACE FUNCTION public.create_stage_at_start(
        p_workspace_id UUID,
        p_title TEXT
      )
      RETURNS SETOF public.stages
      AS $$
      DECLARE
        created_stage public.stages;
      BEGIN
        UPDATE public.stages
        SET "order" = "order" + 1
        WHERE workspace_id = p_workspace_id;
        INSERT INTO public.stages (workspace_id, title, "order")
        VALUES (p_workspace_id, p_title, 0)
        RETURNING * INTO created_stage;
        RETURN NEXT created_stage;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log("API setup tables: RPC function 'create_stage_at_start' ensured.");

    // Grant execute permission on the function
    await client.query(`GRANT EXECUTE ON FUNCTION public.create_stage_at_start(UUID, TEXT) TO authenticated;`);
    console.log("API setup tables: EXECUTE permission granted on 'create_stage_at_start'.");

    // Commit everything
    await client.query("COMMIT");
    console.log("API setup tables: Multi-user database setup successful.");
    return NextResponse.json({ success: true, message: "Multi-user database setup successful." });
  } catch (err) {
    // Rollback on error
    await client.query("ROLLBACK");
    console.error("API setup tables: Error during multi-user DB setup:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, message: `Multi-user database setup failed: ${msg}` },
      { status: 500 }
    );
  } finally {
    // Release and close pool
    client.release();
    await pool.end();
    console.log("API setup tables: Client released, pool ended.");
  }
}
