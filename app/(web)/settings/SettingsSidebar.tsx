"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Globe, 
  Clock, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  Settings,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SETTINGS_SECTIONS = [
  {
    id: 'timezone',
    label: 'Timezone',
    icon: Globe,
  },
  {
    id: 'meal-time',
    label: 'Meal Time',
    icon: Clock,
  },
  {
    id: 'designations',
    label: 'Designations',
    icon: Briefcase,
  },
  {
    id: 'passwords',
    label: 'User Passwords',
    icon: KeyRound,
  },
];

export default function SettingsSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const searchParams = useSearchParams();
  const currentSection = searchParams.get('section') || 'timezone';

  return (
    <aside 
      className={cn(
        "h-full bg-white border-r border-gray-100 transition-all duration-300 flex flex-col relative shadow-sm font-sans",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Collapse Toggle - Positioned at Right Hand Side (Center Edge) */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-4 top-20 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-lg text-gray-400 hover:text-blue-600 hover:scale-110 transition-all z-20",
          isCollapsed && "right-[-16px]"
        )}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Header */}
      <div className={cn(
        "h-16 flex items-center border-b border-gray-50 px-6",
        isCollapsed && "justify-center px-0"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10">
            <Settings size={18} />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-bold uppercase tracking-tight text-gray-900 animate-in fade-in duration-300">
              Settings
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {SETTINGS_SECTIONS.map((section) => {
          const isActive = currentSection === section.id;
          const Icon = section.icon;

          return (
            <Link
              key={section.id}
              href={`/settings?section=${section.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative overflow-hidden",
                isActive 
                  ? "bg-blue-50 text-blue-600 shadow-sm" 
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Icon size={18} className={cn(
                "shrink-0 transition-transform group-hover:scale-110",
                isActive ? "text-blue-600" : "text-gray-400 group-hover:text-blue-600"
              )} />
              
              {!isCollapsed && (
                <span className="text-sm font-semibold tracking-tight animate-in fade-in duration-300">
                  {section.label}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all whitespace-nowrap z-50">
                  {section.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      {!isCollapsed && (
        <div className="p-6 bg-gray-50/50 mt-auto border-t border-gray-50">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <ShieldCheck size={12} className="text-green-500" />
              Secure Control
           </div>
        </div>
      )}
    </aside>
  );
}
