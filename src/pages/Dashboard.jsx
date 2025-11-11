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

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
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
    const userData = await base44.auth.me();
    setUser(userData);
    
    // Se o usuário não tem company_id, criar uma empresa automaticamente
    if (!userData.company_id && userData.role === 'admin') {
      await initializeCompany(userData);
    } else {
      setInitializing(false);
    }
  };

  const initializeCompany = async (userData) => {
    try {
      // Criar empresa padrão
      const company = await base44.entities.Company.create({
        name: "Minha Empresa",
        cnpj: "00.000.000/0000-00",
        work_start_time: "08:00",
        work_end_time: "17:00",
        tolerance_minutes: 15,
        break_minutes: 60,
        status: "active"
      });

      // Atualizar usuário com company_id
      await base44.auth.updateMe({ company_id: company.id });
      
      // Recarregar usuário
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) {
      console.error("Erro ao inicializar empresa:", error);
    } finally {
      setInitializing(false);
    }
  };

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id && !initializing,
  });

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id && !initializing,
  });

  useEffect(() => {
    calculateStats();
  }, [employees, timeRecords]);

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    // Total de funcionários ativos
    const activeEmployees = employees.filter(emp => emp.status === 'active').length;

    // Registros de hoje
    const todayRecords = timeRecords.filter(record => {
      const recordDate = new Date(record.timestamp);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime();
    }).length;

    // Registros do mês
    const monthRecords = timeRecords.filter(record => {
      const recordDate = parseISO(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Cálculo de presença do mês (% de dias úteis com registro)
    const workDays = 22; // aprox 22 dias úteis
    const uniqueDays = new Set(monthRecords.map(r => format(parseISO(r.timestamp), 'yyyy-MM-dd'))).size;
    const monthPresence = uniqueDays > 0 ? Math.round((uniqueDays / workDays) * 100) : 0;

    // Atrasos
    const delays = timeRecords.filter(record => record.status === 'atrasado').length;

    setStats({
      totalEmployees: activeEmployees,
      todayRecords,
      monthPresence,
      delays
    });
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  // Se não é admin e não tem employee_id
  if (user.role !== 'admin' && !user.employee_id) {
    return (
      <div className="p-6">
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            Você ainda não foi cadastrado como funcionário. Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
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
        <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <Building2 className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            Bem-vindo ao PontoFlex! Comece cadastrando os setores, cargos, escalas e funcionários da sua empresa.
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