import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, AlertTriangle, Camera, Download, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const TYPE_CONFIG = {
  incidente: { label: "Incidente", color: "bg-orange-100 text-orange-700" },
  acidente: { label: "Acidente", color: "bg-red-100 text-red-700" },
  reclamacao: { label: "Reclamação", color: "bg-yellow-100 text-yellow-700" },
  elogio: { label: "Elogio", color: "bg-green-100 text-green-700" },
  irregularidade: { label: "Irregularidade", color: "bg-purple-100 text-purple-700" },
  patrimonial: { label: "Patrimonial", color: "bg-blue-100 text-blue-700" },
  seguranca: { label: "Segurança", color: "bg-gray-100 text-gray-700" },
  outro: { label: "Outro", color: "bg-gray-100 text-gray-500" },
};

const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "bg-red-100 text-red-700" },
  em_analise: { label: "Em análise", color: "bg-yellow-100 text-yellow-700" },
  resolvida: { label: "Resolvida", color: "bg-green-100 text-green-700" },
  arquivada: { label: "Arquivada", color: "bg-gray-100 text-gray-500" },
};

const PRIORITY_CONFIG = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-600" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  urgente: { label: "🚨 Urgente", color: "bg-red-100 text-red-700" },
};

const EMPTY = { employee_name: "", employee_email: "", client_name: "", location: "", date: today, time: format(new Date(),"HH:mm"), type: "incidente", description: "", photos: [], priority: "media", status: "aberta", resolution: "" };

