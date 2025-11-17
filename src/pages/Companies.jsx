import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Edit, Trash2, Building2, Users, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Companies() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    address: "",
    work_start_time: "08:00",
    work_end_time: "17:00",
    tolerance_minutes: 15,
    break_minutes: 60,
    status: "active"
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
    enabled: !!user,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Company.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      address: "",
      work_start_time: "08:00",
      work_end_time: "17:00",
      tolerance_minutes: 15,
      break_minutes: 60,
      status: "active"
    });
    setEditingCompany(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || "",
      cnpj: company.cnpj || "",
      address: company.address || "",
      work_start_time: company.work_start_time || "08:00",
      work_end_time: company.work_end_time || "17:00",
      tolerance_minutes: company.tolerance_minutes || 15,
      break_minutes: company.break_minutes || 60,
      status: company.status || "active"
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir esta empresa? Todos os dados relacionados serão perdidos.")) {
      deleteMutation.mutate(id);
    }
  };

  const getEmployeeCount = (companyId) => {
    return employees.filter(e => e.company_id === companyId).length;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Empresas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie todas as empresas do sistema
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <Card key={company.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {getEmployeeCount(company.id)} funcionários
                    </p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={company.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800'}
                >
                  {company.status === 'active' ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>CNPJ:</strong> {company.cnpj}
                </p>
                {company.address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <strong>Endereço:</strong> {company.address}
                  </p>
                )}
              </div>
              
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Horário:</strong> {company.work_start_time} - {company.work_end_time}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Tolerância:</strong> {company.tolerance_minutes} min
                </p>
              </div>

              <div className="flex gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(company)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(company.id)}
                  className="text-red-600 hover:text-red-700 border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {companies.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Nenhuma empresa cadastrada
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Comece criando sua primeira empresa no sistema.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Empresa
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  required
                />
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
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Horário de Entrada</Label>
                <Input
                  type="time"
                  value={formData.work_start_time}
                  onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Horário de Saída</Label>
                <Input
                  type="time"
                  value={formData.work_end_time}
                  onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Tolerância (minutos)</Label>
                <Input
                  type="number"
                  value={formData.tolerance_minutes}
                  onChange={(e) => setFormData({ ...formData, tolerance_minutes: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Pausa/Almoço (minutos)</Label>
                <Input
                  type="number"
                  value={formData.break_minutes}
                  onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) })}
                />
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
                {editingCompany ? "Salvar Alterações" : "Criar Empresa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}