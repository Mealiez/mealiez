"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Package, 
  BookOpen, 
  ShoppingCart, 
  ClipboardList, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  Flame, 
  Bell, 
  Settings,
  ChevronLeft,
  Menu
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/inventory', icon: LayoutDashboard },
  { label: 'Stock Items', href: '/inventory/items', icon: Package },
  { label: 'Recipes', href: '/inventory/recipes', icon: BookOpen },
  { label: 'Purchase Entries', href: '/inventory/purchases', icon: ShoppingCart },
  { label: 'Meal Consumption', href: '/inventory/consumption', icon: ClipboardList },
  { label: 'Forecasting', href: '/inventory/forecasting', icon: TrendingUp },
  { label: 'Perishables', href: '/inventory/perishables', icon: Clock },
  { label: 'Analytics', href: '/inventory/analytics', icon: BarChart3 },
  { label: 'Gas Cylinders', href: '/inventory/gas', icon: Flame },
  { label: 'Notifications', href: '/inventory/notifications', icon: Bell },
  { label: 'Settings', href: '/inventory/settings', icon: Settings },
]

export default function InventorySidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div 
      className={cn(
        "relative flex flex-col border-r border-gray-200 bg-white transition-all duration-300 h-full",
        isOpen ? "w-64" : "w-16"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 min-h-[60px]">
        {isOpen && (
          <span className="font-bold text-gray-900 truncate">Inventory</span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(!isOpen)}
          className={cn("h-8 w-8", !isOpen && "mx-auto")}
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
                          (item.href !== '/inventory' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-700 font-medium" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                !isOpen && "justify-center px-2"
              )}
              title={!isOpen ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-blue-700" : "text-gray-400")} />
              {isOpen && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
