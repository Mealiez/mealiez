"use client";

import Link from 'next/link';
import { ModuleCard, canManageCard } from '@/lib/dashboard/cards';
import { UserRole } from '@/lib/auth/roles';

/*
 * DashboardGrid Component
 * Renders module cards with role-based actions.
 */

interface DashboardGridProps {
  cards: ModuleCard[];
  userRole: UserRole;
}

export default function DashboardGrid({ cards, userRole }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const canManage = canManageCard(card, userRole);
        const actionLabel = canManage ? 'Manage' : 'View';
        const actionColor = canManage
          ? 'text-indigo-600 hover:text-indigo-800'
          : 'text-gray-500 hover:text-gray-700';

        return (
          <div
            key={card.id}
            className="relative bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col"
          >
            {card.badge !== null && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                {card.badge}
              </span>
            )}

            <Link href={card.href} className="flex-1 p-6 block group">
              <div className="text-3xl mb-4">{card.icon}</div>
              <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors text-base">
                {card.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {card.description}
              </p>
            </Link>

            <div className="px-6 pb-4 pt-0">
              <Link
                href={card.href}
                className={`text-sm font-medium ${actionColor} transition-colors`}
              >
                {actionLabel} →
              </Link>

              {card.badge === 'Beta' && (
                <span className="ml-3 text-xs text-amber-600">Beta feature</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
