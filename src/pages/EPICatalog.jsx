import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, HardHat, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EMPTY = { name: "", description: "", ca_number: "", validity_months: 12, manufacturer: "", active: true };

export default function EPICatalog() {
  const [user, setUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: epis = [] } = useQuery({
    queryKey: ["epis", user?.company_id],
    queryFn: () => base44.entities.EPI.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.EPI.create(d),
    onSuccess: () => { qc.invalidateQueries(["epis"]); close_(); toast({ title: "EPI cadastrado!" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["epis"]); close_(); toast({ title: "EPI atualizado!" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.EPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(["epis"]); toast({ title: "EPI excluído" }); },
  });

  const close_ = () => { setShowDialog(false); setEditing(null); setForm(EMPTY); };

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowDialog(true); };

  const openEdit = (e) => {
    setEditing(e);
    setForm({ name: e.name, description: e.description || "", ca_number: e.ca_number || "", validity_months: e.validity_months || 12, manufacturer: e.manufacturer || "", active: e.active !== false });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Informe o nome do EPI", variant: "destructive" });
    const payload = { ...form, company_id: user.company_id };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const filtered = epis.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.ca_number?.includes(search));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cadastro de EPIs</h1>
            <p className="text-gray-500 text-sm">Equipamentos de Proteção Individual</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-yellow-500 to-orange-500">
          <Plus className="w-4 h-4 mr-2" /> Novo EPI
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por nome ou CA..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CA Nº</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Nenhum EPI cadastrado</TableCell></TableRow>
              )}
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{e.name}</p>
                      {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell><span className="font-mono text-sm">{e.ca_number || "—"}</span></TableCell>
                  <TableCell>{e.validity_months ? `${e.validity_months} meses` : "—"}</TableCell>
                  <TableCell>{e.manufacturer || "—"}</TableCell>
                  <TableCell>
                    <Badge className={e.active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {e.active !== false ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(e)}><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" onClick={() => { if (confirm(`Excluir "${e.name}"?`)) deleteMut.mutate(e.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={open => { if (!open) close_(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar EPI" : "Novo EPI"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Capacete de segurança" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada..." className="h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Número do CA</Label>
                <Input value={form.ca_number} onChange={e => setForm({ ...form, ca_number: e.target.value })} placeholder="Ex: 12345" />
              </div>
              <div>
                <Label>Validade (meses)</Label>
                <Input type="number" value={form.validity_months} onChange={e => setForm({ ...form, validity_months: Number(e.target.value) })} min={1} />
              </div>
            </div>
            <div>
              <Label>Fabricante</Label>
              <Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} placeholder="Nome do fabricante" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>EPI ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-yellow-500 to-orange-500">
              {editing ? "Salvar" : "Criar EPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}