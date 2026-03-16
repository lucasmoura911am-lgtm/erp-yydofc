import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, DollarSign, Target, Users, Phone, Send,
  ArrowUpRight, CheckCircle2, XCircle, Clock, Star
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const STAGE_LABELS = {
  lead_novo: "Lead Novo",
  contato_realizado: "Contato Realizado",
  diagnostico: "Diagnóstico",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  fechado_ganho: "Fechado Ganho",
  fechado_perdido: "Fechado Perdido"
};
const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#7c3aed", "#5b21b6", "#10b981", "#ef4444"];
const ORIGIN_COLORS = { site: "#6366f1", indicacao: "#10b981", linkedin: "#3b82f6", google_ads: "#f59e0b", cold_call: "#ef4444", evento: "#8b5cf6", email_marketing: "#06b6d4", whatsapp: "#22c55e", outro: "#94a3b8" };

export default function CRMDashboard() {
  const [user, setUser] = useState(null);
  const [period, setPeriod] = useState(format(new Date(), "yyyy-MM"));
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });
  const { data: leads = [] } = useQuery({ queryKey: ["crm_leads", cid], queryFn: () => base44.entities.CRMLead.filter({ company_id: cid }), enabled: !!cid });
  const { data: activities = [] } = useQuery({ queryKey: ["crm_act", cid], queryFn: () => base44.entities.CRMActivity.filter({ company_id: cid }), enabled: !!cid });
  const { data: proposals = [] } = useQuery({ queryKey: ["crm_prop", cid], queryFn: () => base44.entities.CRMProposal.filter({ company_id: cid }), enabled: !!cid });
  const { data: goals = [] } = useQuery({ queryKey: ["crm_goals", cid], queryFn: () => base44.entities.CRMGoal.filter({ company_id: cid }), enabled: !!cid });

  const [selYear, selMonth] = period.split("-");
  const mStart = startOfMonth(new Date(parseInt(selYear), parseInt(selMonth) - 1, 1));
  const mEnd = endOfMonth(mStart);
  const inPeriod = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= mStart && dt <= mEnd; };

  const wonInPeriod = opportunities.filter(o => o.stage === "fechado_ganho" && inPeriod(o.close_date));
  const closedRevenue = wonInPeriod.reduce((s, o) => s + (o.value || 0), 0);
  const expectedRevenue = opportunities.filter(o => !["fechado_ganho", "fechado_perdido"].includes(o.stage)).reduce((s, o) => s + ((o.value || 0) * (o.probability || 0) / 100), 0);
  const sentProposals = proposals.filter(p => p.status !== "rascunho").length;
  const won = opportunities.filter(o => o.stage === "fechado_ganho").length;
  const lost = opportunities.filter(o => o.stage === "fechado_perdido").length;
  const convRate = (won + lost) > 0 ? (won / (won + lost) * 100).toFixed(1) : 0;
  const avgTicket = won > 0 ? closedRevenue / won : 0;
  const newLeadsInPeriod = leads.filter(l => inPeriod(l.created_date)).length;
  const callsInPeriod = activities.filter(a => a.type === "ligacao" && inPeriod(a.date)).length;

  // Funnel data
  const stageOrder = ["lead_novo", "contato_realizado", "diagnostico", "proposta_enviada", "negociacao", "fechado_ganho"];
  const funnelData = stageOrder.map((s, i) => ({
    name: STAGE_LABELS[s],
    value: opportunities.filter(o => o.stage === s).length,
    fill: COLORS[i]
  }));

  // Revenue by seller
  const sellers = [...new Set(opportunities.filter(o => o.stage === "fechado_ganho").map(o => o.responsible_name || o.responsible_email || "N/A"))];
  const sellerData = sellers.map(s => ({
    name: s.length > 15 ? s.slice(0, 15) + "..." : s,
    receita: opportunities.filter(o => o.stage === "fechado_ganho" && (o.responsible_name === s || o.responsible_email === s)).reduce((sum, o) => sum + (o.value || 0), 0)
  })).sort((a, b) => b.receita - a.receita).slice(0, 8);

  // Revenue by product
  const products = [...new Set(opportunities.filter(o => o.product).map(o => o.product))];
  const productData = products.map(p => ({
    name: p.length > 20 ? p.slice(0, 20) + "..." : p,
    value: opportunities.filter(o => o.product === p && o.stage === "fechado_ganho").reduce((sum, o) => sum + (o.value || 0), 0)
  })).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  // Leads by origin
  const originData = Object.entries(
    leads.reduce((acc, l) => { acc[l.origin || "outro"] = (acc[l.origin || "outro"] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  // Monthly pipeline (last 6 months)
  const last6 = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });
  const monthlyData = last6.map(m => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inM = (d) => { if (!d) return false; const dt = new Date(d + "T00:00:00"); return dt >= ms && dt <= me; };
    return {
      month: format(m, "MMM/yy", { locale: ptBR }),
      ganho: opportunities.filter(o => o.stage === "fechado_ganho" && inM(o.close_date)).reduce((s, o) => s + (o.value || 0), 0),
      previsto: opportunities.filter(o => !["fechado_ganho", "fechado_perdido"].includes(o.stage)).reduce((s, o) => s + ((o.value || 0) * (o.probability || 0) / 100), 0)
    };
  });

  // Upcoming activities
  const upcomingActs = activities.filter(a => a.status === "agendada").sort((a, b) => a.date?.localeCompare(b.date)).slice(0, 5);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM/yyyy", { locale: ptBR }) };
  });

  const KPI = ({ title, value, sub, icon: Icon, color, link }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.includes("green") ? "bg-green-50" : color.includes("blue") ? "bg-blue-50" : color.includes("purple") ? "bg-purple-50" : color.includes("orange") ? "bg-orange-50" : "bg-gray-50"}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {link && <Link to={link} className="text-xs text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1">Ver detalhes <ArrowUpRight className="w-3 h-3" /></Link>}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">CRM — Dashboard Comercial</h1>
          <p className="text-gray-500 text-sm mt-1">Visão completa do pipeline e performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <div className="col-span-2"><KPI title="Receita Fechada" value={fmt(closedRevenue)} sub="no período" icon={DollarSign} color="text-green-600" link="/CRMOpportunities" /></div>
        <div className="col-span-2"><KPI title="Receita Prevista" value={fmt(expectedRevenue)} sub="prob. ponderada" icon={TrendingUp} color="text-blue-600" /></div>
        <div className="col-span-2"><KPI title="Taxa de Conversão" value={`${convRate}%`} sub={`${won} ganhos / ${lost} perdidos`} icon={Target} color="text-purple-600" /></div>
        <div className="col-span-2"><KPI title="Ticket Médio" value={fmt(avgTicket)} sub="oportunidades ganhas" icon={Star} color="text-orange-600" /></div>
        <div className="col-span-2"><KPI title="Propostas Enviadas" value={sentProposals} sub="total" icon={Send} color="text-indigo-600" link="/CRMProposals" /></div>
        <div className="col-span-2"><KPI title="Leads Novos" value={newLeadsInPeriod} sub="no período" icon={Users} color="text-teal-600" link="/CRMLeads" /></div>
        <div className="col-span-2"><KPI title="Ligações" value={callsInPeriod} sub="no período" icon={Phone} color="text-pink-600" link="/CRMActivities" /></div>
        <div className="col-span-2"><KPI title="Pipeline Total" value={opportunities.filter(o => !["fechado_ganho","fechado_perdido"].includes(o.stage)).length} sub="oportunidades ativas" icon={Clock} color="text-cyan-600" link="/CRMKanban" /></div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Receita Mensal — Ganho vs Previsto</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={fmt} />
                <Legend />
                <Bar dataKey="ganho" name="Ganho" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="previsto" name="Previsto" fill="#6366f1" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Origem dos Leads</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={originData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {originData.map((entry, i) => <Cell key={i} fill={ORIGIN_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader><CardTitle className="text-base">Funil de Vendas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {funnelData.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-28 text-xs text-gray-600 text-right">{item.name}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max(5, (item.value / Math.max(...funnelData.map(d=>d.value), 1)) * 100)}%`, backgroundColor: item.fill }}
                  >
                    <span className="text-white text-xs font-bold">{item.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By seller */}
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Vendedor</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sellerData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                <Tooltip formatter={fmt} />
                <Bar dataKey="receita" name="Receita" fill="#6366f1" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By product */}
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Produto</CardTitle></CardHeader>
          <CardContent>
            {productData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={productData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {productData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={fmt} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming activities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Próximas Atividades</CardTitle>
          <Link to="/CRMActivities" className="text-xs text-indigo-600 hover:underline">Ver todas</Link>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {["Data", "Tipo", "Empresa / Contato", "Responsável", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {upcomingActs.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{a.date}</td>
                  <td className="px-4 py-2"><Badge variant="outline" className="text-xs capitalize">{a.type.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-2 text-gray-600">{a.contact_person || a.description?.slice(0, 40) || "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{a.responsible_name || a.responsible_email || "—"}</td>
                  <td className="px-4 py-2"><Badge className={a.status === "realizada" ? "bg-green-100 text-green-700 text-xs" : a.status === "cancelada" ? "bg-red-100 text-red-700 text-xs" : "bg-yellow-100 text-yellow-700 text-xs"}>{a.status}</Badge></td>
                </tr>
              ))}
              {upcomingActs.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-400">Nenhuma atividade agendada</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}