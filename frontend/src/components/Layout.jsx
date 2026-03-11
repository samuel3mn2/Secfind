import { Outlet, NavLink } from "react-router-dom";
import { Shield, LayoutDashboard, List, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/vulnerabilidades", icon: List, label: "Vulnerabilidades" },
  ];

  return (
    <div className="flex min-h-screen bg-[#09090b]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#18181b] border-r border-[#27272a] transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[#27272a]">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Shield className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h1 className="font-semibold text-white tracking-tight">SecFind</h1>
              <p className="text-xs text-zinc-500">Gestión de Vulnerabilidades</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden ml-auto"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-500/10 text-indigo-400 border-r-2 border-indigo-500"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`
                }
                onClick={() => setSidebarOpen(false)}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#27272a]">
            <p className="text-xs text-zinc-600">
              SecFind v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-[#18181b] border-b border-[#27272a]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold">SecFind</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
