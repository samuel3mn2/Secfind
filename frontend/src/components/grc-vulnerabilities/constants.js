export const RISK_COLORS = { Alto: '#ef4444', 'Medio Alto': '#f97316', Medio: '#eab308', Bajo: '#22c55e', 'Sin clasificar': '#a1a1aa' };
export const SEVERITY_COLORS = { Critica: '#ef4444', Alta: '#f97316', Media: '#eab308', Baja: '#3b82f6', 'Sin clasificar': '#a1a1aa' };
export const label = value => value === 'Critica' ? 'Crítica' : value;
export const slug = value => value.toLowerCase().replaceAll(' ', '-');
export const appName = value => value ?? 'Sin aplicación asignada';
export const toggleValue = (values, value) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];