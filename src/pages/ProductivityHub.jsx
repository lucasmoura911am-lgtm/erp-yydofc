import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  Zap, Plus, CheckSquare, Calendar, ClipboardList, Bell,
  ChevronRight, AlertTriangle, Target, Clock, X, Pencil, Trash2,
  User, Paperclip, ArrowUpRight, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const today = format(new Date(), "yyyy-MM-dd");

// ── helpers ──────────────────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { value: "operacional", label: "Operacional", color: "bg-blue-100 text-blue-700" },
  { value: "administrativo", label: "Administrativo", color: "bg-gray-100 text-gray-700" },
  { value: "comercial", label: "Comercial", color: "bg-purple-100 text-purple-700" },
  { value: "atendimento", label: "Atendimento", color: "bg-green-100 text-green-700" },
  { value: "financeiro", label: "Financeiro", color: "bg-emerald-100 text-emerald-700" },
  { value: "reuniao", label: "Reunião", color: "bg-orange-100 text-orange-700" },
  { value: "suporte", label: "Suporte", color: "bg-cyan-100 text-cyan-700" },
  { value: "externo", label: "Externo", color: "bg-red-100 text-red-700" },
];

const TASK_PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  { value: "media", label: "Média", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
];

const APPT_TYPES = [
  { value: "reuniao", label: "Reunião", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "visita", label: "Visita", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "ligacao", label: "Ligação", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "apresentacao", label: "Apresentação", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "interno", label: "Interno", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "outro", label: "Outro", color: "bg-orange-100 text-orange-700 border-orange-300" },
];

function useCompanyId(user) {
  // Try user.company_id first, then look up via Employee record
  const [cid, setCid] = useState(user?.company_id || null);
  useEffect(() => {
    if (user?.company_id) { setCid(user.company_id); return; }
    if (!user?.email) return;
    base44.entities.Employee.filter({ user_email: user.email }).then((emps) => {
      if (emps.length > 0 && emps[0].company_id) setCid(emps[0].company_id);
    });
  }, [user?.email, user?.company_id]);
  return cid;
}

