import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, User, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  { value: "media", label: "Média", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
];

const COLUMNS = [
  { key: "pendente", label: "📋 Pendente", color: "bg-gray-50 dark:bg-gray-800/40", header: "bg-gray-200 dark:bg-gray-700" },
  { key: "em_andamento", label: "⚡ Em andamento", color: "bg-blue-50 dark:bg-blue-900/10", header: "bg-blue-200 dark:bg-blue-800" },
  { key: "concluido", label: "✅ Concluído", color: "bg-green-50 dark:bg-green-900/10", header: "bg-green-200 dark:bg-green-800" },
  { key: "atrasado", label: "🚨 Atrasado", color: "bg-red-50 dark:bg-red-900/10", header: "bg-red-200 dark:bg-red-800" },
];

const EMPTY_TASK = { title: "", description: "", responsible_email: "", responsible_name: "", due_date: "", priority: "media", status: "pendente", client_or_project: "", notes: "" };

export default function ProductivityKanban() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_TASK);
  const [editing, setEditing] = useState(null);
  const [filterOwn, setFilterOwn] = useState(false);
  const qc = useQueryClient();

  const [cid, setCid] = useState(null);
  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      if (u?.email) base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);
  const enabled = !!user?.email;
  const isAdmin = user?.role === "admin";

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["pk_tasks", cid, user?.email],
    queryFn: () => cid
      ? base44.entities.ProductivityTask.filter({ company_id: cid })
      : base44.entities.ProductivityTask.filter({ responsible_email: user.email }),
    enabled,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["pk_emps", cid],
    queryFn: () => cid ? base44.entities.Employee.filter({ company_id: cid }) : [],
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.ProductivityTask.update(editing.id, data);
      return base44.entities.ProductivityTask.create({
        ...data, company_id: cid,
        created_by_email: user.email,
        created_by_name: user.full_name,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pk_tasks"] }); qc.invalidateQueries({ queryKey: ["ph_pt"] }); setOpen(false); setEditing(null); setForm(EMPTY_TASK); toast.success(editing ? "Tarefa atualizada!" : "Tarefa criada!"); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ProductivityTask.update(id, { status, ...(status === "concluido" ? { completed_at: today } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pk_tasks"] }); },
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.ProductivityTask.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pk_tasks"] }); toast.success("Tarefa removida!"); },
  });

  // Auto-mark overdue
  const processedTasks = tasks.map(t => ({
    ...t,
    status: t.status !== "concluido" && t.due_date && t.due_date < today ? "atrasado" : t.status
  }));

  const displayTasks = filterOwn ? processedTasks.filter(t => t.responsible_email === user?.email) : processedTasks;

  const handleEdit = (t) => {
    setEditing(t);
    setForm({ title: t.title, description: t.description || "", responsible_email: t.responsible_email || "", responsible_name: t.responsible_name || "", due_date: t.due_date || "", priority: t.priority, status: t.status, client_or_project: t.client_or_project || "", notes: t.notes || "" });
    setOpen(true);
  };

  const handleResponsibleChange = (email) => {
    const emp = employees.find(e => e.user_email === email || e.full_name === email);
    setForm(f => ({ ...f, responsible_email: email, responsible_name: emp?.full_name || email }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="space-y-5">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">✅ Kanban de Tarefas</h1>
            <p className="text-sm text-gray-400">Gerencie e delegue tarefas da equipe</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setFilterOwn(f => !f)} className={filterOwn ? "border-violet-500 text-violet-600" : ""}>
              <User className="w-4 h-4 mr-1" /> {filterOwn ? "Minhas tarefas" : "Todas"}
            </Button>
            <Button onClick={() => { setEditing(null); setForm(EMPTY_TASK); setOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Nova Tarefa
            </Button>
          </div>
        </div>

        {/* KANBAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = displayTasks.filter(t => t.status === col.key);
            return (
              <div key={col.key} className={`${col.color} rounded-2xl p-3 min-h-[500px]`}>
                <div className={`${col.header} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
                  <span className="bg-white/50 dark:bg-black/20 text-xs font-bold px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">{colTasks.length}</span>
                </div>

                <div className="space-y-2">
                  {colTasks.map(task => {
                    const pri = PRIORITIES.find(p => p.value === task.priority);
                    const isOverdue = task.due_date && task.due_date < today && task.status !== "concluido";
                    return (
                      <div key={task.id} className="bg-white dark:bg-gray-900 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight flex-1">{task.title}</p>
                          <div className="flex gap-0.5 flex-shrink-0">
                            <button onClick={() => handleEdit(task)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => del.mutate(task.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {task.description && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${pri?.color}`}>{pri?.label}</span>
                          {task.due_date && (
                            <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? "text-red-500 font-bold" : "text-gray-400"}`}>
                              {isOverdue && <AlertTriangle className="w-3 h-3" />}
                              <Calendar className="w-3 h-3" />{task.due_date?.slice(5)}
                            </span>
                          )}
                        </div>
                        {task.responsible_name && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-violet-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-violet-700 text-xs font-bold">{task.responsible_name?.charAt(0)}</span>
                            </div>
                            <span className="text-xs text-gray-400 truncate">{task.responsible_name}</span>
                          </div>
                        )}
                        {/* Move buttons */}
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {COLUMNS.filter(c => c.key !== task.status && c.key !== "atrasado").map(c => (
                            <button key={c.key} onClick={() => updateStatus.mutate({ id: task.id, status: c.key })}
                              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-violet-100 hover:text-violet-700 transition-colors">
                              → {c.label.split(" ")[1]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? "Editar Tarefa" : "Nova Tarefa"}</h2>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setEditing(null); }}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Título *</label>
                <Input placeholder="Título da tarefa" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Descrição</label>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Prioridade</label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Data limite</label>
                  <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Responsável</label>
                <Select value={form.responsible_email} onValueChange={handleResponsibleChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.status !== "inactive").map(e => (
                      <SelectItem key={e.id} value={e.user_email || e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Cliente / Projeto</label>
                <Input placeholder="Opcional" value={form.client_or_project} onChange={e => setForm(f => ({ ...f, client_or_project: e.target.value }))} />
              </div>
              {editing && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={() => save.mutate(form)} disabled={!form.title || save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
                {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar Tarefa"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}