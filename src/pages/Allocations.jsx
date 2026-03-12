import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Allocations() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: "",
    client_id: "",
    contract_id: "",
    post_name: "",
    post_location: "",
    start_date: "",
    end_date: "",
    work_schedule: "",
    salary_at_post: "",
    status: "ativo",
    notes: ""
  });

  const queryClient = useQueryClient();

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list(),
    enabled: !!user
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list(),
    enabled: !!user
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
    enabled: !!user
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => base44.entities.Contract.list(),
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const allocation = await base44.entities.Allocation.create({ ...data, company_id: user.company_id });
      // Atualizar funcionário com lotação atual
      await base44.entities.Employee.update(data.employee_id, {
        current_allocation_id: allocation.id
      });
      return allocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["allocations"]);
      queryClient.invalidateQueries(["employees"]);
      toast.success("Lotação criada com sucesso!");
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Allocation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["allocations"]);
      toast.success("Lotação atualizada com sucesso!");
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Allocation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["allocations"]);
      toast.success("Lotação excluída com sucesso!");
    }
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      client_id: "",
      contract_id: "",
      post_name: "",
      post_location: "",
      start_date: "",
      end_date: "",
      work_schedule: "",
      salary_at_post: "",
      status: "ativo",
      notes: ""
    });
    setEditingAllocation(null);
    setDialogOpen(false);
  };

  const handleEdit = (allocation) => {
    setEditingAllocation(allocation);
    setFormData({
      employee_id: allocation.employee_id,
      client_id: allocation.client_id,
      contract_id: allocation.contract_id || "",
      post_name: allocation.post_name,
      post_location: allocation.post_location || "",
      start_date: allocation.start_date,
      end_date: allocation.end_date || "",
      work_schedule: allocation.work_schedule || "",
      salary_at_post: allocation.salary_at_post || "",
      status: allocation.status,
      notes: allocation.notes || ""
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      salary_at_post: formData.salary_at_post ? parseFloat(formData.salary_at_post) : null
    };
    if (editingAllocation) {
      updateMutation.mutate({ id: editingAllocation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.full_name || "Não encontrado";
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Não encontrado";
  };

  const clientContracts = contracts.filter(c => c.client_id === formData.client_id);

  const filteredAllocations = allocations.filter(alloc => {
    const employeeName = getEmployeeName(alloc.employee_id).toLowerCase();
    const clientName = getClientName(alloc.client_id).toLowerCase();
    const search = searchTerm.toLowerCase();
    return employeeName.includes(search) || clientName.includes(search) || alloc.post_name?.toLowerCase().includes(search);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <MapPin className="w-8 h-8 text-purple-600" />
          Gestão de Lotações
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gerencie as lotações de funcionários nos postos de trabalho
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por funcionário, cliente ou posto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Lotação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Posto</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAllocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell className="font-medium">{getEmployeeName(allocation.employee_id)}</TableCell>
                  <TableCell>{getClientName(allocation.client_id)}</TableCell>
                  <TableCell>{allocation.post_name}</TableCell>
                  <TableCell>{allocation.post_location || "-"}</TableCell>
                  <TableCell>{format(new Date(allocation.start_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        allocation.status === "ativo" ? "default" :
                        allocation.status === "encerrado" ? "secondary" : "destructive"
                      }
                    >
                      {allocation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(allocation)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja excluir esta lotação?")) {
                          deleteMutation.mutate(allocation.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAllocation ? "Editar Lotação" : "Nova Lotação"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Funcionário *</Label>
                <Select required value={formData.employee_id} onValueChange={(value) => setFormData({ ...formData, employee_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente *</Label>
                <Select required value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value, contract_id: "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contrato</Label>
                <Select value={formData.contract_id} onValueChange={(value) => setFormData({ ...formData, contract_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientContracts.map(contract => (
                      <SelectItem key={contract.id} value={contract.id}>{contract.contract_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Posto *</Label>
                <Input
                  required
                  value={formData.post_name}
                  onChange={(e) => setFormData({ ...formData, post_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Localização do Posto</Label>
              <Input
                value={formData.post_location}
                onChange={(e) => setFormData({ ...formData, post_location: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Escala de Trabalho</Label>
                <Input
                  value={formData.work_schedule}
                  onChange={(e) => setFormData({ ...formData, work_schedule: e.target.value })}
                  placeholder="Ex: 12x36, 8h diárias"
                />
              </div>
              <div>
                <Label>Salário no Posto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.salary_at_post}
                  onChange={(e) => setFormData({ ...formData, salary_at_post: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingAllocation ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}