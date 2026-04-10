import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, PlusCircle, CalendarDays, LayoutGrid, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", label: "แดชบอร์ด", icon: CalendarDays },
  { href: "/timeline", label: "ตารางการจอง", icon: LayoutGrid },
  { href: "/new", label: "สร้างการจองใหม่", icon: PlusCircle },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Home className="w-6 h-6" />
            <span>ที่พักของฉัน</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 flex flex-col gap-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer",
                  location === href
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent transition-colors">
            <LogOut className="w-5 h-5" />
            ออกจากระบบ
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}
