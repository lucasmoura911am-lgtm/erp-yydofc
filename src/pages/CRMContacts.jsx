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
import { Plus, Edit, Trash2, Search, User, Phone, Mail, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", title: "", email: "", phone: "", whatsapp: "", account_id: "", decision_maker: false, notes: "", status: "ativo" };

export default function CRMContacts() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: contacts = [] } = useQuery({ queryKey: ["crm_cont", cid], queryFn: () => base44.entities.CRMContact.filter({ company_id: cid }), enabled: !!cid });
  const { data: accounts = [] } = useQuery({ queryKey: ["crm_acc", cid], queryFn: () => base44.entities.CRMAccount.filter({ company_id: cid }), enabled: !!cid });

  const createMutation = useMutation({ mutationFn: (d) => base44.entities.CRMContact.create({ ...d, company_id: cid }), onSuccess: () => { qc.invalidateQueries(["crm_cont"]); toast.success("Contato criado!"); setDialogOpen(false); setFormData(emptyForm); } });
  const updateMutation = useMutation({ mutationFn: ({ id, d }) => base44.entities.CRMContact.update(id, d), onSuccess: () => { qc.invalidateQueries(["crm_cont"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.CRMContact.delete(id), onSuccess: () => { qc.invalidateQueries(["crm_cont"]); toast.success("Excluído!"); } });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, d: formData });
    else createMutation.mutate(formData);
  };

  const openEdit = (c) => { setEditing(c); setFormData({ ...emptyForm, ...c }); setDialogOpen(true); };

  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    accounts.find(a => a.id === c.account_id)?.trade_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contatos</h1>
          <p className="text-gray-500 text-sm">{contacts.length} contatos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); }} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Contato</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                <div><Label>Cargo</Label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={formData.account_id || "none"} onValueChange={v => setFormData({ ...formData, account_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.trade_name || a.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>E-mail</Label><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div className="col-span-2"><Label>WhatsApp</Label><Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} /></div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="dm" checked={formData.decision_maker} onChange={e => setFormData({ ...formData, decision_maker: e.target.checked })} />
                  <label htmlFor="dm" className="text-sm font-medium flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500" /> Tomador de decisão</label>
                </div>
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input className="pl-9" placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const acc = accounts.find(a => a.id === c.account_id);
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-700 font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm">{c.name}</p>
                        {c.decision_maker && <Star className="w-3.5 h-3.5 text-yellow-500" />}
                      </div>
                      <p className="text-xs text-gray-500">{c.title || "—"}</p>
                    </div>
                  </div>
                </div>
                {acc && <p className="text-xs text-indigo-600 font-medium mb-2">{acc.trade_name || acc.legal_name}</p>}
                <div className="space-y-1 text-xs text-gray-500">
                  {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{c.phone}</div>}
                  {c.whatsapp && <div className="flex items-center gap-1.5 text-green-600"><MessageCircle className="w-3 h-3" />{c.whatsapp}</div>}
                </div>
                <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => openEdit(c)}><Edit className="w-3 h-3 mr-1" /> Editar</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(c.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum contato cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
}