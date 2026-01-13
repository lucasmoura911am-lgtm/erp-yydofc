import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertTriangle, ListTodo, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { format, isPast, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TasksDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Task.filter({ company_id: user.company_id }, '-created_date') : [],
    enabled: !!user?.company_id,
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id, status: 'active' }) : [],
    enabled: !!user?.company_id,
  });

  const employees = user?.is_supervisor 
    ? allEmployees.filter(emp => emp.supervisor_email === user.email || user.supervised_teams?.some(teamId => emp.team_id === teamId))
    : allEmployees;

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const todayTasks = tasks.filter(task => {
    const dueDate = parseISO(task.due_date);
    return dueDate >= todayStart && dueDate <= todayEnd;
  });

  const completedToday = todayTasks.filter(t => t.status === 'concluida').length;
  const inProgressToday = todayTasks.filter(t => t.status === 'em_andamento').length;
  const lateToday = todayTasks.filter(t => t.status === 'atrasada' || (t.status !== 'concluida' && isPast(parseISO(t.due_date)))).length;

  const getEmployeeStatus = (empId) => {
    const empTasks = todayTasks.filter(t => t.employee_id === empId);
    if (empTasks.length === 0) return { color: 'gray', label: 'Sem tarefas', icon: '⚪' };
    
    const completed = empTasks.filter(t => t.status === 'concluida').length;
    const late = empTasks.filter(t => t.status === 'atrasada' || (t.status !== 'concluida' && isPast(parseISO(t.due_date)))).length;
    
    if (completed === empTasks.length) return { color: 'green', label: 'Completo', icon: '🟢' };
    if (late > 0) return { color: 'red', label: 'Atrasado', icon: '🔴' };
    return { color: 'yellow', label: 'Em andamento', icon: '🟡' };
  };

  const getEmployeeProgress = (empId) => {
    const empTasks = todayTasks.filter(t => t.employee_id === empId);
    if (empTasks.length === 0) return 0;
    const completed = empTasks.filter(t => t.status === 'concluida').length;
    return Math.round((completed / empTasks.length) * 100);
  };

  const getLastActivity = (empId) => {
    const empTasks = tasks.filter(t => t.employee_id === empId).sort((a, b) => 
      new Date(b.updated_date) - new Date(a.updated_date)
    );
    if (empTasks.length === 0) return 'Nenhuma atividade';
    const lastTask = empTasks[0];
    if (lastTask.completed_at) return `Concluiu: ${lastTask.title}`;
    if (lastTask.started_at) return `Iniciou: ${lastTask.title}`;
    return 'Sem atividade recente';
  };

  const getPendingCount = (empId) => {
    return todayTasks.filter(t => t.employee_id === empId && t.status !== 'concluida').length;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard - Plano de Trabalho</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Acompanhamento em tempo real das tarefas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-blue-600" />
              <p className="text-3xl font-bold text-blue-600">{todayTasks.length}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Tarefas programadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-3xl font-bold text-green-600">{completedToday}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">{todayTasks.length > 0 ? Math.round((completedToday/todayTasks.length)*100) : 0}% do total</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <p className="text-3xl font-bold text-yellow-600">{inProgressToday}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Sendo executadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-3xl font-bold text-red-600">{lateToday}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Requer atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Status - Clean Visual */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">👥 Status da Equipe</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {employees.map((emp) => {
            const status = getEmployeeStatus(emp.id);
            const progress = getEmployeeProgress(emp.id);
            const pending = getPendingCount(emp.id);
            const empTasks = todayTasks.filter(t => t.employee_id === emp.id);
            const completed = empTasks.filter(t => t.status === 'concluida').length;

            const bgColor = status.color === 'green' ? 'from-green-500 to-green-600' : 
                           status.color === 'yellow' ? 'from-yellow-500 to-yellow-600' : 
                           status.color === 'red' ? 'from-red-500 to-red-600' : 'from-gray-400 to-gray-500';

            return (
              <Card key={emp.id} className="relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${bgColor} opacity-10`}></div>
                <CardContent className="p-6 relative space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <Avatar className="w-16 h-16 border-4" style={{ borderColor: status.color === 'green' ? '#22c55e' : status.color === 'yellow' ? '#eab308' : status.color === 'red' ? '#ef4444' : '#9ca3af' }}>
                      <AvatarImage src={emp.photo_url} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xl">
                        {emp.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{emp.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-4xl">{status.icon}</span>
                        <span className={`text-sm font-semibold ${status.color === 'green' ? 'text-green-700' : status.color === 'yellow' ? 'text-yellow-700' : status.color === 'red' ? 'text-red-700' : 'text-gray-700'}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                      <p className="text-2xl font-bold text-green-600">{completed}</p>
                      <p className="text-xs text-gray-500">Concluídas</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                      <p className="text-2xl font-bold text-orange-600">{pending}</p>
                      <p className="text-xs text-gray-500">Pendentes</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">Progresso</span>
                      <span className="font-bold">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 bg-gradient-to-r ${bgColor}`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}