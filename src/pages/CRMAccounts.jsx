import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Search, Building2, Phone, Mail, Globe, MapPin, Users, TrendingUp, Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = { prospecto: "bg-blue-100 text-blue-700", ativo: "bg-green-100 text-green-700", inativo: "bg-gray-100 text-gray-500", cliente: "bg-purple-100 text-purple-700" };
const emptyForm = { legal_name: "", trade_name: "", cnpj: "", segment: "", phone: "", email: "", website: "", city: "", state: "", address: "", responsible_name: "", responsible_email: "", status: "prospecto", annual_revenue: "", employee_count: "", notes: "" };

export default function CRMAccounts() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: accounts = [] } = useQuery({ queryKey: ["crm_acc", cid], queryFn: () => base44.entities.CRMAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: contacts = [] } = useQuery({ queryKey: ["crm_cont", cid], queryFn: () => base44.entities.CRMContact.filter({ company_id: cid }), enabled: !!cid });
  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });
  const { data: proposals = [] } = useQuery({ queryKey: ["crm_prop", cid], queryFn: () => base44.entities.CRMProposal.filter({ company_id: cid }), enabled: !!cid });
  const { data: activities = [] } = useQuery({ queryKey: ["crm_act", cid], queryFn: () => base44.entities.CRMActivity.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({ mutationFn: (d) => base44.entities.CRMAccount.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["crm_acc"]); toast.success("Conta criada!"); setDialogOpen(false); setFormData(emptyForm); } });
  const updateMutation = useMutation({ mutationFn: ({ id, d }) => base44.entities.CRMAccount.update(id, d), onSuccess: () => { qc.invalidateQueries(["crm_acc"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.CRMAccount.delete(id), onSuccess: () => { qc.invalidateQueries(["crm_acc"]); setSelected(null); toast.success("Excluído!"); } });

  const handleSubmit = (e) => {
    e.preventDefault();
    const d = { ...formData, annual_revenue: parseFloat(formData.annual_revenue) || 0, employee_count: parseInt(formData.employee_count) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  const openEdit = (a) => { setEditing(a); setFormData({ ...emptyForm, ...a }); setDialogOpen(true); };
  const filtered = accounts.filter(a => a.legal_name?.toLowerCase().includes(search.toLowerCase()) || a.trade_name?.toLowerCase().includes(search.toLowerCase()) || a.cnpj?.includes(search));

  const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Empresas (Contas)</h1>
          <p className="text-gray-500 text-sm">{accounts.length} contas</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormData(emptyForm); setDialogOpen(true); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
          <Plus className="w-4 h-4 mr-2" /> Nova Conta
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* List */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-9" placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2 max-h-[65vh] overflow-y-auto">
            {filtered.map(a => (
              <div key={a.id}
                onClick={() => setSelected(a)}
                className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${selected?.id === a.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 bg-white dark:bg-gray-900 hover:border-gray-300"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{a.trade_name || a.legal_name}</p>
                      {a.trade_name && <p className="text-xs text-gray-400">{a.legal_name}</p>}
                    </div>
                  </div>
                  <Badge className={`text-xs ${STATUS_COLORS[a.status]}`}>{a.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  {a.segment && <span>{a.segment}</span>}
                  {a.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{a.city}</span>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 py-6">Nenhuma conta</p>}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{selected.trade_name || selected.legal_name}</CardTitle>
                  {selected.trade_name && <p className="text-sm text-gray-500">{selected.legal_name}</p>}
                  <div className="flex gap-2 mt-2">
                    <Badge className={`text-xs ${STATUS_COLORS[selected.status]}`}>{selected.status}</Badge>
                    {selected.segment && <Badge variant="outline" className="text-xs">{selected.segment}</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(selected)}><Edit className="w-3.5 h-3.5 mr-1" /> Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir conta?")) deleteMutation.mutate(selected.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {selected.cnpj && <div><span className="text-gray-500">CNPJ:</span> {selected.cnpj}</div>}
                  {selected.phone && <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{selected.phone}</div>}
                  {selected.email && <div className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" />{selected.email}</div>}
                  {selected.website && <div className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-gray-400" />{selected.website}</div>}
                  {(selected.city || selected.state) && <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{[selected.city, selected.state].filter(Boolean).join(", ")}</div>}
                  {selected.responsible_name && <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" />{selected.responsible_name}</div>}
                  {selected.annual_revenue > 0 && <div><span className="text-gray-500">Faturamento:</span> {fmt(selected.annual_revenue)}/ano</div>}
                </div>

                <Tabs defaultValue="contacts">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="contacts">Contatos ({contacts.filter(c=>c.account_id===selected.id).length})</TabsTrigger>
                    <TabsTrigger value="opps">Oportunidades ({opportunities.filter(o=>o.account_id===selected.id).length})</TabsTrigger>
                    <TabsTrigger value="proposals">Propostas ({proposals.filter(p=>p.account_id===selected.id).length})</TabsTrigger>
                    <TabsTrigger value="activities">Atividades ({activities.filter(a=>a.account_id===selected.id).length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="contacts" className="mt-3 space-y-2">
                    {contacts.filter(c=>c.account_id===selected.id).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.title} {c.email && `· ${c.email}`}</p>
                        </div>
                        {c.decision_maker && <Badge className="text-xs bg-yellow-100 text-yellow-700">Decisor</Badge>}
                      </div>
                    ))}
                    {contacts.filter(c=>c.account_id===selected.id).length === 0 && <p className="text-sm text-gray-400 text-center py-3">Sem contatos vinculados</p>}
                  </TabsContent>
                  <TabsContent value="opps" className="mt-3 space-y-2">
                    {opportunities.filter(o=>o.account_id===selected.id).map(o => (
                      <div key={o.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{o.title}</p>
                          <p className="text-xs text-gray-500">{o.stage?.replace("_"," ")} · {fmt(o.value)}</p>
                        </div>
                        <Badge className={`text-xs ${o.stage==="fechado_ganho"?"bg-green-100 text-green-700":o.stage==="fechado_perdido"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{o.probability}%</Badge>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="proposals" className="mt-3 space-y-2">
                    {proposals.filter(p=>p.account_id===selected.id).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs text-gray-500">{p.number} · {fmt(p.final_value || p.total_value)}</p>
                        </div>
                        <Badge className={`text-xs ${p.status==="aprovada"?"bg-green-100 text-green-700":p.status==="rejeitada"?"bg-red-100 text-red-700":"bg-yellow-100 text-yellow-700"}`}>{p.status}</Badge>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="activities" className="mt-3 space-y-2">
                    {activities.filter(a=>a.account_id===selected.id).sort((a,b)=>b.date?.localeCompare(a.date)).slice(0,10).map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium capitalize">{a.type.replace("_"," ")} — {a.date}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{a.description || a.outcome || "—"}</p>
                        </div>
                        <Badge className={`text-xs ${a.status==="realizada"?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{a.status}</Badge>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <div className="text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selecione uma empresa para ver os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Conta</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Razão Social *</Label><Input value={formData.legal_name} onChange={e => setFormData({ ...formData, legal_name: e.target.value })} required /></div>
              <div><Label>Nome Fantasia</Label><Input value={formData.trade_name} onChange={e => setFormData({ ...formData, trade_name: e.target.value })} /></div>
              <div><Label>CNPJ</Label><Input value={formData.cnpj} onChange={e => setFormData({ ...formData, cnpj: e.target.value })} /></div>
              <div><Label>Segmento</Label><Input value={formData.segment} onChange={e => setFormData({ ...formData, segment: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} /></div>
              <div><Label>Responsável Comercial</Label><Input value={formData.responsible_name} onChange={e => setFormData({ ...formData, responsible_name: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["prospecto","ativo","inativo","cliente"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Faturamento Anual</Label><Input type="number" value={formData.annual_revenue} onChange={e => setFormData({ ...formData, annual_revenue: e.target.value })} /></div>
              <div><Label>Nº Funcionários</Label><Input type="number" value={formData.employee_count} onChange={e => setFormData({ ...formData, employee_count: e.target.value })} /></div>
              <div className="col-span-2"><Label>Endereço</Label><Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}