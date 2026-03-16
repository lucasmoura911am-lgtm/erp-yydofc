import React, { useState, useEffect, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Check, Search, Upload, AlertCircle, Clock, Layers } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";


const STATUS_COLORS = {
  pendente: "bg-yellow-100 text-yellow-700",
  pago: "bg-green-100 text-green-700",
  vencido: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-500"
};

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const emptyForm = {
  supplier_name: "", description: "", amount: "", due_date: "",
  payment_date: "", status: "pendente", category_id: "", cost_center_id: "",
  contract_id: "", bank_account_id: "", payment_method: "pix",
  attachment_url: "", notes: ""
};

export default function AccountsPayablePage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [installments, setInstallments] = useState({ enabled: false, count: 2 });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: payables = [] } = useQuery({ queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid });
  const { data: categories = [] } = useQuery({ queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid, type: "despesa" }), enabled: !!cid });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts", cid], queryFn: () => base44.entities.Contract.filter({ company_id: cid }), enabled: !!cid });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["ba", cid], queryFn: () => base44.entities.BankAccount.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (installments.enabled && !editing) {
        const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const amount = parseFloat(formData.amount) / installments.count;
        for (let i = 0; i < installments.count; i++) {
          const dueDate = new Date(formData.due_date + "T00:00:00");
          dueDate.setMonth(dueDate.getMonth() + i);
          await base44.entities.AccountsPayable.create({
            ...data,
            amount,
            due_date: format(dueDate, "yyyy-MM-dd"),
            description: `${data.description} (${i + 1}/${installments.count})`,
            installment_group: groupId,
            installment_number: i + 1,
            installment_total: installments.count
          });
        }
      } else {
        await base44.entities.AccountsPayable.create(data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(["ap"]);
      toast.success("Conta criada!");
      setDialogOpen(false);
      setFormData(emptyForm);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AccountsPayable.update(id, data),
    onSuccess: async (_, { id, data }) => {
      // Auto create cashflow on payment
      if (data.status === "pago" && data.payment_date) {
        await base44.entities.CashFlow.create({
          company_id: cid,
          date: data.payment_date,
          description: `Pagamento: ${data.supplier_name}`,
          amount: data.amount,
          type: "saida",
          source: "conta_pagar",
          reference_id: id,
          category_id: data.category_id,
          cost_center_id: data.cost_center_id,
          bank_account_id: data.bank_account_id
        });
      }
      qc.invalidateQueries(["ap"]);
      qc.invalidateQueries(["cf"]);
      toast.success("Conta atualizada!");
      setDialogOpen(false);
      setEditing(null);
      setFormData(emptyForm);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AccountsPayable.delete(id),
    onSuccess: () => { qc.invalidateQueries(["ap"]); toast.success("Excluído!"); }
  });

  const handleEdit = (p) => {
    setEditing(p);
    setFormData({ ...emptyForm, ...p });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, amount: parseFloat(formData.amount) || 0, company_id: cid };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, attachment_url: file_url }));
    setUploading(false);
    toast.success("Arquivo enviado!");
  };

  const markAsPaid = (p) => {
    updateMutation.mutate({
      id: p.id,
      data: { ...p, status: "pago", payment_date: format(new Date(), "yyyy-MM-dd") }
    });
  };

  // Auto update overdue
  const filtered = payables.map(p => {
    if (p.status === "pendente" && p.due_date && new Date(p.due_date + "T00:00:00") < new Date()) {
      return { ...p, status: "vencido" };
    }
    return p;
  }).filter(p => {
    const ms = p.supplier_name?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const st = filterStatus === "all" || p.status === filterStatus;
    return ms && st;
  });

  const totalPendente = filtered.filter(p => p.status === "pendente").reduce((s, p) => s + (p.amount || 0), 0);
  const totalVencido = filtered.filter(p => p.status === "vencido").reduce((s, p) => s + (p.amount || 0), 0);
  const totalPago = filtered.filter(p => p.status === "pago").reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contas a Pagar</h1>
          <p className="text-gray-500 text-sm">{payables.length} lançamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-red-600 to-orange-600">
              <Plus className="w-4 h-4 mr-2" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Conta a Pagar</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Fornecedor *</Label>
                  <Input value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div>
                  <Label>Valor *</Label>
                  <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                </div>
                <div>
                  <Label>Vencimento *</Label>
                  <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} required />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.status === "pago" && (
                  <div>
                    <Label>Data Pagamento</Label>
                    <Input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pix", "boleto", "transferencia", "cartao", "dinheiro", "cheque"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria (Plano de Contas)</Label>
                  <Select value={formData.category_id || "none"} onValueChange={v => setFormData({ ...formData, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Centro de Custo</Label>
                  <Select value={formData.cost_center_id || "none"} onValueChange={v => setFormData({ ...formData, cost_center_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem centro de custo</SelectItem>
                      {costCenters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contrato</Label>
                  <Select value={formData.contract_id || "none"} onValueChange={v => setFormData({ ...formData, contract_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem contrato</SelectItem>
                      {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conta Bancária</Label>
                  <Select value={formData.bank_account_id || "none"} onValueChange={v => setFormData({ ...formData, bank_account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem conta</SelectItem>
                      {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!editing && (
                <div className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-900/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="installment" checked={installments.enabled} onChange={e => setInstallments(p => ({ ...p, enabled: e.target.checked }))} />
                    <label htmlFor="installment" className="text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center gap-1">
                      <Layers className="w-4 h-4" /> Parcelamento automático
                    </label>
                  </div>
                  {installments.enabled && (
                    <div>
                      <Label>Número de parcelas</Label>
                      <Input type="number" min={2} max={60} value={installments.count}
                        onChange={e => setInstallments(p => ({ ...p, count: parseInt(e.target.value) || 2 }))} className="w-32 mt-1" />
                      {formData.amount && (
                        <p className="text-xs text-orange-700 mt-1">
                          {installments.count}x de {fmt(parseFloat(formData.amount) / installments.count)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Comprovante / NF</Label>
                <div className="flex gap-2 items-center mt-1">
                  <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="w-3.5 h-3.5 mr-1" />{uploading ? "Enviando..." : "Upload"}
                  </Button>
                  {formData.attachment_url && <a href={formData.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600">Ver arquivo</a>}
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-red-600 to-orange-600">{editing ? "Atualizar" : "Criar"}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-yellow-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Pendente</p><p className="text-lg font-bold text-yellow-700">{fmt(totalPendente)}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Vencido</p><p className="text-lg font-bold text-red-700">{fmt(totalVencido)}</p></CardContent></Card>
        <Card className="border-green-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Pago (filtro)</p><p className="text-lg font-bold text-green-700">{fmt(totalPago)}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Fornecedor", "Descrição", "Valor", "Vencimento", "Status", "Categoria", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(p => {
                  const cat = categories.find(c => c.id === p.category_id);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium">{p.supplier_name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-48 truncate">
                        {p.description}
                        {p.installment_total > 1 && <span className="ml-1 text-xs text-orange-600">({p.installment_number}/{p.installment_total})</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(p.amount)}</td>
                      <td className="px-4 py-3">{p.due_date}</td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{cat?.name || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {(p.status === "pendente" || p.status === "vencido") && (
                            <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => markAsPaid(p)} title="Marcar como pago">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => handleEdit(p)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhum lançamento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}