export default function OccurrencesPage() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({ ...f, employee_email: u.email, employee_name: u.full_name }));
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ["occ_list", cid, user?.email],
    queryFn: () => cid ? base44.entities.Occurrence.filter({ company_id: cid }) : base44.entities.Occurrence.filter({ employee_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["occ_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["occ_emps", cid],
    queryFn: () => base44.entities.Employee.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown" };
      return editing ? base44.entities.Occurrence.update(editing.id, payload) : base44.entities.Occurrence.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["occ_list"] }); setOpen(false); setEditing(null); setForm({ ...EMPTY, employee_email: user?.email, employee_name: user?.full_name }); toast.success("Ocorrência registrada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.Occurrence.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["occ_list"] }); toast.success("Removida!"); },
  });

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, photos: [...(f.photos||[]), file_url] })); toast.success("Foto enviada!"); }
    catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const openNew = () => { setEditing(null); setForm({ ...EMPTY, employee_email: user?.email, employee_name: user?.full_name }); setOpen(true); };
  const openEdit = (o) => { setEditing(o); setForm({ ...o, photos: o.photos||[] }); setOpen(true); };
  const isAdmin = user?.role === "admin";

  const allClients = [...new Set(occurrences.map(o=>o.client_name).filter(Boolean))];
  const filtered = occurrences.filter(o => {
    const st = filterStatus === "all" || o.status === filterStatus;
    const pr = filterPriority === "all" || o.priority === filterPriority;
    const cl = filterClient === "all" || o.client_name === filterClient;
    return st && pr && cl;
  }).sort((a,b) => (b.date||"").localeCompare(a.date||""));

  const urgent = occurrences.filter(o => o.priority === "urgente" && o.status === "aberta");

  const exportCSV = () => {
    const rows = [["Funcionário","Cliente","Local","Data","Tipo","Prioridade","Status","Descrição"]];
    filtered.forEach(o => rows.push([o.employee_name||"",o.client_name||"",o.location||"",o.date||"",TYPE_CONFIG[o.type]?.label||o.type,PRIORITY_CONFIG[o.priority]?.label||o.priority,STATUS_CONFIG[o.status]?.label||o.status,o.description||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="ocorrencias.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🚨 Registro de Ocorrências</h1><p className="text-sm text-gray-400">Relato de incidentes e ocorrências</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button><Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Nova Ocorrência</Button></div>
      </div>

      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 animate-pulse">
          <Bell className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
          <div><p className="font-bold text-red-700 text-sm">🚨 {urgent.length} ocorrência(s) urgente(s) em aberto!</p><p className="text-xs text-red-500">{urgent.slice(0,2).map(o=>o.description?.substring(0,50)).join(" | ")}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total",value:occurrences.length,color:"from-violet-500 to-indigo-600"},{label:"Abertas",value:occurrences.filter(o=>o.status==="aberta").length,color:"from-red-500 to-orange-500"},{label:"Em Análise",value:occurrences.filter(o=>o.status==="em_analise").length,color:"from-yellow-400 to-orange-400"},{label:"Resolvidas",value:occurrences.filter(o=>o.status==="resolvida").length,color:"from-green-500 to-emerald-500"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-40"><SelectValue placeholder="Status"/></SelectTrigger><SelectContent><SelectItem value="all">Todos Status</SelectItem>{Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}><SelectTrigger className="w-40"><SelectValue placeholder="Prioridade"/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{Object.entries(PRIORITY_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select>
        <Select value={filterClient} onValueChange={setFilterClient}><SelectTrigger className="w-44"><SelectValue placeholder="Cliente"/></SelectTrigger><SelectContent><SelectItem value="all">Todos Clientes</SelectItem>{allClients.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl"><p className="text-4xl mb-3">🚨</p><p className="text-gray-500">Nenhuma ocorrência encontrada</p><Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Registrar</Button></div>
          ) : filtered.map(o => (
            <Card key={o.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${o.priority==="urgente"&&o.status==="aberta"?"border-l-4 border-l-red-500":""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={TYPE_CONFIG[o.type]?.color}>{TYPE_CONFIG[o.type]?.label}</Badge>
                      <Badge className={PRIORITY_CONFIG[o.priority]?.color}>{PRIORITY_CONFIG[o.priority]?.label}</Badge>
                      <Badge className={STATUS_CONFIG[o.status]?.color}>{STATUS_CONFIG[o.status]?.label}</Badge>
                      <span className="text-xs text-gray-400">{o.date} {o.time}</span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{o.description}</p>
                    <div className="text-xs text-gray-400 mt-1 flex gap-3 flex-wrap">
                      {o.employee_name && <span>👤 {o.employee_name}</span>}
                      {o.client_name && <span>🏢 {o.client_name}</span>}
                      {o.location && <span>📍 {o.location}</span>}
                    </div>
                    {o.photos?.length > 0 && <div className="flex gap-1 mt-2">{o.photos.slice(0,4).map((p,i)=><a key={i} href={p} target="_blank" rel="noopener noreferrer"><img src={p} alt="" className="w-10 h-10 rounded-lg object-cover"/></a>)}</div>}
                    {o.resolution && <p className="text-xs text-green-600 mt-1">✅ {o.resolution}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(o)}><Pencil className="w-3.5 h-3.5"/></Button>
                    {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>del.mutate(o.id)}><Trash2 className="w-3.5 h-3.5"/></Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar":"Nova"} Ocorrência</h2>
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
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Hora</label><Input type="time" value={form.time||""} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo *</label>
                  <Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Prioridade</label>
                  <Select value={form.priority} onValueChange={v=>setForm(f=>({...f,priority:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente</label>
                <Select value={form.client_name||""} onValueChange={v=>setForm(f=>({...f,client_name:v}))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Local</label><Input value={form.location||""} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Descrição *</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={4} placeholder="Descreva o ocorrido em detalhes..." value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fotos</label>
                <input type="file" id="occ-photo" className="hidden" accept="image/*" capture="environment" onChange={handleUploadPhoto}/>
                <label htmlFor="occ-photo" className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-violet-400 w-fit">
                  <Camera className="w-4 h-4"/>{uploading?"Enviando...":"Adicionar foto"}
                </label>
                {form.photos?.length > 0 && <div className="flex gap-2 mt-2 flex-wrap">{form.photos.map((p,i)=><div key={i} className="relative"><img src={p} alt="" className="w-16 h-16 rounded-lg object-cover"/><button onClick={()=>setForm(f=>({...f,photos:f.photos.filter((_,ii)=>ii!==i)}))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">×</button></div>)}</div>}
              </div>
              {isAdmin && (
                <>
                  <div><label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                    <Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-xs font-medium text-gray-600 mb-1 block">Resolução</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={2} value={form.resolution||""} onChange={e=>setForm(f=>({...f,resolution:e.target.value}))}/></div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.description||!form.date||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Registrar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}