import { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const EMPTY_FILTERS = { estado: "todos", destino: "todos", desde: "", hasta: "" };

// Fechas del calendario local convertidas a UTC, incluyendo todo el último día.
const dateBoundary = (value, nextDay = false) => {
  const date = new Date(`${value}T00:00:00`);
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
};

export const useBackupHistory = (refreshKey) => {
  const [query, setQuery] = useState({ ...EMPTY_FILTERS, pagina: 1, limite: 10 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const invalidDates = Boolean(query.desde && query.hasta && query.desde > query.hasta);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    if (invalidDates) {
      setLoading(false);
      return () => controller.abort();
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data: result } = await axios.get(`${API}/backup/historial`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: {
            pagina: query.pagina, limite: query.limite,
            estado: query.estado === "todos" ? undefined : query.estado,
            destino: query.destino === "todos" ? undefined : query.destino,
            fecha_desde: query.desde ? dateBoundary(query.desde) : undefined,
            fecha_hasta: query.hasta ? dateBoundary(query.hasta, true) : undefined,
          },
        });
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError("No se pudo cargar el historial de backups.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [query, revision, refreshKey, invalidDates]);

  return {
    query, data, loading, error, invalidDates,
    hasFilters: Boolean(query.estado !== "todos" || query.destino !== "todos" || query.desde || query.hasta),
    changeFilter: (field, value) => setQuery(prev => ({ ...prev, [field]: value, pagina: 1 })),
    clearFilters: () => setQuery(prev => ({ ...prev, ...EMPTY_FILTERS, pagina: 1 })),
    changePage: (pagina) => setQuery(prev => ({ ...prev, pagina })),
    refresh: () => setRevision(prev => prev + 1),
  };
};