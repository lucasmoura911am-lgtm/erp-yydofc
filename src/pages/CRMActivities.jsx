import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Phone, Video, MessageCircle, Mail, MapPin, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TYPE_CONFIG = {
  ligacao: { icon: Phone, color: "text-blue-600 bg-blue-50", label: "Ligação" },
  reuniao: { icon: Video, color: "text-purple-600 bg-purple-50", label: "Reunião" },
  whatsapp: { icon: MessageCircle, color: "text-green-600 bg-green-50", label: "WhatsApp" },
  email: { icon: Mail, color: "text-orange-600 bg-orange-50", label: "E-mail" },
  visita: { icon: MapPin, color: "text-red-600 bg-red-50", label: "Visita" },
  follow_up: { icon: RefreshCw, color: "text-cyan-600 bg-cyan-50", label: "Follow-up" },
  outro: { icon: RefreshCw, color: "text-gray-600 bg-gray-50", label: "Outro" }
};

const emptyForm = {
  type: "ligacao", date: format(new Date(), "yyyy-MM-dd"), time: "", responsible_name: "", responsible_email: "",
  account_id: "", contact_id: "", opportunity_id: "", description: "", outcome: "", status: "agendada",
  duration_minutes: "", next_action: "", next_action_date: "", contact_person: ""
};

export default function CRMActivities() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: activities = [] } = useQuery({ queryKey: ["crm_act", cid], queryFn: () => base44.entities.CRMActivity.filter({ company_id: cid }), enabled: !!cid });
  const { data: accounts = [] } = useQuery({ queryKey: ["crm_acc", cid], queryFn: () => base44.entities.CRMAccount.filter({ company_id: cid }), enabled: !!cid });
  const { data: contacts = [] } = useQuery({ queryKey: ["crm_cont", cid], queryFn: () => base44.entities.CRMContact.filter({ company_id: cid }), enabled: !!cid });
  const { data: opportunities = [] } = useQuery({ queryKey: ["crm_opp", cid], queryFn: () => base44.entities.CRMOpportunity.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({ mutationFn: (d) => base44.entities.CRMActivity.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["crm_act"]); toast.success("Atividade criada!"); setDialogOpen(false); setFormData(emptyForm); } });
  const updateMutation = useMutation({ mutationFn: ({ id, d }) => base44.entities.CRMActivity.update(id, d), onSuccess: () => { qc.invalidateQueries(["crm_act"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.CRMActivity.delete(id), onSuccess: () => { qc.invalidateQueries(["crm_act"]); toast.success("Excluído!"); } });

  const handleSubmit = (e) => {
    e.preventDefault();
    const d = { ...formData, duration_minutes: parseInt(formData.duration_minutes) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  const markDone = (a) => updateMutation.mutate({ id: a.id, d: { ...a, status: "realizada" } });
  const openEdit = (a) => { setEditing(a); setFormData({ ...emptyForm, ...a }); setDialogOpen(true); };

  const filtered = activities.filter(a => {
    const tt = filterType === "all" || a.type === filterType;
    const st = filterStatus === "all" || a.status === filterStatus;
    return tt && st;
  }).sort((a, b) => b.date?.localeCompare(a.date));

  // Stats
  const total = activities.length;
  const calls = activities.filter(a => a.type === "ligacao").length;
  const meetings = activities.filter(a => a.type === "reuniao").length;
  const done = activities.filter(a => a.status === "realizada").length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Atividades Comerciais</h1>
          <p className="text-gray-500 text-sm">{total} atividades · {calls} ligações · {meetings} reuniões</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> Nova Atividade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Atividade</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo *</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data *</Label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required /></div>
                <div><Label>Hora</Label><Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} /></div>
                <div><Label>Com quem falou</Label><Input value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} placeholder="Nome da pessoa" /></div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={formData.account_id || "none"} onValueChange={v => setFormData({ ...formData, account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.trade_name || a.legal_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contato</Label>
                  <Select value={formData.contact_id || "none"} onValueChange={v => setFormData({ ...formData, contact_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Oportunidade</Label>
                  <Select value={formData.opportunity_id || "none"} onValueChange={v => setFormData({ ...formData, opportunity_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {opportunities.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Responsável</Label><Input value={formData.responsible_name} onChange={e => setFormData({ ...formData, responsible_name: e.target.value })} /></div>
                <div><Label>Duração (min)</Label><Input type="number" value={formData.duration_minutes} onChange={e => setFormData({ ...formData, duration_minutes: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendada">Agendada</SelectItem>
                      <SelectItem value="realizada">Realizada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                <div className="col-span-2"><Label>Resultado / Outcome</Label><Textarea rows={2} value={formData.outcome} onChange={e => setFormData({ ...formData, outcome: e.target.value })} /></div>
                <div className="col-span-2"><Label>Próxima ação</Label><Input value={formData.next_action} onChange={e => setFormData({ ...formData, next_action: e.target.value })} /></div>
                <div><Label>Data próxima ação</Label><Input type="date" value={formData.next_action_date} onChange={e => setFormData({ ...formData, next_action_date: e.target.value })} /></div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">{editing ? "Atualizar" : "Criar"}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(TYPE_CONFIG).slice(0,4).map(([k, v]) => {
          const count = activities.filter(a => a.type === k).length;
          const Icon = v.icon;
          return (
            <Card key={k} className="cursor-pointer hover:shadow-sm" onClick={() => setFilterType(filterType === k ? "all" : k)}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${v.color}`}><Icon className="w-4 h-4" /></div>
                <div><p className="text-xs text-gray-500">{v.label}s</p><p className="font-bold text-lg">{count}</p></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
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
                  {["Tipo", "Data / Hora", "Com quem", "Empresa", "Descrição", "Responsável", "Status", "Ações"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(a => {
                  const tc = TYPE_CONFIG[a.type] || TYPE_CONFIG.outro;
                  const Icon = tc.icon;
                  const acc = accounts.find(ac => ac.id === a.account_id);
                  return (
                    <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${a.status === "realizada" ? "opacity-70" : ""}`}>
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tc.color}`}><Icon className="w-4 h-4" /></div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.date}</p>
                        {a.time && <p className="text-xs text-gray-400">{a.time}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.contact_person || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{acc?.trade_name || acc?.legal_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{a.description || a.outcome || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{a.responsible_name || "—"}</td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${a.status==="realizada"?"bg-green-100 text-green-700":a.status==="cancelada"?"bg-red-100 text-red-700":"bg-yellow-100 text-yellow-700"}`}>{a.status}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {a.status === "agendada" && <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => markDone(a)}><Check className="w-3.5 h-3.5" /></Button>}
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(a)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(a.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">Nenhuma atividade</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}