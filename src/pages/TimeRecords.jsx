import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function TimeRecords() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.full_name || 'Desconhecido';
  };

  const getEmployeePhoto = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.photo_url;
  };

  const filteredRecords = timeRecords.filter(record => {
    const employeeName = getEmployeeName(record.employee_id).toLowerCase();
    const matchSearch = employeeName.includes(searchTerm.toLowerCase());
    const matchType = filterType === "all" || record.type === filterType;
    const matchStatus = filterStatus === "all" || record.status === filterStatus;
    
    let matchDate = true;
    if (startDate && endDate) {
      const recordDate = parseISO(record.timestamp);
      const start = new Date(startDate);
      const end = new Date(endDate);
      matchDate = recordDate >= start && recordDate <= end;
    }

    return matchSearch && matchType && matchStatus && matchDate;
  });

  const exportToCSV = () => {
    const headers = ['Funcionário', 'Tipo', 'Data/Hora', 'Status', 'Atraso (min)'];
    const rows = filteredRecords.map(record => [
      getEmployeeName(record.employee_id),
      record.type,
      format(parseISO(record.timestamp), 'dd/MM/yyyy HH:mm'),
      record.status,
      record.delay_minutes || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `registros-ponto-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColors = {
    pontual: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    atrasado: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    adiantado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    hora_extra: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
  };

  const typeColors = {
    entrada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    saida: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
    pausa: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    retorno: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Registros de Ponto</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Consulte todos os registros de ponto
          </p>
        </div>
        <Button
          onClick={exportToCSV}
          variant="outline"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="pausa">Pausa</SelectItem>
                <SelectItem value="retorno">Retorno</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pontual">Pontual</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="adiantado">Adiantado</SelectItem>
                <SelectItem value="hora_extra">Hora Extra</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Data inicial"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Data final"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Registros ({filteredRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={getEmployeePhoto(record.employee_id)} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs">
                            {getEmployeeName(record.employee_id).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{getEmployeeName(record.employee_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[record.type]}>
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(parseISO(record.timestamp), "dd/MM/yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[record.status]}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.delay_minutes > 0 ? (
                        <span className="text-orange-600 font-medium">{record.delay_minutes} min</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.latitude && record.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Ver mapa
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.photo_url ? (
                        <a
                          href={record.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Ver foto
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}