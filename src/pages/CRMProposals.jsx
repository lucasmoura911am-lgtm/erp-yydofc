import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, FileText, Send, Check, X, Download, Trash } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS = { rascunho: "bg-gray-100 text-gray-600", enviada: "bg-blue-100 text-blue-700", aprovada: "bg-green-100 text-green-700", rejeitada: "bg-red-100 text-red-700", expirada: "bg-orange-100 text-orange-700" };
const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const emptyForm = {
  title: "", account_id: "", opportunity_id: "", contact_id: "", number: "",
  items: [], total_value: 0, discount: 0, final_value: 0,
  validity_date: "", status: "rascunho", notes: "", responsible_email: "", sent_date: ""
};
const emptyItem = { description: "", quantity: 1, unit_price: "", total: 0 };

export default function CRMProposals() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: proposals = [] } = useQuery({ queryKey: ["crm_prop", cid], queryFn: () => base44.entities.CRMProposal.filter({ company_id: cid }), enabled: !!cid });
  const { data: accounts = [] } = useQuery({ queryKey: ["crm_acc", cid], queryFn: () => base44.entities.CRMAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });
  const { data: contacts = [] } = useQuery({ queryKey: ["crm_cont", cid], queryFn: () => base44.entities.CRMContact.filter({ company_id: cid }), enabled: !!cid });

  const totalValue = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price || 0)), 0);
  const discount = parseFloat(formData.discount) || 0;
  const finalValue = totalValue - discount;

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.CRMProposal.create({ ...d, company_id: cid }),
    onSuccess: () => { qc.invalidateQueries(["crm_prop"]); toast.success("Proposta criada!"); setDialogOpen(false); resetForm(); }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => base44.entities.CRMProposal.update(id, d),
    onSuccess: () => { qc.invalidateQueries(["crm_prop"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); resetForm(); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CRMProposal.delete(id),
    onSuccess: () => { qc.invalidateQueries(["crm_prop"]); toast.success("Excluído!"); }
  });

  const resetForm = () => { setFormData(emptyForm); setItems([]); setEditing(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const computedItems = items.map(i => ({ ...i, total: parseFloat(i.quantity) * parseFloat(i.unit_price || 0) }));
    const d = { ...formData, items: computedItems, total_value: totalValue, discount, final_value: finalValue };
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  const openEdit = (p) => {
    setEditing(p);
    setFormData({ ...emptyForm, ...p });
    setItems(p.items || []);
    setDialogOpen(true);
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const updateItem = (i, field, val) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const markStatus = (p, status) => {
    updateMutation.mutate({ id: p.id, d: { ...p, status, sent_date: status === "enviada" ? format(new Date(), "yyyy-MM-dd") : p.sent_date } });
  };

  const exportPDF = async (p) => {
    const acc = accounts.find(a => a.id === p.account_id);
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("PROPOSTA COMERCIAL", 20, 20);
    doc.setFontSize(12); doc.text(`Nº: ${p.number || p.id.slice(0,8)}`, 20, 32);
    doc.text(`Cliente: ${acc?.trade_name || acc?.legal_name || "—"}`, 20, 42);
    doc.text(`Título: ${p.title}`, 20, 52);
    doc.text(`Data: ${p.created_date?.slice(0,10) || "—"} | Validade: ${p.validity_date || "—"}`, 20, 62);
    let y = 78;
    doc.setFontSize(11); doc.text("ITENS", 20, y); y += 8;
    (p.items || []).forEach((item, i) => {
      doc.setFontSize(10);
      doc.text(`${i+1}. ${item.description} — ${item.quantity}x ${fmt(item.unit_price)} = ${fmt(item.total)}`, 20, y);
      y += 7;
    });
    y += 5;
    doc.setFontSize(12);
    doc.text(`Subtotal: ${fmt(p.total_value)}`, 20, y); y += 8;
    if (p.discount > 0) { doc.text(`Desconto: -${fmt(p.discount)}`, 20, y); y += 8; }
    doc.setFontSize(14); doc.text(`TOTAL: ${fmt(p.final_value || p.total_value)}`, 20, y);
    if (p.notes) { y += 15; doc.setFontSize(10); doc.text(`Obs: ${p.notes}`, 20, y); }
    doc.save(`proposta-${p.number || p.id.slice(0,8)}.pdf`);
    toast.success("PDF gerado!");
  };

  const sendByEmail = async (p) => {
    const acc = accounts.find(a => a.id === p.account_id);
    if (!acc?.email) { toast.error("Empresa sem e-mail cadastrado"); return; }
    await base44.integrations.Core.SendEmail({
      to: acc.email,
      subject: `Proposta Comercial — ${p.title}`,
      body: `Olá,\n\nSegue nossa proposta comercial: ${p.title}\nValor total: ${fmt(p.final_value || p.total_value)}\nValidade: ${p.validity_date || "—"}\n\n${p.notes || ""}`
    });
    markStatus(p, "enviada");
    toast.success("Proposta enviada por e-mail!");
  };

  const filtered = proposals.filter(p => filterStatus === "all" || p.status === filterStatus).sort((a, b) => b.created_date?.localeCompare(a.created_date));

  const totalProposals = proposals.length;
  const totalSent = proposals.filter(p => p.status === "enviada").length;
  const totalApproved = proposals.filter(p => p.status === "aprovada").length;
  const totalValue2 = proposals.filter(p => p.status === "aprovada").reduce((s, p) => s + (p.final_value || p.total_value || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Propostas Comerciais</h1>
          <p className="text-gray-500 text-sm">{totalProposals} propostas · {totalApproved} aprovadas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> Nova Proposta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Proposta</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Título *</Label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required /></div>
                <div><Label>Número</Label><Input value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} placeholder="PROP-001" /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["rascunho","enviada","aprovada","rejeitada","expirada"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={formData.account_id || "none"} onValueChange={v => setFormData({ ...formData, account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.trade_name || a.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Oportunidade</Label>
                  <Select value={formData.opportunity_id || "none"} onValueChange={v => setFormData({ ...formData, opportunity_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{opportunities.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Validade</Label><Input type="date" value={formData.validity_date} onChange={e => setFormData({ ...formData, validity_date: e.target.value })} /></div>
                <div><Label>Desconto (R$)</Label><Input type="number" step="0.01" value={formData.discount} onChange={e => setFormData({ ...formData, discount: e.target.value })} /></div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Itens / Produtos</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Item</Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                      <div className="col-span-5"><Input placeholder="Descrição" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="text-sm" /></div>
                      <div className="col-span-2"><Input type="number" placeholder="Qtd" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="text-sm" /></div>
                      <div className="col-span-3"><Input type="number" placeholder="Preço unit." value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="text-sm" /></div>
                      <div className="col-span-1 text-xs font-semibold text-gray-600">{fmt(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0))}</div>
                      <div className="col-span-1"><Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeItem(i)}><Trash className="w-3 h-3 text-red-400" /></Button></div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Adicione itens à proposta</p>}
                </div>
                {items.length > 0 && (
                  <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-semibold">{fmt(totalValue)}</span></div>
                    {discount > 0 && <div className="flex justify-between"><span className="text-gray-600">Desconto:</span><span className="text-red-600">-{fmt(discount)}</span></div>}
                    <div className="flex justify-between text-base font-bold mt-1 border-t pt-1"><span>Total:</span><span className="text-indigo-700">{fmt(finalValue)}</span></div>
                  </div>
                )}
              </div>

              <div><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{totalProposals}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Enviadas</p><p className="text-xl font-bold text-blue-600">{totalSent}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Aprovadas</p><p className="text-xl font-bold text-green-600">{totalApproved}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Receita Aprovada</p><p className="text-xl font-bold text-indigo-600">{fmt(totalValue2)}</p></CardContent></Card>
      </div>

      {/* Filter */}
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {["rascunho","enviada","aprovada","rejeitada","expirada"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Nº", "Título", "Empresa", "Valor Total", "Validade", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(p => {
                  const acc = accounts.find(a => a.id === p.account_id);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.number || p.id.slice(0,8)}</td>
                      <td className="px-4 py-3 font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-gray-600">{acc?.trade_name || acc?.legal_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">{fmt(p.final_value || p.total_value)}</td>
                      <td className="px-4 py-3 text-gray-500">{p.validity_date || "—"}</td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7" title="Exportar PDF" onClick={() => exportPDF(p)}><Download className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" title="Enviar por e-mail" onClick={() => sendByEmail(p)}><Send className="w-3.5 h-3.5 text-blue-500" /></Button>
                          {p.status === "enviada" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 text-green-600" title="Aprovar" onClick={() => markStatus(p, "aprovada")}><Check className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 text-red-500" title="Rejeitar" onClick={() => markStatus(p, "rejeitada")}><X className="w-3.5 h-3.5" /></Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(p)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhuma proposta</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}