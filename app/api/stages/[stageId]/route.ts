// app/api/stages/[stageId]/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updateStageBodySchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Title cannot be empty.' })
    .max(100, { message: 'Title too long.' }),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },  // params is a Promise now
) {
  const { stageId } = await params;                        // await it
  if (!z.string().uuid().safeParse(stageId).success) {
    return NextResponse.json({ success: false, message: 'Invalid stageId.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* ignore in Server Components */
          }
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error(`PUT /stages/${stageId}: Authentication error`, authError);
    return NextResponse.json({ success: false, message: 'Authentication failed.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    console.error(`PUT /stages/${stageId}: Failed to parse JSON body:`, e);
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = updateStageBodySchema.safeParse(body);
  if (!validation.success) {
    console.error(`PUT /stages/${stageId}: Validation error`, validation.error.flatten());
    return NextResponse.json(
      { success: false, message: 'Invalid request data.' },
      { status: 400 }
    );
  }
  const { title } = validation.data;

  const { data: updatedStage, error: updateError } = await supabase
    .from('stages')
    .update({ title })
    .eq('id', stageId)
    .select()
    .single();

  if (updateError) {
    const status =
      updateError.code === 'PGRST301' ||
      updateError.message.toLowerCase().includes('permission denied')
        ? 403
        : updateError.code === 'PGRST204'
        ? 404
        : 500;
    return NextResponse.json(
      { success: false, message: 'Failed to update stage due to a server error.' }, // Generic message
      { status },
    );
  }

  return NextResponse.json({ success: true, stage: updatedStage });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const { stageId } = await params;
  if (!z.string().uuid().safeParse(stageId).success) {
    return NextResponse.json({ success: false, message: 'Invalid stageId.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* ignore in Server Components */
          }
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error(`DELETE /stages/${stageId}: Authentication error`, authError);
    return NextResponse.json({ success: false, message: 'Authentication failed.' }, { status: 401 });
  }

  const { error: deleteError } = await supabase
    .from('stages')
    .delete()
    .eq('id', stageId);

  if (deleteError) {
    const status =
      deleteError.code === 'PGRST301' ||
      deleteError.message.toLowerCase().includes('permission denied')
        ? 403
        : 500;
    return NextResponse.json(
      { success: false, message: 'Failed to delete stage due to a server error.' }, // Generic message
      { status },
    );
  }

  return new NextResponse(null, { status: 204 });
}
