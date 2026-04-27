import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, Palmtree, Settings } from "lucide-react";

const navItems = [
  { title: "打卡", url: "/", icon: LayoutDashboard },
  { title: "紀錄", url: "/history", icon: History },
  { title: "請假/加班", url: "/leave-overtime", icon: Palmtree },
  { title: "設定", url: "/settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pb-20 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50" data-testid="bottom-nav">
        <div className="max-w-3xl mx-auto flex">
          {navItems.map((item) => {
            const isActive = location === item.url;
            return (
              <Link
                key={item.url}
                href={item.url}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
                data-testid={`nav-${item.title}`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
