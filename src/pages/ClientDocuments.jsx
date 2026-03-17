import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, X, Trash2, Download, FileText, FileCheck, Receipt, Upload, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

const EMPTY_NF = {
  client_id: "", client_name: "", type: "nota_fiscal",
  title: "", reference_month: format(new Date(), "yyyy-MM"),
  due_date: "", value: 0, notes: "", status: "pendente", file_url: "",
  boleto_title: "", boleto_due_date: "", boleto_value: 0, boleto_file_url: "", add_boleto: false,
};

export default function ClientDocuments() {
  const [user, setUser] = useState(null);
  const [cid, setCid] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_NF);
  const [editing, setEditing] = useState(null);
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadingBoleto, setUploadingBoleto] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setCid(u?.company_id);
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
    mutationFn: async (data) => {
      if (!data.file_url) throw new Error("Arquivo obrigatório");
      const payload = {
        company_id: cid, client_id: data.client_id, client_name: data.client_name,
        type: data.type, title: data.title, reference_month: data.reference_month,
        due_date: data.due_date, value: data.value, notes: data.notes,
        status: data.status, file_url: data.file_url,
      };
      if (editing) {
        await base44.entities.ClientDocument.update(editing.id, payload);
      } else {
        await base44.entities.ClientDocument.create(payload);
        // If NF + boleto together
        if (data.add_boleto && data.boleto_file_url && data.type === "nota_fiscal") {
          await base44.entities.ClientDocument.create({
            company_id: cid, client_id: data.client_id, client_name: data.client_name,
            type: "boleto",
            title: data.boleto_title || `Boleto — ${data.title}`,
            reference_month: data.reference_month,
            due_date: data.boleto_due_date,
            value: data.boleto_value || data.value,
            status: "pendente",
            file_url: data.boleto_file_url,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_docs"] });
      setOpen(false); setEditing(null); setForm(EMPTY_NF);
      toast.success(form.add_boleto ? "NF e boleto enviados!" : "Documento salvo!");
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: (id) => base44.entities.ClientDocument.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_docs"] }); toast.success("Removido!"); },
  });

  const handleUpload = async (e, field = "file_url") => {
    const file = e.target.files[0]; if (!file) return;
    if (field === "file_url") setUploading(true); else setUploadingBoleto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, [field]: file_url }));
      toast.success("Arquivo enviado!");
    } catch { toast.error("Erro ao enviar arquivo"); }
    if (field === "file_url") setUploading(false); else setUploadingBoleto(false);
  };

  const filtered = documents.filter(d => {
    const c = filterClient === "all" || d.client_id === filterClient;
    const t = filterType === "all" || d.type === filterType;
    return c && t;
  });

  const totals = {
    total: documents.length,
    boletos: documents.filter(d => d.type === "boleto").length,
    notas: documents.filter(d => d.type === "nota_fiscal").length,
    pendentes: documents.filter(d => d.status === "pendente").length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-600"/>Documentos do Cliente
          </h1>
          <p className="text-sm text-gray-400">Notas fiscais, boletos e documentos por cliente</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(EMPTY_NF); setOpen(true); }} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Plus className="w-4 h-4"/>Enviar Documento
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totals.total, color: "from-violet-500 to-indigo-600" },
          { label: "Notas Fiscais", value: totals.notas, color: "from-blue-500 to-cyan-500" },
          { label: "Boletos", value: totals.boletos, color: "from-orange-400 to-amber-500" },
          { label: "Pendentes", value: totals.pendentes, color: totals.pendentes > 0 ? "from-yellow-400 to-orange-400" : "from-green-500 to-emerald-500" },
        ].map(k => (
          <div key={k.label} className={`bg-gradient-to-br ${k.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl font-black">{k.value}</p>
            <p className="text-white/70 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Todos os clientes"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Todos os tipos"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(DOC_TYPE).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Carregando...</div> : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200">
              <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300"/>
              <p className="text-gray-500">Nenhum documento encontrado</p>
              <Button onClick={() => setOpen(true)} className="mt-3 bg-violet-600 text-white gap-1"><Plus className="w-4 h-4"/>Enviar agora</Button>
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
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                      <span>🏢 {d.client_name}</span>
                      {d.reference_month && <span>Ref: {d.reference_month}</span>}
                      {d.due_date && <span>Venc: {d.due_date}</span>}
                      {d.value > 0 && <span className="text-gray-700 font-medium">R$ {d.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500"><Download className="w-3.5 h-3.5"/></Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(d); setForm({ ...d, add_boleto: false, boleto_title: "", boleto_due_date: "", boleto_value: 0, boleto_file_url: "" }); setOpen(true); }}>
                      <Edit className="w-3.5 h-3.5"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => del.mutate(d.id)}>
                      <Trash2 className="w-3.5 h-3.5"/>
                    </Button>
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
              <h2 className="font-bold">{editing ? "Editar Documento" : "Enviar Documento"}</h2>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setEditing(null); }}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-5 space-y-4">
              {/* Cliente */}
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</label>
                <Select value={form.client_id || ""} onValueChange={v => { const c = clients.find(c => c.id === v); setForm(f => ({ ...f, client_id: v, client_name: c?.name || "" })); }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente"/></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Tipo + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tipo *</label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(DOC_TYPE).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Título */}
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Título *</label>
                <Input value={form.title || ""} placeholder="Ex: NF 00123 — Março/2026" onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
              </div>

              {/* Mês + Venc */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Mês de Referência</label>
                  <Input type="month" value={form.reference_month || ""} onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))}/></div>
                {form.type === "boleto" && (
                  <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data de Vencimento</label>
                    <Input type="date" value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}/></div>
                )}
              </div>

              {/* Valor */}
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Valor (R$)</label>
                <Input type="number" min="0" step="0.01" value={form.value || 0} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))}/></div>

              {/* Arquivo */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {form.type === "nota_fiscal" ? "📄 Arquivo da Nota Fiscal *" : "📎 Arquivo *"} (PDF, imagem)
                </label>
                <input type="file" id="doc-file" className="hidden" accept="image/*,.pdf" onChange={e => handleUpload(e, "file_url")}/>
                <label htmlFor="doc-file" className={`cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm w-fit transition-colors ${form.file_url ? "border-green-400 text-green-600" : "border-gray-300 text-gray-500 hover:border-violet-400"}`}>
                  <Upload className="w-4 h-4"/>{uploading ? "Enviando..." : form.file_url ? "✅ Enviado — Trocar" : "Selecionar arquivo"}
                </label>
                {form.file_url && <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:underline mt-1 block">Ver arquivo</a>}
              </div>

              {/* Observações */}
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none" rows={2}
                  value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/></div>

              {/* ─── VINCULAR BOLETO (apenas para NF nova) ─── */}
              {form.type === "nota_fiscal" && !editing && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={!!form.add_boleto} onChange={e => setForm(f => ({ ...f, add_boleto: e.target.checked }))} className="w-4 h-4 accent-violet-600"/>
                    <span className="text-sm font-semibold text-gray-700">Vincular boleto a esta nota fiscal</span>
                  </label>
                  {form.add_boleto && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">📋 Dados do Boleto</p>
                      <div><label className="text-xs font-medium text-gray-600 mb-1 block">Título do Boleto</label>
                        <Input value={form.boleto_title || ""} placeholder={`Boleto — ${form.title || "NF"}`}
                          onChange={e => setForm(f => ({ ...f, boleto_title: e.target.value }))}/></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Data de Vencimento</label>
                          <Input type="date" value={form.boleto_due_date || ""} onChange={e => setForm(f => ({ ...f, boleto_due_date: e.target.value }))}/></div>
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Valor (R$)</label>
                          <Input type="number" min="0" step="0.01" value={form.boleto_value || form.value || 0}
                            onChange={e => setForm(f => ({ ...f, boleto_value: parseFloat(e.target.value) || 0 }))}/></div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">📎 Arquivo do Boleto (PDF) *</label>
                        <input type="file" id="boleto-file" className="hidden" accept="image/*,.pdf" onChange={e => handleUpload(e, "boleto_file_url")}/>
                        <label htmlFor="boleto-file" className={`cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm w-fit transition-colors ${form.boleto_file_url ? "border-green-400 text-green-600" : "border-orange-300 text-orange-500 hover:border-orange-500"}`}>
                          <Upload className="w-4 h-4"/>{uploadingBoleto ? "Enviando..." : form.boleto_file_url ? "✅ Enviado — Trocar" : "Selecionar boleto"}
                        </label>
                        {form.boleto_file_url && <a href={form.boleto_file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:underline mt-1 block">Ver boleto</a>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={() => save.mutate(form)} disabled={!form.title || !form.client_id || save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
                {save.isPending ? "Salvando..." : editing ? "Atualizar" : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}