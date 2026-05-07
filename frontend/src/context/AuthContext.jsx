import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      setMustChangePassword(response.data.debe_cambiar_password || false);
    } catch (error) {
      console.error("Error fetching user:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await axios.post(`${API}/auth/login`, { username, password });
    const { token: newToken, usuario } = response.data;
    
    localStorage.setItem("token", newToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(usuario);
    setMustChangePassword(usuario.debe_cambiar_password || false);
    
    return usuario;
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
    if (user) {
      setUser({ ...user, debe_cambiar_password: false });
    }
  };

  // Permission helpers
  const hasPermission = (module, action) => {
    if (!user) return false;
    if (user.es_admin) return true;
    
    const modulePerms = user.permisos?.[module];
    if (!modulePerms) return false;
    
    return modulePerms[action] === true;
  };

  const canView = (module) => hasPermission(module, "ver");
  const canCreate = (module) => hasPermission(module, "crear");
  const canEdit = (module) => hasPermission(module, "editar");
  const canDelete = (module) => hasPermission(module, "eliminar");

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.es_admin || false,
    mustChangePassword,
    clearMustChangePassword,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
