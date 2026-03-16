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
import { Plus, Edit, Trash2, Check, Search, Layers, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS = {
  pendente: "bg-yellow-100 text-yellow-700",
  recebido: "bg-green-100 text-green-700",
  vencido: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-500"
};

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const emptyForm = {
  client_id: "", contract_id: "", description: "", amount: "",
  issue_date: format(new Date(), "yyyy-MM-dd"), due_date: "",
  payment_date: "", status: "pendente", category_id: "", cost_center_id: "",
  bank_account_id: "", payment_method: "pix", notes: ""
};

export default function AccountsReceivablePage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [installments, setInstallments] = useState({ enabled: false, count: 2 });
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: receivables = [] } = useQuery({ queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid });
  const { data: clients = [] } = useQuery({ queryKey: ["clients", cid], queryFn: () => base44.entities.Client.filter({ company_id: cid }), enabled: !!cid });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts", cid], queryFn: () => base44.entities.Contract.filter({ company_id: cid }), enabled: !!cid });
  const { data: categories = [] } = useQuery({ queryKey: ["coa_receita", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid, type: "receita" }), enabled: !!cid });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["ba", cid], queryFn: () => base44.entities.BankAccount.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (installments.enabled && !editing) {
        const { v4: uuidv4 } = await import("uuid");
        const groupId = uuidv4();
        const amount = parseFloat(formData.amount) / installments.count;
        for (let i = 0; i < installments.count; i++) {
          const dueDate = new Date(formData.due_date + "T00:00:00");
          dueDate.setMonth(dueDate.getMonth() + i);
          await base44.entities.AccountsReceivable.create({
            ...data, amount,
            due_date: format(dueDate, "yyyy-MM-dd"),
            description: `${data.description} (${i + 1}/${installments.count})`,
            installment_group: groupId,
            installment_number: i + 1,
            installment_total: installments.count
          });
        }
      } else {
        await base44.entities.AccountsReceivable.create(data);
      }
    },
    onSuccess: () => { qc.invalidateQueries(["ar"]); toast.success("Conta criada!"); setDialogOpen(false); setFormData(emptyForm); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AccountsReceivable.update(id, data),
    onSuccess: async (_, { id, data }) => {
      if (data.status === "recebido" && data.payment_date) {
        await base44.entities.CashFlow.create({
          company_id: cid,
          date: data.payment_date,
          description: `Recebimento: ${clients.find(c => c.id === data.client_id)?.name || data.description}`,
          amount: data.amount,
          type: "entrada",
          source: "conta_receber",
          reference_id: id,
          category_id: data.category_id,
          cost_center_id: data.cost_center_id,
          bank_account_id: data.bank_account_id
        });
      }
      qc.invalidateQueries(["ar"]);
      qc.invalidateQueries(["cf"]);
      toast.success("Conta atualizada!");
      setDialogOpen(false);
      setEditing(null);
      setFormData(emptyForm);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AccountsReceivable.delete(id),
    onSuccess: () => { qc.invalidateQueries(["ar"]); toast.success("Excluído!"); }
  });

  // Generate from contracts
  const generateFromContracts = async () => {
    const activeContracts = contracts.filter(c => c.status === "ativo" && c.value);
    let created = 0;
    for (const ct of activeContracts) {
      const client = clients.find(c => c.id === ct.client_id);
      const today = format(new Date(), "yyyy-MM-dd");
      await base44.entities.AccountsReceivable.create({
        company_id: cid,
        client_id: ct.client_id,
        contract_id: ct.id,
        description: `Mensalidade - ${client?.name || "Cliente"} - ${ct.contract_number}`,
        amount: ct.value,
        issue_date: today,
        due_date: today,
        status: "pendente"
      });
      created++;
    }
    qc.invalidateQueries(["ar"]);
    toast.success(`${created} cobranças geradas!`);
  };

  const handleEdit = (r) => { setEditing(r); setFormData({ ...emptyForm, ...r }); setDialogOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, amount: parseFloat(formData.amount) || 0, company_id: cid };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const markAsReceived = (r) => {
    updateMutation.mutate({ id: r.id, data: { ...r, status: "recebido", payment_date: format(new Date(), "yyyy-MM-dd") } });
  };

  const filtered = receivables.map(r => {
    if (r.status === "pendente" && r.due_date && new Date(r.due_date + "T00:00:00") < new Date()) return { ...r, status: "vencido" };
    return r;
  }).filter(r => {
    const client = clients.find(c => c.id === r.client_id);
    const ms = r.description?.toLowerCase().includes(search.toLowerCase()) || client?.name?.toLowerCase().includes(search.toLowerCase());
    const st = filterStatus === "all" || r.status === filterStatus;
    return ms && st;
  });

  const totalPendente = filtered.filter(r => r.status === "pendente").reduce((s, r) => s + (r.amount || 0), 0);
  const totalVencido = filtered.filter(r => r.status === "vencido").reduce((s, r) => s + (r.amount || 0), 0);
  const totalRecebido = filtered.filter(r => r.status === "recebido").reduce((s, r) => s + (r.amount || 0), 0);

  const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contas a Receber</h1>
          <p className="text-gray-500 text-sm">{receivables.length} lançamentos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateFromContracts}>
            <RefreshCw className="w-4 h-4 mr-2" /> Gerar de Contratos
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-green-600 to-emerald-600">
                <Plus className="w-4 h-4 mr-2" /> Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Conta a Receber</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cliente</Label>
                    <Select value={formData.client_id || "none"} onValueChange={v => setFormData({ ...formData, client_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem cliente</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                    <Label>Emissão</Label>
                    <Input type="date" value={formData.issue_date} onChange={e => setFormData({ ...formData, issue_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="recebido">Recebido</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.status === "recebido" && (
                    <div>
                      <Label>Data Recebimento</Label>
                      <Input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <Label>Forma de Recebimento</Label>
                    <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["pix", "boleto", "transferencia", "cartao", "dinheiro", "cheque"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
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
                </div>
                {!editing && (
                  <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="inst" checked={installments.enabled} onChange={e => setInstallments(p => ({ ...p, enabled: e.target.checked }))} />
                      <label htmlFor="inst" className="text-sm font-medium text-green-800 flex items-center gap-1">
                        <Layers className="w-4 h-4" /> Parcelamento
                      </label>
                    </div>
                    {installments.enabled && (
                      <div>
                        <Label>Parcelas</Label>
                        <Input type="number" min={2} max={60} value={installments.count} onChange={e => setInstallments(p => ({ ...p, count: parseInt(e.target.value) || 2 }))} className="w-32 mt-1" />
                        {formData.amount && <p className="text-xs text-green-700 mt-1">{installments.count}x de {fmt(parseFloat(formData.amount) / installments.count)}</p>}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <Label>Observações</Label>
                  <Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600">{editing ? "Atualizar" : "Criar"}</Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-yellow-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Pendente</p><p className="text-lg font-bold text-yellow-700">{fmt(totalPendente)}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Vencido</p><p className="text-lg font-bold text-red-700">{fmt(totalVencido)}</p></CardContent></Card>
        <Card className="border-green-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Recebido (filtro)</p><p className="text-lg font-bold text-green-700">{fmt(totalRecebido)}</p></CardContent></Card>
      </div>

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
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Cliente", "Descrição", "Valor", "Vencimento", "Status", "Forma", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(r => {
                  const client = clients.find(c => c.id === r.client_id);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium">{client?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-48 truncate">
                        {r.description}
                        {r.installment_total > 1 && <span className="ml-1 text-xs text-green-600">({r.installment_number}/{r.installment_total})</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(r.amount)}</td>
                      <td className="px-4 py-3">{r.due_date}</td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${STATUS_COLORS[r.status]}`}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.payment_method}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {(r.status === "pendente" || r.status === "vencido") && (
                            <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => markAsReceived(r)} title="Marcar recebido">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => handleEdit(r)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhum lançamento</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}