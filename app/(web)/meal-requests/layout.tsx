"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ListTodo, 
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  Utensils
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MealRequestLayoutProps {
  children: React.ReactNode;
}

export default function MealRequestLayout({ children }: MealRequestLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Navigation items for Manager+
  const navItems = [
    { label: 'Dashboard', href: '/meal-requests/dashboard', icon: LayoutDashboard },
    { label: 'Detailed Log', href: '/meal-requests/log', icon: ListTodo },
    { label: 'Reports', href: '/meal-requests/reports', icon: FileBarChart },
  ];

  // We don't know the user role here easily without a prop, 
  // but we can assume if they are in these sub-routes, they are manager+.
  // Member usually just stays on /meal-requests.
  const isManagerRoute = pathname.startsWith('/meal-requests/') && pathname !== '/meal-requests';

  if (!isManagerRoute) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-50/30">
      {/* Secondary Sidebar (Collapsible) */}
      <aside 
        className={cn(
          "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col relative z-10",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className={cn(
          "h-16 flex items-center border-b border-gray-100 px-6",
          !isSidebarOpen && "justify-center px-0"
        )}>
           <div className="flex items-center gap-2 overflow-hidden">
              <div className="p-2 bg-blue-600 rounded-lg text-white shrink-0">
                <Utensils size={16} />
              </div>
              {isSidebarOpen && (
                <span className="font-black uppercase tracking-tight text-sm truncate animate-in fade-in duration-300">
                  Request Panel
                </span>
              )}
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
           {navItems.map((item) => {
             const Active = pathname === item.href;
             const Icon = item.icon;

             return (
               <Link 
                 key={item.href} 
                 href={item.href}
                 className={cn(
                   "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                   Active 
                    ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/5" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                   !isSidebarOpen && "justify-center px-0"
                 )}
               >
                 <Icon size={18} className={cn(Active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600")} />
                 {isSidebarOpen && (
                   <span className="truncate animate-in fade-in duration-300">
                     {item.label}
                   </span>
                 )}
               </Link>
             );
           })}
        </nav>

        {/* Sidebar Toggle Button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn(
            "absolute -right-4 top-20 w-8 h-8 rounded-full shadow-lg border border-gray-100 z-20 hover:scale-110 transition-transform bg-white",
            !isSidebarOpen && "right-[-16px]"
          )}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </Button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
         {children}
      </main>
    </div>
  );
}
