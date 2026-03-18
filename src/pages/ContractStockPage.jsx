import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, startOfMonth } from "date-fns";
import { Plus, X, Pencil, Trash2, AlertTriangle, Download, Minus, BarChart3, Package, TrendingDown, History, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const today = format(new Date(), "yyyy-MM-dd");
const COLORS = ["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6"];

const EMPTY = { client_name: "", client_id: "", product: "", stock_item_id: "", quantity_on_site: 0, daily_consumption: 0, min_quantity: 0, last_replenishment_date: today, unit: "UN", notes: "" };
const EMPTY_CONSUME = { quantity: 1, notes: "" };

export default function ContractStockPage() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const [filterContract, setFilterContract] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterDateTo, setFilterDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [consumeModal, setConsumeModal] = useState(null);
  const [consumeForm, setConsumeForm] = useState(EMPTY_CONSUME);
  const [addStockModal, setAddStockModal] = useState(null);
  const [addQty, setAddQty] = useState(0);
  const qc = useQueryClient();

  const [employeeData, setEmployeeData] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      const companyId = u?.company_id;
      if (companyId) { setCid(companyId); }
      // Load employee profile to get default_client_id / default_contract_id
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => {
        if (emps.length > 0) {
          setEmployeeData(emps[0]);
          if (!companyId && emps[0]?.company_id) setCid(emps[0].company_id);
        }
      });
    });
  }, []);

  const isAdmin = user?.role === "admin";

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ["cstock_list", cid],
    queryFn: () => base44.entities.ContractStock.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: consumptions = [] } = useQuery({
    queryKey: ["cstock_consumes", cid],
    queryFn: () => base44.entities.StockConsumption.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["cstock_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["cstock_contracts", cid],
    queryFn: () => base44.entities.Contract.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["cstock_allocs", cid],
    queryFn: () => base44.entities.Allocation.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown" };
      return editing ? base44.entities.ContractStock.update(editing.id, payload) : base44.entities.ContractStock.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cstock_list"] }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success("Salvo!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.ContractStock.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cstock_list"] }); toast.success("Removido!"); },
  });

  // Register consumption
  const registerConsumption = useMutation({
    mutationFn: async ({ stock, qty, notes }) => {
      if (qty <= 0) throw new Error("Quantidade inválida");
      if ((stock.quantity_on_site || 0) < qty) throw new Error("Estoque insuficiente");
      // Create consumption record
      await base44.entities.StockConsumption.create({
        company_id: cid,
        contract_stock_id: stock.id,
        product: stock.product,
        client_id: stock.client_id || "",
        client_name: stock.client_name,
        date: today,
        quantity: qty,
        unit: stock.unit,
        employee_email: user.email,
        employee_name: user.full_name,
        notes,
      });
      // Deduct from stock
      await base44.entities.ContractStock.update(stock.id, {
        quantity_on_site: (stock.quantity_on_site || 0) - qty,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cstock_list"] });
      qc.invalidateQueries({ queryKey: ["cstock_consumes"] });
      setConsumeModal(null);
      setConsumeForm(EMPTY_CONSUME);
      toast.success("Consumo registrado!");
    },
    onError: (e) => toast.error(e.message),
  });

  // Add stock manually
  const addStock = useMutation({
    mutationFn: async ({ stock, qty }) => {
      if (qty <= 0) throw new Error("Quantidade inválida");
      await base44.entities.ContractStock.update(stock.id, {
        quantity_on_site: (stock.quantity_on_site || 0) + qty,
        last_replenishment_date: today,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cstock_list"] });
      setAddStockModal(null);
      setAddQty(0);
      toast.success("Estoque adicionado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s }); setOpen(true); };

  const getDaysLeft = (s) => {
    if (!s.daily_consumption || s.daily_consumption === 0) return null;
    return Math.floor((s.quantity_on_site || 0) / s.daily_consumption);
  };

  // For non-admin employees: auto-filter to their allocated client/contract
  const employeeClientId = !isAdmin ? (employeeData?.default_client_id || null) : null;
  const employeeContractId = !isAdmin ? (employeeData?.default_contract_id || null) : null;

  const allClients = [...new Set(stocks.map(s => s.client_name).filter(Boolean))];
  const filtered = stocks.filter(s => {
    // Non-admin: restrict to their client
    if (employeeClientId && s.client_id !== employeeClientId) return false;
    if (employeeContractId && s.contract_id !== employeeContractId) return false;
    // Admin filters
    if (isAdmin && filterClient !== "all" && s.client_name !== filterClient && s.client_id !== filterClient) return false;
    if (isAdmin && filterContract !== "all" && s.contract_id !== filterContract) return false;
    return true;
  });
  const lowAlert = stocks.filter(s => (s.quantity_on_site || 0) <= (s.min_quantity || 0) && s.min_quantity > 0);

  // Date-filtered consumptions (non-admin sees only their client)
  const filteredConsumptions = consumptions.filter(c => {
    if (c.date < filterDateFrom || c.date > filterDateTo) return false;
    if (employeeClientId && c.client_id !== employeeClientId) return false;
    if (isAdmin && filterClient !== "all" && c.client_name !== filterClient && c.client_id !== filterClient) return false;
    return true;
  });

  // Employee usage stats
  const employeeUsageMap = {};
  filteredConsumptions.forEach(c => {
    const key = c.employee_name || c.employee_email || "Desconhecido";
    if (!employeeUsageMap[key]) employeeUsageMap[key] = { name: key, total: 0, count: 0 };
    employeeUsageMap[key].total += c.quantity || 0;
    employeeUsageMap[key].count += 1;
  });
  const employeeUsage = Object.values(employeeUsageMap).sort((a, b) => b.total - a.total).slice(0, 8);

  // Product average daily consumption
  const productAvgMap = {};
  filteredConsumptions.forEach(c => {
    if (!productAvgMap[c.product]) productAvgMap[c.product] = { name: c.product, total: 0, days: new Set() };
    productAvgMap[c.product].total += c.quantity || 0;
    productAvgMap[c.product].days.add(c.date);
  });
  const productAvg = Object.values(productAvgMap).map(p => ({
    name: p.name,
    avg: p.days.size > 0 ? (p.total / p.days.size).toFixed(2) : 0,
    total: p.total
  })).sort((a, b) => b.total - a.total).slice(0, 8);

  // Dashboard data
  const productTotals = useMemo(() => {
    const map = {};
    stocks.forEach(s => {
      if (!map[s.product]) map[s.product] = 0;
      map[s.product] += s.quantity_on_site || 0;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,8);
  }, [stocks]);

  const last7Days = useMemo(() => {
    return Array.from({length: 7}, (_, i) => {
      const d = format(subDays(new Date(), 6-i), "yyyy-MM-dd");
      const label = format(subDays(new Date(), 6-i), "dd/MM");
      const total = consumptions.filter(c => c.date === d).reduce((s,c) => s+c.quantity, 0);
      return { date: label, consumo: total };
    });
  }, [consumptions]);

  const productConsumption = useMemo(() => {
    const map = {};
    consumptions.forEach(c => {
      if (!map[c.product]) map[c.product] = 0;
      map[c.product] += c.quantity || 0;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [consumptions]);

  const recentConsumptions = [...consumptions].sort((a,b) => b.date?.localeCompare(a.date)).slice(0, 30);

  const exportCSV = () => {
    const rows = [["Cliente","Produto","Qtd no Cliente","Consumo Diário","Unidade","Última Reposição"]];
    filtered.forEach(s => rows.push([s.client_name||"",s.product||"",s.quantity_on_site||0,s.daily_consumption||0,s.unit||"",s.last_replenishment_date||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="estoque_contratos.csv"; a.click();
  };

  const exportConsumptionCSV = () => {
    const rows = [["Data","Funcionário","Cliente","Produto","Quantidade","Unidade","Obs"]];
    recentConsumptions.forEach(c => rows.push([c.date||"",c.employee_name||"",c.client_name||"",c.product||"",c.quantity||0,c.unit||"",c.notes||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="consumo_estoque.csv"; a.click();
  };

  const TABS = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "estoque", label: "📦 Estoque" },
    { id: "consumo", label: "📋 Histórico" },
    { id: "relatorios", label: "📈 Relatórios" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🏭 Estoque por Contrato</h1>
          <p className="text-sm text-gray-400">Materiais nos clientes · Consumo diário · Relatórios</p>
        </div>
        <div className="flex gap-2">
          
          {(tab === "estoque" || tab === "dashboard") && <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button>}
          {tab === "estoque" && isAdmin && <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Novo Produto</Button>}
          {tab === "consumo" && <Button variant="outline" onClick={exportConsumptionCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button>}
        </div>
      </div>

      {/* Employee context banner */}
      {!isAdmin && employeeData && (
        <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3">
          <span className="text-violet-500 text-lg">🏢</span>
          <div>
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
              {employeeData.default_client_id
                ? `Visualizando estoque do seu contrato`
                : "Nenhum contrato vinculado ao seu perfil"}
            </p>
            <p className="text-xs text-violet-500">
              {employeeData.default_client_id
                ? "Você vê apenas os itens do seu posto de trabalho"
                : "Peça ao administrador para vincular seu cliente/contrato no seu cadastro de funcionário"}
            </p>
          </div>
        </div>
      )}

      {/* Global Filters — admin only */}
      {isAdmin && <div className="flex flex-wrap gap-2 items-center bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os clientes"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterContract} onValueChange={setFilterContract}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os contratos"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os contratos</SelectItem>{contracts.map(c=><SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">De:</span>
          <Input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} className="w-36 h-9"/>
          <span className="text-xs text-gray-400">Até:</span>
          <Input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} className="w-36 h-9"/>
        </div>
        {(filterClient !== "all" || filterContract !== "all") && (
          <Button size="sm" variant="ghost" onClick={() => { setFilterClient("all"); setFilterContract("all"); }} className="text-xs text-gray-400">Limpar filtros</Button>
        )}
      </div>}


      {/* TABS */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab===t.id?"bg-white dark:bg-gray-900 text-violet-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
        ))}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === "dashboard" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label:"Total Produtos",value:stocks.length,color:"from-violet-500 to-indigo-600"},
              {label:"Clientes",value:allClients.length,color:"from-blue-500 to-cyan-500"},
              {label:"Precisam Repor",value:lowAlert.length,color:lowAlert.length>0?"from-orange-400 to-red-500":"from-green-500 to-emerald-500"},
              {label:"Consumos Hoje",value:consumptions.filter(c=>c.date===today).length,color:"from-pink-500 to-rose-500"},
            ].map(k=>(
              <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
                <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
              </div>
            ))}
          </div>

          {lowAlert.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"/>
              <div><p className="font-bold text-orange-700 text-sm">⚠️ {lowAlert.length} produto(s) precisam de reposição</p>
                <p className="text-xs text-orange-500">{lowAlert.map(s=>`${s.product} (${s.client_name})`).join(" · ")}</p>
              </div>
            </div>
          )}

          {/* Estoque por produto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-violet-500"/>Estoque Atual por Produto</h3>
                {productTotals.length === 0 ? <p className="text-gray-400 text-center py-6">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={productTotals} layout="vertical">
                      <XAxis type="number" tick={{fontSize:10}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={100}/>
                      <Tooltip/>
                      <Bar dataKey="value" fill="#8b5cf6" radius={4}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-pink-500"/>Consumo — Últimos 7 Dias</h3>
                {last7Days.every(d=>d.consumo===0) ? <p className="text-gray-400 text-center py-6">Sem consumos registrados</p> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={last7Days}>
                      <XAxis dataKey="date" tick={{fontSize:10}}/>
                      <YAxis tick={{fontSize:10}}/>
                      <Tooltip/>
                      <Bar dataKey="consumo" fill="#ec4899" radius={4}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top consumed products */}
          {productConsumption.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500"/>Produtos Mais Consumidos (total)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {productConsumption.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{background:COLORS[i%COLORS.length]}}>#{i+1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.value} consumidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Low stock items detail */}
          {lowAlert.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
              <CardContent className="p-4">
                <h3 className="font-bold text-orange-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>Itens para Reposição Urgente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lowAlert.map(s=>(
                    <div key={s.id} className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3">
                      <Package className="w-5 h-5 text-orange-500 flex-shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{s.product}</p>
                        <p className="text-xs text-gray-500">{s.client_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-orange-600">{s.quantity_on_site}</p>
                        <p className="text-xs text-gray-400">mín: {s.min_quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== ESTOQUE ===== */}
      {tab === "estoque" && (
        <>
          {isAdmin && (
            <div className="flex gap-2">
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Todos os clientes"/></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{allClients.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-2 text-center py-16 bg-white dark:bg-gray-900 rounded-2xl">
                  <p className="text-4xl mb-3">🏭</p><p className="text-gray-500">Nenhum produto cadastrado</p>
                  {isAdmin && <Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Adicionar</Button>}
                </div>
              ) : filtered.map(s => {
                const daysLeft = getDaysLeft(s);
                const isLow = (s.quantity_on_site||0) <= (s.min_quantity||0) && s.min_quantity > 0;
                return (
                  <Card key={s.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isLow?"border-l-4 border-l-orange-400":""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{s.product}</p>
                            {isLow && <Badge className="bg-orange-100 text-orange-700 text-xs">⚠️ Repor</Badge>}
                          </div>
                          <p className="text-xs text-gray-400">🏢 {s.client_name}</p>
                        </div>
                        <div className="flex gap-1">
                          {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(s)}><Pencil className="w-3.5 h-3.5"/></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>del.mutate(s.id)}><Trash2 className="w-3.5 h-3.5"/></Button>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-violet-600">{s.quantity_on_site}</p>
                          <p className="text-gray-400">{s.unit} em estoque</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-blue-600">{s.daily_consumption||0}</p>
                          <p className="text-gray-400">{s.unit}/dia estimado</p>
                        </div>
                      </div>
                      {daysLeft !== null && (
                        <div className={`text-xs font-medium px-2 py-1.5 rounded-lg mb-2 ${daysLeft<=0?"bg-red-100 text-red-700":daysLeft<=3?"bg-orange-100 text-orange-700":daysLeft<=7?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>
                          {daysLeft <= 0 ? "🚨 ESTOQUE ZERADO" : `⏱️ ${daysLeft} dia(s) restante(s)`}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-xs h-8 gap-1" onClick={()=>{setConsumeModal(s);setConsumeForm(EMPTY_CONSUME);}}>
                          <Minus className="w-3 h-3"/>Registrar Consumo
                        </Button>
                        {isAdmin && <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={()=>{setAddStockModal(s);setAddQty(0);}}>
                          <Plus className="w-3 h-3"/>Adicionar
                        </Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== HISTÓRICO DE CONSUMO ===== */}
      {tab === "consumo" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {label:"No Período",value:filteredConsumptions.length,color:"from-pink-500 to-rose-500"},
              {label:"Consumos Hoje",value:consumptions.filter(c=>c.date===today).length,color:"from-violet-500 to-indigo-500"},
              {label:"Total Histórico",value:consumptions.length,color:"from-blue-500 to-cyan-500"},
            ].map(k=>(
              <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
                <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
              </div>
            ))}
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><History className="w-4 h-4 text-blue-500"/>Registros de Consumo ({filterDateFrom} a {filterDateTo})</h3>
              {filteredConsumptions.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Nenhum consumo no período selecionado</p>
              ) : (
                <div className="space-y-2">
                  {[...filteredConsumptions].sort((a,b)=>b.date?.localeCompare(a.date)).map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="w-9 h-9 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="w-4 h-4 text-pink-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.product}</p>
                        <p className="text-xs text-gray-400">{c.employee_name} · {c.client_name}</p>
                        {c.notes && <p className="text-xs text-gray-400 italic">{c.notes}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-pink-600">-{c.quantity} {c.unit}</p>
                        <p className="text-xs text-gray-400">{c.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== RELATÓRIOS ===== */}
      {tab === "relatorios" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Consumo por funcionário */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-violet-500"/>Consumo por Funcionário (período)</h3>
                {employeeUsage.length === 0 ? <p className="text-gray-400 text-center py-6">Sem dados no período</p> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={employeeUsage} layout="vertical">
                      <XAxis type="number" tick={{fontSize:10}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={100}/>
                      <Tooltip/>
                      <Bar dataKey="total" name="Total consumido" fill="#8b5cf6" radius={4}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {employeeUsage.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {employeeUsage.map((e, i) => (
                      <div key={e.name} className="flex items-center gap-2 text-xs">
                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[10px]">#{i+1}</span>
                        <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{e.name}</span>
                        <span className="text-gray-400">{e.count}x</span>
                        <span className="font-bold text-violet-600">{e.total} un.</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Média diária por produto */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500"/>Média Diária de Consumo por Produto</h3>
                {productAvg.length === 0 ? <p className="text-gray-400 text-center py-6">Sem dados no período</p> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={productAvg} layout="vertical">
                      <XAxis type="number" tick={{fontSize:10}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={110}/>
                      <Tooltip/>
                      <Bar dataKey="avg" name="Média/dia" fill="#3b82f6" radius={4}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Consumo por produto - total */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-green-500"/>Total Consumido por Produto (período)</h3>
                {productAvg.length === 0 ? <p className="text-gray-400 text-center py-6">Sem dados</p> : (
                  <div className="space-y-2">
                    {productAvg.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{background:COLORS[i%COLORS.length]}}>#{i+1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">Média: {p.avg}/dia</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-green-600">{p.total}</p>
                          <p className="text-xs text-gray-400">unidades</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Consumo diário no período */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-pink-500"/>Consumo Diário (últimos 14 dias)</h3>
                {(() => {
                  const data14 = Array.from({length:14},(_,i)=>{
                    const d = format(subDays(new Date(),13-i),"yyyy-MM-dd");
                    return { date: format(subDays(new Date(),13-i),"dd/MM"), consumo: filteredConsumptions.filter(c=>c.date===d).reduce((s,c)=>s+c.quantity,0) };
                  });
                  return data14.every(d=>d.consumo===0)
                    ? <p className="text-gray-400 text-center py-6">Sem consumos no período</p>
                    : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data14}>
                          <XAxis dataKey="date" tick={{fontSize:9}}/>
                          <YAxis tick={{fontSize:10}}/>
                          <Tooltip/>
                          <Bar dataKey="consumo" fill="#ec4899" radius={4}/>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL: Consumo */}
      {consumeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg mb-1 flex items-center gap-2"><Minus className="w-5 h-5 text-pink-500"/>Registrar Consumo</h2>
            <p className="text-sm text-gray-400 mb-4">{consumeModal.product} · {consumeModal.client_name}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Quantidade *</label>
                <Input type="number" min="1" max={consumeModal.quantity_on_site} value={consumeForm.quantity} onChange={e=>setConsumeForm(f=>({...f,quantity:parseFloat(e.target.value)||1}))}/>
                <p className="text-xs text-gray-400 mt-1">Disponível: <b>{consumeModal.quantity_on_site} {consumeModal.unit}</b></p>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                <Input value={consumeForm.notes||""} placeholder="Opcional..." onChange={e=>setConsumeForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={()=>setConsumeModal(null)}>Cancelar</Button>
              <Button className="bg-pink-500 hover:bg-pink-600 text-white" disabled={registerConsumption.isPending}
                onClick={()=>registerConsumption.mutate({stock:consumeModal,qty:consumeForm.quantity,notes:consumeForm.notes})}>
                {registerConsumption.isPending?"Registrando...":"Registrar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Stock */}
      {addStockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg mb-1 flex items-center gap-2"><Plus className="w-5 h-5 text-violet-500"/>Adicionar Estoque</h2>
            <p className="text-sm text-gray-400 mb-4">{addStockModal.product} · {addStockModal.client_name}</p>
            <p className="text-xs text-gray-500 mb-3">Atual: <b>{addStockModal.quantity_on_site} {addStockModal.unit}</b></p>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Quantidade a adicionar *</label>
              <Input type="number" min="1" value={addQty} onChange={e=>setAddQty(parseFloat(e.target.value)||0)}/>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={()=>setAddStockModal(null)}>Cancelar</Button>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white" disabled={addStock.isPending}
                onClick={()=>addStock.mutate({stock:addStockModal,qty:addQty})}>
                {addStock.isPending?"Salvando...":"Adicionar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Produto */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar":"Novo"} Produto no Estoque</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
                <Select value={form.client_name||""} onValueChange={v=>{const c=clients.find(c=>c.name===v);setForm(f=>({...f,client_name:v,client_id:c?.id||""}));}}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Produto *</label>
                <Input placeholder="Ex: Papel Higiênico, Desinfetante..." value={form.product||""} onChange={e=>setForm(f=>({...f,product:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Unidade</label><Input value={form.unit||"UN"} placeholder="UN, L, KG, CX..." onChange={e=>setForm(f=>({...f,unit:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Qtd em Estoque</label><Input type="number" min="0" value={form.quantity_on_site||0} onChange={e=>setForm(f=>({...f,quantity_on_site:parseFloat(e.target.value)||0}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Consumo Diário Estimado</label><Input type="number" min="0" value={form.daily_consumption||0} onChange={e=>setForm(f=>({...f,daily_consumption:parseFloat(e.target.value)||0}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Estoque Mínimo (alerta)</label><Input type="number" min="0" value={form.min_quantity||0} onChange={e=>setForm(f=>({...f,min_quantity:parseFloat(e.target.value)||0}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={2} value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
              {form.daily_consumption > 0 && form.quantity_on_site > 0 && <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">📅 Previsão: <b>{Math.floor(form.quantity_on_site/form.daily_consumption)} dia(s)</b> de estoque</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.product||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Salvar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}