import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { UpdateMealPlanSchema } from '@/lib/validations/meals';
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'meal_management');
    if (!isEnabled) return featureDisabledResponse();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('meal_plans')
      .select(`
        id,
        name,
        description,
        start_date,
        end_date,
        is_active,
        created_at,
        meal_plan_items (
          id,
          meal_date,
          meal_type,
          name,
          description,
          is_available
        )
      `)
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[MEAL_PLAN_GET_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'meal_management');
    if (!isEnabled) return featureDisabledResponse();

    if (!['owner', 'admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const result = UpdateMealPlanSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.format() }, { status: 400 });
    }

    const supabase = await createClient();

    // Handle is_active specially via RPC
    if (result.data.is_active === true) {
      const { error: rpcError } = await supabase.rpc('activate_meal_plan', {
        p_plan_id: params.id,
        p_tenant_id: currentUser.tenant_id
      });

      if (rpcError) throw rpcError;
    }

    // Build update data excluding is_active
    const updateData: any = {};
    if (result.data.name !== undefined) updateData.name = result.data.name;
    if (result.data.description !== undefined) updateData.description = result.data.description;
    if (result.data.start_date !== undefined) updateData.start_date = result.data.start_date;
    if (result.data.end_date !== undefined) updateData.end_date = result.data.end_date;

    // Only update if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabase
        .from('meal_plans')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // If only is_active was updated, fetch and return the current plan
    const { data: updatedPlan, error: fetchError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError) throw fetchError;
    return NextResponse.json(updatedPlan);

  } catch (err: any) {
    console.error('[MEAL_PLAN_PATCH_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'meal_management');
    if (!isEnabled) return featureDisabledResponse();

    if (!['owner', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();

    // Fetch plan first to check if it's active
    const { data: plan, error: fetchError } = await supabase
      .from('meal_plans')
      .select('is_active')
      .eq('id', params.id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (plan.is_active) {
      return NextResponse.json({ error: 'Deactivate plan before deleting' }, { status: 409 });
    }

    const { error: deleteError } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', params.id);

    if (deleteError) throw deleteError;

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('[MEAL_PLAN_DELETE_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
