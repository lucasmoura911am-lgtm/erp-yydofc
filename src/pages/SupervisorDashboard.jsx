import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, TrendingUp, AlertTriangle, CheckCircle, XCircle, Award, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

export default function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id, status: 'active' }) : [],
    enabled: !!user?.company_id,
  });

  const employees = user?.is_supervisor 
    ? allEmployees.filter(emp => emp.supervisor_email === user.email || user.supervised_teams?.some(teamId => emp.team_id === teamId))
    : allEmployees;

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id,
  });

  const { data: hoursBank = [] } = useQuery({
    queryKey: ['hoursBank', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.HoursBank.filter({ company_id: user.company_id }, '-date') : [],
    enabled: !!user?.company_id,
  });

  const selectedDayStr = format(new Date(selectedDate), 'yyyy-MM-dd');
  const monthStart = startOfMonth(new Date(selectedDate));
  const monthEnd = endOfMonth(new Date(selectedDate));

  const todayRecords = timeRecords.filter(r => {
    // Extrair apenas a data (ignorando hora/timezone)
    const recordDate = new Date(r.timestamp);
    const recordDateStr = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
    return recordDateStr === selectedDayStr;
  });

  const monthRecords = timeRecords.filter(r => {
    const recordDate = parseISO(r.timestamp);
    return recordDate >= monthStart && recordDate <= monthEnd;
  });

  const presentToday = new Set(todayRecords.filter(r => r.type === 'entrada').map(r => r.employee_id)).size;
  const absentToday = employees.length - presentToday;
  const lateToday = todayRecords.filter(r => r.status === 'atrasado' && r.type === 'entrada').length;

  const incompleteDays = hoursBank.filter(hb => {
    const dayRecords = timeRecords.filter(r => 
      format(startOfDay(new Date(r.timestamp)), 'yyyy-MM-dd') === hb.date &&
      r.employee_id === hb.employee_id
    );
    const hasEntrada = dayRecords.some(r => r.type === 'entrada');
    const hasSaida = dayRecords.some(r => r.type === 'saida');
    return hasEntrada && !hasSaida;
  }).length;

  const totalOvertime = hoursBank.reduce((sum, hb) => sum + (hb.overtime_minutes || 0), 0);
  const totalMissing = hoursBank.reduce((sum, hb) => sum + (hb.missing_minutes || 0), 0);

  const formatMinutes = (minutes) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    return `${hours}h ${mins}min`;
  };

  const employeeStats = employees.map(emp => {
    const empRecords = monthRecords.filter(r => r.employee_id === emp.id);
    const empHoursBank = hoursBank.filter(hb => hb.employee_id === emp.id);
    const totalBalance = empHoursBank.reduce((sum, hb) => sum + (hb.balance_minutes || 0), 0);
    const overtime = empHoursBank.reduce((sum, hb) => sum + (hb.overtime_minutes || 0), 0);
    const missing = empHoursBank.reduce((sum, hb) => sum + (hb.missing_minutes || 0), 0);
    const onTime = empRecords.filter(r => r.status === 'pontual').length;
    const late = empRecords.filter(r => r.status === 'atrasado').length;
    const punctuality = empRecords.length > 0 ? Math.round((onTime / empRecords.length) * 100) : 0;

    return {
      employee: emp,
      balance: totalBalance,
      overtime,
      missing,
      punctuality,
      lateCount: late,
      totalRecords: empRecords.length
    };
  });

  const topPerformers = [...employeeStats].sort((a, b) => b.punctuality - a.punctuality).slice(0, 5);
  const mostOvertime = [...employeeStats].sort((a, b) => b.overtime - a.overtime).slice(0, 5);
  const pendingIssues = employeeStats.filter(stat => stat.missing > 0 || stat.lateCount > 3);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard Supervisor</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visão completa da equipe e banco de horas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className="text-3xl font-bold text-blue-600">{employees.length}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Ativos na empresa</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Presentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-3xl font-bold text-green-600">{presentToday}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">{Math.round((presentToday/employees.length)*100)}% da equipe</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Ausentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-orange-600" />
              <p className="text-3xl font-bold text-orange-600">{absentToday}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">{lateToday} atrasados</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Pendências</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-purple-600" />
              <p className="text-3xl font-bold text-purple-600">{incompleteDays}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Pontos incompletos</p>
          </CardContent>
        </Card>
      </div>

      {/* Hours Bank Summary */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-400">
              <TrendingUp className="w-5 h-5" />
              Horas Extras Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-700 dark:text-green-300">
              +{formatMinutes(totalOvertime)}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              Acumulado da equipe este mês
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-400">
              <Clock className="w-5 h-5" />
              Horas Faltantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-orange-700 dark:text-orange-300">
              -{formatMinutes(totalMissing)}
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
              Déficit total da equipe
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-400">
              <Timer className="w-5 h-5" />
              Saldo Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${totalOvertime - totalMissing >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {totalOvertime - totalMissing >= 0 ? '+' : '-'}{formatMinutes(Math.abs(totalOvertime - totalMissing))}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
              Balanço final do mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600" />
              Top 5 Pontualidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerformers.map((stat, index) => (
                <div key={stat.employee.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                    <Avatar>
                      <AvatarImage src={stat.employee.photo_url} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                        {stat.employee.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{stat.employee.full_name}</p>
                      <p className="text-xs text-gray-500">{stat.totalRecords} registros</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-600">{stat.punctuality}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Top 5 Horas Extras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mostOvertime.map((stat, index) => (
                <div key={stat.employee.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                    <Avatar>
                      <AvatarImage src={stat.employee.photo_url} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                        {stat.employee.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{stat.employee.full_name}</p>
                      <p className="text-xs text-gray-500">Saldo: {stat.balance >= 0 ? '+' : ''}{formatMinutes(stat.balance)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-purple-600">+{formatMinutes(stat.overtime)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Issues */}
      {pendingIssues.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              Funcionários com Pendências ({pendingIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Pontualidade</TableHead>
                  <TableHead>Atrasos</TableHead>
                  <TableHead>Horas Faltantes</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingIssues.map((stat) => (
                  <TableRow key={stat.employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={stat.employee.photo_url} />
                          <AvatarFallback>{stat.employee.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{stat.employee.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={stat.punctuality} className="h-2" />
                        <span className="text-xs text-gray-500">{stat.punctuality}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {stat.lateCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600 font-medium">-{formatMinutes(stat.missing)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={stat.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {stat.balance >= 0 ? '+' : ''}{formatMinutes(stat.balance)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Employees Bank */}
      <Card>
        <CardHeader>
          <CardTitle>Banco de Horas - Todos os Funcionários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Pontualidade</TableHead>
                <TableHead>Horas Extras</TableHead>
                <TableHead>Horas Faltantes</TableHead>
                <TableHead>Saldo Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeStats.map((stat) => (
                <TableRow key={stat.employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={stat.employee.photo_url} />
                        <AvatarFallback>{stat.employee.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{stat.employee.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{stat.totalRecords}</TableCell>
                  <TableCell>
                    <Badge className={stat.punctuality >= 90 ? 'bg-green-600' : stat.punctuality >= 70 ? 'bg-yellow-600' : 'bg-red-600'}>
                      {stat.punctuality}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">+{formatMinutes(stat.overtime)}</TableCell>
                  <TableCell className="text-orange-600 font-medium">-{formatMinutes(stat.missing)}</TableCell>
                  <TableCell>
                    <span className={`font-bold ${stat.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.balance >= 0 ? '+' : ''}{formatMinutes(stat.balance)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}