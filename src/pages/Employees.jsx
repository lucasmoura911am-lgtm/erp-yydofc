import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2, User, Key, Mail, Shield, UserPlus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function Employees() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [accessForm, setAccessForm] = useState({
    email: "",
    password: "",
    role: "user",
    newPassword: ""
  });
  const [formData, setFormData] = useState({
    cpf: "",
    full_name: "",
    phone: "",
    hire_date: "",
    position_id: "",
    department_id: "",
    shift_id: "",
    team_id: "",
    supervisor_email: "",
    employee_number: "",
    status: "active",
    user_email: ""
  });

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
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }, '-created_date') : [],
    enabled: !!user?.company_id,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Position.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Department.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Shift.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Team.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const supervisors = allUsers.filter(u => u.is_supervisor && u.company_id === user?.company_id);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const employee = await base44.entities.Employee.create(data);
      return employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      await base44.users.inviteUser(email, role);
      return { email, role };
    },
    onSuccess: () => {
      alert('Convite enviado com sucesso!');
      setInviteDialogOpen(false);
      setAccessForm({ email: "", password: "", role: "user" });
    },
  });

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            employees: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cpf: { type: "string" },
                  full_name: { type: "string" },
                  phone: { type: "string" },
                  hire_date: { type: "string" },
                  employee_number: { type: "string" },
                  user_email: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.status === "success" && result.output?.employees) {
        const bulkData = result.output.employees.map(emp => ({
          ...emp,
          company_id: user.company_id,
          status: "active"
        }));
        
        await Promise.all(bulkData.map(data => base44.entities.Employee.create(data)));
        queryClient.invalidateQueries(['employees']);
        alert(`${bulkData.length} funcionários importados com sucesso!`);
        setBulkUploadOpen(false);
      }
    } catch (error) {
      alert('Erro ao importar: ' + error.message);
    }
  };

  const handleAccessManagement = (employee) => {
    setSelectedEmployee(employee);
    setAccessForm({
      email: employee.user_email || "",
      password: "",
      role: "user"
    });
    setAccessDialogOpen(true);
  };

  const handleInviteUser = async () => {
    if (!accessForm.email) {
      alert('Digite o email do usuário');
      return;
    }

    try {
      // Se tem nova senha, alterar senha
      if (accessForm.newPassword && accessForm.newPassword.length >= 6) {
        await base44.auth.updatePassword(accessForm.email, accessForm.newPassword);
        alert('Senha alterada com sucesso!');
      }

      // Se não tem acesso ainda, enviar convite
      if (!selectedEmployee.user_email) {
        await base44.users.inviteUser(accessForm.email, accessForm.role);
        
        // Atualizar employee com o email
        await base44.entities.Employee.update(selectedEmployee.id, {
          user_email: accessForm.email
        });
        
        alert('Convite enviado com sucesso!');
        queryClient.invalidateQueries(['employees']);
      } else {
        // Já tem acesso, apenas atualizar se necessário
        if (accessForm.email !== selectedEmployee.user_email) {
          await base44.entities.Employee.update(selectedEmployee.id, {
            user_email: accessForm.email
          });
          queryClient.invalidateQueries(['employees']);
        }
        if (!accessForm.newPassword) {
          alert('Acesso atualizado com sucesso!');
        }
      }
      
      setAccessDialogOpen(false);
      setAccessForm({ email: "", password: "", role: "user", newPassword: "" });
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      cpf: "",
      full_name: "",
      phone: "",
      hire_date: "",
      position_id: "",
      department_id: "",
      shift_id: "",
      team_id: "",
      supervisor_email: "",
      employee_number: "",
      status: "active",
      user_email: ""
    });
    setEditingEmployee(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { 
      ...formData, 
      company_id: user.company_id,
      user_email: formData.user_email || "" // Adicionar user_email ao submeter
    };
    
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      cpf: employee.cpf || "",
      full_name: employee.full_name || "",
      phone: employee.phone || "",
      hire_date: employee.hire_date || "",
      position_id: employee.position_id || "",
      department_id: employee.department_id || "",
      shift_id: employee.shift_id || "",
      team_id: employee.team_id || "",
      supervisor_email: employee.supervisor_email || "",
      employee_number: employee.employee_number || "",
      status: employee.status || "active",
      user_email: employee.user_email || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir este funcionário?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cpf?.includes(searchTerm) ||
    emp.employee_number?.includes(searchTerm)
  );

  const getPositionName = (id) => positions.find(p => p.id === id)?.name || "-";
  const getDepartmentName = (id) => departments.find(d => d.id === id)?.name || "-";

  const statusColors = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
    on_leave: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  };

  const statusLabels = {
    active: "Ativo",
    inactive: "Inativo",
    on_leave: "Afastado"
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Funcionários</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie os funcionários da empresa
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setInviteDialogOpen(true)}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Convidar Usuário
          </Button>
          <Button
            onClick={() => setBulkUploadOpen(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Funcionário
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por nome, CPF ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Lista de Funcionários ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Email/Login</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={employee.photo_url} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                            {employee.full_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{employee.full_name}</p>
                          <p className="text-sm text-gray-500">{employee.phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.cpf}</TableCell>
                    <TableCell>{employee.employee_number || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {employee.user_email ? (
                          <>
                            <span className="text-sm">{employee.user_email}</span>
                            <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                              Ativo
                            </Badge>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">Sem acesso</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPositionName(employee.position_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[employee.status]}>
                        {statusLabels[employee.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAccessManagement(employee)}
                          title="Gerenciar Acesso"
                        >
                          <Key className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(employee)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email do Usuário</Label>
                <Input
                  type="email"
                  value={formData.user_email}
                  onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
                <p className="text-xs text-gray-500">
                  Email usado para fazer login no sistema
                </p>
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input
                  value={formData.employee_number}
                  onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Contratação</Label>
                <Input
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select
                  value={formData.position_id}
                  onValueChange={(value) => setFormData({ ...formData, position_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos.id} value={pos.id}>
                        {pos.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Escala de Trabalho</Label>
                <Select
                  value={formData.shift_id}
                  onValueChange={(value) => setFormData({ ...formData, shift_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time/Equipe</Label>
                <Select
                  value={formData.team_id}
                  onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select
                  value={formData.supervisor_email}
                  onValueChange={(value) => setFormData({ ...formData, supervisor_email: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.email} value={sup.email}>
                        {sup.full_name} ({sup.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="on_leave">Afastado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {editingEmployee ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access Management Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Gerenciar Acesso
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Funcionário:</strong> {selectedEmployee.full_name}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Email de Login</Label>
                <Input
                  type="email"
                  value={accessForm.email}
                  onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
                <p className="text-xs text-gray-500">
                  Email usado para fazer login no sistema
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nível de Acesso</Label>
                <Select
                  value={accessForm.role}
                  onValueChange={(value) => setAccessForm({ ...accessForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <div>
                          <div className="font-medium">Funcionário</div>
                          <div className="text-xs text-gray-500">Acesso básico ao sistema</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <div>
                          <div className="font-medium">Administrador</div>
                          <div className="text-xs text-gray-500">Acesso total ao sistema</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nova Senha (opcional)</Label>
                <Input
                  type="password"
                  value={accessForm.newPassword}
                  onChange={(e) => setAccessForm({ ...accessForm, newPassword: e.target.value })}
                  placeholder="Digite para alterar a senha"
                />
                <p className="text-xs text-gray-500">
                  Deixe em branco para manter a senha atual
                </p>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  onClick={handleInviteUser}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {selectedEmployee.user_email ? 'Atualizar Acesso' : 'Enviar Convite por Email'}
                </Button>
                <p className="text-xs text-center text-gray-500">
                  {selectedEmployee.user_email ? 'Atualize o nível de acesso ou senha do usuário' : 'Um email será enviado com instruções para criar a senha'}
                </p>
              </div>

              {selectedEmployee.user_email && (
                <div className="pt-4 border-t">
                  <Alert className="bg-blue-50">
                    <AlertDescription className="text-blue-800">
                      <strong>Status:</strong> Usuário já possui acesso ao sistema com o email {selectedEmployee.user_email}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-600" />
              Convidar Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Envie um convite por email para que o usuário crie sua conta no sistema
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={accessForm.email}
                onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })}
                placeholder="usuario@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Nível de Acesso *</Label>
              <Select
                value={accessForm.role}
                onValueChange={(value) => setAccessForm({ ...accessForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Funcionário (Acesso Básico)</SelectItem>
                  <SelectItem value="admin">Administrador (Acesso Total)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleInviteUser}
                className="bg-green-600 hover:bg-green-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                Enviar Convite
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Importação em Massa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Faça upload de um arquivo CSV com os dados dos funcionários para cadastro em massa.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Formato do CSV</Label>
              <div className="text-xs bg-gray-50 p-3 rounded border">
                <code>
                  cpf,full_name,phone,hire_date,employee_number,user_email<br/>
                  12345678900,João Silva,11999999999,2024-01-15,001,joao@email.com
                </code>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Arquivo CSV</Label>
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleBulkUpload}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}