import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, Key, UserPlus, Trash2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

const AVAILABLE_ENTITIES = [
  { name: "Employee", label: "Funcionários" },
  { name: "Company", label: "Empresas" },
  { name: "Department", label: "Setores" },
  { name: "Position", label: "Cargos" },
  { name: "Shift", label: "Escalas" },
  { name: "Team", label: "Times" },
  { name: "TimeRecord", label: "Registros de Ponto" },
  { name: "Task", label: "Tarefas" },
  { name: "VacationRequest", label: "Solicitações de Férias" },
  { name: "Payslip", label: "Holerites" },
  { name: "SignedTimeReport", label: "Relatórios de Ponto Assinados" },
  { name: "EmployeeDocument", label: "Documentos de Funcionários" },
  { name: "HoursBank", label: "Banco de Horas" },
  { name: "Announcement", label: "Avisos" }
];

export default function UsersManagement() {
  const [user, setUser] = useState(null);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [changePasswordDialog, setChangePasswordDialog] = useState(false);
  const [permissionsDialog, setPermissionsDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const uniqueUsers = Array.from(
    new Map(
      employees
        .filter(emp => emp.user_email)
        .map(emp => {
          const userRecord = allUsers.find(u => u.email === emp.user_email);
          return [emp.user_email, {
            email: emp.user_email,
            full_name: emp.full_name,
            role: emp.user_email === user?.email ? user?.role : 'user',
            allowed_entities: userRecord?.allowed_entities || []
          }];
        })
    ).values()
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError("Digite um e-mail válido");
      return;
    }

    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      setSuccess("Convite enviado com sucesso!");
      setInviteDialog(false);
      setInviteEmail("");
      setInviteRole("user");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Erro ao enviar convite: " + err.message);
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    try {
      setError("Funcionalidade de alteração de senha não disponível no momento. Entre em contato com o suporte.");
      setTimeout(() => setError(""), 5000);
    } catch (err) {
      setError("Erro ao alterar senha: " + err.message);
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleOpenPermissions = (usr) => {
    setSelectedUser(usr);
    setSelectedEntities(usr.allowed_entities || []);
    setPermissionsDialog(true);
  };

  const handleSavePermissions = async () => {
    try {
      const userRecord = allUsers.find(u => u.email === selectedUser.email);
      
      if (userRecord) {
        await base44.entities.User.update(userRecord.id, {
          allowed_entities: selectedEntities
        });
      } else {
        setError("Usuário não encontrado no sistema");
        return;
      }
      
      setSuccess("Permissões atualizadas com sucesso!");
      setPermissionsDialog(false);
      setSelectedUser(null);
      setSelectedEntities([]);
      queryClient.invalidateQueries(['users']);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Erro ao salvar permissões: " + err.message);
      setTimeout(() => setError(""), 5000);
    }
  };

  const toggleEntity = (entityName) => {
    setSelectedEntities(prev => 
      prev.includes(entityName)
        ? prev.filter(e => e !== entityName)
        : [...prev, entityName]
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Usuários e Acessos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie usuários e permissões do sistema
          </p>
        </div>
        <Button
          onClick={() => setInviteDialog(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Convidar Usuário
        </Button>
      </div>

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Usuários do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Entidades Permitidas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueUsers.map((usr) => (
                <TableRow key={usr.email}>
                  <TableCell className="font-medium">{usr.full_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {usr.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={usr.role === 'admin' ? 'default' : 'outline'}>
                      {usr.role === 'admin' ? 'Administrador' : 'Usuário'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {usr.allowed_entities?.length > 0 
                        ? `${usr.allowed_entities.length} entidade(s)` 
                        : 'Nenhuma restrição'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPermissions(usr)}
                      >
                        <Database className="w-4 h-4 mr-2" />
                        Permissões
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(usr);
                          setChangePasswordDialog(true);
                        }}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Senha
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Convidar Usuário */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="usuario@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} className="bg-gradient-to-r from-purple-600 to-blue-600">
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Alterar Senha */}
      <Dialog open={changePasswordDialog} onOpenChange={setChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha de {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Digite a nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type="password"
                placeholder="Confirme a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <p className="text-sm text-gray-500">
              A senha deve ter no mínimo 6 caracteres
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangePasswordDialog(false);
              setNewPassword("");
              setConfirmPassword("");
              setSelectedUser(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} className="bg-gradient-to-r from-purple-600 to-blue-600">
              <Key className="w-4 h-4 mr-2" />
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerenciar Permissões de Entidades */}
      <Dialog open={permissionsDialog} onOpenChange={setPermissionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões de Entidades - {selectedUser?.full_name}</DialogTitle>
            <p className="text-sm text-gray-500 mt-2">
              Selecione quais entidades este usuário pode acessar. 
              {selectedEntities.length === 0 && " Se nenhuma for selecionada, o usuário terá acesso a todas."}
            </p>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEntities(AVAILABLE_ENTITIES.map(e => e.name))}
              >
                Selecionar Todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEntities([])}
              >
                Desmarcar Todas
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {AVAILABLE_ENTITIES.map((entity) => (
                <div
                  key={entity.name}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50"
                >
                  <Checkbox
                    id={entity.name}
                    checked={selectedEntities.includes(entity.name)}
                    onCheckedChange={() => toggleEntity(entity.name)}
                  />
                  <label
                    htmlFor={entity.name}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    {entity.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPermissionsDialog(false);
              setSelectedUser(null);
              setSelectedEntities([]);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} className="bg-gradient-to-r from-purple-600 to-blue-600">
              <Database className="w-4 h-4 mr-2" />
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}