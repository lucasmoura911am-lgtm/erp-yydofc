import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, Wrench, AlertTriangle, Download, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const STATUS_CONFIG = {
  agendada: { label: "Agendada", color: "bg-blue-100 text-blue-700" },
  em_andamento: { label: "Em andamento", color: "bg-yellow-100 text-yellow-700" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700" },
  cancelada: { label: "Cancelada", color: "bg-gray-100 text-gray-500" },
  vencida: { label: "Vencida", color: "bg-red-100 text-red-700" },
};

const EMPTY = { equipment: "", client_name: "", location: "", type: "preventiva", scheduled_date: today, completed_date: "", responsible_name: "", responsible_email: "", description: "", photos: [], status: "agendada", cost: 0, next_maintenance_date: "", notes: "" };

export default function MaintenancePage() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({ ...f, responsible_email: u.email, responsible_name: u.full_name }));
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ["maint_list", cid],
    queryFn: () => cid ? base44.entities.Maintenance.filter({ company_id: cid }) : [],
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["maint_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown" };
      return editing ? base44.entities.Maintenance.update(editing.id, payload) : base44.entities.Maintenance.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maint_list"] }); setOpen(false); setEditing(null); setForm({ ...EMPTY, responsible_email: user?.email, responsible_name: user?.full_name }); toast.success("Manutenção salva!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.Maintenance.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maint_list"] }); toast.success("Removida!"); },
  });

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, photos: [...(f.photos||[]), file_url] })); toast.success("Foto enviada!"); }
    catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const openNew = () => { setEditing(null); setForm({ ...EMPTY, responsible_email: user?.email, responsible_name: user?.full_name }); setOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...m, photos: m.photos || [] }); setOpen(true); };

  const pending = maintenances.filter(m => m.status === "agendada" && m.scheduled_date < today);
  const filtered = maintenances.filter(m => {
    const st = filterStatus === "all" || m.status === filterStatus;
    const tp = filterType === "all" || m.type === filterType;
    return st && tp;
  }).sort((a,b) => (a.scheduled_date||"").localeCompare(b.scheduled_date||""));

  const exportCSV = () => {
    const rows = [["Equipamento","Cliente","Local","Tipo","Data Agendada","Responsável","Status"]];
    filtered.forEach(m => rows.push([m.equipment||"",m.client_name||"",m.location||"",m.type||"",m.scheduled_date||"",m.responsible_name||"",STATUS_CONFIG[m.status]?.label||m.status]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="manutencoes.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">🔧 Gestão de Manutenção</h1><p className="text-sm text-gray-400">Preventiva e corretiva</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button><Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Nova Manutenção</Button></div>
      </div>

      {pending.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
          <div><p className="font-bold text-red-700 text-sm">⚠️ {pending.length} manutenção(ões) com data vencida</p><p className="text-xs text-red-500">{pending.slice(0,3).map(m=>m.equipment).join(", ")}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total",value:maintenances.length,color:"from-violet-500 to-indigo-600"},{label:"Agendadas",value:maintenances.filter(m=>m.status==="agendada").length,color:"from-blue-500 to-cyan-500"},{label:"Concluídas",value:maintenances.filter(m=>m.status==="concluida").length,color:"from-green-500 to-emerald-500"},{label:"Vencidas",value:pending.length,color:pending.length>0?"from-red-500 to-orange-500":"from-gray-400 to-gray-500"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-44"><SelectValue placeholder="Status"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent></Select>
        <Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-44"><SelectValue placeholder="Tipo"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="preventiva">Preventiva</SelectItem><SelectItem value="corretiva">Corretiva</SelectItem></SelectContent></Select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl"><p className="text-4xl mb-3">🔧</p><p className="text-gray-500">Nenhuma manutenção encontrada</p><Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Cadastrar</Button></div>
          ) : filtered.map(m => {
            const isOverdue = m.status === "agendada" && m.scheduled_date < today;
            return (
              <Card key={m.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isOverdue?"border-l-4 border-l-red-400":""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type==="preventiva"?"bg-blue-100":"bg-orange-100"}`}>
                      <Wrench className={`w-5 h-5 ${m.type==="preventiva"?"text-blue-600":"text-orange-600"}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{m.equipment}</p>
                        <Badge className={STATUS_CONFIG[m.status]?.color}>{STATUS_CONFIG[m.status]?.label}</Badge>
                        <Badge className={m.type==="preventiva"?"bg-blue-50 text-blue-600":"bg-orange-50 text-orange-600"}>{m.type}</Badge>
                        {isOverdue && <Badge className="bg-red-100 text-red-600">⚠️ Vencida</Badge>}
                      </div>
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-1">
                        {m.client_name && <span>📍 {m.client_name}</span>}
                        {m.location && <span>🏭 {m.location}</span>}
                        <span>📅 {m.scheduled_date}</span>
                        {m.responsible_name && <span>👤 {m.responsible_name}</span>}
                      </div>
                      {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                      {m.photos?.length > 0 && <div className="flex gap-1 mt-2">{m.photos.slice(0,3).map((p,i)=><img key={i} src={p} alt="foto" className="w-10 h-10 rounded-lg object-cover"/>)}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(m)}><Pencil className="w-3.5 h-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>del.mutate(m.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar":"Nova"} Manutenção</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Equipamento *</label><Input value={form.equipment} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
                  <Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="preventiva">Preventiva</SelectItem><SelectItem value="corretiva">Corretiva</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente</label>
                <Select value={form.client_name||""} onValueChange={v=>setForm(f=>({...f,client_name:v}))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Localização</label><Input value={form.location||""} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data Agendada *</label><Input type="date" value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data Conclusão</label><Input type="date" value={form.completed_date||""} onChange={e=>setForm(f=>({...f,completed_date:e.target.value}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Responsável</label><Input value={form.responsible_name||""} onChange={e=>setForm(f=>({...f,responsible_name:e.target.value}))}/></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={3} value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fotos</label>
                <input type="file" id="maint-photo" className="hidden" accept="image/*" capture="environment" onChange={handleUploadPhoto}/>
                <label htmlFor="maint-photo" className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-violet-400 w-fit">
                  <Camera className="w-4 h-4"/>{uploading?"Enviando...":"Adicionar foto"}
                </label>
                {form.photos?.length > 0 && <div className="flex gap-2 mt-2">{form.photos.map((p,i)=><div key={i} className="relative"><img src={p} alt="" className="w-16 h-16 rounded-lg object-cover"/><button onClick={()=>setForm(f=>({...f,photos:f.photos.filter((_,ii)=>ii!==i)}))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">×</button></div>)}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Custo (R$)</label><Input type="number" value={form.cost||0} onChange={e=>setForm(f=>({...f,cost:parseFloat(e.target.value)||0}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Próxima Manutenção</label><Input type="date" value={form.next_maintenance_date||""} onChange={e=>setForm(f=>({...f,next_maintenance_date:e.target.value}))}/></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.equipment||!form.scheduled_date||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Salvar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}