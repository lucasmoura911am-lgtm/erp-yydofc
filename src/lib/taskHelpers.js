/**
 * Central helpers for Task/Employee/User resolution.
 * Use these everywhere instead of duplicating logic.
 */
import { base44 } from "@/api/base44Client";

/**
 * Resolves the current Employee record for a given User.
 * Priority: employee_id on user → user_email match.
 * Returns null if no employee found.
 */
export async function getCurrentEmployee(user) {
  if (!user) return null;

  // 1. Prefer explicit link
  if (user.employee_id) {
    const rows = await base44.entities.Employee.filter({ id: user.employee_id });
    if (rows.length > 0) return rows[0];
  }

  // 2. Fall back to email match
  if (user.email) {
    const rows = await base44.entities.Employee.filter({ user_email: user.email });
    if (rows.length > 0) return rows[0];
  }

  return null;
}

// ── Query key factories (canonical) ──────────────────────────────────────────
export const QK = {
  tasks: (company_id) => ["tasks", company_id],
  myTasks: (employee_id) => ["myTasks", employee_id],
  employees: (company_id) => ["employees", company_id],
  allocations: (company_id) => ["allocations", company_id],
  clients: (company_id) => ["clients", company_id],
};

// ── Status / Priority display helpers ────────────────────────────────────────
export const STATUS_META = {
  pendente:     { label: "Pendente",    color: "bg-gray-100 text-gray-800 border-gray-200" },
  em_andamento: { label: "Em Andamento",color: "bg-blue-100 text-blue-800 border-blue-200" },
  atrasada:     { label: "Atrasada",    color: "bg-red-100 text-red-800 border-red-200" },
  concluida:    { label: "Concluída",   color: "bg-green-100 text-green-800 border-green-200" },
  pausada:      { label: "Pausada",     color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  cancelada:    { label: "Cancelada",   color: "bg-red-100 text-red-800 border-red-200" },
};

export const PRIORITY_META = {
  baixa: { label: "Baixa", color: "bg-blue-100 text-blue-800" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-800" },
  alta:  { label: "Alta",  color: "bg-red-100 text-red-800" },
};

// ── Build a safe Task payload ─────────────────────────────────────────────────
/**
 * Builds a clean Task create/update payload.
 * Validates required fields; throws if missing.
 */
export function buildTaskPayload(formData, { user, allocations = [] }) {
  if (!formData.employee_id) throw new Error("Selecione um funcionário.");
  if (!user?.company_id)     throw new Error("Empresa do usuário não encontrada.");

  const alloc = allocations.find(a => a.id === formData.allocation_id);

  return {
    title:                formData.title.trim(),
    description:          formData.description || "",
    employee_id:          formData.employee_id,
    company_id:           user.company_id,
    supervisor_email:     user.email,
    allocation_id:        formData.allocation_id || "",
    client_id:            formData.client_id || alloc?.client_id || "",
    due_date:             formData.due_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    scheduled_start_time: formData.scheduled_start_time || "",
    scheduled_end_time:   formData.scheduled_end_time || "",
    scheduled_days:       formData.scheduled_days || [],
    location:             formData.location || alloc?.post_location || "",
    priority:             formData.priority || "media",
    frequency:            formData.frequency || "avulsa",
    status:               "pendente",
  };
}