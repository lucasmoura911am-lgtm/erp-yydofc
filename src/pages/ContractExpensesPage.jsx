import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import {
  Plus, TrendingDown, TrendingUp, DollarSign, Building2, Trash2, Edit,
  ShoppingCart, Users, Package, Wrench, Truck, MoreHorizontal, Download
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { toast } from "sonner";

const CATEGORY_CONFIG = {
  compra: { label: "Compra/Material", icon: ShoppingCart, color: "#8b5cf6" },
  salario: { label: "Salário", icon: Users, color: "#3b82f6" },
  beneficio: { label: "Benefício", icon: DollarSign, color: "#10b981" },
  manutencao: { label: "Manutenção", icon: Wrench, color: "#f59e0b" },
  transporte: { label: "Transporte", icon: Truck, color: "#ec4899" },
  equipamento: { label: "Equipamento", icon: Package, color: "#6366f1" },
  outros: { label: "Outros", icon: MoreHorizontal, color: "#6b7280" },
};

const EMPTY_FORM = {
  client_id: "", category: "outros", description: "", amount: "",
  date: format(new Date(), "yyyy-MM-dd"), competence: format(new Date(), "MM/yyyy"),
  employee_id: "", notes: ""
};

export default function ContractExpensesPage() {
  const [user, setUser] = useState(null);
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MM/yyyy"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.company_id],
    queryFn: () => base44.entities.Client.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", user?.company_id],
    queryFn: () => base44.entities.Contract.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["contractExpenses", user?.company_id, selectedMonth],
    queryFn: () => base44.entities.ContractExpense.filter({
      company_id: user.company_id,
      competence: selectedMonth
    }),
    enabled: !!user?.company_id
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const emp = employees.find(e => e.id === data.employee_id);
      const cli = clients.find(c => c.id === data.client_id);
      const payload = {
        ...data,
        company_id: user.company_id,
        client_name: cli?.name || data.client_name || "",
        employee_name: emp?.full_name || "",
        created_by: user.email,
        amount: parseFloat(data.amount) || 0
      };
      return editing
        ? base44.entities.ContractExpense.update(editing.id, payload)
        : base44.entities.ContractExpense.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(["contractExpenses"]);
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(editing ? "Despesa atualizada!" : "Despesa registrada!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContractExpense.delete(id),
    onSuccess: () => { qc.invalidateQueries(["contractExpenses"]); toast.success("Removido!"); }
  });

  const openEdit = (exp) => {
    setEditing(exp);
    setForm({ ...exp, amount: String(exp.amount) });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, competence: selectedMonth });
    setDialogOpen(true);
  };

  // Filter by selected client
  const filtered = selectedClient === "all"
    ? expenses
    : expenses.filter(e => e.client_id === selectedClient || e.client_name === selectedClient);

  // Per-client summary
  const clientSummary = clients.map(cli => {
    const cliExpenses = expenses.filter(e => e.client_id === cli.id || e.client_name === cli.name);
    const totalExpenses = cliExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    // Contract monthly value
    const cliContracts = contracts.filter(c => c.client_id === cli.id && c.status === "ativo");
    const monthlyRevenue = cliContracts.reduce((s, c) => s + (c.value || 0), 0);
    const profit = monthlyRevenue - totalExpenses;
    const margin = monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : null;
    return { cli, totalExpenses, monthlyRevenue, profit, margin, count: cliExpenses.length };
  }).filter(s => s.count > 0 || s.monthlyRevenue > 0);

  // Category breakdown for selected view
  const catBreakdown = Object.keys(CATEGORY_CONFIG).map(cat => ({
    name: CATEGORY_CONFIG[cat].label,
    value: filtered.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
    color: CATEGORY_CONFIG[cat].color
  })).filter(c => c.value > 0);

  // Month-over-month bar data (last 6 months)
  const barData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const comp = format(d, "MM/yyyy");
    return { month: format(d, "MM/yy"), competence: comp };
  });

  const totalExpenses = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalRevenue = selectedClient === "all"
    ? clientSummary.reduce((s, c) => s + c.monthlyRevenue, 0)
    : (() => {
      const cli = clients.find(c => c.id === selectedClient);
      const cliContracts = contracts.filter(c => c.client_id === selectedClient && c.status === "ativo");
      return cliContracts.reduce((s, c) => s + (c.value || 0), 0);
    })();
  const totalProfit = totalRevenue - totalExpenses;
  const isProfit = totalProfit >= 0;

  const exportCSV = () => {
    const rows = [["Data", "Cliente", "Categoria", "Descrição", "Funcionário", "Valor", "Referência"]];
    filtered.forEach(e => rows.push([
      e.date || "", e.client_name || "", CATEGORY_CONFIG[e.category]?.label || e.category,
      e.description || "", e.employee_name || "",
      (e.amount || 0).toFixed(2), e.reference_type || "manual"
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `gastos-contratos-${selectedMonth.replace("/", "-")}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingDown className="w-8 h-8 text-red-500" />
            Gastos por Contrato / Cliente
          </h1>
          <p className="text-gray-500 mt-1">Controle de despesas, análise de lucratividade por contrato</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const d = subMonths(new Date(), i);
                const v = format(d, "MM/yyyy");
                return <SelectItem key={v} value={v}>{v}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button onClick={openNew} className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Plus className="w-4 h-4 mr-2" />Nova Despesa
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Receita Contratual</p>
              <p className="text-2xl font-bold text-blue-600">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total de Despesas</p>
              <p className="text-2xl font-bold text-red-500">R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={isProfit ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700"}>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isProfit ? "bg-green-100" : "bg-red-100"}`}>
              {isProfit ? <TrendingUp className="w-6 h-6 text-green-600" /> : <TrendingDown className="w-6 h-6 text-red-600" />}
            </div>
            <div>
              <p className="text-xs text-gray-500">{isProfit ? "Lucro" : "Prejuízo"}</p>
              <p className={`text-2xl font-bold ${isProfit ? "text-green-600" : "text-red-600"}`}>
                R$ {Math.abs(totalProfit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Por Cliente</TabsTrigger>
          <TabsTrigger value="despesas">Lista de Despesas</TabsTrigger>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
        </TabsList>

        {/* Per-client profit/loss */}
        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle>Lucratividade por Cliente — {selectedMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              {clientSummary.length === 0 ? (
                <p className="text-center py-8 text-gray-400">Nenhum dado disponível para este mês</p>
              ) : (
                <div className="space-y-3">
                  {clientSummary.map(({ cli, totalExpenses, monthlyRevenue, profit, margin }) => {
                    const isP = profit >= 0;
                    const barPct = monthlyRevenue > 0 ? Math.min(100, (totalExpenses / monthlyRevenue) * 100) : 0;
                    return (
                      <div
                        key={cli.id}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedClient === cli.id ? "border-purple-400 bg-purple-50 dark:bg-purple-900/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-900"}`}
                        onClick={() => setSelectedClient(selectedClient === cli.id ? "all" : cli.id)}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{cli.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">Receita: <b className="text-blue-600">R$ {monthlyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></span>
                            <span className="text-xs text-gray-500">Despesas: <b className="text-red-500">R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></span>
                            <Badge className={isP ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                              {isP ? "+" : ""}R$ {profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              {margin !== null && ` (${margin.toFixed(1)}%)`}
                            </Badge>
                          </div>
                        </div>
                        {/* Expense bar */}
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barPct > 100 ? "bg-red-500" : barPct > 80 ? "bg-yellow-400" : "bg-green-400"}`}
                            style={{ width: Math.min(barPct, 100) + "%" }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{barPct.toFixed(0)}% da receita consumido em despesas</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses list */}
        <TabsContent value="despesas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>Despesas — {selectedMonth}</span>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-gray-400">Carregando...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma despesa registrada</p>
                  <Button onClick={openNew} className="mt-3 bg-purple-600 text-white" size="sm">
                    <Plus className="w-4 h-4 mr-1" />Adicionar despesa
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(exp => {
                        const catCfg = CATEGORY_CONFIG[exp.category];
                        const CatIcon = catCfg?.icon || MoreHorizontal;
                        return (
                          <TableRow key={exp.id}>
                            <TableCell className="text-sm">{exp.date ? format(new Date(exp.date), "dd/MM/yyyy") : "–"}</TableCell>
                            <TableCell className="font-medium">{exp.client_name || "–"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                <CatIcon className="w-3 h-3" />
                                {catCfg?.label || exp.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm">{exp.description}</TableCell>
                            <TableCell className="text-sm text-gray-500">{exp.employee_name || "–"}</TableCell>
                            <TableCell className="font-bold text-red-600">
                              R$ {(exp.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {exp.reference_type === "purchase_order" ? "Pedido Compra" : "Manual"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteMutation.mutate(exp.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts */}
        <TabsContent value="graficos">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lucro por cliente bar chart */}
            <Card>
              <CardHeader><CardTitle>Lucro / Prejuízo por Cliente</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={clientSummary.map(s => ({
                    name: s.cli.name.length > 12 ? s.cli.name.slice(0, 12) + "…" : s.cli.name,
                    Receita: s.monthlyRevenue,
                    Despesas: s.totalExpenses,
                    Lucro: s.profit
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Legend />
                    <Bar dataKey="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category pie */}
            <Card>
              <CardHeader><CardTitle>Despesas por Categoria</CardTitle></CardHeader>
              <CardContent>
                {catBreakdown.length === 0 ? (
                  <p className="text-center py-8 text-gray-400">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={catBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {catBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={e => {
                  const [yyyy, mm] = e.target.value.split("-");
                  setForm(f => ({ ...f, date: e.target.value, competence: `${mm}/${yyyy}` }));
                }} />
              </div>
            </div>

            {(form.category === "salario" || form.category === "beneficio") && (
              <div className="space-y-1">
                <Label>Funcionário</Label>
                <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar funcionário..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.client_id || !form.amount}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              {saveMutation.isPending ? "Salvando..." : editing ? "Salvar" : "Registrar Despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}