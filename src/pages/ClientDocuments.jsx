import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Trash2, Download, FileText, FileCheck, Receipt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const today = format(new Date(), "yyyy-MM-dd");

const DOC_TYPE = {
  nota_fiscal: { label: "Nota Fiscal", color: "bg-blue-100 text-blue-700" },
  boleto: { label: "Boleto", color: "bg-orange-100 text-orange-700" },
  contrato: { label: "Contrato", color: "bg-purple-100 text-purple-700" },
  relatorio: { label: "Relatório", color: "bg-teal-100 text-teal-700" },
  outro: { label: "Outro", color: "bg-gray-100 text-gray-600" },
};

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  pago: { label: "Pago", color: "bg-green-100 text-green-700" },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-500" },
};

const EMPTY = { client_id: "", client_name: "", type: "nota_fiscal", title: "", reference_month: format(new Date(), "yyyy-MM"), due_date: "", value: 0, notes: "", status: "pendente", file_url: "" };

export default function ClientDocuments() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.company_id) { setCid(u.company_id); return; }
      base44.entities.Employee.filter({ user_email: u.email }).then(emps => { if (emps[0]?.company_id) setCid(emps[0].company_id); });
    });
  }, []);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["client_docs", cid],
    queryFn: () => base44.entities.ClientDocument.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_list", cid],
    queryFn: () => base44.entities.Client.filter({ company_id: cid }),
    enabled: !!cid,
  });

  const save = useMutation({
    mutationFn: (data) => {
      if (!data.file_url) throw new Error("Arquivo obrigatório");
      const payload = { ...data, company_id: cid };
      return editing ? base44.entities.ClientDocument.update(editing.id, payload) : base44.entities.ClientDocument.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_docs"] }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success("Documento salvo!"); },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.ClientDocument.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_docs"] }); toast.success("Removido!"); },
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setForm(f => ({ ...f, file_url })); toast.success("Arquivo enviado!"); }
    catch { toast.error("Erro ao enviar arquivo"); }
    setUploading(false);
  };

  const filtered = documents.filter(d => {
    const c = filterClient === "all" || d.client_id === filterClient;
    const t = filterType === "all" || d.type === filterType;
    return c && t;
  });

  const totals = { total: documents.length, boletos: documents.filter(d=>d.type==="boleto").length, notas: documents.filter(d=>d.type==="nota_fiscal").length, pendentes: documents.filter(d=>d.status==="pendente").length };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">📁 Documentos do Cliente</h1>
          <p className="text-sm text-gray-400">Notas fiscais, boletos e documentos por cliente</p>
        </div>
        <Button onClick={()=>{setEditing(null);setForm(EMPTY);setOpen(true);}} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Plus className="w-4 h-4"/>Enviar Documento
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{label:"Total",value:totals.total,color:"from-violet-500 to-indigo-600"},{label:"Notas Fiscais",value:totals.notas,color:"from-blue-500 to-cyan-500"},{label:"Boletos",value:totals.boletos,color:"from-orange-400 to-amber-500"},{label:"Pendentes",value:totals.pendentes,color:totals.pendentes>0?"from-yellow-400 to-orange-400":"from-green-500 to-emerald-500"}].map(k=>(
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p><p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os clientes"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os tipos"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{Object.entries(DOC_TYPE).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl">
              <p className="text-4xl mb-3">📁</p><p className="text-gray-500">Nenhum documento encontrado</p>
              <Button onClick={()=>setOpen(true)} className="mt-3 bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1"/>Enviar agora</Button>
            </div>
          ) : filtered.map(d => (
            <Card key={d.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${DOC_TYPE[d.type]?.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {d.type === "boleto" ? <Receipt className="w-5 h-5"/> : d.type === "nota_fiscal" ? <FileCheck className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{d.title}</p>
                      <Badge className={DOC_TYPE[d.type]?.color}>{DOC_TYPE[d.type]?.label}</Badge>
                      <Badge className={STATUS_CONFIG[d.status]?.color}>{STATUS_CONFIG[d.status]?.label}</Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      <span>🏢 {d.client_name}</span>
                      {d.reference_month && <span>Ref: {d.reference_month}</span>}
                      {d.due_date && <span>Venc: {d.due_date}</span>}
                      {d.value > 0 && <span className="text-gray-700 font-medium">R$ {d.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500"><Download className="w-3.5 h-3.5"/></Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>{setEditing(d);setForm({...d});setOpen(true);}}><FileText className="w-3.5 h-3.5"/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={()=>del.mutate(d.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="font-bold">{editing?"Editar Documento":"Enviar Documento"}</h2>
              <Button variant="ghost" size="icon" onClick={()=>{setOpen(false);setEditing(null);}}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
                <Select value={form.client_id||""} onValueChange={v=>{const c=clients.find(c=>c.id===v);setForm(f=>({...f,client_id:v,client_name:c?.name||""}));}}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente"/></SelectTrigger>
                  <SelectContent>{clients.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo *</label>
                  <Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(DOC_TYPE).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_CONFIG).map(([v,c])=><SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Título / Descrição *</label>
                <Input value={form.title||""} placeholder="Ex: NF 00123 — Março/2026" onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Mês de Referência</label>
                  <Input type="month" value={form.reference_month||""} onChange={e=>setForm(f=>({...f,reference_month:e.target.value}))}/></div>
                {form.type === "boleto" && <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data de Vencimento</label>
                  <Input type="date" value={form.due_date||""} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/></div>}
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Valor (R$)</label>
                <Input type="number" min="0" step="0.01" value={form.value||0} onChange={e=>setForm(f=>({...f,value:parseFloat(e.target.value)||0}))}/></div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">📎 Arquivo * (PDF, imagem)</label>
                <input type="file" id="doc-file" className="hidden" accept="image/*,.pdf" onChange={handleUpload}/>
                <label htmlFor="doc-file" className={`cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm w-fit transition-colors ${form.file_url?"border-green-400 text-green-600":"border-gray-300 text-gray-500 hover:border-violet-400"}`}>
                  <Upload className="w-4 h-4"/>{uploading?"Enviando...":form.file_url?"✅ Arquivo enviado — Trocar":"Selecionar arquivo"}
                </label>
                {form.file_url && <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:underline mt-1 block">Ver arquivo</a>}
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none" rows={2} value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</Button>
              <Button onClick={()=>save.mutate(form)} disabled={!form.title||!form.client_id||save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
                {save.isPending?"Salvando...":editing?"Atualizar":"Enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}