import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, TrendingUp, AlertCircle, UserCheck, UserX, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import StatsCard from "../components/dashboard/StatsCard";
import AttendanceChart from "../components/dashboard/AttendanceChart";
import RecentRecords from "../components/dashboard/RecentRecords";
import TopEmployees from "../components/dashboard/TopEmployees";
import MapRecords from "../components/dashboard/MapRecords";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));


  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      if (!userData.company_id && userData.role === 'admin') {
        await initializeCompany(userData);
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const initializeCompany = async (userData) => {
    try {
      const company = await base44.entities.Company.create({
        name: "Minha Empresa",
        cnpj: "00.000.000/0000-00",
        work_start_time: "08:00",
        work_end_time: "17:00",
        tolerance_minutes: 15,
        break_minutes: 60,
        status: "active"
      });

      await base44.auth.updateMe({ company_id: company.id });
      
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) {
      console.error("Erro ao inicializar empresa:", error);
    }
  };

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id,
  });

  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date(selectedDate + 'T12:00:00'));
    const monthEnd = endOfMonth(new Date(selectedDate + 'T12:00:00'));
    const activeEmployees = employees.filter(emp => emp.status === 'active');

    const todayRecords = timeRecords.filter(record => record.timestamp.substring(0, 10) === selectedDate);
    const presentToday = new Set(todayRecords.filter(r => r.type === 'entrada').map(r => r.employee_id)).size;
    const absentToday = activeEmployees.length - presentToday;

    const monthRecords = timeRecords.filter(record => {
      const recordDate = parseISO(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    const workDays = 22;
    const uniqueDays = new Set(monthRecords.map(r => format(parseISO(r.timestamp), 'yyyy-MM-dd'))).size;
    const monthPresence = uniqueDays > 0 ? Math.round((uniqueDays / workDays) * 100) : 0;
    const delays = monthRecords.filter(record => record.status === 'atrasado').length;

    return {
      totalEmployees: activeEmployees.length,
      todayRecords: todayRecords.length,
      monthPresence,
      delays,
      presentToday,
      absentToday
    };
  }, [employees, timeRecords, selectedDate]);

  const getPresentEmployees = () => {
    const selectedDayStr = selectedDate; // Já está em formato yyyy-MM-dd
    // Incluir registros manuais e automáticos
    const todayRecords = timeRecords.filter(record => {
      const recordDateStr = record.timestamp.substring(0, 10);
      return recordDateStr === selectedDayStr && record.type === 'entrada';
    });

    const presentEmployeeIds = new Set(todayRecords.map(r => r.employee_id));
    return employees.filter(emp => presentEmployeeIds.has(emp.id) && emp.status === 'active');
  };

  const getAbsentEmployees = () => {
    const selectedDayStr = selectedDate; // Já está em formato yyyy-MM-dd
    // Incluir registros manuais e automáticos
    const todayRecords = timeRecords.filter(record => {
      const recordDateStr = record.timestamp.substring(0, 10);
      return recordDateStr === selectedDayStr && record.type === 'entrada';
    });

    const presentEmployeeIds = new Set(todayRecords.map(r => r.employee_id));
    return employees.filter(emp => !presentEmployeeIds.has(emp.id) && emp.status === 'active');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const presentEmployees = getPresentEmployees();
  const absentEmployees = getAbsentEmployees();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visão geral do controle de ponto
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
            {format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
        </div>
      </div>

      {/* Welcome message for new users */}
      {employees.length === 0 && user.role === 'admin' && (
        <Alert className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <Building2 className="h-5 w-5 text-purple-600" />
          <AlertDescription className="text-purple-900 dark:text-purple-200">
            <p className="font-semibold mb-2">🎉 Bem-vindo ao PontoFlex!</p>
            <p className="mb-3">Para começar a usar o sistema, siga estes passos:</p>
            <ol className="list-decimal list-inside space-y-1 mb-3">
              <li>Cadastre os <Link to={createPageUrl('Departments')} className="underline font-medium">Setores</Link> da empresa</li>
              <li>Cadastre os <Link to={createPageUrl('Positions')} className="underline font-medium">Cargos</Link></li>
              <li>Configure as <Link to={createPageUrl('Shifts')} className="underline font-medium">Escalas de Trabalho</Link></li>
              <li>Cadastre os <Link to={createPageUrl('Employees')} className="underline font-medium">Funcionários</Link></li>
            </ol>
            <p className="text-sm">💡 Já criamos alguns exemplos para você começar!</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Funcionários Ativos"
          value={stats.totalEmployees}
          icon={Users}
          gradient="from-blue-600 to-blue-400"
          trend={stats.totalEmployees > 0 ? "+2 este mês" : ""}
        />
        <StatsCard
          title="Presentes Hoje"
          value={stats.presentToday}
          icon={UserCheck}
          gradient="from-green-600 to-green-400"
          trend={`${stats.totalEmployees > 0 ? Math.round((stats.presentToday/stats.totalEmployees)*100) : 0}%`}
        />
        <StatsCard
          title="Ausentes Hoje"
          value={stats.absentToday}
          icon={UserX}
          gradient="from-orange-600 to-orange-400"
          trend={stats.absentToday > 0 ? 'Atenção' : 'Ótimo!'}
        />
        <StatsCard
          title="Registros Hoje"
          value={stats.todayRecords}
          icon={Clock}
          gradient="from-purple-600 to-purple-400"
        />
        <StatsCard
          title="Presença (Mês)"
          value={`${stats.monthPresence}%`}
          icon={TrendingUp}
          gradient="from-emerald-600 to-emerald-400"
          trend={stats.monthPresence > 90 ? 'Excelente!' : stats.monthPresence > 0 ? 'Bom' : ''}
        />
        <StatsCard
          title="Atrasos (Mês)"
          value={stats.delays}
          icon={AlertCircle}
          gradient="from-red-600 to-red-400"
        />
      </div>

      {/* Presentes e Ausentes Hoje */}
      {employees.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Presentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <UserCheck className="w-5 h-5" />
                Presentes ({presentEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {presentEmployees.length > 0 ? (
                  presentEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <Avatar>
                        <AvatarImage src={emp.photo_url} />
                        <AvatarFallback className="bg-green-600 text-white">
                          {emp.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{emp.full_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{emp.employee_number || "Sem matrícula"}</p>
                      </div>
                      <Badge className="bg-green-500">Presente</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4">Nenhum funcionário presente ainda</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ausentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <UserX className="w-5 h-5" />
                Ausentes ({absentEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {absentEmployees.length > 0 ? (
                  absentEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <Avatar>
                        <AvatarImage src={emp.photo_url} />
                        <AvatarFallback className="bg-orange-600 text-white">
                          {emp.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{emp.full_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{emp.employee_number || "Sem matrícula"}</p>
                      </div>
                      <Badge variant="outline" className="text-orange-600 border-orange-600">Ausente</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-green-600 py-4 font-medium">✅ Todos presentes!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Tables */}
      {timeRecords.length > 0 ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AttendanceChart timeRecords={timeRecords} />
            <RecentRecords timeRecords={timeRecords.slice(0, 10)} employees={employees} />
          </div>

          <div className="space-y-6">
            <TopEmployees timeRecords={timeRecords} employees={employees} />
            <MapRecords timeRecords={timeRecords.slice(0, 20)} />
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Nenhum registro de ponto ainda
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Os registros de ponto aparecerão aqui quando os funcionários começarem a bater ponto.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}