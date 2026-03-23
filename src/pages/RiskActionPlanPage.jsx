import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, Edit, Trash2, CheckCircle, Paperclip } from "lucide-react";
import ActionConclusionModal from "@/components/safety/ActionConclusionModal";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";

const STATUS_COLORS = { pendente: "bg-gray-100 text-gray-800", em_andamento: "bg-blue-100 text-blue-800", concluido: "bg-green-100 text-green-800" };
const STATUS_LABELS = { pendente: "Pendente", em_andamento: "Em Andamento", concluido: "Concluído" };
const PRIORITY_COLORS = { baixa: "bg-gray-100 text-gray-600", media: "bg-yellow-100 text-yellow-800", alta: "bg-orange-100 text-orange-800", urgente: "bg-red-100 text-red-800" };
const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const RISK_TYPE_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };

const emptyForm = { risk_id: "", action_description: "", responsible: "", deadline: "", completion_date: "", status: "pendente", priority: "media", notes: "" };

export default function RiskActionPlanPage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("");
  const [conclusionAction, setConclusionAction] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const qc = useQueryClient();

  const { data: actions = [] } = useQuery({ queryKey: ["actions"], queryFn: () => base44.entities.RiskActionPlan.list(), enabled: !!user });
  const { data: risks = [] } = useQuery({ queryKey: ["risks"], queryFn: () => base44.entities.RiskInventory.list(), enabled: !!user });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.RiskActionPlan.update(editing.id, data) : base44.entities.RiskActionPlan.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { qc.invalidateQueries(["actions"]); toast.success("Ação salva!"); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RiskActionPlan.delete(id),
    onSuccess: () => { qc.invalidateQueries(["actions"]); toast.success("Ação removida!"); }
  });

  const resetForm = () => { setFormData(emptyForm); setEditing(null); setDialogOpen(false); };
  const handleEdit = (a) => { setEditing(a); setFormData({ risk_id: a.risk_id, action_description: a.action_description, responsible: a.responsible, deadline: a.deadline || "", completion_date: a.completion_date || "", status: a.status, priority: a.priority, notes: a.notes || "" }); setDialogOpen(true); };

  const getRiskLabel = (rid) => { const r = risks.find(x => x.id === rid); return r ? `${r.risk_name} (${RISK_TYPE_LABELS[r.risk_type] || r.risk_type})` : "—"; };

  const filtered = actions.filter(a => !filterStatus || a.status === filterStatus);

  const isOverdue = (a) => a.deadline && isBefore(new Date(a.deadline), new Date()) && a.status !== "concluido";

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plano de Ação (PGR)</h1>
            <p className="text-gray-500 text-sm">Ações corretivas e preventivas para os riscos mapeados</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Ação</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <Card key={k} className={`cursor-pointer border-2 ${filterStatus === k ? 'border-purple-400' : 'border-transparent'}`} onClick={() => setFilterStatus(filterStatus === k ? "" : k)}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{actions.filter(a => a.status === k).length}</div>
              <div className="text-sm text-gray-500">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Risco Vinculado</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Evidência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">Nenhuma ação cadastrada</TableCell></TableRow>}
              {filtered.map(a => (
                <TableRow key={a.id} className={isOverdue(a) ? "bg-red-50" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{a.action_description}</div>
                    {a.notes && <div className="text-xs text-gray-400">{a.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{getRiskLabel(a.risk_id)}</TableCell>
                  <TableCell className="text-sm">{a.responsible}</TableCell>
                  <TableCell>
                    <div className={`text-sm ${isOverdue(a) ? "text-red-600 font-medium" : ""}`}>
                      {a.deadline ? format(new Date(a.deadline), "dd/MM/yyyy") : "—"}
                    </div>
                    {isOverdue(a) && <div className="text-xs text-red-500">Vencido</div>}
                  </TableCell>
                  <TableCell><Badge className={PRIORITY_COLORS[a.priority]}>{PRIORITY_LABELS[a.priority]}</Badge></TableCell>
                  <TableCell><Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge></TableCell>
                  <TableCell>
                    {a.evidence_url ? (
                      <a href={a.evidence_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-purple-600 hover:underline">
                        <Paperclip className="w-3 h-3" /> Ver
                      </a>
                    ) : a.assinatura_url ? (
                      <a href={a.assinatura_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                        <CheckCircle className="w-3 h-3" /> Assinado
                      </a>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status !== "concluido" && (
                      <Button variant="ghost" size="icon" title="Concluir com assinatura" onClick={() => setConclusionAction(a)}>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir ação?")) deleteMutation.mutate(a.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Ação" : "Nova Ação do Plano"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div>
              <Label>Risco Vinculado *</Label>
              <select required className="w-full border rounded-md px-3 py-2 text-sm" value={formData.risk_id} onChange={e => set("risk_id", e.target.value)}>
                <option value="">Selecione o risco...</option>
                {risks.map(r => <option key={r.id} value={r.id}>{getRiskLabel(r.id)}</option>)}
              </select>
            </div>
            <div>
              <Label>Descrição da Ação *</Label>
              <Textarea required value={formData.action_description} onChange={e => set("action_description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsável *</Label>
                <Input required value={formData.responsible} onChange={e => set("responsible", e.target.value)} />
              </div>
              <div>
                <Label>Prazo *</Label>
                <Input required type="date" value={formData.deadline} onChange={e => set("deadline", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={v => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.status === "concluido" && (
              <div>
                <Label>Data de Conclusão</Label>
                <Input type="date" value={formData.completion_date} onChange={e => set("completion_date", e.target.value)} />
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Textarea value={formData.notes} onChange={e => set("notes", e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ActionConclusionModal
        action={conclusionAction}
        open={!!conclusionAction}
        onClose={() => setConclusionAction(null)}
        onSaved={() => qc.invalidateQueries(["actions"])}
      />
    </div>
  );
}
}