import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Filter, Users, DollarSign, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function AllocationReports() {
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState({
    client_id: "",
    status: "",
    start_date: "",
    end_date: "",
  });

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ["allocations", user?.company_id, filters],
    queryFn: async () => {
      if (!user?.company_id) return [];
      
      let query = { company_id: user.company_id };
      
      if (filters.client_id) query.client_id = filters.client_id;
      if (filters.status) query.status = filters.status;
      
      const allocs = await base44.entities.Allocation.filter(query, "-start_date");
      
      // Filtrar por data se necessário
      return allocs.filter(alloc => {
        if (filters.start_date && alloc.start_date < filters.start_date) return false;
        if (filters.end_date && alloc.end_date && alloc.end_date > filters.end_date) return false;
        return true;
      });
    },
    enabled: !!user?.company_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.Client.filter({ company_id: user.company_id });
    },
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.Employee.filter({ company_id: user.company_id });
    },
    enabled: !!user?.company_id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.Contract.filter({ company_id: user.company_id });
    },
    enabled: !!user?.company_id,
  });

  const getEmployeeName = (employeeId) => {
    return employees.find(e => e.id === employeeId)?.full_name || "N/A";
  };

  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.name || "N/A";
  };

  const getContractInfo = (contractId) => {
    return contracts.find(c => c.id === contractId);
  };

  const calculateTotalCost = () => {
    return allocations.reduce((sum, alloc) => sum + (alloc.salary_at_post || 0), 0);
  };

  const groupByPost = () => {
    const grouped = {};
    allocations.forEach(alloc => {
      const key = `${alloc.post_name} - ${alloc.post_location}`;
      if (!grouped[key]) {
        grouped[key] = {
          post_name: alloc.post_name,
          post_location: alloc.post_location,
          allocations: [],
          total_cost: 0,
        };
      }
      grouped[key].allocations.push(alloc);
      grouped[key].total_cost += alloc.salary_at_post || 0;
    });
    return Object.values(grouped);
  };

  const exportToCSV = () => {
    const headers = [
      "Funcionário",
      "Cliente",
      "Posto",
      "Localização",
      "Data Início",
      "Data Fim",
      "Status",
      "Salário",
      "Cobertura 1",
      "Cobertura 2"
    ];

    const rows = allocations.map(alloc => [
      getEmployeeName(alloc.employee_id),
      getClientName(alloc.client_id),
      alloc.post_name,
      alloc.post_location,
      alloc.start_date,
      alloc.end_date || "Indefinido",
      alloc.status,
      alloc.salary_at_post || 0,
      alloc.backup_employee_1_id ? getEmployeeName(alloc.backup_employee_1_id) : "-",
      alloc.backup_employee_2_id ? getEmployeeName(alloc.backup_employee_2_id) : "-",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-alocacoes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Relatório exportado com sucesso");
  };

  const postGroups = groupByPost();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Relatório de Alocações
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Histórico completo de alocações por cliente e posto
            </p>
          </div>
          <Button onClick={exportToCSV} className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Cliente</Label>
                <Select
                  value={filters.client_id}
                  onValueChange={(value) => setFilters({ ...filters, client_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total de Alocações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{allocations.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Postos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {allocations.filter(a => a.status === "ativo").length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Custo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                R$ {calculateTotalCost().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Relatório Agrupado por Posto */}
        <Card>
          <CardHeader>
            <CardTitle>Custos por Posto</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posto</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Nº Alocações</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postGroups.map((group, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{group.post_name}</TableCell>
                    <TableCell>{group.post_location}</TableCell>
                    <TableCell>{group.allocations.length}</TableCell>
                    <TableCell className="text-right font-semibold">
                      R$ {group.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Histórico Completo */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico Completo de Alocações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-gray-500">Carregando...</p>
            ) : allocations.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                Nenhuma alocação encontrada
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Posto</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cobertura 1</TableHead>
                    <TableHead>Cobertura 2</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((alloc) => (
                    <TableRow key={alloc.id}>
                      <TableCell className="font-medium">
                        {getEmployeeName(alloc.employee_id)}
                      </TableCell>
                      <TableCell>{getClientName(alloc.client_id)}</TableCell>
                      <TableCell>{alloc.post_name}</TableCell>
                      <TableCell>{alloc.post_location}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(alloc.start_date).toLocaleDateString()} -{" "}
                        {alloc.end_date
                          ? new Date(alloc.end_date).toLocaleDateString()
                          : "Indefinido"}
                      </TableCell>
                      <TableCell>
                        {alloc.status === "ativo" && (
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        )}
                        {alloc.status === "encerrado" && (
                          <Badge variant="outline">Encerrado</Badge>
                        )}
                        {alloc.status === "suspenso" && (
                          <Badge className="bg-orange-100 text-orange-800">Suspenso</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {alloc.backup_employee_1_id
                          ? getEmployeeName(alloc.backup_employee_1_id)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {alloc.backup_employee_2_id
                          ? getEmployeeName(alloc.backup_employee_2_id)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {alloc.salary_at_post
                          ? `R$ ${alloc.salary_at_post.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}