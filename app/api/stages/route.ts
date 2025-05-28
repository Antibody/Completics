// app/api/stages/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'

// Zod schema for GET request query parameters
const getStagesQuerySchema = z.object({
  workspaceId: z.string().uuid(),
})

// Zod schema for POST request body
const postStageBodySchema = z.object({
  workspaceId: z.string().uuid(),
  title: z
    .string()
    .min(1, { message: 'Title cannot be empty.' })
    .max(100, { message: 'Title too long.' }),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const queryParams = Object.fromEntries(searchParams.entries())

  const validation = getStagesQuerySchema.safeParse(queryParams)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid workspace ID parameter.', // Generic message, removed errors
      },
      { status: 400 },
    )
  }
  const { workspaceId } = validation.data

  // ← await cookies() so cookieStore.getAll() works
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // ignore when called from a Server Component
          }
        },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: 'Authentication failed.' }, // Generic message
      { status: 401 },
    )
  }

  const { data: stages, error: fetchError } = await supabase
    .from('stages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('order', { ascending: true })

  if (fetchError) {
    console.error(`GET /api/stages?workspaceId=${workspaceId}:`, fetchError)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch stages due to a server error.' }, // Generic message
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, stages: stages ?? [] })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // ignore when called from a Server Component
          }
        },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: 'Authentication failed.' }, // Generic message
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch (e) {
    console.error('Failed to parse JSON body:', e)
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 })
  }

  const validation = postStageBodySchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid request data.', // Generic message, removed errors
      },
      { status: 400 },
    )
  }
  const { workspaceId, title } = validation.data

  const { data: newStage, error: rpcError } = await supabase.rpc('create_stage_at_start', {
    p_workspace_id: workspaceId,
    p_title: title,
  })
  if (rpcError) {
    console.error(`POST /api/stages RPC error for workspaceId ${workspaceId}:`, rpcError)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create stage due to a server error.', // Generic message
      },
      {
        status:
          rpcError.code === 'PGRST301' ||
          rpcError.message.toLowerCase().includes('permission denied')
            ? 403
            : 500,
      },
    )
  }

  if (!newStage || (Array.isArray(newStage) && newStage.length === 0)) {
    console.error(`POST /api/stages: RPC returned no data for workspaceId ${workspaceId}`)
    return NextResponse.json(
      { success: false, message: 'Failed to create stage: No data returned.' },
      { status: 500 },
    )
  }

  const createdStage = Array.isArray(newStage) ? newStage[0] : newStage
  return NextResponse.json({ success: true, stage: createdStage }, { status: 201 })
}
