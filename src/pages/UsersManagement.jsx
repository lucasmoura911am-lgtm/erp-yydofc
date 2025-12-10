import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Shield, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function UsersManagement() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ email, data }) => base44.entities.User.update(email, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
      setDialogOpen(false);
    },
  });

  const availableModules = [
    { id: "dashboard", label: "Dashboard Principal", icon: "📊" },
    { id: "supervisor_dashboard", label: "Dashboard Supervisor", icon: "📈" },
    { id: "time_records", label: "Registros de Ponto", icon: "🕐" },
    { id: "manage_records", label: "Gestão de Pontos", icon: "✏️" },
    { id: "employees", label: "Funcionários", icon: "👥" },
    { id: "teams", label: "Times", icon: "🏆" },
    { id: "supervisors", label: "Supervisores", icon: "👔" },
    { id: "departments", label: "Setores", icon: "🏢" },
    { id: "positions", label: "Cargos", icon: "💼" },
    { id: "shifts", label: "Escalas", icon: "📅" },
    { id: "reports", label: "Relatórios", icon: "📄" },
    { id: "settings", label: "Configurações", icon: "⚙️" },
    { id: "users", label: "Gestão de Usuários", icon: "🔐" }
  ];

  const companyUsers = allUsers.filter(u => u.company_id === user?.company_id);

  const handleEdit = (userData) => {
    setEditing(userData);
    setDialogOpen(true);
  };

  const handleUpdatePermissions = async (e) => {
    e.preventDefault();
    const moduleCheckboxes = document.querySelectorAll('input[name="module"]:checked');
    const selectedModules = Array.from(moduleCheckboxes).map(cb => cb.value);

    await updateUserMutation.mutateAsync({
      email: editing.email,
      data: { ...editing, permissions: selectedModules }
    });
  };

  const filteredUsers = companyUsers.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Usuários</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure permissões e acessos dos usuários
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((u) => (
              <div key={u.email} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                      {u.full_name?.charAt(0) || u.email?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">
                        {u.role === 'admin' ? '👑 Admin' : '👤 Funcionário'}
                      </Badge>
                      {u.is_supervisor && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-800">
                          👔 Supervisor
                        </Badge>
                      )}
                      {u.permissions?.length > 0 && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          🔐 {u.permissions.length} módulos
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => handleEdit(u)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Permissões
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Permissões</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleUpdatePermissions} className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{editing.full_name || editing.email}</p>
                <p className="text-sm text-gray-500">{editing.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">
                    {editing.role === 'admin' ? '👑 Admin' : '👤 Funcionário'}
                  </Badge>
                  {editing.is_supervisor && (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      👔 Supervisor
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Módulos Permitidos</Label>
                <p className="text-sm text-gray-500">Selecione quais módulos este usuário pode acessar</p>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {availableModules.map((module) => (
                    <div key={module.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Checkbox
                        id={module.id}
                        name="module"
                        value={module.id}
                        defaultChecked={(editing.permissions || []).includes(module.id)}
                      />
                      <Label htmlFor={module.id} className="cursor-pointer">
                        <span className="mr-2">{module.icon}</span>
                        {module.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                  Salvar Permissões
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}