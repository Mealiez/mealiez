/*
 * SECURITY: Meal Plans API
 * tenant_id sourced from JWT only.
 * Feature flag: meal_management must be enabled.
 * Role requirement: manager+ for write operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CreateMealPlanSchema } from '@/lib/validations/meals';
import { checkFeatureEnabled, featureDisabledResponse } from '@/lib/features/gate';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(currentUser.tenant_id, 'meal_management');
    if (!isEnabled) return featureDisabledResponse();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'all';
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    
    let query = supabase
      .from('meal_plans')
      .select(`
        id,
        name,
        description,
        start_date,
        end_date,
        is_active,
        created_at,
        created_by (
          id,
          full_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit)
      }
    });
  } catch (err: any) {
    console.error('[MEAL_PLANS_GET_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const result = CreateMealPlanSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.format() }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('meal_plans')
      .insert({
        tenant_id: currentUser.tenant_id,
        name: result.data.name,
        description: result.data.description ?? null,
        start_date: result.data.start_date,
        end_date: result.data.end_date,
        is_active: false, // New plans start inactive
        created_by: currentUser.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('[MEAL_PLANS_POST_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
