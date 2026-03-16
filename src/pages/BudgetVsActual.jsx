import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { Target, Edit, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function BudgetVsActual() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [editingCC, setEditingCC] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: costCenters = [] } = useQuery({ queryKey: ["cc", cid], queryFn: () => base44.entities.CostCenter.filter({ company_id: cid }), enabled: !!cid });
  const { data: payables = [] } = useQuery({ queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid });
  const { data: receivables = [] } = useQuery({ queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid });
  const { data: categories = [] } = useQuery({ queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid }), enabled: !!cid });

  const updateCCMutation = useMutation({
    mutationFn: ({ id, budget }) => base44.entities.CostCenter.update(id, { budget }),
    onSuccess: () => { qc.invalidateQueries(["cc"]); toast.success("Orçamento atualizado!"); setEditingCC(null); }
  });

  const [selYear, selMonth] = selectedMonth.split("-");
  const mStart = startOfMonth(new Date(parseInt(selYear), parseInt(selMonth) - 1, 1));
  const mEnd = endOfMonth(mStart);
  const inMonth = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= mStart && dt <= mEnd; };

  // CC budget vs actual for selected month
  const ccData = costCenters.map(cc => {
    const actual = payables.filter(p => p.cost_center_id === cc.id && inMonth(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    const budget = cc.budget || 0;
    const diff = budget - actual;
    const pct = budget > 0 ? (actual / budget) * 100 : 0;
    return { ...cc, actual, budget, diff, pct };
  }).sort((a, b) => b.actual - a.actual);

  // Monthly trend per cost center (last 6 months)
  const last6 = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });
  const trendData = last6.map(m => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inM = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= ms && dt <= me; };
    const entry = { month: format(m, "MMM/yy", { locale: ptBR }) };
    costCenters.slice(0, 4).forEach(cc => {
      entry[cc.name] = payables.filter(p => p.cost_center_id === cc.id && inM(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    });
    return entry;
  });

  // Category budget analysis
  const catData = categories.filter(c => c.type === "despesa").map(cat => {
    const actual = payables.filter(p => p.category_id === cat.id && inMonth(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { name: cat.name, actual, budget: 0 };
  }).filter(d => d.actual > 0);

  // Projected vs actual for current year
  const allMonthsYear = eachMonthOfInterval({
    start: new Date(parseInt(selYear), 0, 1),
    end: new Date(parseInt(selYear), 11, 31)
  });
  const projectedVsActual = allMonthsYear.map(m => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inM = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= ms && dt <= me; };
    const realRev = receivables.filter(r => r.status === "recebido" && inM(r.payment_date)).reduce((s, r) => s + (r.amount || 0), 0);
    const realExp = payables.filter(p => p.status === "pago" && inM(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0);
    const projRev = receivables.filter(r => r.status !== "cancelado" && inM(r.due_date)).reduce((s, r) => s + (r.amount || 0), 0);
    const projExp = payables.filter(p => p.status !== "cancelado" && inM(p.due_date)).reduce((s, p) => s + (p.amount || 0), 0);
    const isFuture = ms > new Date();
    return {
      month: format(m, "MMM", { locale: ptBR }),
      "Receita Prevista": projRev,
      "Receita Realizada": isFuture ? null : realRev,
      "Despesa Prevista": projExp,
      "Despesa Realizada": isFuture ? null : realExp,
    };
  });

  const totalBudget = ccData.reduce((s, c) => s + c.budget, 0);
  const totalActual = ccData.reduce((s, c) => s + c.actual, 0);
  const overBudget = ccData.filter(c => c.budget > 0 && c.actual > c.budget).length;

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM/yyyy", { locale: ptBR }) };
  });

  const CC_COLORS = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orçamento x Realizado</h1>
          <p className="text-gray-500 text-sm mt-1">Controle orçamentário e projeção previsto x realizado</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Orçamento Total</p><p className="text-xl font-bold text-purple-700">{fmt(totalBudget)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Realizado</p><p className={`text-xl font-bold ${totalActual > totalBudget ? "text-red-700" : "text-green-700"}`}>{fmt(totalActual)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Variação</p><p className={`text-xl font-bold ${totalActual > totalBudget ? "text-red-700" : "text-green-700"}`}>{fmt(totalBudget - totalActual)}</p></CardContent></Card>
        <Card className={overBudget > 0 ? "border-red-200" : "border-green-200"}>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Acima do Orçamento</p>
            <p className={`text-xl font-bold ${overBudget > 0 ? "text-red-700" : "text-green-700"}`}>{overBudget} {overBudget === 1 ? "centro" : "centros"}</p>
          </CardContent>
        </Card>
      </div>

      {/* CC Detail table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" /> Orçamento por Centro de Custo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {["Centro de Custo", "Orçado", "Realizado", "Variação", "% Exec.", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {ccData.map(cc => (
                <tr key={cc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium">{cc.name}</td>
                  <td className="px-4 py-3 text-purple-700">{fmt(cc.budget)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(cc.actual)}</td>
                  <td className={`px-4 py-3 font-semibold ${cc.diff >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {cc.diff >= 0 ? "+" : ""}{fmt(cc.diff)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20">
                        <div
                          className={`h-2 rounded-full ${cc.pct > 100 ? "bg-red-500" : cc.pct > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(cc.pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs">{cc.pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {cc.budget === 0 ? (
                      <Badge variant="outline" className="text-xs">Sem orçamento</Badge>
                    ) : cc.actual > cc.budget ? (
                      <Badge className="text-xs bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Estourou
                      </Badge>
                    ) : cc.pct > 80 ? (
                      <Badge className="text-xs bg-yellow-100 text-yellow-700">Atenção</Badge>
                    ) : (
                      <Badge className="text-xs bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingCC(cc); setBudgetInput(String(cc.budget || "")); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {ccData.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cadastre centros de custo em Configurações Financeiras</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Realizado x Orçado por C. Custo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ccData.filter(c => c.budget > 0 || c.actual > 0)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmt} />
                <Legend />
                <Bar dataKey="budget" name="Orçado" fill="#c4b5fd" radius={[0, 3, 3, 0]} />
                <Bar dataKey="actual" name="Realizado" fill="#7c3aed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tendência por C. Custo (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fmt} />
                <Legend />
                {costCenters.slice(0, 4).map((cc, i) => (
                  <Line key={cc.id} type="monotone" dataKey={cc.name} stroke={CC_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Previsto x Realizado anual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previsto x Realizado — {selYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={projectedVsActual}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={fmt} />
              <Legend />
              <Bar dataKey="Receita Prevista" fill="#bbf7d0" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Receita Realizada" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Despesa Prevista" fill="#fecaca" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Despesa Realizada" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Edit budget dialog */}
      {editingCC && (
        <Dialog open={!!editingCC} onOpenChange={() => setEditingCC(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Orçamento — {editingCC.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Orçamento mensal (R$)</Label>
                <Input type="number" step="0.01" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} className="mt-1" autoFocus />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600" onClick={() => updateCCMutation.mutate({ id: editingCC.id, budget: parseFloat(budgetInput) || 0 })}>
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setEditingCC(null)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}