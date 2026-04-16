import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { UpdateMealPlanItemSchema } from '@/lib/validations/meals';
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate';

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
    const result = UpdateMealPlanItemSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.format() }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch item to verify tenant and get parent plan
    const { data: item, error: itemError } = await supabase
      .from('meal_plan_items')
      .select('id, plan_id, tenant_id, meal_date, meal_type')
      .eq('id', params.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Meal item not found' }, { status: 404 });
    }

    // If changing meal_date or meal_type, re-verify date is within plan range
    if (result.data.meal_date || result.data.meal_type) {
      const { data: plan, error: planError } = await supabase
        .from('meal_plans')
        .select('start_date, end_date')
        .eq('id', item.plan_id)
        .single();

      if (planError || !plan) {
        return NextResponse.json({ error: 'Parent plan not found' }, { status: 404 });
      }

      const newDate = result.data.meal_date || item.meal_date;
      if (newDate < plan.start_date || newDate > plan.end_date) {
        return NextResponse.json({
          error: 'Meal date must be within plan range',
          range: {
            start: plan.start_date,
            end: plan.end_date
          }
        }, { status: 422 });
      }
    }

    const { data, error } = await supabase
      .from('meal_plan_items')
      .update(result.data)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const mealType = result.data.meal_type || item.meal_type;
        const mealDate = result.data.meal_date || item.meal_date;
        return NextResponse.json({
          error: `A ${mealType} already exists for ${mealDate} in this plan`
        }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[MEAL_ITEM_PATCH_ERROR]', err);
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

    if (!['owner', 'admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('meal_plan_items')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('[MEAL_ITEM_DELETE_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
