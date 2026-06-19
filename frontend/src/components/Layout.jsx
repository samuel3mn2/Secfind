import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Shield, LayoutDashboard, List, Menu, X, Settings, LogOut, User, CalendarClock, Users, Key, AlertTriangle, ClipboardCheck, BookOpen, Gauge, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Key for localStorage persistence
const SIDEBAR_COLLAPSED_KEY = "secfind_sidebar_collapsed";

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar collapsed state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === "true";
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showForcedPasswordModal, setShowForcedPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const { user, logout, isAdmin, canView, mustChangePassword, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();

  // Show forced password change modal when user must change password
  useEffect(() => {
    if (mustChangePassword) {
      setShowForcedPasswordModal(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
  }, [mustChangePassword]);

  // Persist sidebar collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleChangePassword = async (isForced = false) => {
    // Validations
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Todos los campos son requeridos");
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      toast.error("La nueva contraseña debe tener al menos 4 caracteres");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    setChangingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword
      });
      toast.success("Contraseña actualizada correctamente");
      setShowPasswordModal(false);
      setShowForcedPasswordModal(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      // Clear the mustChangePassword flag in context
      if (isForced) {
        clearMustChangePassword();
      }
    } catch (error) {
      const message = error.response?.data?.detail || "Error al cambiar la contraseña";
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setShowPasswordModal(true);
  };

  const navItems = [
    { 
      to: "/", 
      icon: LayoutDashboard, 
      label: "Dashboard",
      show: isAdmin || canView("dashboard")
    },
    { 
      to: "/dashboard-grc", 
      icon: Gauge, 
      label: "Dashboard GRC",
      show: isAdmin || canView("dashboard")
    },
    { 
      to: "/vulnerabilidades", 
      icon: List, 
      label: "Vulnerabilidades",
      show: isAdmin || canView("vulnerabilidades")
    },
    { 
      to: "/seguimiento-riesgos", 
      icon: CalendarClock, 
      label: "Seguimiento",
      show: isAdmin || canView("vulnerabilidades")
    },
    { 
      to: "/vista-comite", 
      icon: Users, 
      label: "Vista Comité",
      show: isAdmin || canView("vulnerabilidades")
    },
    { 
      to: "/catalogo-riesgos", 
      icon: BookOpen, 
      label: "Catálogo Riesgos",
      show: isAdmin || canView("vulnerabilidades")
    },
    { 
      to: "/hallazgos-auditoria", 
      icon: ClipboardCheck, 
      label: "Hallazgos Auditoría",
      show: isAdmin || canView("vulnerabilidades")
    },
    { 
      to: "/configuracion", 
      icon: Settings, 
      label: "Configuración",
      show: isAdmin || canView("configuracion")
    },
  ].filter(item => item.show);

  return (
    <TooltipProvider delayDuration={100}>
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
          className={`fixed lg:static inset-y-0 left-0 z-50 bg-[#18181b] border-r border-[#27272a] transform transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? "w-[72px]" : "w-64"
          } ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`flex items-center gap-3 py-5 border-b border-[#27272a] transition-all duration-300 ${
              isSidebarCollapsed ? "px-3 justify-center" : "px-6"
            }`}>
              <div className="p-2 rounded-lg bg-indigo-500/10 flex-shrink-0">
                <Shield className="w-6 h-6 text-indigo-500" />
              </div>
              {!isSidebarCollapsed && (
                <div className="overflow-hidden transition-all duration-300">
                  <h1 className="font-semibold text-white tracking-tight">SecFind</h1>
                  <p className="text-xs text-zinc-500">Gestión de Vulnerabilidades</p>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden ml-auto"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Collapse Toggle Button - Desktop Only */}
            <div className={`hidden lg:flex items-center border-b border-[#27272a] ${
              isSidebarCollapsed ? "justify-center py-2" : "justify-end px-3 py-2"
            }`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSidebarCollapse}
                    className="text-zinc-400 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                    data-testid="toggle-sidebar-btn"
                  >
                    {isSidebarCollapsed ? (
                      <PanelLeft className="w-4 h-4" />
                    ) : (
                      <PanelLeftClose className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-800 border-zinc-700">
                  <p>{isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 py-4 space-y-1 transition-all duration-300 ${
              isSidebarCollapsed ? "px-2" : "px-3"
            }`}>
              {navItems.map((item) => (
                isSidebarCollapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                          `flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          }`
                        }
                        onClick={() => setSidebarOpen(false)}
                        data-testid={`nav-${item.label.toLowerCase()}`}
                      >
                        <item.icon className="w-5 h-5" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-zinc-800 border-zinc-700">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
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
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              ))}
            </nav>

            {/* User Section */}
            <div className={`py-4 border-t border-[#27272a] transition-all duration-300 ${
              isSidebarCollapsed ? "px-2" : "px-3"
            }`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {isSidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="flex items-center justify-center w-full p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-indigo-400" />
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-zinc-800 border-zinc-700">
                        <p>{user?.nombre}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-white/5 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
                        <p className="text-xs text-zinc-500 truncate">
                          {user?.es_admin ? "Administrador" : "Usuario"}
                        </p>
                      </div>
                    </button>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-700" side={isSidebarCollapsed ? "right" : "top"}>
                  <DropdownMenuLabel className="text-zinc-400">
                    {user?.username}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  <DropdownMenuItem 
                    className="text-zinc-300 focus:text-white focus:bg-white/10 cursor-pointer"
                    onClick={openPasswordModal}
                    data-testid="change-password-btn"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Cambiar Contraseña
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                    onClick={handleLogout}
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Footer */}
            <div className={`py-3 border-t border-[#27272a] transition-all duration-300 ${
              isSidebarCollapsed ? "px-2 text-center" : "px-6"
            }`}>
              <p className="text-xs text-zinc-600">
                {isSidebarCollapsed ? "v1.0" : "SecFind v1.0"}
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#18181b] border-b border-[#27272a]">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
              <DropdownMenuLabel className="text-zinc-400">
                {user?.nombre}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem 
                className="text-zinc-300 focus:text-white focus:bg-white/10 cursor-pointer"
                onClick={openPasswordModal}
              >
                <Key className="w-4 h-4 mr-2" />
                Cambiar Contraseña
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-red-400 focus:text-red-400 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Cambiar Contraseña
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(false); }} autoComplete="on">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-zinc-300">Contraseña Actual</Label>
                <Input
                  id="current-password"
                  name="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Ingresa tu contraseña actual"
                  data-testid="current-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-zinc-300">Nueva Contraseña</Label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Ingresa tu nueva contraseña"
                  data-testid="new-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-zinc-300">Confirmar Nueva Contraseña</Label>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Confirma tu nueva contraseña"
                  data-testid="confirm-password-input"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordModal(false)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={changingPassword}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="save-password-btn"
              >
                {changingPassword ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Forced Password Change Modal - Cannot be dismissed */}
      <Dialog open={showForcedPasswordModal} onOpenChange={() => {}}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Cambio de Contraseña Requerido
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Por seguridad, debes cambiar tu contraseña antes de continuar. 
              Esta es una medida para evitar el uso de contraseñas genéricas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(true); }} autoComplete="on">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="forced-current-password" className="text-zinc-300">Contraseña Actual</Label>
                <Input
                  id="forced-current-password"
                  name="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Ingresa tu contraseña actual"
                  data-testid="forced-current-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forced-new-password" className="text-zinc-300">Nueva Contraseña</Label>
                <Input
                  id="forced-new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Ingresa tu nueva contraseña"
                  data-testid="forced-new-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forced-confirm-password" className="text-zinc-300">Confirmar Nueva Contraseña</Label>
                <Input
                  id="forced-confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Confirma tu nueva contraseña"
                  data-testid="forced-confirm-password-input"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar Sesión
              </Button>
              <Button
                type="submit"
                disabled={changingPassword}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="forced-save-password-btn"
              >
                {changingPassword ? "Guardando..." : "Cambiar Contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
