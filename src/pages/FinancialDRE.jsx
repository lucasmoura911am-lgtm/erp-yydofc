import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v) => {
  const abs = Math.abs(v || 0);
  if (abs >= 1000000) return `R$ ${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `R$ ${(abs / 1000).toFixed(1)}k`;
  return fmt(v);
};

export default function FinancialDRE() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [viewMode, setViewMode] = useState("monthly"); // monthly | annual

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: payables = [] } = useQuery({ queryKey: ["ap", cid], queryFn: () => base44.entities.AccountsPayable.filter({ company_id: cid }), enabled: !!cid });
  const { data: receivables = [] } = useQuery({ queryKey: ["ar", cid], queryFn: () => base44.entities.AccountsReceivable.filter({ company_id: cid }), enabled: !!cid });
  const { data: categories = [] } = useQuery({ queryKey: ["coa", cid], queryFn: () => base44.entities.ChartOfAccounts.filter({ company_id: cid }), enabled: !!cid });

  const [selYear, selMonth] = selectedMonth.split("-");
  const mStart = startOfMonth(new Date(parseInt(selYear), parseInt(selMonth) - 1, 1));
  const mEnd = endOfMonth(mStart);

  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    if (viewMode === "monthly") {
      const d = new Date(dateStr + "T00:00:00");
      return d >= mStart && d <= mEnd;
    } else {
      return dateStr.startsWith(selYear);
    }
  };

  const inPayment = (dateStr) => {
    if (!dateStr) return false;
    if (viewMode === "monthly") {
      const d = new Date(dateStr + "T00:00:00");
      return d >= mStart && d <= mEnd;
    } else {
      return dateStr.startsWith(selYear);
    }
  };

  const receiptCats = categories.filter(c => c.type === "receita");
  const expenseCats = categories.filter(c => c.type === "despesa");

  // Gross Revenue breakdown
  const revenueByCategory = receiptCats.map(cat => {
    const total = receivables.filter(r => r.category_id === cat.id && inPayment(r.payment_date) && r.status === "recebido").reduce((s, r) => s + (r.amount || 0), 0);
    return { ...cat, total };
  }).filter(c => c.total > 0);

  const revenueUncategorized = receivables.filter(r => !r.category_id && inPayment(r.payment_date) && r.status === "recebido").reduce((s, r) => s + (r.amount || 0), 0);
  const grossRevenue = revenueByCategory.reduce((s, c) => s + c.total, 0) + revenueUncategorized;

  // Expense breakdown by category
  const expenseByCategory = expenseCats.map(cat => {
    const total = payables.filter(p => p.category_id === cat.id && inPayment(p.payment_date) && p.status === "pago").reduce((s, p) => s + (p.amount || 0), 0);
    return { ...cat, total };
  }).filter(c => c.total > 0);

  const expenseUncategorized = payables.filter(p => !p.category_id && inPayment(p.payment_date) && p.status === "pago").reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = expenseByCategory.reduce((s, c) => s + c.total, 0) + expenseUncategorized;

  const grossProfit = grossRevenue - totalExpenses;
  const margin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  // Monthly evolution chart (last 12 months)
  const last12 = eachMonthOfInterval({ start: subMonths(new Date(), 11), end: new Date() });
  const evolutionData = last12.map(m => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inM = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= ms && dt <= me; };
    const rev = receivables.filter(r => r.status === "recebido" && inM(r.payment_date)).reduce((s, r) => s + (r.amount || 0), 0);
    const exp = payables.filter(p => p.status === "pago" && inM(p.payment_date)).reduce((s, p) => s + (p.amount || 0), 0);
    return { month: format(m, "MMM/yy", { locale: ptBR }), receita: rev, despesa: exp, resultado: rev - exp };
  });

  const months = Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM/yyyy", { locale: ptBR }) };
  });
  const years = Array.from(new Set(months.map(m => m.value.split("-")[0]))).sort().reverse();

  const exportDRE = () => {
    const lines = [
      ["DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO"],
      [viewMode === "monthly" ? format(mStart, "MMMM/yyyy", { locale: ptBR }) : selYear],
      [],
      ["RECEITAS BRUTAS", fmt(grossRevenue)],
      ...revenueByCategory.map(c => [`  ${c.name}`, fmt(c.total)]),
      revenueUncategorized > 0 ? ["  Outras Receitas", fmt(revenueUncategorized)] : null,
      [],
      ["DESPESAS TOTAIS", fmt(totalExpenses)],
      ...expenseByCategory.map(c => [`  ${c.name}`, fmt(c.total)]),
      expenseUncategorized > 0 ? ["  Outras Despesas", fmt(expenseUncategorized)] : null,
      [],
      ["RESULTADO LÍQUIDO", fmt(grossProfit)],
      ["MARGEM LÍQUIDA", `${margin.toFixed(2)}%`],
    ].filter(Boolean);
    const csv = lines.map(l => l.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `DRE-${selectedMonth}.csv`; a.click();
  };

  const DRERow = ({ label, value, indent = false, bold = false, colorize = false, separator = false }) => (
    <>
      {separator && <tr><td colSpan={3} className="px-4 py-1"><div className="border-t border-gray-200 dark:border-gray-700" /></td></tr>}
      <tr className={`${bold ? "bg-gray-50 dark:bg-gray-800/50" : "hover:bg-gray-50/50 dark:hover:bg-gray-800/20"}`}>
        <td className={`px-4 py-2 text-sm ${indent ? "pl-10 text-gray-500" : bold ? "font-bold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"}`}>
          {indent ? `↳ ${label}` : label}
        </td>
        <td className={`px-4 py-2 text-sm text-right ${bold ? "font-bold" : ""} ${colorize ? (value >= 0 ? "text-green-600" : "text-red-600") : "text-gray-700 dark:text-gray-300"}`}>
          {fmt(value)}
        </td>
        <td className={`px-4 py-2 text-sm text-right text-gray-400 ${bold ? "font-semibold" : ""}`}>
          {grossRevenue > 0 ? `${((value / grossRevenue) * 100).toFixed(1)}%` : "—"}
        </td>
      </tr>
    </>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DRE — Demonstrativo de Resultado</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas, despesas e resultado do período</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setViewMode("monthly")} className={`px-3 py-1.5 text-sm ${viewMode === "monthly" ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Mensal</button>
            <button onClick={() => setViewMode("annual")} className={`px-3 py-1.5 text-sm ${viewMode === "annual" ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Anual</button>
          </div>
          {viewMode === "monthly" ? (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Select value={selYear} onValueChange={y => setSelectedMonth(`${y}-01`)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={exportDRE}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><p className="text-xs text-gray-500">Receita Bruta</p></div>
            <p className="text-xl font-bold text-green-700">{fmtShort(grossRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-600" /><p className="text-xs text-gray-500">Despesas Totais</p></div>
            <p className="text-xl font-bold text-red-700">{fmtShort(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={`${grossProfit >= 0 ? "border-blue-200 bg-blue-50/50 dark:bg-blue-900/10" : "border-red-300 bg-red-50/50"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Minus className="w-4 h-4 text-blue-600" /><p className="text-xs text-gray-500">Resultado Líquido</p></div>
            <p className={`text-xl font-bold ${grossProfit >= 0 ? "text-blue-700" : "text-red-700"}`}>{fmtShort(grossProfit)}</p>
          </CardContent>
        </Card>
        <Card className={`${margin >= 0 ? "border-purple-200 bg-purple-50/50" : "border-red-200 bg-red-50/50"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><p className="text-xs text-gray-500">Margem Líquida</p></div>
            <p className={`text-xl font-bold ${margin >= 0 ? "text-purple-700" : "text-red-700"}`}>{margin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DRE Table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Demonstrativo Detalhado</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Conta</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">% Receita</th>
                </tr>
              </thead>
              <tbody>
                <DRERow label="RECEITAS BRUTAS" value={grossRevenue} bold />
                {revenueByCategory.map(c => <DRERow key={c.id} label={c.name} value={c.total} indent />)}
                {revenueUncategorized > 0 && <DRERow label="Outras Receitas" value={revenueUncategorized} indent />}

                <DRERow label="DESPESAS TOTAIS" value={-totalExpenses} bold separator colorize />
                {expenseByCategory.map(c => <DRERow key={c.id} label={c.name} value={-c.total} indent colorize />)}
                {expenseUncategorized > 0 && <DRERow label="Outras Despesas" value={-expenseUncategorized} indent colorize />}

                <DRERow label="RESULTADO LÍQUIDO" value={grossProfit} bold separator colorize />
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Evolution chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução Mensal (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fmt} />
                <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
                <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="resultado" name="Resultado" fill="#7c3aed" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}