import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Shield, LayoutDashboard, List, Menu, X, Settings, LogOut, User, CalendarClock, Users, History, Key, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      to: "/auditoria", 
      icon: History, 
      label: "Auditoría",
      show: isAdmin
    },
    { 
      to: "/configuracion", 
      icon: Settings, 
      label: "Configuración",
      show: isAdmin || canView("configuracion")
    },
  ].filter(item => item.show);

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

          {/* User Section */}
          <div className="px-3 py-4 border-t border-[#27272a]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {user?.es_admin ? "Administrador" : "Usuario"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-700">
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
          <div className="px-6 py-3 border-t border-[#27272a]">
            <p className="text-xs text-zinc-600">
              SecFind v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-zinc-300">Contraseña Actual</Label>
              <Input
                id="current-password"
                type="password"
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
                type="password"
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
                type="password"
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
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleChangePassword(false)}
              disabled={changingPassword}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="save-password-btn"
            >
              {changingPassword ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forced-current-password" className="text-zinc-300">Contraseña Actual</Label>
              <Input
                id="forced-current-password"
                type="password"
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
                type="password"
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
                type="password"
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
              variant="outline"
              onClick={handleLogout}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cerrar Sesión
            </Button>
            <Button
              onClick={() => handleChangePassword(true)}
              disabled={changingPassword}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="forced-save-password-btn"
            >
              {changingPassword ? "Guardando..." : "Cambiar Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;
