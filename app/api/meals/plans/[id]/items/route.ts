import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CreateMealPlanItemSchema } from '@/lib/validations/meals';
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

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const supabase = await createClient();
    let query = supabase
      .from('meal_plan_items')
      .select('*')
      .eq('plan_id', params.id)
      .order('meal_date', { ascending: true });

    if (date) query = query.eq('meal_date', date);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[MEAL_PLAN_ITEMS_GET_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
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
    const result = CreateMealPlanItemSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.format() }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify plan belongs to tenant and get date range
    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .select('start_date, end_date')
      .eq('id', params.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Verify meal_date is within plan date range
    if (result.data.meal_date < plan.start_date || result.data.meal_date > plan.end_date) {
      return NextResponse.json({
        error: 'Meal date must be within plan range',
        range: {
          start: plan.start_date,
          end: plan.end_date
        }
      }, { status: 422 });
    }

    const { data, error } = await supabase
      .from('meal_plan_items')
      .insert({
        tenant_id: currentUser.tenant_id,
        plan_id: params.id,
        meal_date: result.data.meal_date,
        meal_type: result.data.meal_type,
        name: result.data.name,
        description: result.data.description ?? null,
        is_available: result.data.is_available ?? true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          error: `A ${result.data.meal_type} already exists for ${result.data.meal_date} in this plan`
        }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('[MEAL_PLAN_ITEMS_POST_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
