import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, Camera, HardHat, Download, CheckCircle2, XCircle, AlertTriangle, Users, ShieldCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import EPIReportTab from "@/components/epi/EPIReportTab";
import EPIPGRComplianceTab from "@/components/epi/EPIPGRComplianceTab";

const today = format(new Date(), "yyyy-MM-dd");
const EMPTY = { date: today, epi_name: "", epi_id: "", quantity: 1, photo_url: "", observations: "", location: "", employee_name: "", employee_email: "", client_name: "" };

export default function EPIDailyLogs() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [tab, setTab] = useState("registros");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterDate, setFilterDate] = useState(today);
  const [filterEmployee, setFilterEmployee] = useState("mine");
  const [uploading, setUploading] = useState(false);
  const [complianceDate, setComplianceDate] = useState(today);
  const [openEpiConfig, setOpenEpiConfig] = useState(false);
  const [editingEpi, setEditingEpi] = useState(null);
  const [epiForm, setEpiForm] = useState({ name: "", mandatory_for_all: false, is_mandatory: true });
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({ ...f, employee_email: u.email, employee_name: u.full_name }));
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const isAdmin = user?.role === "admin";

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["epi_logs", cid, user?.email],
    queryFn: () => cid ? base44.entities.EPIDailyLog.filter({ company_id: cid }) : base44.entities.EPIDailyLog.filter({ employee_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: epis = [] } = useQuery({
    queryKey: ["epi_cat", cid],
    queryFn: () => base44.entities.EPI.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["epi_emps", cid],
    queryFn: () => base44.entities.Employee.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["epi_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      if (!data.photo_url) throw new Error("Foto é obrigatória");
      const payload = { ...data, company_id: cid || "unknown" };
      return editing ? base44.entities.EPIDailyLog.update(editing.id, payload) : base44.entities.EPIDailyLog.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epi_logs"] }); setOpen(false); setEditing(null); setForm({ ...EMPTY, employee_email: user?.email, employee_name: user?.full_name }); toast.success("Registro salvo!"); },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.EPIDailyLog.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epi_logs"] }); toast.success("Removido!"); },
  });

  const saveEpi = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown", is_mandatory: true };
      return editingEpi ? base44.entities.EPI.update(editingEpi.id, payload) : base44.entities.EPI.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epi_cat"] }); setOpenEpiConfig(false); setEditingEpi(null); setEpiForm({ name: "", mandatory_for_all: false, is_mandatory: true }); toast.success("EPI salvo!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const delEpi = useMutation({
    mutationFn: (id) => base44.entities.EPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epi_cat"] }); toast.success("EPI removido!"); },
  });

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, photo_url: file_url })); toast.success("Foto enviada!"); }
    catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const openNew = () => { setEditing(null); setForm({ ...EMPTY, employee_email: user?.email, employee_name: user?.full_name }); setOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ ...l }); setOpen(true); };

  const filtered = logs.filter(l => {
    const d = !filterDate || l.date === filterDate;
    const e = filterEmployee === "all" || l.employee_email === user?.email;
    return d && e;
  });

  // ---- COMPLIANCE LOGIC ----
  const mandatoryEpis = epis.filter(e => e.mandatory_for_all || e.is_mandatory);

  const complianceData = useMemo(() => {
    const activeEmps = employees.filter(e => e.status !== "inactive" && e.status !== "terminated");
    const logsOnDate = logs.filter(l => l.date === complianceDate);

    return activeEmps.map(emp => {
      const empLogs = logsOnDate.filter(l => l.employee_email === emp.user_email);
      const loggedEpiIds = new Set(empLogs.map(l => l.epi_id).filter(Boolean));
      const loggedEpiNames = new Set(empLogs.map(l => l.epi_name?.toLowerCase()).filter(Boolean));

      const required = mandatoryEpis;
      const compliantEpis = required.filter(epi => loggedEpiIds.has(epi.id) || loggedEpiNames.has(epi.name?.toLowerCase()));
      const missingEpis = required.filter(epi => !loggedEpiIds.has(epi.id) && !loggedEpiNames.has(epi.name?.toLowerCase()));
      const hasAnyLog = empLogs.length > 0;
      const isFullyCompliant = required.length === 0 ? hasAnyLog : missingEpis.length === 0 && hasAnyLog;

      return {
        emp,
        empLogs,
        compliantEpis,
        missingEpis,
        hasAnyLog,
        isFullyCompliant,
        complianceRate: required.length > 0 ? Math.round((compliantEpis.length / required.length) * 100) : (hasAnyLog ? 100 : 0),
      };
    });
  }, [employees, logs, complianceDate, mandatoryEpis]);

  const compliantCount = complianceData.filter(d => d.isFullyCompliant).length;
  const nonCompliantCount = complianceData.filter(d => !d.isFullyCompliant).length;
  const complianceRate = complianceData.length > 0 ? Math.round((compliantCount / complianceData.length) * 100) : 0;

  const exportCSV = () => {
    const rows = [["Funcionário","Cliente","Data","EPI","Quantidade","Local","Obs"]];
    filtered.forEach(l => rows.push([l.employee_name||"",l.client_name||"",l.date||"",l.epi_name||"",l.quantity||1,l.location||"",l.observations||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="diario_epi.csv"; a.click();
  };

  const exportComplianceCSV = () => {
    const rows = [["Funcionário","Status","EPIs Registrados","EPIs Obrigatórios Faltando","Taxa Conformidade"]];
    complianceData.forEach(d => rows.push([
      d.emp.full_name||"",
      d.isFullyCompliant?"Conforme":"Não Conforme",
      d.empLogs.map(l=>l.epi_name).join("; "),
      d.missingEpis.map(e=>e.name).join("; "),
      d.complianceRate+"%"
    ]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`conformidade_epi_${complianceDate}.csv`; a.click();
  };

  const TABS = [
    { id: "registros", label: "📋 Registros" },
    ...(isAdmin ? [
      { id: "conformidade", label: "✅ Conformidade" },
      { id: "relatorio", label: "📊 Relatório" },
      { id: "pgr", label: "🔗 EPIs x PGR/PCMSO" },
      { id: "epis", label: "⚙️ EPIs Obrigatórios" },
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">⛑️ Diário de EPI</h1><p className="text-sm text-gray-400">Registro diário e conformidade de EPIs</p></div>
        <div className="flex gap-2">
          {tab === "conformidade" && <Button variant="outline" onClick={exportComplianceCSV} className="gap-2"><Download className="w-4 h-4"/>Exportar</Button>}
          {tab === "registros" && <><Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button><Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Registrar EPI</Button></>}
          {tab === "epis" && <Button onClick={()=>{setEditingEpi(null);setEpiForm({name:"",mandatory_for_all:true,is_mandatory:true,ca_number:"",description:""});setOpenEpiConfig(true);}} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Novo EPI</Button>}
          {(tab === "relatorio" || tab === "pgr") && <span className="text-xs text-gray-400 self-center">Use os filtros internos para exportar</span>}
        </div>
      </div>

      {/* TABS */}
      {isAdmin && (
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab===t.id?"bg-white dark:bg-gray-900 text-violet-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
          ))}
        </div>
      )}

      {/* ===== TAB: REGISTROS ===== */}
      {tab === "registros" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[{label:"Registros Hoje",value:logs.filter(l=>l.date===today).length,color:"from-violet-500 to-indigo-600"},{label:"Total do Mês",value:logs.filter(l=>l.date?.startsWith(format(new Date(),"yyyy-MM"))).length,color:"from-blue-500 to-cyan-500"},{label:"Total Geral",value:logs.length,color:"from-green-500 to-emerald-500"}].map(k=>(
              <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
                <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <Input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="w-40"/>
            {isAdmin && <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="mine">Somente meus</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>}
            <Button size="sm" variant="ghost" onClick={()=>setFilterDate(today)}>Hoje</Button>
          </div>

          {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-2 text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <p className="text-4xl mb-3">⛑️</p><p className="text-gray-500">Nenhum registro encontrado</p>
                  <Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Registrar agora</Button>
                </div>
              ) : filtered.map(l => (
                <Card key={l.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {l.photo_url ? <img src={l.photo_url} alt="epi" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border-2 border-green-200"/> : <div className="w-16 h-16 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0"><HardHat className="w-8 h-8 text-yellow-500"/></div>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{l.epi_name}</p>
                            <p className="text-xs text-gray-400">{l.employee_name} · {l.date}</p>
                            {l.client_name && <p className="text-xs text-blue-500">📍 {l.client_name}</p>}
                            {l.location && <p className="text-xs text-gray-400">📍 {l.location}</p>}
                            <p className="text-xs text-gray-500 mt-1">Qtd: <b>{l.quantity}</b></p>
                            {l.observations && <p className="text-xs text-gray-400 mt-1 italic">{l.observations}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>openEdit(l)}><Pencil className="w-3.5 h-3.5"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={()=>del.mutate(l.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== TAB: CONFORMIDADE (GESTOR) ===== */}
      {tab === "conformidade" && isAdmin && (
        <>
          {/* Date picker */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Data de referência:</label>
              <Input type="date" value={complianceDate} onChange={e=>setComplianceDate(e.target.value)} className="w-40"/>
            </div>
            <Button size="sm" variant="ghost" onClick={()=>setComplianceDate(today)}>Hoje</Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {label:"Total Funcionários",value:complianceData.length,color:"from-violet-500 to-indigo-600",icon:Users},
              {label:"Em Conformidade",value:compliantCount,color:"from-green-500 to-emerald-600",icon:CheckCircle2},
              {label:"Não Conformes",value:nonCompliantCount,color:nonCompliantCount>0?"from-red-500 to-orange-500":"from-green-500 to-emerald-500",icon:XCircle},
              {label:"Taxa Conformidade",value:complianceRate+"%",color:complianceRate>=80?"from-green-500 to-teal-500":complianceRate>=50?"from-yellow-400 to-orange-400":"from-red-500 to-rose-600",icon:ShieldCheck},
            ].map(k=>(
              <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
                <div className="bg-white/20 rounded-xl p-1.5 w-fit mb-2"><k.icon className="w-4 h-4"/></div>
                <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
              </div>
            ))}
          </div>

          {mandatoryEpis.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="font-bold text-yellow-700 text-sm">Nenhum EPI obrigatório configurado</p>
                <p className="text-xs text-yellow-600 mt-0.5">Vá em <b>"⚙️ EPIs Obrigatórios"</b> e marque os EPIs que são obrigatórios. O dashboard mostrará conformidade apenas de quem registrou algum EPI.</p>
              </div>
            </div>
          )}

          {/* Compliance table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500"/>Conformidade por Funcionário — {complianceDate}
              </h3>
              <div className="space-y-3">
                {complianceData.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum funcionário ativo encontrado</p>}
                {complianceData.map(({ emp, empLogs, compliantEpis, missingEpis, isFullyCompliant, hasAnyLog, complianceRate: rate }) => (
                  <div key={emp.id} className={`rounded-2xl border p-4 transition-all ${isFullyCompliant ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : hasAnyLog ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800" : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${isFullyCompliant?"bg-green-200 text-green-700":hasAnyLog?"bg-yellow-200 text-yellow-700":"bg-red-200 text-red-700"}`}>
                        {emp.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{emp.full_name}</p>
                          {isFullyCompliant
                            ? <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Conforme</Badge>
                            : hasAnyLog
                            ? <Badge className="bg-yellow-100 text-yellow-700 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Parcial</Badge>
                            : <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-1"><XCircle className="w-3 h-3"/>Não registrou</Badge>
                          }
                          {mandatoryEpis.length > 0 && <span className="text-xs text-gray-400">{rate}% conformidade</span>}
                        </div>

                        {/* EPIs registrados no dia */}
                        {empLogs.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">EPIs registrados hoje:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {empLogs.map((l, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-green-200 rounded-lg px-2 py-1">
                                  {l.photo_url && <img src={l.photo_url} alt="" className="w-6 h-6 rounded object-cover"/>}
                                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{l.epi_name}</span>
                                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0"/>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* EPIs obrigatórios faltando */}
                        {missingEpis.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-red-500 mb-1">⚠️ EPIs obrigatórios não registrados:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {missingEpis.map((epi, i) => (
                                <div key={i} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                  <XCircle className="w-3 h-3 text-red-400 flex-shrink-0"/>
                                  <span className="text-xs text-red-600 font-medium">{epi.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No log at all */}
                        {!hasAnyLog && (
                          <p className="text-xs text-red-500 mt-1">Nenhum EPI registrado nesta data</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Non compliant summary */}
          {nonCompliantCount > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
              <CardContent className="p-4">
                <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><XCircle className="w-4 h-4"/>Funcionários sem conformidade ({nonCompliantCount})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {complianceData.filter(d=>!d.isFullyCompliant).map(({emp, missingEpis, hasAnyLog})=>(
                    <div key={emp.id} className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{emp.full_name}</p>
                      {!hasAnyLog
                        ? <p className="text-xs text-red-500">Sem registro</p>
                        : <p className="text-xs text-orange-500">Faltando: {missingEpis.map(e=>e.name).join(", ")}</p>
                      }
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== TAB: EPIs OBRIGATÓRIOS (CONFIG) ===== */}
      {tab === "epis" && isAdmin && (
        <>
          <p className="text-sm text-gray-500">Configure quais EPIs são obrigatórios. Eles serão cobrados no dashboard de conformidade.</p>
          <div className="space-y-3">
            {epis.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum EPI cadastrado. Adicione um EPI usando o botão acima.</div>}
            {epis.map(epi => (
              <Card key={epi.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${epi.mandatory_for_all || epi.is_mandatory?"bg-green-100":"bg-gray-100"}`}>
                      <HardHat className={`w-4 h-4 ${epi.mandatory_for_all || epi.is_mandatory?"text-green-600":"text-gray-400"}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{epi.name}</p>
                      {epi.ca_number && <p className="text-xs text-gray-400">CA: {epi.ca_number}</p>}
                      {epi.description && <p className="text-xs text-gray-400">{epi.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(epi.mandatory_for_all || epi.is_mandatory)
                        ? <Badge className="bg-green-100 text-green-700">Obrigatório</Badge>
                        : <Badge className="bg-gray-100 text-gray-500">Opcional</Badge>
                      }
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>{setEditingEpi(epi);setEpiForm({...epi});setOpenEpiConfig(true);}}><Pencil className="w-3.5 h-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>delEpi.mutate(epi.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* MODAL: Registro de EPI */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar Registro":"Novo Registro de EPI"}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              {isAdmin && <div><label className="text-xs font-medium text-gray-600 mb-1 block">Funcionário</label>
                <Select value={form.employee_email||""} onValueChange={v=>{const e=employees.find(e=>e.user_email===v);setForm(f=>({...f,employee_email:v,employee_name:e?.full_name||v}))}}>
                  <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                  <SelectContent>{employees.map(e=><SelectItem key={e.id} value={e.user_email||e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data *</label><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Quantidade</label><Input type="number" min="1" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:parseInt(e.target.value)||1}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">EPI Utilizado *</label>
                <Select value={form.epi_id||""} onValueChange={v=>{const e=epis.find(e=>e.id===v);setForm(f=>({...f,epi_id:v,epi_name:e?.name||v}))}}>
                  <SelectTrigger><SelectValue placeholder="Selecionar EPI"/></SelectTrigger>
                  <SelectContent>{epis.map(e=><SelectItem key={e.id} value={e.id}>{e.name}{e.mandatory_for_all||e.is_mandatory?" ⭐":""}</SelectItem>)}</SelectContent>
                </Select>
                {!form.epi_id&&<Input className="mt-2" placeholder="Ou digitar nome do EPI" value={form.epi_name||""} onChange={e=>setForm(f=>({...f,epi_name:e.target.value}))}/>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente</label>
                  <Select value={form.client_name||""} onValueChange={v=>setForm(f=>({...f,client_name:v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                    <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Local</label><Input value={form.location||""} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">📸 Foto (obrigatória)</label>
                <input type="file" id="epi-photo" className="hidden" accept="image/*" capture="environment" onChange={handleUploadPhoto}/>
                <label htmlFor="epi-photo" className={`cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm w-fit transition-colors ${form.photo_url?"border-green-400 text-green-600":"border-red-300 text-red-500 hover:border-violet-400 hover:text-violet-600"}`}>
                  <Camera className="w-4 h-4"/>{uploading?"Enviando...":form.photo_url?"✅ Foto enviada — Trocar":"Tirar foto agora"}
                </label>
                {form.photo_url && <img src={form.photo_url} alt="preview" className="mt-2 w-28 h-28 rounded-xl object-cover border-2 border-green-300"/>}
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={2} value={form.observations||""} onChange={e=>setForm(f=>({...f,observations:e.target.value}))}/></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.epi_name||!form.date||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Registrar"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EPI Config */}
      {openEpiConfig && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
              <h2 className="font-bold">{editingEpi?"Editar EPI":"Novo EPI"}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpenEpiConfig(false);setEditingEpi(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nome do EPI *</label><Input value={epiForm.name||""} onChange={e=>setEpiForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Número CA</label><Input value={epiForm.ca_number||""} placeholder="Ex: CA 12345" onChange={e=>setEpiForm(f=>({...f,ca_number:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label><Input value={epiForm.description||""} onChange={e=>setEpiForm(f=>({...f,description:e.target.value}))}/></div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                <input type="checkbox" id="mandatory" checked={!!epiForm.mandatory_for_all} onChange={e=>setEpiForm(f=>({...f,mandatory_for_all:e.target.checked,is_mandatory:e.target.checked}))} className="w-4 h-4 accent-green-600"/>
                <label htmlFor="mandatory" className="text-sm font-medium text-gray-700 cursor-pointer">
                  <span className="font-bold">EPI Obrigatório</span> — aparece no dashboard de conformidade
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800">
              <Button variant="outline" onClick={()=>{setOpenEpiConfig(false);setEditingEpi(null);}}>Cancelar</Button>
              <Button onClick={()=>saveEpi.mutate(epiForm)} disabled={!epiForm.name||saveEpi.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{saveEpi.isPending?"Salvando...":editingEpi?"Atualizar":"Salvar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}