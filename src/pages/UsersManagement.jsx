import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, UserPlus, Edit, Search, CheckCircle2, Crown, User, Plus, Trash2, Key, Settings, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ALL_MODULES, getModulesByGroup } from "@/lib/navigationModules";

const COLOR_OPTIONS = [
  { value: "purple", label: "Roxo", class: "bg-purple-100 text-purple-700" },
  { value: "blue", label: "Azul", class: "bg-blue-100 text-blue-700" },
  { value: "green", label: "Verde", class: "bg-green-100 text-green-700" },
  { value: "orange", label: "Laranja", class: "bg-orange-100 text-orange-700" },
  { value: "red", label: "Vermelho", class: "bg-red-100 text-red-700" },
  { value: "gray", label: "Cinza", class: "bg-gray-100 text-gray-700" },
];

const getBadgeClass = (color) => COLOR_OPTIONS.find(c => c.value === color)?.class || "bg-blue-100 text-blue-700";

export default function UsersManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  // Dialogs
  const [inviteDialog, setInviteDialog] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [roleEditorDialog, setRoleEditorDialog] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);

  // Selected
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // role being edited

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");

  // Role editor form
  const [roleForm, setRoleForm] = useState({ name: "", description: "", color: "blue", allowed_modules: [] });
  const [expandedGroups, setExpandedGroups] = useState({});

  // User role assign
  const [newRoleId, setNewRoleId] = useState("");

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { base44.auth.me().then(setCurrentUser); }, []);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["all_users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser,
  });

  const { data: accessRoles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["access_roles", currentUser?.company_id],
    queryFn: () => base44.entities.AccessRole.filter({ company_id: currentUser.company_id }),
    enabled: !!currentUser?.company_id,
  });

  const modulesByGroup = getModulesByGroup();
  const filteredUsers = allUsers.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Invite ───────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Digite um e-mail válido"); return; }
    setSaving(true);
    try {
      const role = inviteRole || "user";
      await base44.users.inviteUser(inviteEmail.trim(), role === "admin" ? "admin" : "user");
      // If custom role selected, save role_id after user is created (best effort)
      toast.success("Convite enviado!");
      setInviteDialog(false);
      setInviteEmail(""); setInviteRole("");
      qc.invalidateQueries(["all_users"]);
    } catch (err) { toast.error("Erro: " + err.message); }
    setSaving(false);
  };

  // ─── Assign role to user ──────────────────────────────────────
  const handleOpenAssignRole = (usr) => {
    setSelectedUser(usr);
    setNewRoleId(usr.access_role_id || "");
    setRoleDialog(true);
  };

  const handleSaveUserRole = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const updates = { access_role_id: newRoleId || null };
      // If selecting admin built-in role
      if (newRoleId === "__admin__") {
        await base44.entities.User.update(selectedUser.id, { role: "admin", access_role_id: null });
      } else if (newRoleId === "__user__") {
        await base44.entities.User.update(selectedUser.id, { role: "user", access_role_id: null });
      } else {
        await base44.entities.User.update(selectedUser.id, { role: "user", access_role_id: newRoleId });
      }
      toast.success("Perfil de acesso atualizado!");
      setRoleDialog(false);
      setSelectedUser(null);
      qc.invalidateQueries(["all_users"]);
    } catch (err) { toast.error("Erro: " + err.message); }
    setSaving(false);
  };

  // ─── Role editor ──────────────────────────────────────────────
  const handleNewRole = () => {
    setSelectedRole(null);
    setRoleForm({ name: "", description: "", color: "blue", allowed_modules: [] });
    setExpandedGroups({});
    setRoleEditorDialog(true);
  };

  const handleEditRole = (role) => {
    setSelectedRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      color: role.color || "blue",
      allowed_modules: role.allowed_modules || [],
    });
    setExpandedGroups({});
    setRoleEditorDialog(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) { toast.error("Informe o nome do perfil"); return; }
    setSaving(true);
    try {
      const data = { ...roleForm, company_id: currentUser.company_id };
      if (selectedRole) {
        await base44.entities.AccessRole.update(selectedRole.id, data);
        toast.success("Perfil atualizado!");
      } else {
        await base44.entities.AccessRole.create(data);
        toast.success("Perfil criado!");
      }
      setRoleEditorDialog(false);
      qc.invalidateQueries(["access_roles", currentUser.company_id]);
    } catch (err) { toast.error("Erro: " + err.message); }
    setSaving(false);
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm("Deseja excluir este perfil?")) return;
    try {
      await base44.entities.AccessRole.delete(roleId);
      toast.success("Perfil excluído!");
      qc.invalidateQueries(["access_roles", currentUser.company_id]);
    } catch (err) { toast.error("Erro: " + err.message); }
  };

  const toggleModule = (moduleId) => {
    setRoleForm(prev => ({
      ...prev,
      allowed_modules: prev.allowed_modules.includes(moduleId)
        ? prev.allowed_modules.filter(m => m !== moduleId)
        : [...prev.allowed_modules, moduleId]
    }));
  };

  const toggleGroup = (group) => {
    const groupModules = modulesByGroup[group].map(m => m.id);
    const allSelected = groupModules.every(id => roleForm.allowed_modules.includes(id));
    setRoleForm(prev => ({
      ...prev,
      allowed_modules: allSelected
        ? prev.allowed_modules.filter(id => !groupModules.includes(id))
        : [...new Set([...prev.allowed_modules, ...groupModules])]
    }));
  };

  const selectAll = () => setRoleForm(prev => ({ ...prev, allowed_modules: ALL_MODULES.map(m => m.id) }));
  const clearAll = () => setRoleForm(prev => ({ ...prev, allowed_modules: [] }));

  // ─── Password ─────────────────────────────────────────────────
  const handleOpenPassword = (usr) => {
    setSelectedUser(usr);
    setPasswordDialog(true);
  };

  const handleSendPasswordReset = async () => {
    if (!selectedUser?.email) return;
    setSaving(true);
    try {
      await base44.functions.invoke("changeUserPassword", { email: selectedUser.email });
      toast.success(`Email de redefinição enviado para ${selectedUser.email}!`);
      setPasswordDialog(false);
      setSelectedUser(null);
    } catch (err) {
      toast.error("Erro: " + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  // ─── Helpers ──────────────────────────────────────────────────
  const getUserRoleLabel = (usr) => {
    if (usr.role === "admin") return { label: "Administrador", color: "bg-purple-100 text-purple-700" };
    if (usr.access_role_id) {
      const role = accessRoles.find(r => r.id === usr.access_role_id);
      if (role) return { label: role.name, color: getBadgeClass(role.color) };
    }
    return { label: "Funcionário", color: "bg-blue-100 text-blue-700" };
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-600"/>Usuários e Acessos
        </h1>
        <p className="text-sm text-gray-400">Gerencie usuários, perfis e permissões do sistema</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="roles">Perfis de Acesso</TabsTrigger>
        </TabsList>

        {/* ─── Aba Usuários ─────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
              <Input placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9"/>
            </div>
            <Button onClick={() => setInviteDialog(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white gap-2">
              <UserPlus className="w-4 h-4"/>Convidar Usuário
            </Button>
          </div>

          <Card className="border shadow-sm">
            <CardContent className="p-0">
              {loadingUsers ? (
                <div className="text-center py-12 text-gray-400">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfil de Acesso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(usr => {
                      const roleInfo = getUserRoleLabel(usr);
                      const isSelf = usr.email === currentUser?.email;
                      return (
                        <TableRow key={usr.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {(usr.full_name || usr.email || "?").charAt(0).toUpperCase()}
                              </div>
                              <p className="font-medium text-sm">
                                {usr.full_name || "—"}
                                {isSelf && <span className="ml-1 text-xs text-purple-500">(você)</span>}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Mail className="w-3.5 h-3.5"/>{usr.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                              {roleInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1.5 justify-end">
                              <Button variant="outline" size="sm" className="gap-1 text-xs" disabled={isSelf} onClick={() => handleOpenAssignRole(usr)}>
                                <Shield className="w-3.5 h-3.5"/>Perfil
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1 text-xs" disabled={isSelf} onClick={() => handleOpenPassword(usr)}>
                                <Key className="w-3.5 h-3.5"/>Senha
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-12">
                          {search ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Aba Perfis de Acesso ──────────────────────────────── */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Crie perfis com módulos específicos e atribua aos usuários</p>
            <Button onClick={handleNewRole} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white gap-2">
              <Plus className="w-4 h-4"/>Novo Perfil
            </Button>
          </div>

          {/* Built-in roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5"/>
                </div>
                <div>
                  <p className="font-bold text-sm text-purple-800 dark:text-purple-200">Administrador</p>
                  <p className="text-xs text-purple-500">Acesso total a todos os módulos · Perfil fixo do sistema</p>
                </div>
              </div>
              <Badge className="bg-purple-200 text-purple-700 border-0">{allUsers.filter(u => u.role === "admin").length} usuário(s)</Badge>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5"/>
                </div>
                <div>
                  <p className="font-bold text-sm text-blue-800 dark:text-blue-200">Funcionário (padrão)</p>
                  <p className="text-xs text-blue-500">Acesso ao painel do funcionário · Perfil fixo do sistema</p>
                </div>
              </div>
              <Badge className="bg-blue-200 text-blue-700 border-0">{allUsers.filter(u => u.role !== "admin" && !u.access_role_id).length} usuário(s)</Badge>
            </div>
          </div>

          {/* Custom roles */}
          {loadingRoles ? (
            <p className="text-center text-gray-400 py-8">Carregando perfis...</p>
          ) : accessRoles.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300">
              <Settings className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
              <p className="font-medium text-gray-500">Nenhum perfil customizado criado</p>
              <p className="text-sm text-gray-400 mt-1">Crie perfis para controlar o acesso de cada grupo de usuários</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accessRoles.map(role => {
                const usersWithRole = allUsers.filter(u => u.access_role_id === role.id).length;
                return (
                  <div key={role.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 ${getBadgeClass(role.color)} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <Shield className="w-5 h-5"/>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{role.name}</p>
                          <p className="text-xs text-gray-400 truncate">{role.description || "—"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(role.allowed_modules || []).length} módulo(s) · {usersWithRole} usuário(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRole(role)}>
                          <Edit className="w-3.5 h-3.5"/>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteRole(role.id)}>
                          <Trash2 className="w-3.5 h-3.5"/>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog: Convidar ────────────────────────────────────── */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">E-mail</Label>
              <Input type="email" placeholder="usuario@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/>
            </div>
            <div>
              <Label className="mb-1.5 block">Nível de acesso inicial</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                  <SelectItem value="user">Funcionário (padrão)</SelectItem>
                  {accessRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <UserPlus className="w-4 h-4 mr-1"/>{saving ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Atribuir perfil ao usuário ─────────────────── */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atribuir Perfil de Acesso</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {(selectedUser.full_name || selectedUser.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm">{selectedUser.full_name || "—"}</p>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                {/* Built-in */}
                {[
                  { id: "__admin__", name: "Administrador", description: "Acesso total ao sistema", color: "purple" },
                  { id: "__user__", name: "Funcionário (padrão)", description: "Painel do funcionário", color: "blue" },
                  ...accessRoles
                ].map(r => (
                  <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${newRoleId === r.id ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" name="new_role" value={r.id} checked={newRoleId === r.id} onChange={() => setNewRoleId(r.id)} className="sr-only"/>
                    <div className={`w-8 h-8 ${getBadgeClass(r.color || "blue")} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Shield className="w-4 h-4"/>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.description || `${(r.allowed_modules||[]).length} módulo(s) permitido(s)`}</p>
                    </div>
                    {newRoleId === r.id && <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0"/>}
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRoleDialog(false); setSelectedUser(null); }}>Cancelar</Button>
            <Button onClick={handleSaveUserRole} disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Editor de Perfil ─────────────────────────────── */}
      <Dialog open={roleEditorDialog} onOpenChange={setRoleEditorDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRole ? "Editar Perfil" : "Novo Perfil de Acesso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Name & color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Nome do Perfil *</Label>
                <Input placeholder="Ex: Supervisor Operacional" value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))}/>
              </div>
              <div>
                <Label className="mb-1.5 block">Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => setRoleForm(p => ({ ...p, color: c.value }))} className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${c.class} ${roleForm.color === c.value ? "border-gray-800 scale-110" : "border-transparent"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Descrição</Label>
              <Input placeholder="Breve descrição das responsabilidades" value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))}/>
            </div>

            {/* Module selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Módulos Permitidos ({roleForm.allowed_modules.length}/{ALL_MODULES.length})</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Selecionar Todos</Button>
                  <Button variant="outline" size="sm" onClick={clearAll}>Limpar</Button>
                </div>
              </div>
              <div className="space-y-2 border rounded-xl overflow-hidden">
                {Object.entries(modulesByGroup).map(([group, modules]) => {
                  const allSelected = modules.every(m => roleForm.allowed_modules.includes(m.id));
                  const someSelected = modules.some(m => roleForm.allowed_modules.includes(m.id));
                  const isOpen = expandedGroups[group];
                  return (
                    <div key={group} className="border-b last:border-b-0">
                      <button
                        onClick={() => setExpandedGroups(p => ({ ...p, [group]: !p[group] }))}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div onClick={e => { e.stopPropagation(); toggleGroup(group); }} className="flex items-center">
                          <Checkbox checked={allSelected} className={someSelected && !allSelected ? "opacity-60" : ""}/>
                        </div>
                        <span className="flex-1 text-left font-semibold text-sm">{group}</span>
                        <span className="text-xs text-gray-400">{modules.filter(m => roleForm.allowed_modules.includes(m.id)).length}/{modules.length}</span>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                      </button>
                      {isOpen && (
                        <div className="px-4 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white dark:bg-gray-900">
                          {modules.map(mod => (
                            <label key={mod.id} className="flex items-center gap-2 cursor-pointer py-1 text-sm hover:text-purple-600 transition-colors">
                              <Checkbox checked={roleForm.allowed_modules.includes(mod.id)} onCheckedChange={() => toggleModule(mod.id)}/>
                              <span>{mod.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEditorDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveRole} disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              {saving ? "Salvando..." : selectedRole ? "Atualizar Perfil" : "Criar Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Redefinir Senha ─────────────────────────────────── */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {(selectedUser.full_name || selectedUser.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm">{selectedUser.full_name || "—"}</p>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">Como funciona</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Será enviado um email de redefinição de senha para <strong>{selectedUser.email}</strong>. 
                  O usuário poderá criar uma nova senha pelo link recebido.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordDialog(false); setSelectedUser(null); }}>Cancelar</Button>
            <Button onClick={handleSendPasswordReset} disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Key className="w-4 h-4 mr-1"/>{saving ? "Enviando..." : "Enviar Email de Redefinição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}