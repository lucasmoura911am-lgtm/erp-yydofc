import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MyTimeRecords() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
    
    if (userData.employee_id) {
      const employeeData = await base44.entities.Employee.filter({ id: userData.employee_id });
      setEmployee(employeeData[0]);
    }
  };

  const { data: myRecords = [] } = useQuery({
    queryKey: ['myRecords', user?.employee_id],
    queryFn: () => user?.employee_id ? base44.entities.TimeRecord.filter({ employee_id: user.employee_id }, '-timestamp') : [],
    enabled: !!user?.employee_id,
  });

  const monthRecords = myRecords.filter(record => {
    const recordDate = parseISO(record.timestamp);
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return recordDate >= monthStart && recordDate <= monthEnd;
  });

  const todayRecords = myRecords.filter(record => {
    const recordDate = new Date(record.timestamp);
    const today = new Date();
    return recordDate.toDateString() === today.toDateString();
  });

  const onTimeCount = monthRecords.filter(r => r.status === 'pontual').length;
  const lateCount = monthRecords.filter(r => r.status === 'atrasado').length;
  const totalMinutesLate = monthRecords.reduce((sum, r) => sum + (r.delay_minutes || 0), 0);

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Meus Registros</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Acompanhe seu histórico de ponto
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total (Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{monthRecords.length}</p>
            <p className="text-xs text-gray-500 mt-1">registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Pontual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{onTimeCount}</p>
            <p className="text-xs text-gray-500 mt-1">registros no horário</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{lateCount}</p>
            <p className="text-xs text-gray-500 mt-1">registros atrasados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{totalMinutesLate}</p>
            <p className="text-xs text-gray-500 mt-1">minutos de atraso</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Records */}
      {todayRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Registros de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {todayRecords.map((record) => (
                <div key={record.id} className="p-4 border rounded-lg">
                  <Badge variant="outline" className={`${typeColors[record.type]} mb-2`}>
                    {record.type}
                  </Badge>
                  <p className="text-2xl font-bold">
                    {format(parseISO(record.timestamp), "HH:mm")}
                  </p>
                  <Badge variant="outline" className={`${statusColors[record.status]} mt-2`}>
                    {record.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Histórico Completo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(parseISO(record.timestamp), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {format(parseISO(record.timestamp), "HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[record.type]}>
                        {record.type}
                      </Badge>
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