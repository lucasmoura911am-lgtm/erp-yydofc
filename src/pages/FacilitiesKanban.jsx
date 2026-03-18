import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter, Building2, Users, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import AllocationCard from "@/components/facilities/AllocationCard";

export default function FacilitiesKanban() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [now, setNow] = useState(new Date());
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupervisor, setFilterSupervisor] = useState("all");

  // Tick every minute for real-time status
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations", user?.company_id],
    queryFn: () => base44.entities.Allocation.filter({ company_id: user.company_id, status: "ativo" }),
    enabled: !!user?.company_id,
    refetchInterval: 60000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.company_id],
    queryFn: () => base44.entities.Client.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const todayStr = format(now, "yyyy-MM-dd");

  const { data: timeRecords = [] } = useQuery({
    queryKey: ["timeRecords_today", user?.company_id, todayStr],
    queryFn: () => base44.entities.TimeRecord.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
    refetchInterval: 60000,
    select: (records) => records.filter(r => r.timestamp?.substring(0, 10) === todayStr),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_today", user?.company_id, todayStr],
    queryFn: () => base44.entities.Task.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
    refetchInterval: 60000,
    select: (tasks) => tasks.filter(t => t.due_date?.substring(0, 10) === todayStr),
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId) =>
      base44.entities.Task.update(taskId, {
        status: "concluida",
        completed_at: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks_today"] }),
  });

  const employeeMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees]);
  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  // Build set of present employees (last record is 'entrada' or 'retorno', not 'saida'/'pausa')
  const presentEmployeeIds = useMemo(() => {
    const lastRecord = {};
    [...timeRecords].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).forEach(r => {
      lastRecord[r.employee_id] = r.type;
    });
    return new Set(Object.entries(lastRecord).filter(([, t]) => t === "entrada" || t === "retorno").map(([id]) => id));
  }, [timeRecords]);

  // Determine card color per allocation
  const getAllocationStatus = (allocation) => {
    const empId = allocation.employee_id;
    const isPresent = presentEmployeeIds.has(empId);
    const empTasks = tasks.filter(t => t.employee_id === empId);
    const nowStr = format(now, "HH:mm");

    if (!isPresent) return "red";

    const overdue = empTasks.some(t =>
      t.status !== "concluida" && t.status !== "cancelada" &&
      t.due_date && format(parseISO(t.due_date), "HH:mm") < nowStr
    );

    const hasDelayed = empTasks.some(t => t.status === "atrasada");

    if (overdue || hasDelayed) return "yellow";
    return "green";
  };

  const supervisors = useMemo(() => {
    const set = new Set(employees.filter(e => e.supervisor_email).map(e => e.supervisor_email));
    employees.filter(e => e.is_supervisor).forEach(e => set.add(e.user_email));
    return [...set].filter(Boolean);
  }, [employees]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter(a => {
      if (filterClient !== "all" && a.client_id !== filterClient) return false;
      if (filterStatus !== "all" && getAllocationStatus(a) !== filterStatus) return false;
      if (filterSupervisor !== "all") {
        const emp = employeeMap[a.employee_id];
        if (!emp || emp.supervisor_email !== filterSupervisor) return false;
      }
      return true;
    });
  }, [allocations, filterClient, filterStatus, filterSupervisor, presentEmployeeIds, tasks, now]);

  // Summary counters
  const summary = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    allocations.forEach(a => { counts[getAllocationStatus(a)]++; });
    return counts;
  }, [allocations, presentEmployeeIds, tasks, now]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              Kanban de Lotações — Facilities
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {format(now, "EEEE, dd 'de' MMMM 'de' yyyy '•' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">{summary.green} OK</span>
            </div>
            <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">{summary.yellow} Atenção</span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">{summary.red} Crítico</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries()}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="green">✅ OK</SelectItem>
              <SelectItem value="yellow">⚠️ Atenção</SelectItem>
              <SelectItem value="red">🔴 Crítico</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Supervisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os supervisores</SelectItem>
              {supervisors.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-gray-400 ml-auto">{filteredAllocations.length} postos exibidos</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full" style={{ minWidth: "max-content" }}>
          {filteredAllocations.length === 0 ? (
            <div className="flex items-center justify-center w-full">
              <div className="text-center text-gray-400 py-20">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Nenhuma lotação ativa encontrada</p>
                <p className="text-sm mt-1">Cadastre lotações em Clientes e Contratos → Lotações</p>
              </div>
            </div>
          ) : (
            filteredAllocations.map(allocation => (
              <AllocationCard
                key={allocation.id}
                allocation={allocation}
                employee={employeeMap[allocation.employee_id]}
                client={clientMap[allocation.client_id]}
                tasks={tasks.filter(t => t.employee_id === allocation.employee_id)}
                isPresent={presentEmployeeIds.has(allocation.employee_id)}
                status={getAllocationStatus(allocation)}
                now={now}
                onCompleteTask={(taskId) => completeTaskMutation.mutate(taskId)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}