import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Building2, Search, ExternalLink, Copy, Eye, EyeOff, Globe } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  name: "", cnpj: "", contact_person: "", contact_email: "", contact_phone: "", address: "", status: "ativo",
  portal_email: "", portal_password: "", portal_active: false
};

export default function Clients() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create({ ...data, company_id: user.company_id }),
    onSuccess: () => { queryClient.invalidateQueries(["clients"]); toast.success("Cliente criado!"); resetForm(); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["clients"]); toast.success("Cliente atualizado!"); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(["clients"]); toast.success("Cliente excluído!"); }
  });

  const resetForm = () => { setFormData(EMPTY_FORM); setEditingClient(null); setDialogOpen(false); };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || "", cnpj: client.cnpj || "",
      contact_person: client.contact_person || "", contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "", address: client.address || "",
      status: client.status || "ativo",
      portal_email: client.portal_email || "", portal_password: client.portal_password || "",
      portal_active: client.portal_active || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingClient) updateMutation.mutate({ id: editingClient.id, data: formData });
    else createMutation.mutate(formData);
  };

  const getPortalLink = (client) => {
    const base = window.location.origin + "/ClientPortal";
    if (client.portal_email) return `${base}?email=${encodeURIComponent(client.portal_email)}`;
    return base;
  };

  const copyLink = (client) => {
    navigator.clipboard.writeText(getPortalLink(client));
    toast.success("Link copiado!");
  };

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.cnpj?.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600"/>Gestão de Clientes
          </h1>
          <p className="text-sm text-gray-400">Gerencie clientes e credenciais do portal</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4"/>Novo Cliente
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
            <Input placeholder="Buscar por nome ou CNPJ..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="pl-9"/>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Email Contato</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map(client => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.cnpj || "-"}</TableCell>
                  <TableCell>{client.contact_person || "-"}</TableCell>
                  <TableCell>{client.contact_email || "-"}</TableCell>
                  <TableCell>
                    {client.portal_active ? (
                      <div className="flex items-center gap-1">
                        <Badge className="bg-green-100 text-green-700 text-xs">✅ Ativo</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-violet-500" onClick={()=>copyLink(client)}>
                          <Copy className="w-3 h-3"/>
                        </Button>
                        <a href={getPortalLink(client)} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500"><ExternalLink className="w-3 h-3"/></Button>
                        </a>
                      </div>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-500 text-xs">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === "ativo" ? "default" : "secondary"}>{client.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}><Edit className="w-4 h-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este cliente?")) deleteMutation.mutate(client.id); }}>
                      <Trash2 className="w-4 h-4 text-red-500"/>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-12">Nenhum cliente encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome do Cliente *</Label><Input required value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})}/></div>
              <div><Label>CNPJ</Label><Input value={formData.cnpj} onChange={e=>setFormData({...formData,cnpj:e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Pessoa de Contato</Label><Input value={formData.contact_person} onChange={e=>setFormData({...formData,contact_person:e.target.value})}/></div>
              <div><Label>Telefone</Label><Input value={formData.contact_phone} onChange={e=>setFormData({...formData,contact_phone:e.target.value})}/></div>
            </div>
            <div><Label>Email de Contato</Label><Input type="email" value={formData.contact_email} onChange={e=>setFormData({...formData,contact_email:e.target.value})}/></div>
            <div><Label>Endereço</Label><Textarea value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})}/></div>
            <div><Label>Status</Label>
              <Select value={formData.status} onValueChange={v=>setFormData({...formData,status:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>

            {/* Portal Section */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-violet-500"/>
                <h3 className="font-bold text-sm text-gray-800">Acesso ao Portal do Cliente</h3>
              </div>
              <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-200 mb-3">
                <input type="checkbox" id="portal_active" checked={!!formData.portal_active} onChange={e=>setFormData({...formData,portal_active:e.target.checked})} className="w-4 h-4 accent-violet-600"/>
                <label htmlFor="portal_active" className="text-sm font-medium text-gray-700 cursor-pointer">Ativar portal para este cliente</label>
              </div>
              {formData.portal_active && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email de Acesso ao Portal</Label>
                    <Input type="email" placeholder="cliente@empresa.com" value={formData.portal_email} onChange={e=>setFormData({...formData,portal_email:e.target.value})}/>
                  </div>
                  <div><Label>Senha do Portal</Label>
                    <div className="relative">
                      <Input type={showPass.form?"text":"password"} placeholder="senha123" value={formData.portal_password} onChange={e=>setFormData({...formData,portal_password:e.target.value})}/>
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" onClick={()=>setShowPass(p=>({...p,form:!p.form}))}>
                        {showPass.form ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                  {editingClient?.portal_active && (
                    <div className="col-span-2">
                      <Label>Link de Acesso</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input readOnly value={getPortalLink(editingClient)} className="text-xs bg-gray-50"/>
                        <Button type="button" variant="outline" size="sm" onClick={()=>copyLink(editingClient)}><Copy className="w-4 h-4"/></Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white">{editingClient ? "Atualizar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}