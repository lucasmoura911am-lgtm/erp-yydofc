import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    todayRecords: 0,
    monthPresence: 0,
    delays: 0
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      // Se não tem company_id, criar uma
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

  useEffect(() => {
    calculateStats();
  }, [employees, timeRecords]);

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const activeEmployees = employees.filter(emp => emp.status === 'active').length;

    const todayRecords = timeRecords.filter(record => {
      const recordDate = new Date(record.timestamp);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime();
    }).length;

    const monthRecords = timeRecords.filter(record => {
      const recordDate = parseISO(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    const workDays = 22;
    const uniqueDays = new Set(monthRecords.map(r => format(parseISO(r.timestamp), 'yyyy-MM-dd'))).size;
    const monthPresence = uniqueDays > 0 ? Math.round((uniqueDays / workDays) * 100) : 0;

    const delays = timeRecords.filter(record => record.status === 'atrasado').length;

    setStats({
      totalEmployees: activeEmployees,
      todayRecords,
      monthPresence,
      delays
    });
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
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Funcionários Ativos"
          value={stats.totalEmployees}
          icon={Users}
          gradient="from-blue-600 to-blue-400"
          trend={stats.totalEmployees > 0 ? "+2 este mês" : ""}
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
          gradient="from-green-600 to-green-400"
          trend={stats.monthPresence > 90 ? 'Excelente!' : stats.monthPresence > 0 ? 'Bom' : ''}
        />
        <StatsCard
          title="Atrasos (Mês)"
          value={stats.delays}
          icon={AlertCircle}
          gradient="from-orange-600 to-orange-400"
        />
      </div>

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