import { useState, useEffect } from "react";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CalendarClock,
  CalendarX,
  History,
  FileText,
  User,
  MessageSquare,
  ArrowRightLeft,
  TestTube2,
  Ban,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Componente Timeline para historial de impedimentos (modo solo lectura)
export const TimelineSeguimiento = ({ vulnId, readOnly = false }) => {
  const [historial, setHistorial] = useState([]);
  const [vecesCambiadaFecha, setVecesCambiadaFecha] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vulnId) return;
    
    const fetchHistorial = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/seguimiento/${vulnId}/historial`);
        setHistorial(response.data.historial || []);
        setVecesCambiadaFecha(response.data.veces_cambiada_fecha || 0);
      } catch (error) {
        console.error("Error fetching historial:", error);
        setHistorial([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [vulnId]);

  if (loading) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <div className="animate-pulse">Cargando bitácora...</div>
      </div>
    );
  }

  if (!historial || historial.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay registros de seguimiento aún</p>
        {readOnly && (
          <p className="text-xs mt-2 text-zinc-600">
            Los registros se crean desde el Módulo de Seguimiento de Riesgos
          </p>
        )}
      </div>
    );
  }

  const getResultadoColor = (resultado) => {
    const r = resultado?.toLowerCase() || "";
    if (r === "corregido") return "bg-green-500";
    if (r === "impedimento") return "bg-red-500";
    if (r === "vulnerable") return "bg-orange-500";
    if (r === "pendiente") return "bg-yellow-500";
    if (r === "desestimado") return "bg-zinc-500";
    if (r === "para re test") return "bg-cyan-500";
    if (r === "nota de seguimiento") return "bg-blue-500";
    return "bg-blue-500";
  };

  const getResultadoBadgeClass = (resultado) => {
    const r = resultado?.toLowerCase() || "";
    if (r === "corregido") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (r === "impedimento") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (r === "vulnerable") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (r === "pendiente") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (r === "desestimado") return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    if (r === "para re test") return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    if (r === "nota de seguimiento") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  // Determinar el tipo de registro basado en resultado y cambio de fecha
  const getTipoRegistro = (entry, index) => {
    const resultado = entry.resultado_retest?.toLowerCase() || "";
    const tieneNuevaFecha = entry.fecha_compromiso_asignada != null;
    
    // Para determinar si hubo cambio de fecha, comparamos con la entrada anterior
    let fechaCambio = false;
    if (tieneNuevaFecha) {
      if (index < historial.length - 1) {
        const entradaAnterior = historial[index + 1];
        fechaCambio = entry.fecha_compromiso_asignada !== entradaAnterior?.fecha_compromiso_asignada;
      } else {
        fechaCambio = true;
      }
    }

    switch (resultado) {
      case "corregido":
        return {
          tipo: "Validación Técnica",
          subtipo: "Remediación exitosa",
          icon: CheckCheck,
          class: "bg-green-500/10 text-green-400 border-green-500/30"
        };
      case "desestimado":
        return {
          tipo: "Validación Técnica",
          subtipo: "Falso positivo / Riesgo aceptado",
          icon: XCircle,
          class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
        };
      case "vulnerable":
        return {
          tipo: "Validación Técnica",
          subtipo: "Vulnerabilidad persiste",
          icon: TestTube2,
          class: "bg-orange-500/10 text-orange-400 border-orange-500/30"
        };
      case "impedimento":
        return {
          tipo: "Bloqueo Operativo",
          subtipo: tieneNuevaFecha ? "Con reprogramación" : "Sin reprogramación",
          icon: Ban,
          class: "bg-red-500/10 text-red-400 border-red-500/30"
        };
      case "pendiente":
        if (tieneNuevaFecha && fechaCambio) {
          return {
            tipo: "Prórroga Administrativa",
            subtipo: "Reprogramación de fecha",
            icon: ArrowRightLeft,
            class: "bg-purple-500/10 text-purple-400 border-purple-500/30"
          };
        } else {
          return {
            tipo: "Retest Técnico",
            subtipo: "Validación sin cambio de fecha",
            icon: TestTube2,
            class: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
          };
        }
      case "para re test":
        return {
          tipo: "En Validación",
          subtipo: "Esperando retest del proveedor",
          icon: TestTube2,
          class: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
        };
      case "nota de seguimiento":
        return {
          tipo: "Nota Informativa",
          subtipo: "Comentario sin impacto en contadores",
          icon: FileText,
          class: "bg-blue-500/10 text-blue-400 border-blue-500/30"
        };
      default:
        return {
          tipo: "Registro",
          subtipo: "",
          icon: FileText,
          class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con contador */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <History className="w-4 h-4" />
          Bitácora de Seguimientos ({historial.length})
          {readOnly && (
            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Solo lectura</span>
          )}
        </h4>
        {vecesCambiadaFecha > 0 && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            <CalendarX className="w-3 h-3 mr-1" />
            Fecha reprogramada {vecesCambiadaFecha}x
          </Badge>
        )}
      </div>

      {/* Leyenda de tipos */}
      <div className="flex flex-wrap gap-2 p-2 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
        <span className="text-xs text-zinc-500 mr-2">Tipos:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          <TestTube2 className="w-3 h-3" /> Retest Técnico
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30">
          <ArrowRightLeft className="w-3 h-3" /> Prórroga Admin.
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/30">
          <CheckCheck className="w-3 h-3" /> Remediación
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30">
          <Ban className="w-3 h-3" /> Bloqueo
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-700" />

        {historial.map((entry, index) => {
          const tipoInfo = getTipoRegistro(entry, index);
          const TipoIcon = tipoInfo.icon;
          
          return (
            <div key={entry.id_accion || index} className="relative pl-10 pb-6 last:pb-0">
              {/* Punto del timeline */}
              <div className={`absolute left-2.5 w-3 h-3 rounded-full ${getResultadoColor(entry.resultado_retest)} ring-4 ring-zinc-900`} />
              
              {/* Contenido */}
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                {/* Header de la entrada */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {/* Badge de resultado */}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getResultadoBadgeClass(entry.resultado_retest)}`}>
                    {entry.resultado_retest}
                  </span>
                  
                  {/* Badge de TIPO DE REGISTRO */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${tipoInfo.class}`}>
                    <TipoIcon className="w-3 h-3" />
                    {tipoInfo.tipo}
                  </span>
                  
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entry.fecha_registro_nota ? 
                      format(new Date(entry.fecha_registro_nota), "dd MMM yyyy, HH:mm", { locale: es }) : 
                      "Sin fecha"}
                  </span>
                </div>

                {/* Subtipo y fecha */}
                <div className="flex flex-wrap items-center gap-3 mb-2 text-xs">
                  {tipoInfo.subtipo && (
                    <span className="text-zinc-500 italic">{tipoInfo.subtipo}</span>
                  )}
                  {entry.fecha_compromiso_asignada && (
                    <span className="text-cyan-400 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      Nueva fecha: {entry.fecha_compromiso_asignada}
                    </span>
                  )}
                </div>

                {/* Usuario */}
                <div className="text-xs text-zinc-400 mb-2 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {entry.usuario_registro || "Sistema"}
                </div>

                {/* Notas de impedimento */}
                {entry.notas_impedimento && (
                  <div className="mt-2 p-3 bg-zinc-900/50 rounded border-l-2 border-amber-500/50">
                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Notas / Impedimento:
                    </p>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{entry.notas_impedimento}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineSeguimiento;