// ── MODAL: Nova Atividade ────────────────────────────────────────────────────
function ActivityModal({ user, cid, employees, editing, onClose, onSaved }) {
  const isAdmin = user?.role === "admin";
  const makeEmpty = () => ({
    date: today, start_time: "", end_time: "", type: "operacional",
    description: "", client_or_project: "", status: "em_andamento",
    attachment_url: "", employee_email: user?.email || "", employee_name: user?.full_name || "",
  });
  const [form, setForm] = useState(editing ? {
    date: editing.date, start_time: editing.start_time || "", end_time: editing.end_time || "",
    type: editing.type, description: editing.description, client_or_project: editing.client_or_project || "",
    status: editing.status, attachment_url: editing.attachment_url || "",
    employee_email: editing.employee_email || user?.email || "",
    employee_name: editing.employee_name || user?.full_name || "",
  } : makeEmpty());
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async (data) => {
      let duration_minutes = 0;
      if (data.start_time && data.end_time) {
        const [sh, sm] = data.start_time.split(":").map(Number);
        const [eh, em] = data.end_time.split(":").map(Number);
        duration_minutes = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
      const payload = { ...data, duration_minutes, company_id: cid || "unknown" };
      if (editing) return base44.entities.WorkActivity.update(editing.id, payload);
      return base44.entities.WorkActivity.create(payload);
    },
    onSuccess: () => { toast.success(editing ? "Atividade atualizada!" : "Atividade registrada!"); onSaved(); onClose(); },
    onError: (e) => toast.error("Erro ao salvar: " + (e?.message || "tente novamente")),
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, attachment_url: file_url })); }
    catch { toast.error("Erro ao enviar arquivo"); }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Editar Atividade" : "📋 Nova Atividade"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 space-y-3">
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Funcionário *</label>
              <Select value={form.employee_email} onValueChange={(v) => {
                const emp = employees.find(e => e.user_email === v);
                setForm(f => ({ ...f, employee_email: v, employee_name: emp?.full_name || v }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={user.email}>{user.full_name || user.email} (eu)</SelectItem>
                  {employees.filter(e => e.user_email && e.user_email !== user.email).map(e => (
                    <SelectItem key={e.id} value={e.user_email}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Tipo *</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Início</label>
              <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fim</label>
              <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Descrição *</label>
            <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" rows={3}
              placeholder="O que foi feito?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Cliente / Projeto</label>
            <Input placeholder="Opcional" value={form.client_or_project} onChange={e => setForm(f => ({ ...f, client_or_project: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Anexo</label>
            <div className="flex items-center gap-2">
              <input type="file" className="hidden" id="act-attach" accept="image/*,.pdf,.doc,.docx" onChange={handleUpload} />
              <label htmlFor="act-attach" className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-violet-400">
                <Paperclip className="w-4 h-4" />{uploading ? "Enviando..." : form.attachment_url ? "Trocar" : "Anexar"}
              </label>
              {form.attachment_url && <a href={form.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:underline">Ver</a>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate(form)} disabled={!form.description || !form.date || save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Registrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: Nova Tarefa ───────────────────────────────────────────────────────
function TaskModal({ user, cid, employees, editing, onClose, onSaved }) {
  const makeEmpty = () => ({ title: "", description: "", responsible_email: user?.email || "", responsible_name: user?.full_name || "", due_date: "", priority: "media", status: "pendente", client_or_project: "", notes: "" });
  const [form, setForm] = useState(editing ? { title: editing.title, description: editing.description || "", responsible_email: editing.responsible_email || user?.email || "", responsible_name: editing.responsible_name || user?.full_name || "", due_date: editing.due_date || "", priority: editing.priority, status: editing.status, client_or_project: editing.client_or_project || "", notes: editing.notes || "" } : makeEmpty());

  const save = useMutation({
    mutationFn: (data) => {
      if (editing) return base44.entities.ProductivityTask.update(editing.id, data);
      return base44.entities.ProductivityTask.create({ ...data, company_id: cid || "unknown", created_by_email: user.email, created_by_name: user.full_name });
    },
    onSuccess: () => { toast.success(editing ? "Tarefa atualizada!" : "Tarefa criada!"); onSaved(); onClose(); },
    onError: (e) => toast.error("Erro: " + (e?.message || "tente novamente")),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Editar Tarefa" : "✅ Nova Tarefa"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Título *</label>
            <Input placeholder="Título da tarefa" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Descrição</label>
            <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" rows={2}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhe opcional..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Responsável *</label>
            <Select value={form.responsible_email} onValueChange={(v) => {
              const emp = employees.find(e => e.user_email === v);
              setForm(f => ({ ...f, responsible_email: v, responsible_name: emp?.full_name || v }));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={user?.email || ""}>{user?.full_name || user?.email} (eu)</SelectItem>
                {employees.filter(e => e.user_email && e.user_email !== user?.email).map(e => (
                  <SelectItem key={e.id} value={e.user_email}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Prioridade</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data limite</label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Cliente / Projeto</label>
            <Input placeholder="Opcional" value={form.client_or_project} onChange={e => setForm(f => ({ ...f, client_or_project: e.target.value }))} />
          </div>
          {editing && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate(form)} disabled={!form.title || save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar Tarefa"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: Novo Compromisso ──────────────────────────────────────────────────
function AppointmentModal({ user, cid, editing, onClose, onSaved }) {
  const makeEmpty = () => ({ title: "", date: today, start_time: "", end_time: "", location: "", client_or_project: "", description: "", participants: [], type: "reuniao", status: "agendado" });
  const [form, setForm] = useState(editing ? { title: editing.title, date: editing.date, start_time: editing.start_time || "", end_time: editing.end_time || "", location: editing.location || "", client_or_project: editing.client_or_project || "", description: editing.description || "", participants: editing.participants || [], type: editing.type || "reuniao", status: editing.status || "agendado" } : makeEmpty());
  const [pInput, setPInput] = useState("");

  const save = useMutation({
    mutationFn: (data) => {
      if (editing) return base44.entities.Appointment.update(editing.id, data);
      return base44.entities.Appointment.create({ ...data, company_id: cid || "unknown", employee_email: user.email, employee_name: user.full_name });
    },
    onSuccess: () => { toast.success(editing ? "Compromisso atualizado!" : "Compromisso criado!"); onSaved(); onClose(); },
    onError: (e) => toast.error("Erro: " + (e?.message || "tente novamente")),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Editar Compromisso" : "📅 Novo Compromisso"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Reunião com cliente..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Tipo</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{APPT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Início</label>
              <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fim</label>
              <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Local</label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Sala, Meet, Zoom..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Cliente / Projeto</label>
            <Input value={form.client_or_project} onChange={e => setForm(f => ({ ...f, client_or_project: e.target.value }))} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Notas</label>
            <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" rows={2}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Participantes</label>
            <div className="flex gap-2">
              <Input placeholder="Email ou nome" value={pInput} onChange={e => setPInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), pInput.trim() && (setForm(f => ({ ...f, participants: [...(f.participants||[]), pInput.trim()] })), setPInput("")))} />
              <Button type="button" variant="outline" size="sm" onClick={() => { if (pInput.trim()) { setForm(f => ({ ...f, participants: [...(f.participants||[]), pInput.trim()] })); setPInput(""); } }}>Add</Button>
            </div>
            {(form.participants || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.participants.map((p, i) => (
                  <span key={i} className="flex items-center gap-1 bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full">
                    {p}<button onClick={() => setForm(f => ({ ...f, participants: f.participants.filter((_, j) => j !== i) }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate(form)} disabled={!form.title || !form.date || save.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
            {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ProductivityHub() {
  const [user, setUser] = useState(null);
  const [modal, setModal] = useState(null); // "activity"|"task"|"appointment"
  const [editTarget, setEditTarget] = useState(null);
  const [activeTab, setActiveTab] = useState("hoje"); // "hoje"|"tarefas"|"agenda"
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = useCompanyId(user);
  const isAdmin = user?.role === "admin";

  const enabled = !!user?.email;
  const cidEnabled = !!cid;

  const { data: activities = [] } = useQuery({
    queryKey: ["ph_act", cid, user?.email],
    queryFn: () => cid
      ? base44.entities.WorkActivity.filter({ company_id: cid, employee_email: user.email })
      : base44.entities.WorkActivity.filter({ employee_email: user.email }),
    enabled,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["ph_apt", cid, user?.email],
    queryFn: () => cid
      ? base44.entities.Appointment.filter({ company_id: cid, employee_email: user.email })
      : base44.entities.Appointment.filter({ employee_email: user.email }),
    enabled,
  });

  const { data: ptasks = [] } = useQuery({
    queryKey: ["ph_pt", cid, user?.email],
    queryFn: () => cid
      ? base44.entities.ProductivityTask.filter({ company_id: cid, responsible_email: user.email })
      : base44.entities.ProductivityTask.filter({ responsible_email: user.email }),
    enabled,
  });

  const { data: notices = [] } = useQuery({
    queryKey: ["ph_notices", cid],
    queryFn: () => base44.entities.InternalNotice.filter({ company_id: cid, active: true }),
    enabled: cidEnabled,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["ph_emps", cid],
    queryFn: () => base44.entities.Employee.filter({ company_id: cid }),
    enabled: cidEnabled,
  });

  const delActivity = useMutation({
    mutationFn: (id) => base44.entities.WorkActivity.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ph_act"] }); toast.success("Removida!"); },
  });
  const delTask = useMutation({
    mutationFn: (id) => base44.entities.ProductivityTask.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ph_pt"] }); toast.success("Tarefa removida!"); },
  });
  const updateTaskStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ProductivityTask.update(id, { status, ...(status === "concluido" ? { completed_at: today } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ph_pt"] }),
  });
  const delAppt = useMutation({
    mutationFn: (id) => base44.entities.Appointment.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ph_apt"] }); toast.success("Removido!"); },
  });

  const todayActivities = activities.filter(a => a.date === today);
  const todayAppts = appointments.filter(a => a.date === today && a.status !== "cancelado").sort((a, b) => (a.start_time||"").localeCompare(b.start_time||""));
  const pendingTasks = ptasks.filter(t => t.status !== "concluido").map(t => ({ ...t, status: t.status !== "concluido" && t.due_date && t.due_date < today ? "atrasado" : t.status }));
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today);
  const upcomingAppts = appointments.filter(a => a.date >= today && a.status !== "cancelado").sort((a, b) => a.date.localeCompare(b.date) || (a.start_time||"").localeCompare(b.start_time||"")).slice(0, 5);
  const totalDone = ptasks.filter(t => t.responsible_email === user?.email && t.status === "concluido").length;
  const total = ptasks.filter(t => t.responsible_email === user?.email).length;
  const completion = total > 0 ? Math.round(totalDone / total * 100) : 0;

  const myNotices = notices.filter(n => n.type === "empresa" || n.responsible_email === user?.email || (n.target_emails||[]).includes(user?.email)).slice(0, 3);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ph_act"] });
    qc.invalidateQueries({ queryKey: ["ph_pt"] });
    qc.invalidateQueries({ queryKey: ["ph_apt"] });
  };

  const TABS = [
    { key: "hoje", label: "Hoje", icon: "🗓️" },
    { key: "tarefas", label: "Tarefas", icon: "✅" },
    { key: "agenda", label: "Agenda", icon: "📅" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* TOP BAR — Slack style */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 dark:text-gray-100 text-base leading-tight">Central de Produtividade</h1>
            <p className="text-xs text-gray-400 capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditTarget(null); setModal("appointment"); }} className="gap-1 text-teal-600 border-teal-200 hover:bg-teal-50">
            <Calendar className="w-3.5 h-3.5" /><span className="hidden sm:inline">Compromisso</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setEditTarget(null); setModal("task"); }} className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50">
            <CheckSquare className="w-3.5 h-3.5" /><span className="hidden sm:inline">Tarefa</span>
          </Button>
          <Button size="sm" onClick={() => { setEditTarget(null); setModal("activity"); }} className="gap-1 bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Atividade</span>
          </Button>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 flex gap-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.key ? "border-violet-600 text-violet-700 dark:text-violet-400" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <span>{t.icon}</span><span>{t.label}</span>
            {t.key === "tarefas" && pendingTasks.length > 0 && <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{pendingTasks.length}</span>}
            {t.key === "hoje" && todayAppts.length > 0 && <span className="ml-1 bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full">{todayAppts.length}</span>}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6">

        {/* ALERTA DE ATRASO */}
        {overdueTasks.length > 0 && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 font-medium flex-1">Você tem <b>{overdueTasks.length}</b> tarefa(s) em atraso!</p>
            <button onClick={() => setActiveTab("tarefas")} className="text-xs text-red-600 underline">Ver</button>
          </div>
        )}

        {/* ──── TAB: HOJE ──── */}
        {activeTab === "hoje" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* KPIs */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Atividades Hoje", value: todayActivities.length, icon: ClipboardList, color: "from-violet-500 to-indigo-600" },
                { label: "Compromissos Hoje", value: todayAppts.length, icon: Calendar, color: "from-teal-500 to-cyan-600" },
                { label: "Tarefas Pendentes", value: pendingTasks.length, icon: CheckSquare, color: pendingTasks.length > 0 ? "from-orange-500 to-amber-500" : "from-green-500 to-emerald-500" },
                { label: "Taxa de Conclusão", value: `${completion}%`, icon: Target, color: "from-pink-500 to-rose-500" },
              ].map(k => (
                <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow`}>
                  <div className="bg-white/20 rounded-xl p-1.5 w-fit mb-2"><k.icon className="w-4 h-4" /></div>
                  <p className="text-2xl font-black">{k.value}</p>
                  <p className="text-white/70 text-xs mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Agenda do dia — Slack style timeline */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-white" /></span>
                      Compromissos de Hoje
                    </h3>
                    <button onClick={() => { setEditTarget(null); setModal("appointment"); }} className="text-xs text-teal-500 hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" />Adicionar
                    </button>
                  </div>
                  {todayAppts.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Nenhum compromisso hoje</p>
                      <button onClick={() => setModal("appointment")} className="mt-2 text-xs text-teal-500 hover:underline">+ Agendar</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayAppts.map(a => {
                        const ti = APPT_TYPES.find(t => t.value === a.type) || APPT_TYPES[0];
                        return (
                          <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${ti.color} group`}>
                            <div className="text-center min-w-[40px]">
                              <p className="text-xs font-bold">{a.start_time || "?"}</p>
                              {a.end_time && <p className="text-xs opacity-60">{a.end_time}</p>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{a.title}</p>
                              {a.location && <p className="text-xs opacity-70">📍 {a.location}</p>}
                              {a.participants?.length > 0 && <p className="text-xs opacity-60">👥 {a.participants.slice(0,2).join(", ")}{a.participants.length > 2 ? ` +${a.participants.length-2}` : ""}</p>}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditTarget(a); setModal("appointment"); }} className="p-1 hover:bg-white/50 rounded"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => delAppt.mutate(a.id)} className="p-1 hover:bg-white/50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Atividades do dia */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-violet-500 flex items-center justify-center"><ClipboardList className="w-3.5 h-3.5 text-white" /></span>
                      Atividades de Hoje
                    </h3>
                    <button onClick={() => { setEditTarget(null); setModal("activity"); }} className="text-xs text-violet-500 hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" />Registrar
                    </button>
                  </div>
                  {todayActivities.length === 0 ? (
                    <div className="text-center py-8">
                      <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Nenhuma atividade registrada hoje</p>
                      <button onClick={() => setModal("activity")} className="mt-2 text-xs text-violet-500 hover:underline">+ Registrar</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayActivities.map(a => {
                        const ti = ACTIVITY_TYPES.find(t => t.value === a.type);
                        return (
                          <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ti?.color}`}>{ti?.label}</span>
                                {a.start_time && <span className="text-xs text-gray-400"><Clock className="w-3 h-3 inline mr-0.5" />{a.start_time}{a.end_time ? ` - ${a.end_time}` : ""}</span>}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${a.status === "finalizado" ? "bg-green-100 text-green-700" : a.status === "pausado" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                                  {a.status === "finalizado" ? "✓ Finalizado" : a.status === "pausado" ? "⏸ Pausado" : "● Andamento"}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200">{a.description}</p>
                              {a.client_or_project && <p className="text-xs text-gray-400 mt-0.5">🔗 {a.client_or_project}</p>}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button onClick={() => { setEditTarget(a); setModal("activity"); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><Pencil className="w-3 h-3 text-gray-400" /></button>
                              <button onClick={() => delActivity.mutate(a.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Avisos */}
              {myNotices.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-white" /></span>
                      Avisos
                    </h3>
                    <div className="space-y-2">
                      {myNotices.map(n => (
                        <div key={n.id} className={`p-2.5 rounded-xl border-l-4 ${n.priority === "urgente" ? "border-l-red-500 bg-red-50 dark:bg-red-900/10" : n.priority === "alta" ? "border-l-orange-500 bg-orange-50" : "border-l-blue-400 bg-blue-50 dark:bg-blue-900/10"}`}>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{n.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.description}</p>
                        </div>
                      ))}
                    </div>
                    <Link to="/ProductivityNotices" className="text-xs text-amber-500 hover:underline flex items-center gap-1 mt-2">Ver todos <ChevronRight className="w-3 h-3" /></Link>
                  </CardContent>
                </Card>
              )}

              {/* Próximos compromissos */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-white" /></span>
                    Próximos
                  </h3>
                  {upcomingAppts.length === 0 ? <p className="text-xs text-gray-400 py-2">Nenhum compromisso</p> : (
                    <div className="space-y-2">
                      {upcomingAppts.map(a => (
                        <div key={a.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                          <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-1.5 text-center min-w-[36px]">
                            <p className="text-xs text-teal-700 font-bold">{a.date?.slice(8)}/{a.date?.slice(5,7)}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{a.title}</p>
                            <p className="text-xs text-gray-400">{a.start_time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Task progress */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-3">Progresso Tarefas</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{totalDone} concluídas</span><span>{total} total</span>
                    </div>
                    <Progress value={completion} className="h-2" />
                    <p className="text-xs text-gray-400">{completion}% de conclusão</p>
                  </div>
                  <button onClick={() => setActiveTab("tarefas")} className="w-full mt-3 text-xs text-blue-500 hover:underline flex items-center justify-center gap-1">
                    Ver tarefas <ChevronRight className="w-3 h-3" />
                  </button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ──── TAB: TAREFAS ──── */}
        {activeTab === "tarefas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 dark:text-gray-100">Minhas Tarefas</h2>
              <div className="flex gap-2">
                {isAdmin && <Link to="/ProductivityKanban"><Button variant="outline" size="sm">Kanban completo</Button></Link>}
                <Button size="sm" onClick={() => { setEditTarget(null); setModal("task"); }} className="bg-violet-600 text-white gap-1">
                  <Plus className="w-3.5 h-3.5" />Nova Tarefa
                </Button>
              </div>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: "pendente", label: "📋 Pendente", color: "bg-gray-50 dark:bg-gray-800/40", hdr: "bg-gray-200" },
                { key: "em_andamento", label: "⚡ Em andamento", color: "bg-blue-50 dark:bg-blue-900/10", hdr: "bg-blue-200" },
                { key: "atrasado", label: "🚨 Atrasado", color: "bg-red-50 dark:bg-red-900/10", hdr: "bg-red-200" },
              ].map(col => {
                const colTasks = pendingTasks.filter(t => t.status === col.key);
                return (
                  <div key={col.key} className={`${col.color} rounded-2xl p-3`}>
                    <div className={`${col.hdr} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
                      <span className="bg-white/50 text-xs font-bold px-2 py-0.5 rounded-full text-gray-600">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Nenhuma tarefa</p> : colTasks.map(t => {
                        const pri = TASK_PRIORITIES.find(p => p.value === t.priority);
                        return (
                          <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl p-3 shadow-sm group">
                            <div className="flex items-start justify-between gap-1 mb-1.5">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 leading-tight">{t.title}</p>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                                <button onClick={() => { setEditTarget(t); setModal("task"); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-3 h-3 text-gray-400" /></button>
                                <button onClick={() => delTask.mutate(t.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                              </div>
                            </div>
                            {t.description && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{t.description}</p>}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${pri?.color}`}>{pri?.label}</span>
                              {t.due_date && <span className={`text-xs ${t.due_date < today ? "text-red-500 font-bold" : "text-gray-400"}`}>📅 {t.due_date?.slice(5)}</span>}
                            </div>
                            <div className="mt-2 flex gap-1">
                              {t.status !== "em_andamento" && <button onClick={() => updateTaskStatus.mutate({ id: t.id, status: "em_andamento" })} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700">→ Andamento</button>}
                              <button onClick={() => updateTaskStatus.mutate({ id: t.id, status: "concluido" })} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700">✓ Concluir</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Concluídas */}
            {ptasks.filter(t => t.status === "concluido").length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-3">✅ Concluídas ({ptasks.filter(t => t.status === "concluido").length})</h3>
                  <div className="space-y-2">
                    {ptasks.filter(t => t.status === "concluido").slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded-xl">
                        <span className="text-green-500 text-sm">✓</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-through flex-1">{t.title}</p>
                        {t.completed_at && <span className="text-xs text-gray-400">{t.completed_at?.slice(5)}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ──── TAB: AGENDA ──── */}
        {activeTab === "agenda" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 dark:text-gray-100">Minha Agenda</h2>
              <div className="flex gap-2">
                <Link to="/ProductivityAgenda"><Button variant="outline" size="sm">Calendário completo</Button></Link>
                <Button size="sm" onClick={() => { setEditTarget(null); setModal("appointment"); }} className="bg-teal-600 text-white gap-1">
                  <Plus className="w-3.5 h-3.5" />Novo Compromisso
                </Button>
              </div>
            </div>

            {/* Lista de compromissos próximos */}
            <div className="space-y-3">
              {appointments.filter(a => a.status !== "cancelado").sort((a, b) => a.date.localeCompare(b.date) || (a.start_time||"").localeCompare(b.start_time||"")).length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum compromisso cadastrado</p>
                  <button onClick={() => setModal("appointment")} className="mt-3 text-sm text-teal-500 hover:underline">+ Agendar agora</button>
                </div>
              ) : appointments.filter(a => a.status !== "cancelado").sort((a, b) => a.date.localeCompare(b.date) || (a.start_time||"").localeCompare(b.start_time||"")).map(a => {
                const ti = APPT_TYPES.find(t => t.value === a.type) || APPT_TYPES[0];
                const isApptToday = a.date === today;
                const isPast = a.date < today;
                return (
                  <div key={a.id} className={`bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border group flex items-start gap-4 ${isApptToday ? "border-teal-400" : isPast ? "border-gray-100 opacity-60" : "border-gray-100 dark:border-gray-800"}`}>
                    <div className={`rounded-xl p-3 text-center min-w-[60px] flex-shrink-0 ${isApptToday ? "bg-teal-500 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>
                      <p className={`text-xs font-bold ${isApptToday ? "text-white" : "text-gray-500"}`}>{a.date?.slice(8)}/{a.date?.slice(5,7)}</p>
                      <p className={`text-sm font-black ${isApptToday ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>{a.start_time || "--"}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ti.color}`}>{ti.label}</span>
                        {isApptToday && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">Hoje</span>}
                      </div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{a.title}</p>
                      {a.location && <p className="text-xs text-gray-400 mt-0.5">📍 {a.location}</p>}
                      {a.client_or_project && <p className="text-xs text-gray-400 mt-0.5">🔗 {a.client_or_project}</p>}
                      {a.participants?.length > 0 && <p className="text-xs text-gray-400 mt-0.5">👥 {a.participants.join(", ")}</p>}
                      {a.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => { setEditTarget(a); setModal("appointment"); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><Pencil className="w-4 h-4 text-gray-400" /></button>
                      <button onClick={() => delAppt.mutate(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal === "activity" && (
        <ActivityModal user={user} cid={cid} employees={employees} editing={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSaved={invalidate} />
      )}
      {modal === "task" && (
        <TaskModal user={user} cid={cid} employees={employees} editing={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSaved={invalidate} />
      )}
      {modal === "appointment" && (
        <AppointmentModal user={user} cid={cid} editing={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSaved={invalidate} />
      )}
    </div>
  );
}