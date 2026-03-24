import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Trash2, Plus, Edit, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";

const STATUS_COLORS = { pendente: "bg-gray-100 text-gray-700", em_andamento: "bg-blue-100 text-blue-700", concluida: "bg-green-100 text-green-700", cancelada: "bg-gray-100 text-gray-400" };
const STATUS_LABELS = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
const PRIO_COLORS = { baixa: "bg-gray-100 text-gray-600", media: "bg-blue-100 text-blue-700", alta: "bg-orange-100 text-orange-700", urgente: "bg-red-100 text-red-700" };
const TIPO_LABELS = { risco: "Risco", exame: "Exame", acao: "Ação", treinamento: "Treinamento", documento: "Documento" };

const EMPTY_FORM = { titulo: "", descricao: "", tipo: "acao", responsible: "", prazo: "", priority: "media", status: "pendente" };

export default function NR01Tasks({ user, tasks, selectedContract }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPrio, setFilterPrio] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.TarefaNR01.update(editing.id, data)
      : base44.entities.TarefaNR01.create({ ...data, company_id: user?.company_id || "", contract_id: selectedContract || "" }),
    onSuccess: () => { qc.invalidateQueries(["nr01_tasks"]); toast.success("Tarefa salva!"); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TarefaNR01.delete(id),
    onSuccess: () => { qc.invalidateQueries(["nr01_tasks"]); toast.success("Tarefa removida!"); }
  });

  const concluirMutation = useMutation({
    mutationFn: ({ id, obs }) => base44.entities.TarefaNR01.update(id, { status: "concluida", observacao: obs }),
    onSuccess: () => { qc.invalidateQueries(["nr01_tasks"]); toast.success("Tarefa concluída!"); }
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setDialogOpen(false); };

  const handleEdit = (t) => {
    setEditing(t);
    setForm({ titulo: t.titulo, descricao: t.descricao || "", tipo: t.tipo || "acao", responsible: t.responsible || "", prazo: t.prazo || "", priority: t.priority || "media", status: t.status || "pendente" });
    setDialogOpen(true);
  };

  const isOverdue = (t) => t.prazo && isBefore(new Date(t.prazo), new Date()) && t.status !== "concluida" && t.status !== "cancelada";

  const filtered = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPrio && t.priority !== filterPrio) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    pendente: tasks.filter(t => t.status === "pendente").length,
    em_andamento: tasks.filter(t => t.status === "em_andamento").length,
    concluida: tasks.filter(t => t.status === "concluida").length,
    atrasada: tasks.filter(isOverdue).length,
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", val: stats.total, color: "gray" },
          { label: "Pendentes", val: stats.pendente, color: "blue" },
          { label: "Concluídas", val: stats.concluida, color: "green" },
          { label: "Atrasadas", val: stats.atrasada, color: "red" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold text-${s.color}-600`}>{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.atrasada > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{stats.atrasada} tarefa(s) em atraso — ação imediata necessária.</p>
        </div>
      )}

      {/* Filtros + botão */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
            <option value="">Todas as prioridades</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
          <span className="text-sm text-gray-500 flex items-center">{filtered.length} tarefa(s)</span>
        </div>
        <Button className="gap-2" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Nova Tarefa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                    Nenhuma tarefa encontrada. Crie riscos médios/altos para gerar tarefas automaticamente.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(t => (
                <TableRow key={t.id} className={isOverdue(t) ? "bg-red-50" : ""}>
                  <TableCell className="max-w-[260px]">
                    <div className="font-medium text-sm">{t.titulo}</div>
                    {t.descricao && <div className="text-xs text-gray-400 truncate">{t.descricao}</div>}
                    {t.referencia_tipo && <Badge variant="outline" className="text-xs mt-1">{t.referencia_tipo}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{TIPO_LABELS[t.tipo] || t.tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={PRIO_COLORS[t.priority] || "bg-gray-100"}>{t.priority}</Badge>
                  </TableCell>
                  <TableCell className={`text-sm ${isOverdue(t) ? "text-red-600 font-semibold" : ""}`}>
                    {t.prazo ? format(new Date(t.prazo), "dd/MM/yyyy") : "—"}
                    {isOverdue(t) && <div className="text-xs text-red-500">ATRASADA</div>}
                  </TableCell>
                  <TableCell className="text-sm">{t.responsible || "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[t.status] || "bg-gray-100"}>{STATUS_LABELS[t.status] || t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {t.status !== "concluida" && t.status !== "cancelada" && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs text-green-700 border-green-300"
                          onClick={() => {
                            const obs = prompt("Observação de conclusão (opcional):");
                            concluirMutation.mutate({ id: t.id, obs: obs || "" });
                          }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir tarefa?")) deleteMutation.mutate(t.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa NR-01"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input required className="mt-1" value={form.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Ex: Implementar proteção coletiva" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.priority} onChange={e => set("priority", e.target.value)}>
                  <option value="urgente">Urgente</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável</Label>
                <Input className="mt-1" value={form.responsible} onChange={e => set("responsible", e.target.value)} placeholder="Nome / cargo" />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" className="mt-1" value={form.prazo} onChange={e => set("prazo", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" rows={3} value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Detalhes da tarefa..." />
            </div>
            {editing && (
              <div>
                <Label>Status</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.status} onChange={e => set("status", e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}