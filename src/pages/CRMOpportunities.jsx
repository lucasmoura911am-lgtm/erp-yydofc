import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Search, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";

const STAGE_LABELS = { lead_novo: "Lead Novo", contato_realizado: "Contato", diagnostico: "Diagnóstico", proposta_enviada: "Proposta", negociacao: "Negociação", fechado_ganho: "Ganho ✓", fechado_perdido: "Perdido ✗" };
const STAGE_COLORS = { lead_novo: "bg-gray-100 text-gray-700", contato_realizado: "bg-blue-100 text-blue-700", diagnostico: "bg-purple-100 text-purple-700", proposta_enviada: "bg-yellow-100 text-yellow-700", negociacao: "bg-orange-100 text-orange-700", fechado_ganho: "bg-green-100 text-green-700", fechado_perdido: "bg-red-100 text-red-700" };
const PROB_MAP = { lead_novo: 10, contato_realizado: 20, diagnostico: 40, proposta_enviada: 60, negociacao: 80, fechado_ganho: 100, fechado_perdido: 0 };
const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

const emptyForm = { title: "", account_id: "", contact_id: "", lead_id: "", product: "", value: "", probability: 50, stage: "lead_novo", close_date: "", responsible_name: "", responsible_email: "", origin: "", lost_reason: "", notes: "" };

export default function CRMOpportunities() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });
  const { data: accounts = [] } = useQuery({ queryKey: ["crm_acc", cid], queryFn: () => base44.entities.CRMAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: contacts = [] } = useQuery({ queryKey: ["crm_cont", cid], queryFn: () => base44.entities.CRMContact.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.CRMOpportunity.create({ ...d, company_id: cid }),
    onSuccess: () => { qc.invalidateQueries(["crm_opp"]); toast.success("Oportunidade criada!"); setDialogOpen(false); setFormData(emptyForm); }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => base44.entities.CRMOpportunity.update(id, d),
    onSuccess: () => { qc.invalidateQueries(["crm_opp"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CRMOpportunity.delete(id),
    onSuccess: () => { qc.invalidateQueries(["crm_opp"]); toast.success("Excluído!"); }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const d = { ...formData, value: parseFloat(formData.value) || 0, probability: parseInt(formData.probability) || 0 };
    d.expected_revenue = d.value * d.probability / 100;
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  const openEdit = (o) => { setEditing(o); setFormData({ ...emptyForm, ...o }); setDialogOpen(true); };

  const filtered = opportunities.filter(o => {
    const ms = o.title?.toLowerCase().includes(search.toLowerCase()) || accounts.find(a => a.id === o.account_id)?.trade_name?.toLowerCase().includes(search.toLowerCase());
    const st = filterStage === "all" || o.stage === filterStage;
    return ms && st;
  });

  const totalPipeline = filtered.filter(o => !["fechado_ganho","fechado_perdido"].includes(o.stage)).reduce((s,o) => s + (o.value||0), 0);
  const totalExpected = filtered.filter(o => !["fechado_ganho","fechado_perdido"].includes(o.stage)).reduce((s,o) => s + ((o.value||0)*(o.probability||0)/100), 0);
  const totalWon = filtered.filter(o => o.stage === "fechado_ganho").reduce((s,o) => s + (o.value||0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Oportunidades</h1>
          <p className="text-gray-500 text-sm">{opportunities.length} oportunidades · Pipeline: {fmt(totalPipeline)}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> Nova Oportunidade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Oportunidade</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Título *</Label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required /></div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={formData.account_id || "none"} onValueChange={v => setFormData({ ...formData, account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.trade_name || a.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contato</Label>
                  <Select value={formData.contact_id || "none"} onValueChange={v => setFormData({ ...formData, contact_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Produto / Serviço</Label><Input value={formData.product} onChange={e => setFormData({ ...formData, product: e.target.value })} /></div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} /></div>
                <div><Label>Probabilidade (%)</Label><Input type="number" min={0} max={100} value={formData.probability} onChange={e => setFormData({ ...formData, probability: e.target.value })} /></div>
                <div>
                  <Label>Etapa</Label>
                  <Select value={formData.stage} onValueChange={v => setFormData({ ...formData, stage: v, probability: PROB_MAP[v] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STAGE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Previsão Fechamento</Label><Input type="date" value={formData.close_date} onChange={e => setFormData({ ...formData, close_date: e.target.value })} /></div>
                <div><Label>Responsável</Label><Input value={formData.responsible_name} onChange={e => setFormData({ ...formData, responsible_name: e.target.value })} /></div>
                <div>
                  <Label>Origem</Label>
                  <Select value={formData.origin || "none"} onValueChange={v => setFormData({ ...formData, origin: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{["site","indicacao","linkedin","google_ads","cold_call","evento","email_marketing","whatsapp","outro"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {formData.stage === "fechado_perdido" && <div className="col-span-2"><Label>Motivo da Perda</Label><Input value={formData.lost_reason} onChange={e => setFormData({ ...formData, lost_reason: e.target.value })} /></div>}
                <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
              </div>
              {(formData.value && formData.probability) ? (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm flex justify-between">
                  <span className="text-gray-600">Receita prevista ponderada:</span>
                  <span className="font-bold text-indigo-700">{fmt((parseFloat(formData.value)||0) * (parseInt(formData.probability)||0) / 100)}</span>
                </div>
              ) : null}
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Pipeline Total</p><p className="text-lg font-bold text-indigo-700">{fmt(totalPipeline)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Receita Prevista (ponderada)</p><p className="text-lg font-bold text-blue-700">{fmt(totalExpected)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Ganho (filtro)</p><p className="text-lg font-bold text-green-700">{fmt(totalWon)}</p></CardContent></Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar oportunidade..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {Object.entries(STAGE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>{["Título", "Empresa", "Produto", "Valor", "Prob.", "Prev. Receita", "Fechamento", "Etapa", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(o => {
                  const acc = accounts.find(a => a.id === o.account_id);
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium max-w-xs truncate">{o.title}</td>
                      <td className="px-4 py-3 text-indigo-600 text-sm">{acc?.trade_name || acc?.legal_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{o.product || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{fmt(o.value)}</td>
                      <td className="px-4 py-3 text-center"><Badge variant="outline" className="text-xs">{o.probability}%</Badge></td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{fmt(o.expected_revenue || (o.value * o.probability / 100))}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{o.close_date || "—"}</td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${STAGE_COLORS[o.stage]}`}>{STAGE_LABELS[o.stage]}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(o)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(o.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-gray-400">Nenhuma oportunidade</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}