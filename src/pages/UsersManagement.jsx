import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, UserPlus, Edit, Search, CheckCircle2, Crown, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema", icon: Crown, color: "bg-purple-100 text-purple-700" },
  { value: "user", label: "Funcionário", description: "Acesso padrão de funcionário", icon: User, color: "bg-blue-100 text-blue-700" },
  { value: "manager", label: "Supervisor", description: "Acesso a relatórios e gestão", icon: Shield, color: "bg-orange-100 text-orange-700" },
];

export default function UsersManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [newRole, setNewRole] = useState("user");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["all_users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser,
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Digite um e-mail válido"); return; }
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast.success("Convite enviado com sucesso!");
      setInviteDialog(false);
      setInviteEmail("");
      setInviteRole("user");
      qc.invalidateQueries(["all_users"]);
    } catch (err) {
      toast.error("Erro ao enviar convite: " + err.message);
    }
  };

  const handleOpenRoleEdit = (usr) => {
    setSelectedUser(usr);
    setNewRole(usr.role || "user");
    setRoleDialog(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await base44.entities.User.update(selectedUser.id, { role: newRole });
      toast.success(`Nível de acesso de ${selectedUser.full_name || selectedUser.email} atualizado para ${ROLES.find(r=>r.value===newRole)?.label}!`);
      setRoleDialog(false);
      setSelectedUser(null);
      qc.invalidateQueries(["all_users"]);
    } catch (err) {
      toast.error("Erro ao atualizar: " + err.message);
    }
    setSaving(false);
  };

  const filteredUsers = allUsers.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleConfig = (role) => ROLES.find(r => r.value === role) || ROLES[1];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600"/>Usuários e Acessos
          </h1>
          <p className="text-sm text-gray-400">Gerencie usuários e níveis de acesso do sistema</p>
        </div>
        <Button onClick={() => setInviteDialog(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white gap-2">
          <UserPlus className="w-4 h-4"/>Convidar Usuário
        </Button>
      </div>

      {/* Roles legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ROLES.map(r => {
          const Icon = r.icon;
          const count = allUsers.filter(u => (u.role || "user") === r.value).length;
          return (
            <div key={r.value} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${r.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5"/>
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{r.label}</p>
                <p className="text-xs text-gray-400">{count} usuário(s) · {r.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
            <Input placeholder="Buscar por nome ou email..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9"/>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nível de Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(usr => {
                  const rc = getRoleConfig(usr.role);
                  const RoleIcon = rc.icon;
                  const isSelf = usr.email === currentUser?.email;
                  return (
                    <TableRow key={usr.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(usr.full_name || usr.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              {usr.full_name || "—"}
                              {isSelf && <span className="ml-1 text-xs text-purple-500">(você)</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="w-3.5 h-3.5"/>{usr.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${rc.color}`}>
                          <RoleIcon className="w-3 h-3"/>{rc.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={isSelf}
                          onClick={() => handleOpenRoleEdit(usr)}
                        >
                          <Edit className="w-3.5 h-3.5"/>
                          {isSelf ? "Seu perfil" : "Editar Acesso"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-12">
                      {search ? "Nenhum usuário encontrado para essa busca" : "Nenhum usuário cadastrado"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Convidar */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">E-mail</Label>
              <Input type="email" placeholder="usuario@exemplo.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/>
            </div>
            <div>
              <Label className="mb-1.5 block">Nível de Acesso</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label} — {r.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>Cancelar</Button>
            <Button onClick={handleInvite} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <UserPlus className="w-4 h-4 mr-1"/>Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar nível de acesso */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Nível de Acesso</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {(selectedUser.full_name || selectedUser.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm">{selectedUser.full_name || "—"}</p>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Selecione o nível de acesso</Label>
                <div className="space-y-2">
                  {ROLES.map(r => {
                    const Icon = r.icon;
                    return (
                      <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${newRole===r.value?"border-purple-500 bg-purple-50 dark:bg-purple-900/20":"border-gray-200 hover:border-gray-300"}`}>
                        <input type="radio" name="role" value={r.value} checked={newRole===r.value} onChange={()=>setNewRole(r.value)} className="sr-only"/>
                        <div className={`w-8 h-8 ${r.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4 h-4"/>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{r.label}</p>
                          <p className="text-xs text-gray-400">{r.description}</p>
                        </div>
                        {newRole === r.value && <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0"/>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRoleDialog(false); setSelectedUser(null); }}>Cancelar</Button>
            <Button onClick={handleSaveRole} disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              {saving ? "Salvando..." : "Salvar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}