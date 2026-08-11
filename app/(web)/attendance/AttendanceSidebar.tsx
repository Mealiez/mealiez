"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  ListTodo, 
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const menuItems = [
  {
    label: 'Dashboard',
    href: '/attendance',
    icon: LayoutDashboard,
    exact: true,
    roles: ['admin', 'manager', 'member']
  },
  {
    label: 'Active Sessions',
    href: '/attendance/sessions',
    icon: ListTodo,
    roles: ['admin', 'manager']
  },
  {
    label: 'Attendance Logs',
    href: '/attendance/logs',
    icon: ClipboardList,
    roles: ['admin', 'manager']
  },
  {
    label: 'Schedule Session',
    href: '/attendance/schedules',
    icon: Bell,
    roles: ['admin', 'manager']
  }
];

interface AttendanceSidebarProps {
  userRole: string;
}

export default function AttendanceSidebar({ userRole }: AttendanceSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();

  const filteredMenu = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <aside 
      className={cn(
        "flex flex-col border-r bg-white/50 backdrop-blur-sm transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 border-b flex items-center justify-between overflow-hidden">
        {!isCollapsed && (
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-in fade-in slide-in-from-left-2">
            Attendance Ops
          </span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 rounded-lg ml-auto"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </Button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {filteredMenu.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive 
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
              )} />
              {!isCollapsed && (
                <span className="truncate animate-in fade-in slide-in-from-left-2 duration-300">
                  {item.label}
                </span>
              )}
              {!isCollapsed && isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {!isCollapsed && userRole !== 'member' && (
        <div className="p-4 border-t">
          <div className="bg-gray-900 rounded-2xl p-4 text-white space-y-2">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-50 text-blue-400">Live Status</p>
             <p className="text-xs font-medium leading-relaxed">
               System is monitoring check-ins across all branches.
             </p>
          </div>
        </div>
      )}
    </aside>
  );
}
