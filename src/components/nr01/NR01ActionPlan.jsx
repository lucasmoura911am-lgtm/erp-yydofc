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
import { CheckCircle2, Clock, AlertTriangle, Upload, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";

const STATUS_COLORS = { pendente: "bg-gray-100 text-gray-700", em_andamento: "bg-blue-100 text-blue-700", concluido: "bg-green-100 text-green-700" };
const STATUS_LABELS = { pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído" };
const PRIO_COLORS = { baixa: "bg-gray-100 text-gray-600", media: "bg-blue-100 text-blue-700", alta: "bg-orange-100 text-orange-700", urgente: "bg-red-100 text-red-700" };

export default function NR01ActionPlan({ user, actions, risks, contracts, clients, selectedContract }) {
  const qc = useQueryClient();
  const [conclusionOpen, setConclusionOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [conclusion, setConclusion] = useState({ status: "concluido", completion_date: "", conclusao_observacao: "", evidence_url: "" });
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPrio, setFilterPrio] = useState("");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RiskActionPlan.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["actions"]); toast.success("Ação atualizada!"); setConclusionOpen(false); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RiskActionPlan.delete(id),
    onSuccess: () => { qc.invalidateQueries(["actions"]); toast.success("Removido!"); }
  });

  const handleEvidenceUpload = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setConclusion(c => ({ ...c, evidence_url: file_url }));
      toast.success("Evidência enviada!");
    } catch (e) {
      toast.error("Erro no upload");
    }
    setUploading(false);
  };

  const handleConclude = () => {
    if (!selectedAction) return;
    updateMutation.mutate({
      id: selectedAction.id,
      data: { status: conclusion.status, completion_date: conclusion.completion_date, conclusao_observacao: conclusion.conclusao_observacao, evidence_url: conclusion.evidence_url }
    });
  };

  const openConclusion = (action) => {
    setSelectedAction(action);
    setConclusion({ status: "concluido", completion_date: new Date().toISOString().split("T")[0], conclusao_observacao: "", evidence_url: action.evidence_url || "" });
    setConclusionOpen(true);
  };

  const isOverdue = (a) => a.deadline && isBefore(new Date(a.deadline), new Date()) && a.status !== "concluido";

  const filtered = actions.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterPrio && a.priority !== filterPrio) return false;
    return true;
  });

  const stats = {
    total: actions.length,
    concluido: actions.filter(a => a.status === "concluido").length,
    atrasado: actions.filter(isOverdue).length,
    pendente: actions.filter(a => a.status === "pendente" && !isOverdue(a)).length,
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", val: stats.total, color: "gray" },
          { label: "Concluídas", val: stats.concluido, color: "green" },
          { label: "Pendentes", val: stats.pendente, color: "blue" },
          { label: "Atrasadas", val: stats.atrasado, color: "red" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold text-${s.color}-600`}>{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select className="border rounded-md px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
        </select>
        <select className="border rounded-md px-3 py-1.5 text-sm" value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
          <option value="">Todas as prioridades</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <span className="text-sm text-gray-500 flex items-center">{filtered.length} ação(ões)</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-10">
                  Nenhuma ação encontrada. Faça upload do PGR para gerar ações automaticamente.
                </TableCell></TableRow>
              )}
              {filtered.map(a => (
                <TableRow key={a.id} className={isOverdue(a) ? "bg-red-50" : ""}>
                  <TableCell className="max-w-[280px]">
                    <div className="font-medium text-sm">{a.action_description}</div>
                    {a.notes && <div className="text-xs text-gray-400 truncate">{a.notes}</div>}
                    {a.legal_obligation && <Badge className="bg-purple-100 text-purple-700 text-xs mt-1">Obrigação Legal</Badge>}
                  </TableCell>
                  <TableCell><Badge className={PRIO_COLORS[a.priority] || "bg-gray-100"}>{a.priority || "—"}</Badge></TableCell>
                  <TableCell className={`text-sm ${isOverdue(a) ? "text-red-600 font-semibold" : ""}`}>
                    {a.deadline ? format(new Date(a.deadline), "dd/MM/yyyy") : "—"}
                    {isOverdue(a) && <div className="text-xs text-red-500">ATRASADA</div>}
                  </TableCell>
                  <TableCell className="text-sm">{a.responsible || "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status] || a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {a.status !== "concluido" && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs text-green-700 border-green-300" onClick={() => openConclusion(a)}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Registrar
                        </Button>
                      )}
                      {a.evidence_url && (
                        <a href={a.evidence_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="text-xs">📎</Button>
                        </a>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(a.id); }}>
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

      {/* Modal de conclusão */}
      <Dialog open={conclusionOpen} onOpenChange={setConclusionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Execução da Ação</DialogTitle></DialogHeader>
          {selectedAction && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                {selectedAction.action_description}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={conclusion.status} onChange={e => setConclusion(c => ({ ...c, status: e.target.value }))}>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
                <div>
                  <Label>Data de execução</Label>
                  <Input type="date" className="mt-1" value={conclusion.completion_date} onChange={e => setConclusion(c => ({ ...c, completion_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Observação / Evidência</Label>
                <Textarea className="mt-1" rows={3} value={conclusion.conclusao_observacao} onChange={e => setConclusion(c => ({ ...c, conclusao_observacao: e.target.value }))} placeholder="Descreva o que foi realizado..." />
              </div>
              <div>
                <Label>Anexar comprovante (foto/PDF)</Label>
                <div className="mt-1 flex gap-2 items-center">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" onChange={e => e.target.files[0] && handleEvidenceUpload(e.target.files[0])} />
                  {uploading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {conclusion.evidence_url && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConclusionOpen(false)}>Cancelar</Button>
                <Button onClick={handleConclude} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}