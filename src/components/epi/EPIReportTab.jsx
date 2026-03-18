import React, { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { Download, FileText, ShieldCheck, Users, Calendar, Filter, CheckCircle2, XCircle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function EPIReportTab({ logs, employees, epis, clients }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");

  const [filterStart, setFilterStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterEnd, setFilterEnd] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterEpi, setFilterEpi] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all | with_photo | missing
  const [viewMode, setViewMode] = useState("list"); // list | by_employee | by_day

  const mandatoryEpis = epis.filter(e => e.mandatory_for_all || e.is_mandatory);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const inRange = (!filterStart || l.date >= filterStart) && (!filterEnd || l.date <= filterEnd);
      const byEmp = filterEmployee === "all" || l.employee_email === filterEmployee;
      const byEpi = filterEpi === "all" || l.epi_id === filterEpi || l.epi_name === filterEpi;
      const byClient = filterClient === "all" || l.client_name === filterClient;
      const byStatus = filterStatus === "all" || (filterStatus === "with_photo" && l.photo_url) || (filterStatus === "missing" && !l.photo_url);
      return inRange && byEmp && byEpi && byClient && byStatus;
    });
  }, [logs, filterStart, filterEnd, filterEmployee, filterEpi, filterClient, filterStatus]);

  // Group by employee for the "by_employee" view
  const byEmployee = useMemo(() => {
    const map = {};
    filtered.forEach(l => {
      const key = l.employee_email || l.employee_name;
      if (!map[key]) map[key] = { name: l.employee_name, email: l.employee_email, logs: [] };
      map[key].logs.push(l);
    });
    return Object.values(map);
  }, [filtered]);

  // Group by day
  const byDay = useMemo(() => {
    const map = {};
    filtered.forEach(l => {
      if (!map[l.date]) map[l.date] = { date: l.date, logs: [] };
      map[l.date].logs.push(l);
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

  // Compliance per employee per day (for the period)
  const complianceSummary = useMemo(() => {
    if (!filterStart || !filterEnd || mandatoryEpis.length === 0) return [];

    const activeEmps = employees.filter(e => e.status !== "inactive");
    return activeEmps.map(emp => {
      const empLogs = filtered.filter(l => l.employee_email === emp.user_email);
      const daysWithLogs = new Set(empLogs.map(l => l.date));
      const mandatoryMet = mandatoryEpis.filter(epi => {
        return empLogs.some(l => l.epi_id === epi.id || l.epi_name?.toLowerCase() === epi.name?.toLowerCase());
      });
      return {
        emp,
        totalLogs: empLogs.length,
        daysCount: daysWithLogs.size,
        mandatoryMet: mandatoryMet.length,
        mandatoryTotal: mandatoryEpis.length,
        complianceRate: Math.round((mandatoryMet.length / mandatoryEpis.length) * 100),
        photos: empLogs.filter(l => l.photo_url),
      };
    }).filter(s => s.totalLogs > 0);
  }, [filtered, employees, mandatoryEpis]);

  const exportFullCSV = () => {
    const rows = [
      ["Data", "Funcionário", "E-mail", "EPI", "CA", "Qtd", "Cliente", "Local", "Tem Foto", "Observações", "URL da Foto"]
    ];
    filtered.forEach(l => {
      const epi = epis.find(e => e.id === l.epi_id);
      rows.push([
        l.date || "",
        l.employee_name || "",
        l.employee_email || "",
        l.epi_name || "",
        epi?.ca_number || "",
        l.quantity || 1,
        l.client_name || "",
        l.location || "",
        l.photo_url ? "Sim" : "Não",
        l.observations || "",
        l.photo_url || ""
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_epi_${filterStart}_a_${filterEnd}.csv`;
    a.click();
  };

  const exportComplianceCSV = () => {
    const rows = [
      ["Funcionário", "E-mail", "Dias com Registros", "Total de Registros", "EPIs Obrigatórios Cumpridos", "Total Obrigatórios", "Taxa Conformidade", "Fotos"]
    ];
    complianceSummary.forEach(s => {
      rows.push([
        s.emp.full_name,
        s.emp.user_email || "",
        s.daysCount,
        s.totalLogs,
        s.mandatoryMet,
        s.mandatoryTotal,
        s.complianceRate + "%",
        s.photos.length
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conformidade_epi_${filterStart}_a_${filterEnd}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* FILTERS */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-violet-500" />
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">Filtros do Relatório</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data início</label>
              <Input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data fim</label>
              <Input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Funcionário</label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.user_email || e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">EPI</label>
              <Select value={filterEpi} onValueChange={setFilterEpi}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os EPIs</SelectItem>
                  {epis.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cliente</label>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Foto</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with_photo">Com foto</SelectItem>
                  <SelectItem value="missing">Sem foto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setFilterStart(format(startOfMonth(new Date()), "yyyy-MM-dd")); setFilterEnd(format(endOfMonth(new Date()), "yyyy-MM-dd")); }}>Mês atual</Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); setFilterStart(format(startOfMonth(d), "yyyy-MM-dd")); setFilterEnd(format(endOfMonth(d), "yyyy-MM-dd")); }}>Mês anterior</Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFilterStart(format(d, "yyyy-MM-dd")); setFilterEnd(format(new Date(), "yyyy-MM-dd")); }}>Últimos 7 dias</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Registros no Período", value: filtered.length, color: "from-violet-500 to-indigo-600" },
          { label: "Funcionários com Reg.", value: new Set(filtered.map(l => l.employee_email)).size, color: "from-blue-500 to-cyan-500" },
          { label: "Registros com Foto", value: filtered.filter(l => l.photo_url).length, color: "from-green-500 to-emerald-500" },
          { label: "EPIs Distintos Usados", value: new Set(filtered.map(l => l.epi_name)).size, color: "from-orange-400 to-yellow-500" },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p>
            <p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* VIEW MODE */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500">Visualizar:</span>
        {[
          { id: "list", label: "Lista" },
          { id: "by_employee", label: "Por Funcionário" },
          { id: "by_day", label: "Por Dia" },
          { id: "compliance", label: "Conformidade" },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${viewMode === v.id ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
          >
            {v.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportFullCSV} className="gap-1.5 text-xs h-7">
            <Download className="w-3 h-3" />Exportar Registros
          </Button>
          {complianceSummary.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportComplianceCSV} className="gap-1.5 text-xs h-7">
              <ShieldCheck className="w-3 h-3" />Exportar Conformidade
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500">Nenhum registro encontrado para os filtros selecionados</p>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(l => {
            const epiDef = epis.find(e => e.id === l.epi_id);
            return (
              <Card key={l.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex gap-3 items-start">
                    {l.photo_url
                      ? <img src={l.photo_url} alt="epi" className="w-14 h-14 rounded-xl object-cover border-2 border-green-200 flex-shrink-0" />
                      : <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Camera className="w-5 h-5 text-gray-400" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{l.epi_name}</span>
                        {epiDef?.ca_number && <span className="text-xs text-gray-400">CA {epiDef.ca_number}</span>}
                        {(epiDef?.mandatory_for_all || epiDef?.is_mandatory) && <Badge className="bg-green-100 text-green-700 text-xs">Obrigatório</Badge>}
                        {l.photo_url ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>👤 {l.employee_name}</span>
                        <span>📅 {l.date}</span>
                        {l.client_name && <span>🏢 {l.client_name}</span>}
                        {l.location && <span>📍 {l.location}</span>}
                        <span>Qtd: <b>{l.quantity}</b></span>
                      </div>
                      {l.observations && <p className="text-xs text-gray-400 italic mt-1">{l.observations}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* BY EMPLOYEE */}
      {viewMode === "by_employee" && byEmployee.length > 0 && (
        <div className="space-y-3">
          {byEmployee.sort((a, b) => a.name?.localeCompare(b.name)).map(group => (
            <Card key={group.email} className="border-0 shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">{group.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">{group.logs.length} registros</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.logs.sort((a, b) => b.date.localeCompare(a.date)).map(l => (
                    <div key={l.id} className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      {l.photo_url
                        ? <img src={l.photo_url} alt="epi" className="w-10 h-10 rounded-lg object-cover border border-green-200 flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0"><Camera className="w-4 h-4 text-gray-400" /></div>
                      }
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{l.epi_name}</p>
                        <p className="text-xs text-gray-400">{l.date}{l.client_name ? ` · ${l.client_name}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* BY DAY */}
      {viewMode === "by_day" && byDay.length > 0 && (
        <div className="space-y-3">
          {byDay.map(group => (
            <Card key={group.date} className="border-0 shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-violet-500" />
                    {group.date}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{group.logs.length} registros</Badge>
                    <Badge variant="outline" className="text-xs">{new Set(group.logs.map(l => l.employee_email)).size} funcionários</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {group.logs.map(l => (
                    <div key={l.id} className="flex gap-2 items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      {l.photo_url
                        ? <img src={l.photo_url} alt="epi" className="w-9 h-9 rounded-lg object-cover border border-green-200 flex-shrink-0" />
                        : <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0"><Camera className="w-3.5 h-3.5 text-gray-400" /></div>
                      }
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1 truncate">{l.employee_name}</span>
                      <span className="text-xs text-gray-500 truncate">{l.epi_name}</span>
                      {l.photo_url ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* COMPLIANCE SUMMARY */}
      {viewMode === "compliance" && (
        <>
          {mandatoryEpis.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
              <p className="text-yellow-600 font-medium">Nenhum EPI obrigatório configurado</p>
              <p className="text-xs text-yellow-500 mt-1">Configure EPIs obrigatórios na aba "⚙️ EPIs Obrigatórios" para ver a conformidade.</p>
            </div>
          ) : complianceSummary.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhum funcionário registrou EPIs no período selecionado</div>
          ) : (
            <div className="space-y-3">
              {complianceSummary.sort((a, b) => a.complianceRate - b.complianceRate).map(s => (
                <Card key={s.emp.id} className={`border-0 shadow-sm ${s.complianceRate === 100 ? "border-l-4 border-l-green-400" : s.complianceRate >= 50 ? "border-l-4 border-l-yellow-400" : "border-l-4 border-l-red-400"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${s.complianceRate === 100 ? "bg-green-100 text-green-700" : s.complianceRate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {s.emp.full_name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{s.emp.full_name}</span>
                          <Badge className={`text-xs ${s.complianceRate === 100 ? "bg-green-100 text-green-700" : s.complianceRate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            {s.complianceRate}% conformidade
                          </Badge>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span>📋 {s.totalLogs} registros</span>
                          <span>📅 {s.daysCount} dias</span>
                          <span>📸 {s.photos.length} fotos</span>
                          <span>✅ {s.mandatoryMet}/{s.mandatoryTotal} EPIs obrigatórios</span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${s.complianceRate === 100 ? "bg-green-500" : s.complianceRate >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                            style={{ width: s.complianceRate + "%" }}
                          />
                        </div>
                      </div>
                      {/* Photos grid mini */}
                      {s.photos.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {s.photos.slice(0, 3).map((l, i) => (
                            <img key={i} src={l.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
                          ))}
                          {s.photos.length > 3 && <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">+{s.photos.length - 3}</div>}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}