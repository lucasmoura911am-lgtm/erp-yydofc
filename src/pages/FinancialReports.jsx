import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, FileBarChart } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const COLORS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

export default function FinancialReports() {
  const [user, setUser] = useState(null);
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterClient, setFilterClient] = useState("all");
  const [filterCostCenter, setFilterCostCenter] = useState("all");

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: payables = [] } = useQuery({ queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid });
  const { data: receivables = [] } = useQuery({ queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid });
  const { data: cashFlows = [] } = useQuery({ queryKey: ["cf", cid], queryFn: () => base44.entities.CashFlow.filter({ company_id: cid }), enabled: !!cid });
  const { data: clients = [] } = useQuery({ queryKey: ["clients", cid], queryFn: () => base44.entities.Client.filter({ company_id: cid }), enabled: !!cid });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts", cid], queryFn: () => base44.entities.Contract.filter({ company_id: cid }), enabled: !!cid });
  const { data: costCenters = [] } = useQuery({ queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid });
  const { data: categories = [] } = useQuery({ queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid }), enabled: !!cid });

  const inPeriod = (dateStr) => dateStr && dateStr >= dateFrom && dateStr <= dateTo;

  const filteredAP = payables.filter(p => inPeriod(p.due_date) && (filterCostCenter === "all" || p.cost_center_id === filterCostCenter));
  const filteredAR = receivables.filter(r => inPeriod(r.due_date) && (filterClient === "all" || r.client_id === filterClient));
  const filteredCF = cashFlows.filter(f => inPeriod(f.date));

  const totalRevenue = filteredAR.filter(r => r.status === "recebido").reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpenses = filteredAP.filter(p => p.status === "pago").reduce((s, p) => s + (p.amount || 0), 0);
  const result = totalRevenue - totalExpenses;

  // Monthly result last 12 months
  const last12 = eachMonthOfInterval({ start: subMonths(new Date(), 11), end: new Date() });
  const monthlyResult = last12.map(m => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inM = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= ms && dt <= me; };
    const rev = receivables.filter(r => r.status === "recebido" && inM(r.payment_date)).reduce((s, r) => s + (r.amount || 0), 0);
    const exp = payables.filter(p => p.status === "pago" && inM(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { month: format(m, "MMM/yy", { locale: ptBR }), receita: rev, despesa: exp, resultado: rev - exp };
  });

  // Receivable by contract
  const byContract = contracts.map(ct => {
    const total = receivables.filter(r => r.contract_id === ct.id && inPeriod(r.due_date)).reduce((s, r) => s + (r.amount || 0), 0);
    const client = clients.find(c => c.id === ct.client_id);
    return { name: `${client?.name || "?"} - ${ct.contract_number}`, value: total };
  }).filter(d => d.value > 0);

  // Expenses by cost center
  const byCostCenter = costCenters.map(cc => {
    const total = payables.filter(p => p.cost_center_id === cc.id && inPeriod(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { name: cc.name, value: total, budget: cc.budget || 0 };
  }).filter(d => d.value > 0);

  // Expenses by category
  const byCategory = categories.filter(c => c.type === "despesa").map(cat => {
    const total = filteredAP.reduce((s, p) => p.category_id === cat.id ? s + (p.amount || 0) : s, 0);
    return { name: cat.name, value: total };
  }).filter(d => d.value > 0);

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => row[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileBarChart className="w-6 h-6" /> Relatórios Financeiros
          </h1>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex gap-4 flex-wrap items-end">
          <div><Label>De</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 mt-1" /></div>
          <div><Label>Até</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 mt-1" /></div>
          <div>
            <Label>Cliente</Label>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-44 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Centro de Custo</Label>
            <Select value={filterCostCenter} onValueChange={setFilterCostCenter}>
              <SelectTrigger className="w-44 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {costCenters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Receitas (recebidas)</p><p className="text-xl font-bold text-green-700">{fmt(totalRevenue)}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="p-4"><p className="text-xs text-gray-500">Despesas (pagas)</p><p className="text-xl font-bold text-red-700">{fmt(totalExpenses)}</p></CardContent></Card>
        <Card className={result >= 0 ? "border-blue-200" : "border-red-300"}>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Resultado</p>
            <p className={`text-xl font-bold ${result >= 0 ? "text-blue-700" : "text-red-700"}`}>{fmt(result)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="result">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="result">Resultado Mensal</TabsTrigger>
          <TabsTrigger value="ap">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="ar">Contas a Receber</TabsTrigger>
          <TabsTrigger value="contract">Por Contrato</TabsTrigger>
          <TabsTrigger value="cc">Por C. Custo</TabsTrigger>
          <TabsTrigger value="cf">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="result">
          <Card>
            <CardHeader><CardTitle className="text-sm">Resultado Mensal (últimos 12 meses)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyResult}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={fmt} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="resultado" name="Resultado" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Contas a Pagar no Período</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCSV(filteredAP.map(p => ({ fornecedor: p.supplier_name, valor: p.amount, vencimento: p.due_date, status: p.status })), "contas-pagar.csv")}>
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium mb-3">Despesas por Categoria</p>
                  {byCategory.length === 0 ? <p className="text-gray-400 text-sm">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart><Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={70} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                        {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip formatter={fmt} /><Legend /></PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="overflow-y-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left py-1">Fornecedor</th><th className="text-right py-1">Valor</th><th className="py-1">Status</th></tr></thead>
                    <tbody>{filteredAP.slice(0, 20).map(p => <tr key={p.id} className="border-b"><td className="py-1 truncate max-w-32">{p.supplier_name}</td><td className="text-right py-1">{fmt(p.amount)}</td><td className="py-1 pl-2"><Badge className={`text-xs ${p.status === "pago" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.status}</Badge></td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Contas a Receber no Período</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCSV(filteredAR.map(r => ({ cliente: clients.find(c => c.id === r.client_id)?.name || "", valor: r.amount, vencimento: r.due_date, status: r.status })), "contas-receber.csv")}>
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>{["Cliente", "Descrição", "Valor", "Vencimento", "Status"].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {filteredAR.map(r => {
                      const client = clients.find(c => c.id === r.client_id);
                      return <tr key={r.id}><td className="px-3 py-2">{client?.name || "—"}</td><td className="px-3 py-2 max-w-48 truncate">{r.description}</td><td className="px-3 py-2 font-medium">{fmt(r.amount)}</td><td className="px-3 py-2">{r.due_date}</td><td className="px-3 py-2"><Badge className={r.status === "recebido" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{r.status}</Badge></td></tr>;
                    })}
                    {filteredAR.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sem dados no período</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract">
          <Card>
            <CardHeader><CardTitle className="text-sm">Receitas por Contrato</CardTitle></CardHeader>
            <CardContent>
              {byContract.length === 0 ? <p className="text-gray-400 text-center py-8">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byContract} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={fmt} />
                    <Bar dataKey="value" name="Receita" fill="#10b981" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cc">
          <Card>
            <CardHeader><CardTitle className="text-sm">Despesas por Centro de Custo</CardTitle></CardHeader>
            <CardContent>
              {byCostCenter.length === 0 ? <p className="text-gray-400 text-center py-8">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byCostCenter} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={fmt} />
                    <Legend />
                    <Bar dataKey="value" name="Realizado" fill="#ef4444" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="budget" name="Orçamento" fill="#c4b5fd" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cf">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Fluxo de Caixa Detalhado</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCSV(filteredCF.map(f => ({ data: f.date, descricao: f.description, tipo: f.type, valor: f.amount })), "fluxo-caixa.csv")}>
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>{["Data", "Descrição", "Tipo", "Valor"].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {filteredCF.sort((a, b) => b.date.localeCompare(a.date)).map(f => (
                      <tr key={f.id}><td className="px-3 py-2">{f.date}</td><td className="px-3 py-2 max-w-64 truncate">{f.description}</td>
                        <td className="px-3 py-2"><Badge className={f.type === "entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{f.type}</Badge></td>
                        <td className={`px-3 py-2 font-medium ${f.type === "entrada" ? "text-green-700" : "text-red-700"}`}>{fmt(f.amount)}</td>
                      </tr>
                    ))}
                    {filteredCF.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sem dados no período</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}