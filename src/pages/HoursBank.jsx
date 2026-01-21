import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function HoursBank() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodMonths, setPeriodMonths] = useState(1);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id, status: 'active' }) : [],
    enabled: !!user?.company_id,
  });

  const { data: hoursBank = [] } = useQuery({
    queryKey: ['hoursBank', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.HoursBank.filter({ company_id: user.company_id }, '-date') : [],
    enabled: !!user?.company_id,
  });

  const getEmployeeHoursSummary = (employeeId) => {
    const startDate = startOfMonth(subMonths(new Date(), periodMonths - 1));
    const endDate = endOfMonth(new Date());
    
    const employeeRecords = hoursBank.filter(h => {
      const recordDate = new Date(h.date);
      return h.employee_id === employeeId && recordDate >= startDate && recordDate <= endDate;
    });

    const totalBalance = employeeRecords.reduce((sum, r) => sum + (r.balance_minutes || 0), 0);
    const totalOvertime = employeeRecords.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0);
    const totalMissing = employeeRecords.reduce((sum, r) => sum + (r.missing_minutes || 0), 0);
    const totalWorked = employeeRecords.reduce((sum, r) => sum + (r.worked_minutes || 0), 0);
    const totalExpected = employeeRecords.reduce((sum, r) => sum + (r.expected_minutes || 0), 0);

    return {
      totalBalance,
      totalOvertime,
      totalMissing,
      totalWorked,
      totalExpected,
      records: employeeRecords
    };
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return "0h";
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = minutes < 0 ? '-' : '+';
    return `${sign}${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
  };

  const employeesWithSummary = employees.map(emp => ({
    ...emp,
    summary: getEmployeeHoursSummary(emp.id)
  }));

  const filteredEmployees = employeesWithSummary.filter(emp => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const balance = emp.summary.totalBalance;
    
    let matchesStatus = true;
    if (statusFilter === "deficit") matchesStatus = balance < 0;
    else if (statusFilter === "excess") matchesStatus = balance > 0;
    else if (statusFilter === "balanced") matchesStatus = balance === 0;
    
    return matchesSearch && matchesStatus;
  });

  const sortedEmployees = filteredEmployees.sort((a, b) => a.summary.totalBalance - b.summary.totalBalance);

  const deficitEmployees = employeesWithSummary.filter(e => e.summary.totalBalance < 0);
  const excessEmployees = employeesWithSummary.filter(e => e.summary.totalBalance > 0);
  const totalDeficit = deficitEmployees.reduce((sum, e) => sum + Math.abs(e.summary.totalBalance), 0);
  const totalExcess = excessEmployees.reduce((sum, e) => sum + e.summary.totalBalance, 0);

  const getStatusColor = (balance) => {
    if (balance < -480) return { bg: 'from-red-500 to-red-600', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: AlertTriangle };
    if (balance < 0) return { bg: 'from-orange-500 to-orange-600', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800', icon: TrendingDown };
    if (balance > 480) return { bg: 'from-blue-500 to-blue-600', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', icon: TrendingUp };
    if (balance > 0) return { bg: 'from-green-500 to-green-600', text: 'text-green-700', badge: 'bg-green-100 text-green-800', icon: CheckCircle };
    return { bg: 'from-gray-400 to-gray-500', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800', icon: Clock };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Banco de Horas</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gestão e acompanhamento do saldo de horas dos funcionários
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-gray-600">Com Déficit</p>
            </div>
            <p className="text-3xl font-bold text-red-600">{deficitEmployees.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total: {formatMinutes(totalDeficit)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-gray-600">Com Excesso</p>
            </div>
            <p className="text-3xl font-bold text-green-600">{excessEmployees.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total: {formatMinutes(totalExcess)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">Total Funcionários</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">{employees.length}</p>
            <p className="text-xs text-gray-500 mt-1">Ativos no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-600">Período Análise</p>
            </div>
            <p className="text-3xl font-bold text-purple-600">{periodMonths}</p>
            <p className="text-xs text-gray-500 mt-1">{periodMonths === 1 ? 'mês' : 'meses'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="deficit">Apenas Déficit</SelectItem>
                <SelectItem value="excess">Apenas Excesso</SelectItem>
                <SelectItem value="balanced">Equilibrados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={periodMonths.toString()} onValueChange={(v) => setPeriodMonths(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Último mês</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedEmployees.map((emp) => {
          const status = getStatusColor(emp.summary.totalBalance);
          const StatusIcon = status.icon;
          const isDeficit = emp.summary.totalBalance < 0;

          return (
            <Card key={emp.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`absolute inset-0 bg-gradient-to-br ${status.bg} opacity-5`}></div>
              <CardHeader className="relative pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 border-2" style={{ borderColor: isDeficit ? '#ef4444' : emp.summary.totalBalance > 0 ? '#22c55e' : '#9ca3af' }}>
                    <AvatarImage src={emp.photo_url} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                      {emp.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{emp.full_name}</CardTitle>
                    <p className="text-xs text-gray-500">{emp.employee_number || 'Sem matrícula'}</p>
                  </div>
                  <StatusIcon className={`w-5 h-5 ${status.text}`} />
                </div>
              </CardHeader>
              <CardContent className="relative space-y-3">
                {/* Main Balance */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2" style={{ borderColor: isDeficit ? '#ef4444' : emp.summary.totalBalance > 0 ? '#22c55e' : '#e5e7eb' }}>
                  <p className="text-xs text-gray-500 mb-1">Saldo Total</p>
                  <p className={`text-2xl font-bold ${status.text}`}>
                    {formatMinutes(emp.summary.totalBalance)}
                  </p>
                  <Badge className={`${status.badge} mt-2`}>
                    {isDeficit ? 'Déficit' : emp.summary.totalBalance > 0 ? 'Excesso' : 'Equilibrado'}
                  </Badge>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Horas Extra</p>
                    <p className="text-lg font-bold text-green-700">
                      {formatMinutes(emp.summary.totalOvertime)}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200">
                    <p className="text-xs text-gray-600 mb-1">Faltantes</p>
                    <p className="text-lg font-bold text-red-700">
                      {formatMinutes(emp.summary.totalMissing)}
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Trabalhadas</span>
                    <span className="font-semibold">{formatMinutes(emp.summary.totalWorked)} / {formatMinutes(emp.summary.totalExpected)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all bg-gradient-to-r ${status.bg}`}
                      style={{ width: `${Math.min((emp.summary.totalWorked / emp.summary.totalExpected) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Recent Records */}
                {emp.summary.records.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Últimos Registros ({emp.summary.records.length})</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {emp.summary.records.slice(0, 5).map((record, idx) => (
                        <div key={idx} className="flex justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                          <span className="text-gray-600">{format(new Date(record.date), 'dd/MM/yyyy')}</span>
                          <span className={record.balance_minutes < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                            {formatMinutes(record.balance_minutes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sortedEmployees.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Nenhum funcionário encontrado
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Ajuste os filtros para visualizar diferentes resultados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}