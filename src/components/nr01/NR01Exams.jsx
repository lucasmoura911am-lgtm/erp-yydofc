import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Plus, Edit, Trash2, AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addDays, differenceInDays } from "date-fns";

const TYPE_LABELS = { admissional: "Admissional", periodico: "Periódico", retorno: "Retorno", demissional: "Demissional", mudanca_funcao: "Mudança Função" };
const TYPE_COLORS = { admissional: "bg-blue-100 text-blue-700", periodico: "bg-purple-100 text-purple-700", retorno: "bg-yellow-100 text-yellow-700", demissional: "bg-gray-100 text-gray-700", mudanca_funcao: "bg-orange-100 text-orange-700" };
const STATUS_COLORS = { pendente: "bg-gray-100 text-gray-700", realizado: "bg-green-100 text-green-700", vencido: "bg-red-100 text-red-700", agendado: "bg-blue-100 text-blue-700" };
const FREQ_DAYS = { unico: 0, mensal: 30, trimestral: 90, semestral: 180, anual: 365, continuo: 365 };

export default function NR01Exams({ user, healthPlans, exams, employees, contracts, clients, selectedContract }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ employee_id: "", exam_name: "", tipo: "periodico", exam_date: "", due_date: "", resultado: "pendente", status: "pendente", medico_responsavel: "", observations: "" });
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.SSTExame.update(editing.id, data)
      : base44.entities.SSTExame.create({ ...data, company_id: user.company_id, contract_id: selectedContract || "" }),
    onSuccess: () => { qc.invalidateQueries(["sst_exames"]); toast.success("Exame salvo!"); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SSTExame.delete(id),
    onSuccess: () => { qc.invalidateQueries(["sst_exames"]); toast.success("Removido!"); }
  });

  const resetForm = () => { setForm({ employee_id: "", exam_name: "", tipo: "periodico", exam_date: "", due_date: "", resultado: "pendente", status: "pendente", medico_responsavel: "", observations: "" }); setEditing(null); setDialogOpen(false); };

  const handleEdit = (e) => {
    setEditing(e);
    setForm({ employee_id: e.employee_id, exam_name: e.exam_name, tipo: e.tipo, exam_date: e.exam_date || "", due_date: e.due_date || "", resultado: e.resultado || "pendente", status: e.status || "pendente", medico_responsavel: e.medico_responsavel || "", observations: e.observations || "" });
    setDialogOpen(true);
  };

  // Auto-calcular próximo exame quando data realização muda
  const handleExamDateChange = (date) => {
    set("exam_date", date);
    // Tenta inferir periodicidade pelo plano vinculado
    const plan = healthPlans.find(p => p.activity_name?.toLowerCase().includes(form.exam_name?.toLowerCase().slice(0, 8) || ""));
    const freq = plan?.frequency || "anual";
    if (date && FREQ_DAYS[freq]) {
      const due = addDays(new Date(date), FREQ_DAYS[freq]);
      set("due_date", due.toISOString().split("T")[0]);
    }
  };

  const getEmployeeName = (id) => employees.find(e => e.id === id)?.full_name || "—";

  const filtered = exams.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterEmployee && e.employee_id !== filterEmployee) return false;
    return true;
  });

  const stats = {
    total: exams.length,
    realizado: exams.filter(e => e.status === "realizado").length,
    vencido: exams.filter(e => e.status === "vencido").length,
    agendado: exams.filter(e => e.status === "agendado").length,
  };

  const getDueBadge = (due_date) => {
    if (!due_date) return null;
    const d = differenceInDays(new Date(due_date), new Date());
    if (d < 0) return <Badge className="bg-red-100 text-red-700 text-xs">Vencido {Math.abs(d)}d</Badge>;
    if (d <= 30) return <Badge className="bg-red-100 text-red-700 text-xs">Vence {d}d</Badge>;
    if (d <= 90) return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Vence {d}d</Badge>;
    return <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>;
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", val: stats.total, color: "gray" },
          { label: "Realizados", val: stats.realizado, color: "green" },
          { label: "Agendados", val: stats.agendado, color: "blue" },
          { label: "Vencidos", val: stats.vencido, color: "red" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold text-${s.color}-600`}>{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Planos PCMSO gerados automaticamente */}
      {healthPlans.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Atividades extraídas do PCMSO ({healthPlans.length})</p>
            <div className="flex flex-wrap gap-2">
              {healthPlans.map(p => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {p.activity_name} — {p.frequency || "anual"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros + botão */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos status</option>
            <option value="pendente">Pendente</option>
            <option value="agendado">Agendado</option>
            <option value="realizado">Realizado</option>
            <option value="vencido">Vencido</option>
          </select>
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
            <option value="">Todos funcionários</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <Button className="gap-2" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Registrar Exame
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Exame</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Realizado em</TableHead>
                <TableHead>Próximo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  Nenhum exame registrado. Faça upload do PCMSO para gerar automaticamente.
                </TableCell></TableRow>
              )}
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-sm">{getEmployeeName(e.employee_id)}</TableCell>
                  <TableCell className="text-sm">{e.exam_name}</TableCell>
                  <TableCell><Badge className={TYPE_COLORS[e.tipo] || "bg-gray-100"}>{TYPE_LABELS[e.tipo] || e.tipo}</Badge></TableCell>
                  <TableCell className="text-sm">{e.exam_date ? format(new Date(e.exam_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm">
                    {e.due_date ? format(new Date(e.due_date), "dd/MM/yyyy") : "—"}
                    {e.due_date && <div className="mt-0.5">{getDueBadge(e.due_date)}</div>}
                  </TableCell>
                  <TableCell><Badge className={STATUS_COLORS[e.status]}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(e.id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Exame" : "Registrar Exame"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.employee_id} onChange={e => set("employee_id", e.target.value)}>
                <option value="">Selecione...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do Exame *</Label>
                <Input required className="mt-1" value={form.exam_name} onChange={e => set("exam_name", e.target.value)} placeholder="Ex: Audiometria" />
              </div>
              <div>
                <Label>Tipo</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de realização</Label>
                <Input type="date" className="mt-1" value={form.exam_date} onChange={e => handleExamDateChange(e.target.value)} />
              </div>
              <div>
                <Label>Próximo exame</Label>
                <Input type="date" className="mt-1" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Resultado</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.resultado} onChange={e => set("resultado", e.target.value)}>
                  <option value="pendente">Pendente</option>
                  <option value="apto">Apto</option>
                  <option value="inapto">Inapto</option>
                  <option value="apto_com_restricoes">Apto c/ Restrições</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.status} onChange={e => set("status", e.target.value)}>
                  <option value="pendente">Pendente</option>
                  <option value="agendado">Agendado</option>
                  <option value="realizado">Realizado</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Médico / Observações</Label>
              <Input className="mt-1" value={form.medico_responsavel} onChange={e => set("medico_responsavel", e.target.value)} placeholder="Dr. Nome CRM-XX" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}