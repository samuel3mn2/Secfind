import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, AppWindow, Truck, FileText, Bell } from "lucide-react";
import Instituciones from "@/pages/Instituciones";
import Usuarios from "@/pages/Usuarios";
import Aplicaciones from "@/pages/Aplicaciones";
import Proveedores from "@/pages/Proveedores";
import InformesPentest from "@/pages/InformesPentest";
import Notificaciones from "@/pages/Notificaciones";

export default function Configuracion() {
  const { isAdmin, canView } = useAuth();
  const [activeTab, setActiveTab] = useState("instituciones");

  const canViewUsers = isAdmin || canView("configuracion");

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="configuracion-page">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Configuración
        </h1>
        <p className="text-zinc-500">
          Gestiona las opciones del sistema
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#18181b] border border-[#27272a] p-1 flex-wrap h-auto">
          <TabsTrigger 
            value="instituciones" 
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            data-testid="tab-instituciones"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Instituciones
          </TabsTrigger>
          <TabsTrigger 
            value="aplicaciones" 
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            data-testid="tab-aplicaciones"
          >
            <AppWindow className="w-4 h-4 mr-2" />
            Aplicaciones
          </TabsTrigger>
          <TabsTrigger 
            value="proveedores" 
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            data-testid="tab-proveedores"
          >
            <Truck className="w-4 h-4 mr-2" />
            Proveedores
          </TabsTrigger>
          <TabsTrigger 
            value="informes" 
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            data-testid="tab-informes"
          >
            <FileText className="w-4 h-4 mr-2" />
            Informes Pentest
          </TabsTrigger>
          {canViewUsers && (
            <TabsTrigger 
              value="usuarios" 
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              data-testid="tab-usuarios"
            >
              <Users className="w-4 h-4 mr-2" />
              Usuarios
            </TabsTrigger>
          )}
          {canViewUsers && (
            <TabsTrigger 
              value="notificaciones" 
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              data-testid="tab-notificaciones"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notificaciones
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="instituciones" className="mt-6">
          <Instituciones />
        </TabsContent>

        <TabsContent value="aplicaciones" className="mt-6">
          <Aplicaciones />
        </TabsContent>

        <TabsContent value="proveedores" className="mt-6">
          <Proveedores />
        </TabsContent>

        <TabsContent value="informes" className="mt-6">
          <InformesPentest />
        </TabsContent>

        {canViewUsers && (
          <TabsContent value="usuarios" className="mt-6">
            <Usuarios />
          </TabsContent>
        )}

        {canViewUsers && (
          <TabsContent value="notificaciones" className="mt-6">
            <Notificaciones />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
