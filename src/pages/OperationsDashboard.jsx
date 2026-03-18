import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertTriangle, Wrench, ShoppingCart, Package, Bell, Users, ArrowRight, TrendingUp,
  CheckCircle2, XCircle, HardHat, Shirt, Siren, Factory, MapPin, Clock, Activity,
  RefreshCw, ChevronRight
} from "lucide-react";
import { ptBR } from "date-fns/locale";

const today = format(new Date(), "yyyy-MM-dd");
const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
const COLORS = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16"];

export default function OperationsDashboard() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const enabled = !!cid;

  const { data: occurrences = [] } = useQuery({ queryKey: ["od_occ", cid], queryFn: () => base44.entities.Occurrence.filter({ company_id: cid }), enabled });
  const { data: maintenances = [] } = useQuery({ queryKey: ["od_maint", cid], queryFn: () => base44.entities.Maintenance.filter({ company_id: cid }), enabled });
  const { data: stockItems = [] } = useQuery({ queryKey: ["od_stock", cid], queryFn: () => base44.entities.StockItem.filter({ company_id: cid }), enabled });
  const { data: orders = [] } = useQuery({ queryKey: ["od_orders", cid], queryFn: () => base44.entities.PurchaseOrder.filter({ company_id: cid }), enabled });
  const { data: activities = [] } = useQuery({ queryKey: ["od_act", cid], queryFn: () => base44.entities.WorkActivity.filter({ company_id: cid }), enabled });
  const { data: employees = [] } = useQuery({ queryKey: ["od_emps", cid], queryFn: () => base44.entities.Employee.filter({ company_id: cid }), enabled });
  const { data: allocations = [] } = useQuery({ queryKey: ["od_allocs", cid], queryFn: () => base44.entities.Allocation.filter({ company_id: cid }), enabled });
  const { data: clients = [] } = useQuery({ queryKey: ["od_clients", cid], queryFn: () => base44.entities.Client.filter({ company_id: cid }), enabled });
  const { data: timeRecords = [] } = useQuery({
    queryKey: ["od_tr", cid],
    queryFn: () => base44.entities.TimeRecord.filter({ company_id: cid }),
    enabled,
    select: (data) => data.filter(r => r.timestamp?.startsWith(today))
  });
  const { data: epiDeliveries = [] } = useQuery({ queryKey: ["od_epi", cid], queryFn: () => base44.entities.EPIDelivery.filter({ company_id: cid }), enabled });
  const { data: uniformDeliveries = [] } = useQuery({ queryKey: ["od_uniform", cid], queryFn: () => base44.entities.UniformDelivery.filter({ company_id: cid }), enabled });
  const { data: coverages = [] } = useQuery({ queryKey: ["od_cov", cid], queryFn: () => base44.entities.PostCoverage.filter({ company_id: cid }), enabled });
  const { data: tickets = [] } = useQuery({ queryKey: ["od_tickets", cid], queryFn: () => base44.entities.ClientTicket.filter({ company_id: cid }), enabled });

  // Derived stats
  const activeEmployees = employees.filter(e => e.status === "active");
  const activeAllocations = allocations.filter(a => a.status === "ativo");

  // Employees "at post" = have an active allocation + checked-in today
  const checkedInTodayIds = new Set(
    timeRecords.filter(r => r.type === "entrada").map(r => r.employee_id)
  );
  const allocatedEmployeeIds = new Set(activeAllocations.map(a => a.employee_id));
  const atPostCount = activeEmployees.filter(e => allocatedEmployeeIds.has(e.id) && checkedInTodayIds.has(e.id)).length;
  const notAtPostCount = activeEmployees.filter(e => allocatedEmployeeIds.has(e.id) && !checkedInTodayIds.has(e.id)).length;
  const notAllocated = activeEmployees.filter(e => !allocatedEmployeeIds.has(e.id)).length;

  const openOccurrences = occurrences.filter(o => o.status === "aberta");
  const urgentOccurrences = openOccurrences.filter(o => o.priority === "urgente");
  const overdueMaintenances = maintenances.filter(m => m.status === "agendada" && m.scheduled_date <= today);
  const lowStock = stockItems.filter(i => (i.quantity || 0) <= (i.min_quantity || 0) && i.min_quantity > 0);
  const pendingOrders = orders.filter(o => o.status === "solicitado");
  const openCoverages = coverages.filter(c => c.status === "em_andamento");
  const openTickets = tickets.filter(t => t.status === "aberto");

  // Client-filtered allocations
  const filteredAllocations = filterClient === "all"
    ? activeAllocations
    : activeAllocations.filter(a => a.client_id === filterClient);

  const allocationRows = filteredAllocations.map(alloc => {
    const emp = employees.find(e => e.id === alloc.employee_id);
    const client = clients.find(c => c.id === alloc.client_id);
    const isPresent = checkedInTodayIds.has(alloc.employee_id);
    return { alloc, emp, client, isPresent };
  });

  const occByClient = Object.entries(
    occurrences.filter(o => o.date >= mStart).reduce((acc, o) => { acc[o.client_name || "Sem cliente"] = (acc[o.client_name || "Sem cliente"] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const occByType = Object.entries(
    occurrences.reduce((acc, o) => { acc[o.type || "outro"] = (acc[o.type || "outro"] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).filter(i => i.value > 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    return {
      label: format(subDays(new Date(), 6 - i), "dd/MM"),
      atividades: activities.filter(a => a.date === d).length,
      ocorrencias: occurrences.filter(o => o.date === d).length
    };
  });

  const postPresenceData = [
    { name: "A Posto", value: atPostCount, fill: "#10b981" },
    { name: "Faltando", value: notAtPostCount, fill: "#ef4444" },
    { name: "Sem lotação", value: notAllocated, fill: "#9ca3af" },
  ].filter(d => d.value > 0);

  const quickLinks = [
    { title: "Pedidos de Compra", icon: ShoppingCart, url: "/PurchaseOrders", count: pendingOrders.length, countLabel: "pendentes", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    { title: "Estoque Baixo", icon: Package, url: "/StockControl", count: lowStock.length, countLabel: "itens", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { title: "Manutenções", icon: Wrench, url: "/MaintenancePage", count: overdueMaintenances.length, countLabel: "vencidas", color: "bg-red-50 text-red-700 border-red-200" },
    { title: "Ocorrências", icon: Bell, url: "/OccurrencesPage", count: openOccurrences.length, countLabel: "abertas", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { title: "Chamados Clientes", icon: Siren, url: "/ClientTicketsManage", count: openTickets.length, countLabel: "abertos", color: "bg-pink-50 text-pink-700 border-pink-200" },
    { title: "Coberturas Ativas", icon: RefreshCw, url: "/PostCoveragePage", count: openCoverages.length, countLabel: "em andamento", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { title: "EPIs", icon: HardHat, url: "/EPIDeliveries", count: epiDeliveries.filter(e => e.status === "rascunho").length, countLabel: "pendentes", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { title: "Uniformes", icon: Shirt, url: "/UniformControl", count: uniformDeliveries.filter(u => u.status === "pendente").length, countLabel: "pendentes", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🏭 Dashboard Operacional</h1>
          <p className="text-sm text-gray-400">Visão geral das operações de facilities · Atualizado às {format(now, "HH:mm")}</p>
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar cliente..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Alerts */}
      {(urgentOccurrences.length > 0 || overdueMaintenances.length > 0) && (
        <div className="space-y-2">
          {urgentOccurrences.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1"><p className="font-bold text-red-700 text-sm">🚨 {urgentOccurrences.length} ocorrência(s) urgente(s)</p><p className="text-xs text-red-500">{urgentOccurrences.slice(0, 2).map(o => o.description?.substring(0, 60)).join(" | ")}</p></div>
              <Link to="/OccurrencesPage"><Button size="sm" className="bg-red-500 text-white text-xs">Ver <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
            </div>
          )}
          {overdueMaintenances.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div className="flex-1"><p className="font-bold text-orange-700 text-sm">⚠️ {overdueMaintenances.length} manutenção(ões) com data vencida</p></div>
              <Link to="/MaintenancePage"><Button size="sm" className="bg-orange-500 text-white text-xs">Ver <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
            </div>
          )}
        </div>
      )}

      {/* KPI Grid - Main */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Funcionários Ativos", value: activeEmployees.length, icon: Users, color: "from-violet-500 to-indigo-600" },
          { label: "A Posto Hoje", value: atPostCount, icon: CheckCircle2, color: "from-green-500 to-emerald-500" },
          { label: "Faltando ao Posto", value: notAtPostCount, icon: XCircle, color: notAtPostCount > 0 ? "from-red-400 to-rose-500" : "from-green-400 to-emerald-500" },
          { label: "Postos Ativos", value: activeAllocations.length, icon: MapPin, color: "from-blue-500 to-cyan-500" },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <div className="bg-white/20 rounded-xl p-2 w-fit mb-2"><k.icon className="w-4 h-4" /></div>
            <p className="text-3xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ocorrências Abertas", value: openOccurrences.length, color: openOccurrences.length > 0 ? "from-red-400 to-rose-500" : "from-green-500 to-emerald-500", icon: Bell },
          { label: "Chamados Clientes", value: openTickets.length, color: openTickets.length > 0 ? "from-pink-500 to-rose-500" : "from-green-500 to-emerald-500", icon: Siren },
          { label: "Coberturas Ativas", value: openCoverages.length, color: "from-blue-500 to-cyan-500", icon: RefreshCw },
          { label: "PC Pendentes", value: pendingOrders.length, color: pendingOrders.length > 0 ? "from-yellow-400 to-orange-400" : "from-green-500 to-emerald-500", icon: ShoppingCart },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <div className="bg-white/20 rounded-xl p-2 w-fit mb-2"><k.icon className="w-4 h-4" /></div>
            <p className="text-3xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {quickLinks.map(l => (
          <Link key={l.url} to={l.url}>
            <div className={`border rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer ${l.color} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <l.icon className="w-4 h-4" />
                  {l.count > 0 && <Badge className="text-xs bg-white/60 text-current">{l.count}</Badge>}
                </div>
                <p className="font-bold text-xs">{l.title}</p>
                {l.count > 0 && <p className="text-xs opacity-70">{l.count} {l.countLabel}</p>}
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </div>
          </Link>
        ))}
      </div>

      {/* Post Presence + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Funcionários a Posto */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" />Presença nos Postos — Hoje
            </h3>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <p className="text-3xl font-black text-green-600">{atPostCount}</p>
                <p className="text-xs text-gray-500">A Posto</p>
              </div>
              <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <p className="text-3xl font-black text-red-500">{notAtPostCount}</p>
                <p className="text-xs text-gray-500">Faltando</p>
              </div>
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-3xl font-black text-gray-400">{notAllocated}</p>
                <p className="text-xs text-gray-500">Sem lotação</p>
              </div>
            </div>
            {postPresenceData.length > 0 && (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={postPresenceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} fontSize={10}>
                    {postPresenceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Atividades e Ocorrências 7 dias */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Atividades e Ocorrências — 7 dias</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last7} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="atividades" name="Atividades" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ocorrencias" name="Ocorrências" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ocorrências por Tipo */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Ocorrências por Tipo</h3>
            {occByType.length === 0 ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Nenhuma ocorrência</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={occByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                    {occByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ocorrências por Cliente */}
        {occByClient.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Ocorrências por Cliente (mês atual)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={occByClient} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="value" name="Ocorrências" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Postos detalhados */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory className="w-4 h-4 text-violet-500" />
            Postos Ativos — Status Individual
            <Badge variant="outline" className="ml-auto">{filteredAllocations.length} postos</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allocationRows.length === 0 ? (
            <p className="text-center py-8 text-gray-400">Nenhum posto ativo encontrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allocationRows.map(({ alloc, emp, client, isPresent }) => (
                <div key={alloc.id} className={`p-3 rounded-xl border flex items-center gap-3 ${isPresent ? "border-green-200 bg-green-50 dark:bg-green-900/10" : "border-red-200 bg-red-50 dark:bg-red-900/10"}`}>
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={emp?.photo_url} />
                    <AvatarFallback className={`text-sm font-bold text-white ${isPresent ? "bg-green-500" : "bg-red-400"}`}>{emp?.full_name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{emp?.full_name || "Funcionário"}</p>
                    <p className="text-xs text-gray-500 truncate">{alloc.post_name}</p>
                    {client && <p className="text-xs text-gray-400 truncate">{client.name}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    {isPresent
                      ? <Badge className="bg-green-100 text-green-700 text-xs">✅ Presente</Badge>
                      : <Badge className="bg-red-100 text-red-700 text-xs">❌ Ausente</Badge>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manutenções vencidas + Ocorrências abertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {overdueMaintenances.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2"><Wrench className="w-4 h-4" />Manutenções Vencidas</h3>
              <div className="space-y-2">
                {overdueMaintenances.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.equipment}</p><p className="text-xs text-gray-400">{m.client_name} · {m.scheduled_date}</p></div>
                    <Badge className={m.type === "preventiva" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}>{m.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {openOccurrences.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><Bell className="w-4 h-4" />Ocorrências Abertas</h3>
              <div className="space-y-2">
                {openOccurrences.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/10 rounded-xl">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{o.description?.substring(0, 60)}</p><p className="text-xs text-gray-400">{o.client_name} · {o.date}</p></div>
                    <Badge className={o.priority === "urgente" ? "bg-red-100 text-red-700" : o.priority === "alta" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}>{o.priority}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {openTickets.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-pink-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-pink-600 mb-3 flex items-center gap-2"><Siren className="w-4 h-4" />Chamados Abertos dos Clientes</h3>
              <div className="space-y-2">
                {openTickets.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 bg-pink-50 dark:bg-pink-900/10 rounded-xl">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.title || t.description?.substring(0, 50)}</p><p className="text-xs text-gray-400">{t.client_name} · {t.created_date?.substring(0, 10)}</p></div>
                    <Badge className="bg-pink-100 text-pink-700 text-xs">{t.priority || "normal"}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {openCoverages.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-blue-600 mb-3 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Coberturas em Andamento</h3>
              <div className="space-y-2">
                {openCoverages.slice(0, 5).map(c => {
                  const backup = employees.find(e => e.id === c.backup_employee_id);
                  const original = employees.find(e => e.id === c.original_employee_id);
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{backup?.full_name} cobre {original?.full_name}</p>
                        <p className="text-xs text-gray-400">{c.reason} · {c.start_datetime?.substring(0, 10)}</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">ativo</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}