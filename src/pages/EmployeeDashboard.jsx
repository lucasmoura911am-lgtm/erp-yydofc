import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown, Calendar, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfMonth, endOfMonth, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import HoursBankCard from "../components/hours/HoursBankCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function EmployeeDashboard() {
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
      if (employeeData.length > 0) {
        setEmployee(employeeData[0]);
      }
    }
  };

  const { data: myRecords = [] } = useQuery({
    queryKey: ['myRecords', user?.employee_id],
    queryFn: () => user?.employee_id ? base44.entities.TimeRecord.filter({ employee_id: user.employee_id }, '-timestamp') : [],
    enabled: !!user?.employee_id,
  });

  const { data: hoursBank = [] } = useQuery({
    queryKey: ['hoursBank', user?.employee_id],
    queryFn: () => user?.employee_id ? base44.entities.HoursBank.filter({ employee_id: user.employee_id }, '-date') : [],
    enabled: !!user?.employee_id,
  });

  // Filtrar registros do mês (incluindo manuais e automáticos)
  const monthRecords = myRecords.filter(record => {
    const recordDate = parseISO(record.timestamp);
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return recordDate >= monthStart && recordDate <= monthEnd;
  });

  // Filtrar registros de hoje (incluindo manuais e automáticos)
  const todayRecords = myRecords.filter(record => {
    const recordDate = startOfDay(new Date(record.timestamp));
    const today = startOfDay(new Date());
    return recordDate.getTime() === today.getTime();
  });

  const totalBalance = hoursBank.reduce((sum, record) => sum + (record.balance_minutes || 0), 0);
  const totalOvertime = hoursBank.reduce((sum, record) => sum + (record.overtime_minutes || 0), 0);
  const onTimeCount = monthRecords.filter(r => r.status === 'pontual').length;
  const lateCount = monthRecords.filter(r => r.status === 'atrasado').length;
  const punctualityRate = monthRecords.length > 0 ? Math.round((onTimeCount / monthRecords.length) * 100) : 0;

  const formatMinutes = (minutes) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    return `${hours}h ${mins}min`;
  };

  const statusColors = {
    pontual: "bg-green-100 text-green-800",
    atrasado: "bg-orange-100 text-orange-800",
    adiantado: "bg-blue-100 text-blue-800",
    hora_extra: "bg-purple-100 text-purple-800",
    falta: "bg-red-100 text-red-800"
  };

  const typeColors = {
    entrada: "bg-blue-100 text-blue-800",
    saida: "bg-gray-100 text-gray-800",
    pausa: "bg-yellow-100 text-yellow-800",
    retorno: "bg-green-100 text-green-800"
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Meu Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Bem-vindo, {employee?.full_name || user?.full_name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Saldo de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {totalBalance >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalBalance >= 0 ? '+' : '-'}{formatMinutes(totalBalance)}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Acumulado total</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Horas Extras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              <p className="text-3xl font-bold text-green-600">+{formatMinutes(totalOvertime)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Pontualidade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{punctualityRate}%</p>
            <p className="text-xs text-gray-500 mt-1">{onTimeCount} de {monthRecords.length} registros</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Atrasos (Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <p className="text-3xl font-bold text-orange-600">{lateCount}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Registros atrasados</p>
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
                <div key={record.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
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

      {/* Hours Bank */}
      {hoursBank.length > 0 && (
        <HoursBankCard hoursBank={hoursBank} />
      )}

      {/* Recent Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Últimos 10 Registros
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
                {myRecords.slice(0, 10).map((record) => (
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