import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, TrendingUp, AlertCircle, Award, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatsCard from "../components/dashboard/StatsCard";
import AttendanceChart from "../components/dashboard/AttendanceChart";
import RecentRecords from "../components/dashboard/RecentRecords";
import TopEmployees from "../components/dashboard/TopEmployees";
import MapRecords from "../components/dashboard/MapRecords";

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
    const userData = await base44.auth.me();
    setUser(userData);
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
    if (employees.length > 0 && timeRecords.length > 0) {
      calculateStats();
    }
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
    const monthPresence = Math.round((uniqueDays / workDays) * 100);

    // Atrasos
    const delays = timeRecords.filter(record => record.status === 'atrasado').length;

    setStats({
      totalEmployees: activeEmployees,
      todayRecords,
      monthPresence,
      delays
    });
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Funcionários Ativos"
          value={stats.totalEmployees}
          icon={Users}
          gradient="from-blue-600 to-blue-400"
          trend="+2 este mês"
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
          trend={stats.monthPresence > 90 ? 'Excelente!' : 'Bom'}
        />
        <StatsCard
          title="Atrasos (Mês)"
          value={stats.delays}
          icon={AlertCircle}
          gradient="from-orange-600 to-orange-400"
        />
      </div>

      {/* Charts and Tables */}
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
    </div>
  );
}