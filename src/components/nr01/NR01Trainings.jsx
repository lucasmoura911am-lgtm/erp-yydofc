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
import { BookOpen, Plus, Edit, Trash2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, differenceInDays } from "date-fns";

const TIPO_LABELS = { inicial: "Inicial", periodico: "Periódico", dds: "DDS", sipat: "SIPAT", integracao: "Integração", reciclagem: "Reciclagem" };
const STATUS_COLORS = { agendado: "bg-blue-100 text-blue-700", realizado: "bg-green-100 text-green-700", cancelado: "bg-gray-100 text-gray-700" };

export default function NR01Trainings({ user, trainings, employees, contracts, clients, selectedContract }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", tipo: "periodico", tema: "", nr_referencia: "", carga_horaria: 0, training_date: "", next_date: "", instrutor: "", status: "agendado", local: "", observations: "", participantes: [] });
  const [filterStatus, setFilterStatus] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.SSTTreinamento.update(editing.id, data)
      : base44.entities.SSTTreinamento.create({ ...data, company_id: user.company_id, contract_id: selectedContract || "" }),
    onSuccess: () => { qc.invalidateQueries(["sst_treinamentos"]); toast.success("Treinamento salvo!"); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SSTTreinamento.delete(id),
    onSuccess: () => { qc.invalidateQueries(["sst_treinamentos"]); toast.success("Removido!"); }
  });

  const resetForm = () => { setForm({ title: "", tipo: "periodico", tema: "", nr_referencia: "", carga_horaria: 0, training_date: "", next_date: "", instrutor: "", status: "agendado", local: "", observations: "", participantes: [] }); setEditing(null); setDialogOpen(false); };

  const handleEdit = (t) => {
    setEditing(t);
    setForm({ title: t.title, tipo: t.tipo, tema: t.tema || "", nr_referencia: t.nr_referencia || "", carga_horaria: t.carga_horaria || 0, training_date: t.training_date || "", next_date: t.next_date || "", instrutor: t.instrutor || "", status: t.status, local: t.local || "", observations: t.observations || "", participantes: t.participantes || [] });
    setDialogOpen(true);
  };

  const isOverdue = (t) => t.next_date && isBefore(new Date(t.next_date), new Date()) && t.status !== "realizado";

  const filtered = trainings.filter(t => !filterStatus || t.status === filterStatus);

  const stats = {
    total: trainings.length,
    realizado: trainings.filter(t => t.status === "realizado").length,
    agendado: trainings.filter(t => t.status === "agendado").length,
    vencido: trainings.filter(isOverdue).length,
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

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos status</option>
            <option value="agendado">Agendado</option>
            <option value="realizado">Realizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <Button className="gap-2" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Treinamento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treinamento</TableHead>
                <TableHead>NR / Tema</TableHead>
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
                  Nenhum treinamento registrado. Faça upload do PGR/PCMSO para importar automaticamente.
                </TableCell></TableRow>
              )}
              {filtered.map(t => (
                <TableRow key={t.id} className={isOverdue(t) ? "bg-red-50/50" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{t.title}</div>
                    {t.instrutor && <div className="text-xs text-gray-400">{t.instrutor}</div>}
                    {t.carga_horaria > 0 && <div className="text-xs text-gray-400">{t.carga_horaria}h</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.nr_referencia && <Badge variant="outline" className="text-xs mr-1">{t.nr_referencia}</Badge>}
                    {t.tema}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{TIPO_LABELS[t.tipo] || t.tipo}</Badge></TableCell>
                  <TableCell className="text-sm">{t.training_date ? format(new Date(t.training_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm">
                    {t.next_date ? format(new Date(t.next_date), "dd/MM/yyyy") : "—"}
                    {isOverdue(t) && <div className="text-xs text-red-500 mt-0.5">VENCIDO</div>}
                  </TableCell>
                  <TableCell><Badge className={STATUS_COLORS[t.status]}>{t.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(t.id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Treinamento" : "Novo Treinamento SST"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input required className="mt-1" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ex: NR-35 Trabalho em Altura" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label>NR de referência</Label>
                <Input className="mt-1" value={form.nr_referencia} onChange={e => set("nr_referencia", e.target.value)} placeholder="Ex: NR-35" />
              </div>
            </div>
            <div>
              <Label>Tema / Conteúdo</Label>
              <Input className="mt-1" value={form.tema} onChange={e => set("tema", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de realização</Label>
                <Input type="date" className="mt-1" value={form.training_date} onChange={e => set("training_date", e.target.value)} />
              </div>
              <div>
                <Label>Próxima data</Label>
                <Input type="date" className="mt-1" value={form.next_date} onChange={e => set("next_date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Instrutor</Label>
                <Input className="mt-1" value={form.instrutor} onChange={e => set("instrutor", e.target.value)} />
              </div>
              <div>
                <Label>Carga horária (h)</Label>
                <Input type="number" className="mt-1" value={form.carga_horaria} onChange={e => set("carga_horaria", Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="agendado">Agendado</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}