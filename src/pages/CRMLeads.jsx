import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Search, UserPlus, Phone, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = { novo: "bg-blue-100 text-blue-700", contactado: "bg-yellow-100 text-yellow-700", qualificado: "bg-purple-100 text-purple-700", convertido: "bg-green-100 text-green-700", descartado: "bg-gray-100 text-gray-500" };
const ORIGINS = ["site","indicacao","linkedin","google_ads","cold_call","evento","email_marketing","whatsapp","outro"];

const emptyForm = { name: "", company_name: "", email: "", phone: "", whatsapp: "", origin: "outro", segment: "", responsible_name: "", responsible_email: "", status: "novo", notes: "", cnpj_cpf: "", city: "", state: "", estimated_value: "" };

export default function CRMLeads() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState("all");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: leads = [] } = useQuery({ queryKey: ["crm_leads", cid], queryFn: () => base44.entities.CRMLead.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.CRMLead.create({ ...d, company_id: cid }),
    onSuccess: () => { qc.invalidateQueries(["crm_leads"]); toast.success("Lead criado!"); setDialogOpen(false); setFormData(emptyForm); }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => base44.entities.CRMLead.update(id, d),
    onSuccess: () => { qc.invalidateQueries(["crm_leads"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CRMLead.delete(id),
    onSuccess: () => { qc.invalidateQueries(["crm_leads"]); toast.success("Excluído!"); }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const d = { ...formData, estimated_value: parseFloat(formData.estimated_value) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  const convertToOpportunity = async (lead) => {
    await base44.entities.CRMOpportunity.create({
      company_id: cid,
      title: `Oportunidade - ${lead.company_name || lead.name}`,
      lead_id: lead.id,
      value: lead.estimated_value || 0,
      stage: "contato_realizado",
      probability: 20,
      responsible_name: lead.responsible_name,
      responsible_email: lead.responsible_email,
      origin: lead.origin,
      notes: lead.notes
    });
    await base44.entities.CRMLead.update(lead.id, { status: "convertido" });
    qc.invalidateQueries(["crm_leads"]);
    qc.invalidateQueries(["crm_opp"]);
    toast.success("Lead convertido em oportunidade!");
  };

  const filtered = leads.filter(l => {
    const ms = l.name?.toLowerCase().includes(search.toLowerCase()) || l.company_name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase());
    const st = filterStatus === "all" || l.status === filterStatus;
    const or = filterOrigin === "all" || l.origin === filterOrigin;
    return ms && st && or;
  });

  const openEdit = (l) => { setEditing(l); setFormData({ ...emptyForm, ...l }); setDialogOpen(true); };

  const FormDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Lead</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div><Label>Empresa</Label><Input value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} /></div>
            <div>
              <Label>Origem</Label>
              <Select value={formData.origin} onValueChange={v => setFormData({ ...formData, origin: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map(o => <SelectItem key={o} value={o}>{o.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Segmento</Label><Input value={formData.segment} onChange={e => setFormData({ ...formData, segment: e.target.value })} /></div>
            <div><Label>Valor Estimado (R$)</Label><Input type="number" step="0.01" value={formData.estimated_value} onChange={e => setFormData({ ...formData, estimated_value: e.target.value })} /></div>
            <div><Label>Responsável</Label><Input value={formData.responsible_name} onChange={e => setFormData({ ...formData, responsible_name: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["novo","contactado","qualificado","convertido","descartado"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cidade</Label><Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
            <div><Label>Estado</Label><Input value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-gray-500 text-sm">{leads.length} leads · {leads.filter(l=>l.status==="novo").length} novos</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormData(emptyForm); setDialogOpen(true); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </div>
      <FormDialog />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar lead..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {["novo","contactado","qualificado","convertido","descartado"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOrigin} onValueChange={setFilterOrigin}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {ORIGINS.map(o => <SelectItem key={o} value={o}>{o.replace("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Nome", "Empresa", "Contato", "Origem", "Segmento", "Responsável", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium">{l.name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.company_name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {l.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail className="w-3 h-3" />{l.email}</span>}
                        {l.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone className="w-3 h-3" />{l.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{l.origin?.replace("_"," ") || "—"}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.segment || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.responsible_name || "—"}</td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${STATUS_COLORS[l.status]}`}>{l.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {l.status !== "convertido" && l.status !== "descartado" && (
                          <Button size="sm" variant="ghost" className="h-7 text-green-600" title="Converter em Oportunidade" onClick={() => convertToOpportunity(l)}>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(l)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(l.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Nenhum lead encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}