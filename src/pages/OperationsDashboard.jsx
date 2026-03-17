import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wrench, ShoppingCart, Package, Bell, Users, ArrowRight, TrendingUp } from "lucide-react";

const today = format(new Date(), "yyyy-MM-dd");
const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
const COLORS = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16"];

export default function OperationsDashboard() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const enabled = !!cid;

  const { data: occurrences = [] } = useQuery({ queryKey: ["od_occ", cid], queryFn: () => base44.entities.Occurrence.filter({ company_id: cid }), enabled });
  const { data: maintenances = [] } = useQuery({ queryKey: ["od_maint", cid], queryFn: () => base44.entities.Maintenance.filter({ company_id: cid }), enabled });
  const { data: stockItems = [] } = useQuery({ queryKey: ["od_stock", cid], queryFn: () => base44.entities.StockItem.filter({ company_id: cid }), enabled });
  const { data: orders = [] } = useQuery({ queryKey: ["od_orders", cid], queryFn: () => base44.entities.PurchaseOrder.filter({ company_id: cid }), enabled });
  const { data: activities = [] } = useQuery({ queryKey: ["od_act", cid], queryFn: () => base44.entities.WorkActivity.filter({ company_id: cid }), enabled });
  const { data: employees = [] } = useQuery({ queryKey: ["od_emps", cid], queryFn: () => base44.entities.Employee.filter({ company_id: cid }), enabled });

  const openOccurrences = occurrences.filter(o => o.status === "aberta");
  const urgentOccurrences = openOccurrences.filter(o => o.priority === "urgente");
  const pendingMaintenances = maintenances.filter(m => m.status === "agendada" && m.scheduled_date < today);
  const overdueMaintenances = maintenances.filter(m => m.status === "agendada" && m.scheduled_date <= today);
  const lowStock = stockItems.filter(i => (i.quantity||0) <= (i.min_quantity||0) && i.min_quantity > 0);
  const pendingOrders = orders.filter(o => o.status === "solicitado");
  const todayActivities = activities.filter(a => a.date === today);

  const occByClient = Object.entries(
    occurrences.filter(o => o.date >= mStart).reduce((acc, o) => { acc[o.client_name||"Sem cliente"] = (acc[o.client_name||"Sem cliente"]||0)+1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6);

  const occByType = Object.entries(
    occurrences.reduce((acc, o) => { acc[o.type||"outro"] = (acc[o.type||"outro"]||0)+1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).filter(i=>i.value>0);

  const last7 = Array.from({length:7},(_,i)=>{
    const d = format(subDays(new Date(),6-i),"yyyy-MM-dd");
    return { label: format(subDays(new Date(),6-i),"dd/MM"), atividades: activities.filter(a=>a.date===d).length, ocorrencias: occurrences.filter(o=>o.date===d).length };
  });

  const quickLinks = [
    { title: "Pedidos de Compra", icon: ShoppingCart, url: "/PurchaseOrders", count: pendingOrders.length, countLabel: "pendentes", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    { title: "Estoque", icon: Package, url: "/StockControl", count: lowStock.length, countLabel: "baixo", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { title: "Manutenções", icon: Wrench, url: "/MaintenancePage", count: overdueMaintenances.length, countLabel: "vencidas", color: "bg-red-50 text-red-700 border-red-200" },
    { title: "Ocorrências", icon: Bell, url: "/OccurrencesPage", count: openOccurrences.length, countLabel: "abertas", color: "bg-purple-50 text-purple-700 border-purple-200" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🏭 Dashboard Operacional</h1>
        <p className="text-sm text-gray-400">Visão geral das operações de facilities</p>
      </div>

      {(urgentOccurrences.length > 0 || pendingMaintenances.length > 0) && (
        <div className="space-y-2">
          {urgentOccurrences.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0"/>
              <div className="flex-1"><p className="font-bold text-red-700 text-sm">🚨 {urgentOccurrences.length} ocorrência(s) urgente(s)</p><p className="text-xs text-red-500">{urgentOccurrences.slice(0,2).map(o=>o.description?.substring(0,60)).join(" | ")}</p></div>
              <Link to="/OccurrencesPage"><Button size="sm" className="bg-red-500 text-white text-xs">Ver <ArrowRight className="w-3 h-3 ml-1"/></Button></Link>
            </div>
          )}
          {pendingMaintenances.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-orange-500 flex-shrink-0"/>
              <div className="flex-1"><p className="font-bold text-orange-700 text-sm">⚠️ {pendingMaintenances.length} manutenção(ões) com data vencida</p></div>
              <Link to="/MaintenancePage"><Button size="sm" className="bg-orange-500 text-white text-xs">Ver <ArrowRight className="w-3 h-3 ml-1"/></Button></Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Funcionários",value:employees.length,icon:Users,color:"from-violet-500 to-indigo-600"},{label:"Atividades Hoje",value:todayActivities.length,icon:TrendingUp,color:"from-blue-500 to-cyan-500"},{label:"Estoque Baixo",value:lowStock.length,icon:Package,color:lowStock.length>0?"from-orange-400 to-red-400":"from-green-500 to-emerald-500"},{label:"PC Pendentes",value:pendingOrders.length,icon:ShoppingCart,color:pendingOrders.length>0?"from-yellow-400 to-orange-400":"from-green-500 to-emerald-500"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <div className="bg-white/20 rounded-xl p-2 w-fit mb-2"><k.icon className="w-4 h-4"/></div>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map(l => (
          <Link key={l.url} to={l.url}>
            <div className={`border rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer ${l.color}`}>
              <div className="flex items-center justify-between">
                <l.icon className="w-5 h-5"/>
                {l.count > 0 && <Badge className="text-xs">{l.count}</Badge>}
              </div>
              <p className="font-bold text-sm mt-2">{l.title}</p>
              {l.count > 0 && <p className="text-xs opacity-70">{l.count} {l.countLabel}</p>}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Atividades e Ocorrências — 7 dias</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last7} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="label" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}} allowDecimals={false}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="atividades" name="Atividades" fill="#7c3aed" radius={[4,4,0,0]}/>
                <Bar dataKey="ocorrencias" name="Ocorrências" fill="#ef4444" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Ocorrências por Tipo</h3>
            {occByType.length === 0 ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Nenhuma ocorrência</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={occByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} fontSize={10}>
                    {occByType.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {occByClient.length > 0 && (
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">Ocorrências por Cliente (mês atual)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={occByClient} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={120}/>
                  <Tooltip/>
                  <Bar dataKey="value" name="Ocorrências" fill="#7c3aed" radius={[0,6,6,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {overdueMaintenances.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2"><Wrench className="w-4 h-4"/>Manutenções Vencidas</h3>
              <div className="space-y-2">
                {overdueMaintenances.slice(0,5).map(m=>(
                  <div key={m.id} className="flex items-center gap-3 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.equipment}</p><p className="text-xs text-gray-400">{m.client_name} · {m.scheduled_date}</p></div>
                    <Badge className={m.type==="preventiva"?"bg-blue-100 text-blue-700":"bg-orange-100 text-orange-700"}>{m.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {openOccurrences.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
            <CardContent className="p-4">
              <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><Bell className="w-4 h-4"/>Ocorrências Abertas</h3>
              <div className="space-y-2">
                {openOccurrences.slice(0,5).map(o=>(
                  <div key={o.id} className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/10 rounded-xl">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{o.description?.substring(0,60)}</p><p className="text-xs text-gray-400">{o.client_name} · {o.date}</p></div>
                    <Badge className={o.priority==="urgente"?"bg-red-100 text-red-700":o.priority==="alta"?"bg-orange-100 text-orange-700":"bg-yellow-100 text-yellow-700"}>{o.priority}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}