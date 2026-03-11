import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users } from "lucide-react";
import Instituciones from "@/pages/Instituciones";
import Usuarios from "@/pages/Usuarios";

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
        <TabsList className="bg-[#18181b] border border-[#27272a] p-1">
          <TabsTrigger 
            value="instituciones" 
            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            data-testid="tab-instituciones"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Instituciones
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
        </TabsList>

        <TabsContent value="instituciones" className="mt-6">
          <Instituciones />
        </TabsContent>

        {canViewUsers && (
          <TabsContent value="usuarios" className="mt-6">
            <Usuarios />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
