import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Pencil, Trash2, Download, Camera, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const UNIFORM_TYPES = ["Camisa","Camiseta","Calça","Short","Bermuda","Jaleco","Avental","Colete","Touca","Luva","Bota","Sapato","Tênis","Meia","Crachá","Boné"];

const EMPTY = { employee_name: "", employee_email: "", position: "", client_name: "", uniform_type: "", items: [], delivery_date: today, photo_url: "", notes: "" };

export default function UniformControl() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["unif_list", cid],
    queryFn: () => cid ? base44.entities.UniformDelivery.filter({ company_id: cid }) : [],
    enabled: !!user,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["unif_emps", cid],
    queryFn: () => base44.entities.Employee.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["unif_clients", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: cid || "unknown" };
      return editing ? base44.entities.UniformDelivery.update(editing.id, payload) : base44.entities.UniformDelivery.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unif_list"] }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success("Entrega registrada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.UniformDelivery.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unif_list"] }); toast.success("Removido!"); },
  });

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, photo_url: file_url })); toast.success("Foto enviada!"); }
    catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { item: "", size: "", quantity: 1 }] }));
  const updateItem = (idx, field, val) => setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], [field]: val }; return { ...f, items }; });
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const handleEmpSelect = (email) => {
    const emp = employees.find(e => e.user_email === email || e.email === email);
    setForm(f => ({ ...f, employee_email: email, employee_name: emp?.full_name || email, position: emp?.position_id || f.position }));
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ ...d }); setOpen(true); };

  const allClients = [...new Set(deliveries.map(d => d.client_name).filter(Boolean))];
  const filtered = deliveries.filter(d => filterClient === "all" || d.client_name === filterClient);

  const exportCSV = () => {
    const rows = [["Funcionário","Cargo","Cliente","Tipo","Data"]];
    filtered.forEach(d => rows.push([d.employee_name||"",d.position||"",d.client_name||"",d.uniform_type||"",d.delivery_date||""]));
    const csv = rows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="uniformes.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">👕 Gestão de Uniformes</h1><p className="text-sm text-gray-400">Controle de entregas de uniformes</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4"/>CSV</Button><Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2"><Plus className="w-4 h-4"/>Nova Entrega</Button></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[{label:"Total Entregas",value:deliveries.length,color:"from-violet-500 to-indigo-600"},{label:"Este Mês",value:deliveries.filter(d=>d.delivery_date?.startsWith(format(new Date(),"yyyy-MM"))).length,color:"from-blue-500 to-cyan-500"},{label:"Contratos",value:allClients.length,color:"from-green-500 to-emerald-500"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filtrar por cliente"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{allClients.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-4xl mb-3">👕</p><p className="text-gray-500">Nenhuma entrega registrada</p>
              <Button onClick={openNew} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Registrar entrega</Button>
            </div>
          ) : filtered.map(d => (
            <Card key={d.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {d.photo_url ? <img src={d.photo_url} alt="entrega" className="w-14 h-14 rounded-xl object-cover flex-shrink-0"/> : <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0"><Shirt className="w-7 h-7 text-violet-400"/></div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{d.employee_name}</p>
                    <p className="text-xs text-gray-400">{d.position} {d.client_name ? `· ${d.client_name}` : ""}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{d.uniform_type||"Uniforme"}</span>
                      <span className="text-xs text-gray-400">{d.delivery_date}</span>
                      {d.items?.length > 0 && <span className="text-xs text-gray-400">{d.items.length} peça(s)</span>}
                    </div>
                    {d.signature_url && <p className="text-xs text-green-500 mt-1">✅ Assinado</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(d)}><Pencil className="w-3.5 h-3.5"/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>del.mutate(d.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
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
              <h2 className="font-bold">{editing?"Editar Entrega":"Nova Entrega de Uniforme"}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Funcionário *</label>
                <Select value={form.employee_email||""} onValueChange={handleEmpSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecionar funcionário"/></SelectTrigger>
                  <SelectContent>
                    {employees.map(e=><SelectItem key={e.id} value={e.user_email||e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!form.employee_email && <Input className="mt-2" placeholder="Ou digitar nome manualmente" value={form.employee_name||""} onChange={e=>setForm(f=>({...f,employee_name:e.target.value}))}/>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cargo</label><Input value={form.position||""} onChange={e=>setForm(f=>({...f,position:e.target.value}))}/></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data de Entrega *</label><Input type="date" value={form.delivery_date} onChange={e=>setForm(f=>({...f,delivery_date:e.target.value}))}/></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente / Contrato</label>
                <Select value={form.client_name||""} onValueChange={v=>setForm(f=>({...f,client_name:v}))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente"/></SelectTrigger>
                  <SelectContent><SelectItem value={null}>Nenhum</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo de Uniforme</label>
                <Select value={form.uniform_type||""} onValueChange={v=>setForm(f=>({...f,uniform_type:v}))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar tipo"/></SelectTrigger>
                  <SelectContent>{UNIFORM_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-xs font-bold text-gray-700">Itens Entregues</label><Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1"/>Item</Button></div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-10 gap-2 items-center mb-2 text-xs">
                    <div className="col-span-4"><Input placeholder="Peça" value={item.item} onChange={e=>updateItem(idx,"item",e.target.value)} className="text-xs h-8"/></div>
                    <div className="col-span-3"><Input placeholder="Tamanho" value={item.size} onChange={e=>updateItem(idx,"size",e.target.value)} className="text-xs h-8"/></div>
                    <div className="col-span-2"><Input type="number" min="1" placeholder="Qtd" value={item.quantity} onChange={e=>updateItem(idx,"quantity",parseInt(e.target.value)||1)} className="text-xs h-8"/></div>
                    <div className="col-span-1"><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={()=>removeItem(idx)}><X className="w-3 h-3"/></Button></div>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Foto da Entrega</label>
                <input type="file" id="unif-photo" className="hidden" accept="image/*" capture="environment" onChange={handleUploadPhoto}/>
                <label htmlFor="unif-photo" className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-violet-400 w-fit">
                  <Camera className="w-4 h-4"/>{uploading?"Enviando...":form.photo_url?"Trocar foto":"Tirar/Enviar foto"}
                </label>
                {form.photo_url && <img src={form.photo_url} alt="preview" className="mt-2 w-28 h-28 rounded-xl object-cover"/>}
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label><textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 resize-none" rows={2} value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.employee_name||!form.delivery_date||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">{save.isPending?"Salvando...":editing?"Atualizar":"Registrar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}