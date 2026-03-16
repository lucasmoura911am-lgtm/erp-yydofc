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
import { Plus, Edit, Trash2, Search, Truck, Building2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "", cnpj_cpf: "", contact_person: "", contact_email: "", contact_phone: "",
  address: "", category: "", bank_name: "", bank_agency: "", bank_account: "",
  notes: "", status: "ativo"
};

export default function SuppliersPage() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const cid = user?.company_id;

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", cid],
    queryFn: () => base44.entities.Supplier.filter({ company_id: cid }),
    enabled: !!cid
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Supplier.create({ ...d, company_id: cid }),
    onSuccess: () => { qc.invalidateQueries(["suppliers"]); toast.success("Fornecedor cadastrado!"); setDialogOpen(false); setFormData(emptyForm); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Supplier.update(id, d),
    onSuccess: () => { qc.invalidateQueries(["suppliers"]); toast.success("Atualizado!"); setDialogOpen(false); setEditing(null); setFormData(emptyForm); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries(["suppliers"]); toast.success("Excluído!"); }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, d: formData });
    else createMutation.mutate(formData);
  };

  const openEdit = (s) => { setEditing(s); setFormData({ ...emptyForm, ...s }); setDialogOpen(true); };
  const openNew = () => { setEditing(null); setFormData(emptyForm); setDialogOpen(true); };

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.cnpj_cpf?.includes(search) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const active = suppliers.filter(s => s.status === "ativo").length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fornecedores</h1>
          <p className="text-gray-500 text-sm">{active} ativos · {suppliers.length} total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-to-r from-orange-500 to-red-600">
              <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label>CNPJ / CPF</Label>
                  <Input value={formData.cnpj_cpf} onChange={e => setFormData({ ...formData, cnpj_cpf: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Ex: TI, Limpeza, Alimentação..." />
                </div>
                <div>
                  <Label>Pessoa de Contato</Label>
                  <Input value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>

                {/* Dados bancários */}
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-t pt-3">Dados Bancários / PIX</p>
                </div>
                <div>
                  <Label>Banco</Label>
                  <Input value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input value={formData.bank_agency} onChange={e => setFormData({ ...formData, bank_agency: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Conta / Chave PIX</Label>
                  <Input value={formData.bank_account} onChange={e => setFormData({ ...formData, bank_account: e.target.value })} placeholder="Número da conta ou chave PIX" />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-red-600">
                  {editing ? "Atualizar" : "Cadastrar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input className="pl-9" placeholder="Buscar por nome, CNPJ, categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => (
          <Card key={s.id} className={`hover:shadow-md transition-shadow ${s.status === "inativo" ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight">{s.name}</p>
                    {s.cnpj_cpf && <p className="text-xs text-gray-400">{s.cnpj_cpf}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge className={s.status === "ativo" ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                    {s.status}
                  </Badge>
                </div>
              </div>

              {s.category && (
                <Badge variant="outline" className="text-xs mb-2">{s.category}</Badge>
              )}

              <div className="space-y-1 text-xs text-gray-500">
                {s.contact_person && (
                  <div className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />{s.contact_person}</div>
                )}
                {s.contact_phone && (
                  <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.contact_phone}</div>
                )}
                {s.contact_email && (
                  <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{s.contact_email}</div>
                )}
                {s.bank_account && (
                  <div className="flex items-center gap-1.5 text-purple-600">
                    <span className="font-medium">PIX/Conta:</span> {s.bank_account}
                  </div>
                )}
              </div>

              <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => openEdit(s)}>
                  <Edit className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (confirm("Excluir fornecedor?")) deleteMutation.mutate(s.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum fornecedor cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
}