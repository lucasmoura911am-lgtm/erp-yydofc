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
import { AlertTriangle, Trash2, Plus, Edit, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

const TYPE_COLORS = { fisico: "bg-blue-100 text-blue-800", quimico: "bg-purple-100 text-purple-800", biologico: "bg-emerald-100 text-emerald-800", ergonomico: "bg-amber-100 text-amber-800", acidente: "bg-red-100 text-red-800" };
const TYPE_LABELS = { fisico: "Físico", quimico: "Químico", biologico: "Biológico", ergonomico: "Ergonômico", acidente: "Acidente" };
const LEVEL_COLORS = { baixo: "bg-green-100 text-green-800", medio: "bg-yellow-100 text-yellow-800", alto: "bg-orange-100 text-orange-800", critico: "bg-red-100 text-red-800" };
const LEVEL_LABELS = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };

// Mapeamento numérico para cálculo automático de nível
const PROB_NUM = { baixa: 1, media: 2, alta: 3 };
const SEV_NUM = { leve: 1, moderada: 2, grave: 3, gravissima: 3 };

function calcRiskLevel(probability, severity) {
  const p = PROB_NUM[probability] || 1;
  const s = SEV_NUM[severity] || 1;
  const score = p * s;
  if (score <= 3) return "baixo";
  if (score <= 6) return "medio";
  return "alto";
}

const EMPTY_FORM = {
  risk_name: "", risk_type: "fisico", risk_description: "",
  probability: "baixa", severity: "leve", control_measures: ""
};

