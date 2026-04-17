/*
 * PUBLIC-ISH: Authenticated but lightweight.
 * Used by mobile home screen on every app open.
 * Returns today's available meals only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { checkFeatureEnabled } from '@/lib/features/gate';

export async function GET(req: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await checkFeatureEnabled(
      currentUser.tenant_id,
      'meal_management'
    );

    if (!isEnabled) {
      return NextResponse.json({
        data: {},
        items: [],
        date: today,
        message: 'Meal management not enabled'
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_todays_meals', {
      p_tenant_id: currentUser.tenant_id
    });

    if (error) {
      console.error('[TODAY_MEALS_ERROR]', error);
      throw error;
    }

    const meals = data || [];

    // Group by meal_type for easier UI rendering
    const grouped = meals.reduce((acc: Record<string, any[]>, item: any) => {
      const type = item.meal_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {});

    return NextResponse.json({
      date: today,
      data: grouped,
      items: meals
    });
  } catch (err: any) {
    console.error('[TODAY_MEALS_API_ERROR]', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
