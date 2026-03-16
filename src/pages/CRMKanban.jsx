import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, User, Calendar, DollarSign, TrendingUp, Edit, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STAGES = [
  { id: "lead_novo", label: "Lead Novo", color: "bg-gray-100 border-gray-300", header: "bg-gray-500" },
  { id: "contato_realizado", label: "Contato Realizado", color: "bg-blue-50 border-blue-200", header: "bg-blue-500" },
  { id: "diagnostico", label: "Diagnóstico", color: "bg-purple-50 border-purple-200", header: "bg-purple-600" },
  { id: "proposta_enviada", label: "Proposta Enviada", color: "bg-yellow-50 border-yellow-200", header: "bg-yellow-500" },
  { id: "negociacao", label: "Negociação", color: "bg-orange-50 border-orange-200", header: "bg-orange-500" },
  { id: "fechado_ganho", label: "Fechado Ganho ✓", color: "bg-green-50 border-green-200", header: "bg-green-600" },
  { id: "fechado_perdido", label: "Fechado Perdido ✗", color: "bg-red-50 border-red-200", header: "bg-red-500" },
];

const PROB_MAP = { lead_novo: 10, contato_realizado: 20, diagnostico: 40, proposta_enviada: 60, negociacao: 80, fechado_ganho: 100, fechado_perdido: 0 };
const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

const emptyForm = {
  title: "", account_id: "", contact_id: "", product: "", value: "", probability: 50,
  stage: "lead_novo", close_date: "", responsible_name: "", responsible_email: "", origin: "", notes: "", lost_reason: ""
};

export default function CRMKanban() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [dragItem, setDragItem] = useState(null);
  const [filterSeller, setFilterSeller] = useState("all");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });
  const { data: accounts = [] } = useQuery({ queryKey: ["crm_acc", cid], queryFn: () => base44.entities.CRMAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: contacts = [] } = useQuery({ queryKey: ["crm_cont", cid], queryFn: () => base44.entities.CRMContact.filter({ company_id: cid }), enabled: !!cid });

  const sellers = [...new Set(opportunities.map(o => o.responsible_name || o.responsible_email).filter(Boolean))];

  const filtered = filterSeller === "all" ? opportunities : opportunities.filter(o => (o.responsible_name || o.responsible_email) === filterSeller);

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

  const handleDragStart = (opp) => setDragItem(opp);
  const handleDrop = (stageId) => {
    if (!dragItem || dragItem.stage === stageId) return;
    updateMutation.mutate({ id: dragItem.id, d: { ...dragItem, stage: stageId, probability: PROB_MAP[stageId] } });
    setDragItem(null);
  };

  const openEdit = (o) => { setEditing(o); setFormData({ ...emptyForm, ...o }); setDialogOpen(true); };

  const totalValue = (stageId) => filtered.filter(o => o.stage === stageId).reduce((s, o) => s + (o.value || 0), 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pipeline de Vendas</h1>
          <p className="text-gray-500 text-sm">{opportunities.length} oportunidades · {fmt(opportunities.filter(o => !["fechado_ganho","fechado_perdido"].includes(o.stage)).reduce((s,o)=>s+(o.value||0),0))} em pipeline</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterSeller} onValueChange={setFilterSeller}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Todos vendedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos vendedores</SelectItem>
              {sellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setFormData(emptyForm); setDialogOpen(true); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
            <Plus className="w-4 h-4 mr-2" /> Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "70vh" }}>
        {STAGES.map(stage => {
          const cards = filtered.filter(o => o.stage === stage.id);
          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-64 rounded-xl border-2 ${stage.color} flex flex-col`}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
            >
              {/* Column header */}
              <div className={`${stage.header} text-white rounded-t-lg px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{stage.label}</span>
                  <Badge className="bg-white/20 text-white text-xs">{cards.length}</Badge>
                </div>
                <p className="text-white/80 text-xs mt-0.5">{fmt(totalValue(stage.id))}</p>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
                {cards.map(opp => {
                  const account = accounts.find(a => a.id === opp.account_id);
                  return (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={() => handleDragStart(opp)}
                      className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          <p className="font-semibold text-xs text-gray-900 dark:text-gray-100 leading-tight line-clamp-2">{opp.title}</p>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEdit(opp)} className="p-0.5 hover:bg-gray-100 rounded"><Edit className="w-3 h-3 text-gray-400" /></button>
                          <button onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(opp.id); }} className="p-0.5 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                        </div>
                      </div>

                      {account && (
                        <p className="text-xs text-indigo-600 mt-1 truncate">{account.trade_name || account.legal_name}</p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{fmt(opp.value)}</span>
                        <Badge className="text-xs bg-indigo-50 text-indigo-700 border-0">{opp.probability}%</Badge>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                        {opp.responsible_name && (
                          <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{opp.responsible_name.split(" ")[0]}</span>
                        )}
                        {opp.close_date && (
                          <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{opp.close_date.slice(5)}</span>
                        )}
                      </div>

                      {opp.product && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{opp.product}</p>
                      )}
                    </div>
                  );
                })}

                {/* Add button */}
                <button
                  onClick={() => { setEditing(null); setFormData({ ...emptyForm, stage: stage.id, probability: PROB_MAP[stage.id] }); setDialogOpen(true); }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-lg py-2 border border-dashed border-gray-300 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Oportunidade</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="Ex: Proposta de Segurança - Empresa XYZ" />
              </div>
              <div>
                <Label>Empresa (Conta)</Label>
                <Select value={formData.account_id || "none"} onValueChange={v => setFormData({ ...formData, account_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.trade_name || a.legal_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contato</Label>
                <Select value={formData.contact_id || "none"} onValueChange={v => setFormData({ ...formData, contact_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem contato</SelectItem>
                    {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.title || ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produto / Serviço</Label>
                <Input value={formData.product} onChange={e => setFormData({ ...formData, product: e.target.value })} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
              </div>
              <div>
                <Label>Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={formData.probability} onChange={e => setFormData({ ...formData, probability: e.target.value })} />
              </div>
              <div>
                <Label>Etapa do Funil</Label>
                <Select value={formData.stage} onValueChange={v => setFormData({ ...formData, stage: v, probability: PROB_MAP[v] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Prevista Fechamento</Label>
                <Input type="date" value={formData.close_date} onChange={e => setFormData({ ...formData, close_date: e.target.value })} />
              </div>
              <div>
                <Label>Responsável (Nome)</Label>
                <Input value={formData.responsible_name} onChange={e => setFormData({ ...formData, responsible_name: e.target.value })} />
              </div>
              <div>
                <Label>Origem</Label>
                <Select value={formData.origin || "none"} onValueChange={v => setFormData({ ...formData, origin: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {["site","indicacao","linkedin","google_ads","cold_call","evento","email_marketing","whatsapp","outro"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formData.stage === "fechado_perdido" && (
                <div className="col-span-2">
                  <Label>Motivo da Perda</Label>
                  <Input value={formData.lost_reason} onChange={e => setFormData({ ...formData, lost_reason: e.target.value })} />
                </div>
              )}
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}