export default function NR01Risks({ user, risks, contracts, clients, selectedContract }) {
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [autoCreating, setAutoCreating] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const calculatedLevel = calcRiskLevel(form.probability, form.severity);

  // Após criar/editar risco, dispara automações se nível médio/alto
  const autoCreateActionAndTask = async (risk) => {
    if (risk.risk_level !== "medio" && risk.risk_level !== "alto") return;
    setAutoCreating(true);
    try {
      const prazosDias = { medio: 30, alto: 15 };
      const dias = prazosDias[risk.risk_level] || 30;
      const prazo = new Date();
      prazo.setDate(prazo.getDate() + dias);
      const prazoStr = prazo.toISOString().split("T")[0];

      // 1. Criar RiskActionPlan
      const action = await base44.entities.RiskActionPlan.create({
        company_id: risk.company_id,
        contract_id: risk.contract_id || "",
        risk_id: risk.id,
        action_description: `Controle de risco: ${risk.risk_name}`,
        responsible: "Responsável SST",
        deadline: prazoStr,
        status: "pendente",
        priority: risk.risk_level === "alto" ? "urgente" : "alta",
        legal_obligation: true,
        notes: `Gerado automaticamente. Nível: ${LEVEL_LABELS[risk.risk_level]}. ${risk.risk_description || ""}`
      });

      // 2. Criar TarefaNR01 vinculada à ação
      await base44.entities.TarefaNR01.create({
        titulo: `[AÇÃO NR-01] ${risk.risk_name}`,
        descricao: `Implementar medidas de controle para o risco identificado: ${risk.risk_description || risk.risk_name}`,
        tipo: "acao",
        referencia_id: action.id,
        referencia_tipo: "RiskActionPlan",
        responsible: "Responsável SST",
        company_id: risk.company_id,
        contract_id: risk.contract_id || "",
        prazo: prazoStr,
        status: "pendente",
        priority: risk.risk_level === "alto" ? "urgente" : "alta"
      });

      qc.invalidateQueries(["actions"]);
      qc.invalidateQueries(["nr01_tasks"]);
      toast.success(`Risco ${LEVEL_LABELS[risk.risk_level]}: ação e tarefa geradas automaticamente!`);
    } catch (e) {
      console.error("Erro na automação:", e);
    }
    setAutoCreating(false);
  };

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        risk_level: calcRiskLevel(data.probability, data.severity),
        company_id: user?.company_id || "",
        contract_id: selectedContract || "",
        active: true
      };
      return editing
        ? base44.entities.RiskInventory.update(editing.id, payload)
        : base44.entities.RiskInventory.create(payload);
    },
    onSuccess: async (saved) => {
      qc.invalidateQueries(["risks"]);
      toast.success(editing ? "Risco atualizado!" : "Risco criado!");
      resetForm();
      // Automação: criar ação + tarefa se nível médio/alto
      if (!editing) await autoCreateActionAndTask(saved);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RiskInventory.delete(id),
    onSuccess: () => { qc.invalidateQueries(["risks"]); toast.success("Risco removido!"); }
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setDialogOpen(false); };

  const handleEdit = (r) => {
    setEditing(r);
    setForm({
      risk_name: r.risk_name, risk_type: r.risk_type, risk_description: r.risk_description || "",
      probability: r.probability || "baixa", severity: r.severity || "leve",
      control_measures: r.control_measures || ""
    });
    setDialogOpen(true);
  };

  const filtered = risks.filter(r => {
    if (filterType && r.risk_type !== filterType) return false;
    if (filterLevel && r.risk_level !== filterLevel) return false;
    return true;
  });

  const stats = {
    total: risks.length,
    critico: risks.filter(r => r.risk_level === "critico").length,
    alto: risks.filter(r => r.risk_level === "alto").length,
    medio: risks.filter(r => r.risk_level === "medio").length,
    baixo: risks.filter(r => r.risk_level === "baixo").length,
  };

  const criticalCount = stats.critico + stats.alto;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", val: stats.total, color: "gray" },
          { label: "Crítico", val: stats.critico, color: "red" },
          { label: "Alto", val: stats.alto, color: "orange" },
          { label: "Médio", val: stats.medio, color: "yellow" },
          { label: "Baixo", val: stats.baixo, color: "green" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold text-${s.color}-600`}>{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {criticalCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{criticalCount} risco(s) de nível ALTO/CRÍTICO identificados</p>
            <p className="text-xs text-red-600 mt-0.5">Exigem AÇÃO IMEDIATA conforme NR-01. Ações e tarefas geradas automaticamente.</p>
          </div>
        </div>
      )}

      {/* Filtros + botão */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="border rounded-md px-3 py-1.5 text-sm" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
            <option value="">Todos os níveis</option>
            {Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="text-sm text-gray-500 flex items-center">{filtered.length} risco(s)</span>
        </div>
        <Button className="gap-2" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Risco
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risco</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Nível (auto)</TableHead>
                <TableHead>Controles</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  Nenhum risco mapeado. Clique em "Novo Risco" ou faça upload do PGR.
                </TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.id} className={(r.risk_level === "critico" || r.risk_level === "alto") ? "bg-red-50/50" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.risk_name}</div>
                    {r.risk_description && <div className="text-xs text-gray-400 max-w-[200px] truncate">{r.risk_description}</div>}
                    {(r.risk_level === "alto" || r.risk_level === "critico") && (
                      <Badge className="bg-red-600 text-white text-xs mt-1">AÇÃO OBRIGATÓRIA</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge className={TYPE_COLORS[r.risk_type] || "bg-gray-100"}>{TYPE_LABELS[r.risk_type] || r.risk_type}</Badge></TableCell>
                  <TableCell className="capitalize text-sm">{r.probability || "—"}</TableCell>
                  <TableCell className="capitalize text-sm">{r.severity || "—"}</TableCell>
                  <TableCell><Badge className={LEVEL_COLORS[r.risk_level] || "bg-gray-100"}>{LEVEL_LABELS[r.risk_level] || r.risk_level}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-[150px]">
                    {r.control_measures
                      ? <span title={r.control_measures}>{r.control_measures.slice(0, 60)}{r.control_measures.length > 60 ? "..." : ""}</span>
                      : <span className="text-red-400">Sem controle</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir risco?")) deleteMutation.mutate(r.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Risco" : "Novo Risco Ocupacional"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Nome do Risco *</Label>
              <Input required className="mt-1" value={form.risk_name} onChange={e => set("risk_name", e.target.value)} placeholder="Ex: Exposição a ruído elevado" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Risco *</Label>
                <select required className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.risk_type} onChange={e => set("risk_type", e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                {/* Preview do nível calculado */}
                <Label>Nível Calculado</Label>
                <div className="mt-1 flex items-center gap-2 h-9">
                  <Badge className={`${LEVEL_COLORS[calculatedLevel]} text-sm px-3 py-1`}>
                    {LEVEL_LABELS[calculatedLevel]}
                  </Badge>
                  {(calculatedLevel === "medio" || calculatedLevel === "alto") && (
                    <span className="text-xs text-orange-600 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Auto-ação
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probabilidade</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.probability} onChange={e => set("probability", e.target.value)}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <Label>Severidade</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.severity} onChange={e => set("severity", e.target.value)}>
                  <option value="leve">Leve</option>
                  <option value="moderada">Moderada</option>
                  <option value="grave">Grave</option>
                  <option value="gravissima">Gravíssima</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" rows={2} value={form.risk_description} onChange={e => set("risk_description", e.target.value)} placeholder="Descreva o risco identificado..." />
            </div>

            <div>
              <Label>Medidas de Controle</Label>
              <Textarea className="mt-1" rows={2} value={form.control_measures} onChange={e => set("control_measures", e.target.value)} placeholder="EPC, EPI, medidas administrativas..." />
            </div>

            {(calculatedLevel === "medio" || calculatedLevel === "alto") && !editing && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
                ⚡ <strong>Automação ativa:</strong> ao salvar, um Plano de Ação e uma Tarefa NR-01 serão criados automaticamente.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending || autoCreating}>
                {(saveMutation.isPending || autoCreating) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {autoCreating ? "Gerando ações..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}