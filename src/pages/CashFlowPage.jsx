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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { format, eachDayOfInterval, subDays, startOfMonth, endOfMonth, addDays } from "date-fns";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const emptyForm = {
  date: format(new Date(), "yyyy-MM-dd"), description: "", amount: "",
  type: "entrada", category_id: "", cost_center_id: "", bank_account_id: "", source: "manual"
};

export default function CashFlowPage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState("daily"); // daily | monthly
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: cashFlows = [] } = useQuery({ queryKey: ["cf", cid], queryFn: () => base44.entities.CashFlow.filter({ company_id: cid }), enabled: !!cid });
  const { data: categories = [] } = useQuery({ queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid }), enabled: !!cid });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ["ba", cid], queryFn: () => base44.entities.BankAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: payables = [] } = useQuery({ queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid });
  const { data: receivables = [] } = useQuery({ queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CashFlow.create({ ...data, company_id: cid }),
    onSuccess: () => { qc.invalidateQueries(["cf"]); toast.success("Lançamento criado!"); setDialogOpen(false); setFormData(emptyForm); }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CashFlow.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["cf"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CashFlow.delete(id),
    onSuccess: () => { qc.invalidateQueries(["cf"]); toast.success("Excluído!"); }
  });

  const handleEdit = (f) => { setEditing(f); setFormData({ ...emptyForm, ...f }); setDialogOpen(true); };
  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, amount: parseFloat(formData.amount) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = cashFlows.filter(f => f.date >= dateFrom && f.date <= dateTo);

  const totalIn = filtered.filter(f => f.type === "entrada").reduce((s, f) => s + (f.amount || 0), 0);
  const totalOut = filtered.filter(f => f.type === "saida").reduce((s, f) => s + (f.amount || 0), 0);
  const balance = totalIn - totalOut;

  // Daily chart
  const days = eachDayOfInterval({ start: new Date(dateFrom + "T00:00:00"), end: new Date(dateTo + "T00:00:00") });
  let cumBalance = 0;
  const dailyData = days.map(day => {
    const d = format(day, "yyyy-MM-dd");
    const inp = filtered.filter(f => f.date === d && f.type === "entrada").reduce((s, f) => s + (f.amount || 0), 0);
    const out = filtered.filter(f => f.date === d && f.type === "saida").reduce((s, f) => s + (f.amount || 0), 0);
    cumBalance += inp - out;
    return { date: format(day, "dd/MM"), entrada: inp, saida: out, saldo: cumBalance };
  });

  // Projected (pending payables/receivables next 30 days)
  const today = new Date();
  const next30 = Array.from({ length: 30 }, (_, i) => format(addDays(today, i), "yyyy-MM-dd"));
  let projBalance = balance;
  const projData = next30.map(d => {
    const projIn = receivables.filter(r => r.due_date === d && r.status === "pendente").reduce((s, r) => s + (r.amount || 0), 0);
    const projOut = payables.filter(p => p.due_date === d && p.status === "pendente").reduce((s, p) => s + (p.amount || 0), 0);
    projBalance += projIn - projOut;
    return { date: d.slice(5), projetado: projBalance };
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fluxo de Caixa</h1>
          <p className="text-gray-500 text-sm">{filtered.length} lançamentos no período</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-purple-600 to-blue-600">
              <Plus className="w-4 h-4 mr-2" /> Lançamento Manual
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Lançamento</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo *</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
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
                      <SelectItem value="none">—</SelectItem>
                      {costCenters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conta Bancária</Label>
                  <Select value={formData.bank_account_id || "none"} onValueChange={v => setFormData({ ...formData, bank_account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600">{editing ? "Atualizar" : "Criar"}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpRight className="w-8 h-8 text-green-600 bg-green-50 rounded-lg p-1.5" />
            <div><p className="text-xs text-gray-500">Entradas</p><p className="font-bold text-green-700 text-lg">{fmt(totalIn)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownRight className="w-8 h-8 text-red-600 bg-red-50 rounded-lg p-1.5" />
            <div><p className="text-xs text-gray-500">Saídas</p><p className="font-bold text-red-700 text-lg">{fmt(totalOut)}</p></div>
          </CardContent>
        </Card>
        <Card className={balance >= 0 ? "border-blue-200" : "border-red-300"}>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className={`w-8 h-8 rounded-lg p-1.5 ${balance >= 0 ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"}`} />
            <div><p className="text-xs text-gray-500">Saldo do Período</p><p className={`font-bold text-lg ${balance >= 0 ? "text-blue-700" : "text-red-700"}`}>{fmt(balance)}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Date filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">De:</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Até:</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Entradas x Saídas no Período</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(days.length / 7)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fmt} />
                <Legend />
                <Bar dataKey="entrada" name="Entrada" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="saida" name="Saída" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Projeção (próximos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={projData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fmt} />
                <Area type="monotone" dataKey="projetado" name="Saldo Projetado" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Data", "Descrição", "Tipo", "Valor", "Origem", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">{f.date}</td>
                    <td className="px-4 py-3 max-w-64 truncate">{f.description}</td>
                    <td className="px-4 py-3">
                      <Badge className={f.type === "entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {f.type === "entrada" ? "↑ Entrada" : "↓ Saída"}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${f.type === "entrada" ? "text-green-700" : "text-red-700"}`}>
                      {f.type === "entrada" ? "+" : "-"}{fmt(f.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{f.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {f.source === "manual" && <>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => handleEdit(f)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(f.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Nenhum lançamento no período</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}