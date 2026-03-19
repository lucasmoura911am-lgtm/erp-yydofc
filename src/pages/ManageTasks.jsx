import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Pause, Play, XCircle, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { QK, STATUS_META, PRIORITY_META, buildTaskPayload } from "@/lib/taskHelpers";

const DAYS = [
  { id: "seg", label: "Seg" }, { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" }, { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" }, { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

const EMPTY_FORM = {
  title: "", description: "", employee_id: "", allocation_id: "",
  client_id: "", due_date: "", scheduled_start_time: "", scheduled_end_time: "",
  scheduled_days: [], location: "", priority: "media", frequency: "avulsa",
};

export default function ManageTasks() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const qc = useQueryClient();

  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      if (u.role !== "admin") {
        try {
          const emps = await base44.entities.Employee.filter({ company_id: u.company_id, user_email: u.email });
          if (emps.length > 0) setEmployee(emps[0]);
        } catch {}
      }
    });
  }, []);

  const isAdmin = user?.role === "admin";

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: QK.tasks(user?.company_id),
    queryFn: () => isAdmin
      ? base44.entities.Task.filter({ company_id: user.company_id }, "-created_date")
      : base44.entities.Task.filter({ company_id: user.company_id, employee_id: employee.id }, "-created_date"),
    enabled: !!user?.company_id && (isAdmin || !!employee?.id),
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: QK.employees(user?.company_id),
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: QK.allocations(user?.company_id),
    queryFn: () => base44.entities.Allocation.filter({ company_id: user.company_id, status: "ativo" }),
    enabled: !!user?.company_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: QK.clients(user?.company_id),
    queryFn: () => base44.entities.Client.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  // Supervisores veem apenas seus funcionários
  const employees = user?.is_supervisor
    ? allEmployees.filter(e => e.supervisor_email === user.email || user.supervised_teams?.includes(e.team_id))
    : allEmployees;

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.tasks(user?.company_id) });
    // Invalida myTasks de qualquer funcionário afetado
    qc.invalidateQueries({ queryKey: ["myTasks"] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); resetForm(); toast.success("Tarefa criada!"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => { invalidate(); setDialogOpen(false); resetForm(); toast.success("Tarefa atualizada!"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { invalidate(); toast.success("Tarefa excluída!"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const resetForm = () => { setFormData(EMPTY_FORM); setEditing(null); };

  const handleEdit = (task) => {
    setEditing(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      employee_id: task.employee_id || "",
      allocation_id: task.allocation_id || "",
      client_id: task.client_id || "",
      due_date: task.due_date || "",
      scheduled_start_time: task.scheduled_start_time || "",
      scheduled_end_time: task.scheduled_end_time || "",
      scheduled_days: task.scheduled_days || [],
      location: task.location || "",
      priority: task.priority || "media",
      frequency: task.frequency || "avulsa",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let payload;
    try {
      payload = buildTaskPayload(formData, { user, allocations });
    } catch (err) {
      toast.error(err.message);
      return;
    }
    if (editing) {
      // Preserve status when editing
      const { status, ...rest } = payload;
      updateMutation.mutate({ id: editing.id, data: rest });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Partial update — never spread full task object
  const handleStatusChange = (taskId, newStatus) => {
    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      scheduled_days: prev.scheduled_days.includes(day)
        ? prev.scheduled_days.filter(d => d !== day)
        : [...prev.scheduled_days, day],
    }));
  };

  const getEmployeeName = (id) => employees.find(e => e.id === id)?.full_name
    || allEmployees.find(e => e.id === id)?.full_name
    || "Desconhecido";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Tarefas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Crie e gerencie tarefas para sua equipe</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Plus className="w-4 h-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Todas as Tarefas</CardTitle></CardHeader>
        <CardContent>
          {loadingTasks ? (
            <p className="text-center text-gray-400 py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                      Nenhuma tarefa cadastrada
                    </TableCell>
                  </TableRow>
                )}
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">{task.description}</p>
                      )}
                    </TableCell>
                    <TableCell>{getEmployeeName(task.employee_id)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        {(task.scheduled_start_time || task.scheduled_end_time) && (
                          <div className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                            <Clock className="w-3 h-3" />
                            {task.scheduled_start_time || "?"}{task.scheduled_end_time ? ` – ${task.scheduled_end_time}` : ""}
                          </div>
                        )}
                        {task.scheduled_days?.length > 0 && (
                          <div className="flex gap-0.5 flex-wrap mt-0.5">
                            {task.scheduled_days.map(d => (
                              <span key={d} className="text-[10px] px-1 py-0 bg-purple-100 text-purple-700 rounded font-medium">{d}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PRIORITY_META[task.priority]?.color}>
                        {PRIORITY_META[task.priority]?.label || task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_META[task.status]?.color}>
                        {STATUS_META[task.status]?.label || task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(task)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {task.status === "pendente" && (
                          <Button variant="ghost" size="icon" onClick={() => handleStatusChange(task.id, "pausada")}>
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                        {task.status === "pausada" && (
                          <Button variant="ghost" size="icon" onClick={() => handleStatusChange(task.id, "pendente")}>
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange(task.id, "cancelada")}>
                          <XCircle className="w-4 h-4 text-red-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(task.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Lotação → preenche employee/client automaticamente */}
            <div className="space-y-2">
              <Label>Lotação (Posto) — vincula funcionário automaticamente</Label>
              <Select
                value={formData.allocation_id || ""}
                onValueChange={(value) => {
                  const alloc = allocations.find(a => a.id === value);
                  setFormData(p => ({
                    ...p,
                    allocation_id: value,
                    client_id: alloc?.client_id || p.client_id,
                    employee_id: alloc?.employee_id || p.employee_id,
                    location: p.location || alloc?.post_location || "",
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sem lotação específica" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem lotação específica</SelectItem>
                  {allocations.map((a) => {
                    const cli = clients.find(c => c.id === a.client_id);
                    const emp = allEmployees.find(e => e.id === a.employee_id);
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        {a.post_name}{cli ? ` — ${cli.name}` : ""}{emp ? ` (${emp.full_name})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formData.allocation_id && (() => {
                const alloc = allocations.find(a => a.id === formData.allocation_id);
                const cli = clients.find(c => c.id === alloc?.client_id);
                const emp = allEmployees.find(e => e.id === alloc?.employee_id);
                return (
                  <div className="text-xs text-purple-700 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <span>📌</span>
                    <span>Vinculado: <b>{emp?.full_name || "—"}</b> · {cli?.name || "—"} · {alloc?.post_name}</span>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Funcionário *</Label>
                <Select
                  value={formData.employee_id || ""}
                  onValueChange={(value) => setFormData(p => ({ ...p, employee_id: value }))}
                  required
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => {
                      const cli = clients.find(c => c.id === emp.default_client_id);
                      return (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}{cli ? ` — ${cli.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Referência <span className="text-xs text-gray-400">(opcional)</span></Label>
                <Input
                  type="datetime-local"
                  value={formData.due_date || ""}
                  onChange={(e) => setFormData(p => ({ ...p, due_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={formData.frequency} onValueChange={(v) => setFormData(p => ({ ...p, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avulsa">Avulsa</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-500" />Horário Previsto</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Início</label>
                  <Input type="time" value={formData.scheduled_start_time} onChange={(e) => setFormData(p => ({ ...p, scheduled_start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Término</label>
                  <Input type="time" value={formData.scheduled_end_time} onChange={(e) => setFormData(p => ({ ...p, scheduled_end_time: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-purple-500" />Dias de Execução</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(d => {
                  const active = formData.scheduled_days.includes(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => toggleDay(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${active ? "bg-purple-600 text-white border-purple-600" : "bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-purple-400"}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">Deixe em branco para não vincular a dias específicos</p>
            </div>

            <div className="space-y-2">
              <Label>Local (opcional)</Label>
              <Input value={formData.location} onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}