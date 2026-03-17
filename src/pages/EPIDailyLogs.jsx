import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, Camera, HardHat, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");
const EMPTY = { date: today, epi_name: "", epi_id: "", quantity: 1, photo_url: "", observations: "", location: "", employee_name: "", employee_email: "", client_name: "" };

export default function EPIDailyLogs() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterDate, setFilterDate] = useState(today);
  const [filterEmployee, setFilterEmployee] = useState("mine");
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

  const exportCSV = () => {
    const rows = [["Funcionário","Cliente","Data","EPI","Quantidade","Local","Obs"]];
    filtered.forEach(l => rows.push([l.employee_name||"",l.client_name||"",l.date||"",l.epi_name||"",l.quantity||1,l.location||"",l.observations||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="diario_epi.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">⛑️ Diário de EPI</h1><p className="text-sm text-gray-400">Registro diário de uso de EPIs</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button><Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Registrar EPI</Button></div>
      </div>

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
                  <SelectContent>{epis.map(e=><SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
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
    </div>
  );
}