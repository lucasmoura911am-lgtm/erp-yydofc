import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Save, Trash2, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import MonthlySummaryCard from "@/components/timereport/MonthlySummaryCard";
import { calcDayResult, calcMonthlySummary, calcWeeklyDSRMap, applyInterjornada, formatMinutes } from "@/lib/timeCalculations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, getDaysInMonth, startOfMonth, addMonths, subMonths, parseISO, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

const TYPES = ["entrada", "pausa", "retorno", "saida"];
const TYPE_COLORS = {
  entrada: "bg-green-100 text-green-700 border-green-200",
  pausa: "bg-orange-100 text-orange-700 border-orange-200",
  retorno: "bg-blue-100 text-blue-700 border-blue-200",
  saida: "bg-red-100 text-red-700 border-red-200",
};
const TYPE_DOT = {
  entrada: "bg-green-500",
  pausa: "bg-orange-500",
  retorno: "bg-blue-500",
  saida: "bg-red-500",
};

export default function ManageTimeRecordsMonthly() {
  const [user, setUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // edits: { "yyyy-MM-dd": { entrada: "HH:mm", pausa, retorno, saida } }
  const [edits, setEdits] = useState({});
  const [savingDays, setSavingDays] = useState({});
  const [savedDays, setSavedDays] = useState({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const monthKey = format(currentMonth, "yyyy-MM");

  const { data: timeRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["timeRecordsMonthly", user?.company_id, selectedEmployee, monthKey],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), "yyyy-MM-dd");
      const all = await base44.entities.TimeRecord.filter(
        { company_id: user.company_id, employee_id: selectedEmployee },
        "-timestamp",
        500
      );
      return all.filter(r => {
        const d = r.timestamp?.substring(0, 10);
        return d >= start && d <= end;
      });
    },
    enabled: !!user?.company_id && !!selectedEmployee,
  });

  // Build recordsMap: { "yyyy-MM-dd": { entrada: record, pausa: record, ... } }
  const recordsMap = useMemo(() => {
    const map = {};
    timeRecords.forEach(r => {
      const day = r.timestamp?.substring(0, 10);
      if (!map[day]) map[day] = {};
      map[day][r.type] = r;
    });
    return map;
  }, [timeRecords]);

  // Initialize edits when records load or employee/month changes
  useEffect(() => {
    if (!selectedEmployee) return;
    const initialEdits = {};
    const days = getDaysInMonth(currentMonth);
    for (let d = 1; d <= days; d++) {
      const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d), "yyyy-MM-dd");
      const dayRecs = recordsMap[dateStr] || {};
      initialEdits[dateStr] = {
        entrada: dayRecs.entrada ? dayRecs.entrada.timestamp?.substring(11, 16) : "",
        pausa: dayRecs.pausa ? dayRecs.pausa.timestamp?.substring(11, 16) : "",
        retorno: dayRecs.retorno ? dayRecs.retorno.timestamp?.substring(11, 16) : "",
        saida: dayRecs.saida ? dayRecs.saida.timestamp?.substring(11, 16) : "",
      };
    }
    setEdits(initialEdits);
    setSavedDays({});
  }, [recordsMap, selectedEmployee, monthKey]);

  const updateTime = (dateStr, type, value) => {
    setEdits(prev => ({
      ...prev,
      [dateStr]: { ...(prev[dateStr] || {}), [type]: value },
    }));
    setSavedDays(prev => ({ ...prev, [dateStr]: false }));
  };

  const saveDay = async (dateStr) => {
    setSavingDays(prev => ({ ...prev, [dateStr]: true }));
    const dayEdits = edits[dateStr] || {};
    const dayRecs = recordsMap[dateStr] || {};

    for (const type of TYPES) {
      const time = dayEdits[type];
      const existing = dayRecs[type];

      if (time && existing) {
        // update
        await base44.entities.TimeRecord.update(existing.id, {
          timestamp: `${dateStr}T${time}:00`,
          is_manual: true,
          edited_by: user.email,
          edited_at: new Date().toISOString(),
        });
      } else if (time && !existing) {
        // create
        await base44.entities.TimeRecord.create({
          employee_id: selectedEmployee,
          company_id: user.company_id,
          timestamp: `${dateStr}T${time}:00`,
          type,
          is_manual: true,
          edited_by: user.email,
          edited_at: new Date().toISOString(),
        });
      } else if (!time && existing) {
        // delete
        await base44.entities.TimeRecord.delete(existing.id);
      }
    }

    await queryClient.invalidateQueries(["timeRecordsMonthly", user?.company_id, selectedEmployee, monthKey]);
    setSavingDays(prev => ({ ...prev, [dateStr]: false }));
    setSavedDays(prev => ({ ...prev, [dateStr]: true }));
  };

  const deleteDay = async (dateStr) => {
    const dayRecs = recordsMap[dateStr] || {};
    const ids = Object.values(dayRecs).map(r => r.id);
    if (ids.length === 0) return;
    if (!confirm(`Excluir todos os ${ids.length} registros de ${format(parseISO(dateStr), "dd/MM")}?`)) return;
    for (const id of ids) {
      await base44.entities.TimeRecord.delete(id);
    }
    await queryClient.invalidateQueries(["timeRecordsMonthly", user?.company_id, selectedEmployee, monthKey]);
    toast({ title: "Registros excluídos", description: `Dia ${format(parseISO(dateStr), "dd/MM")} limpo.` });
  };

  const days = useMemo(() => {
    const count = getDaysInMonth(currentMonth);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
      return { date: d, dateStr: format(d, "yyyy-MM-dd") };
    });
  }, [currentMonth]);

  const selectedEmp = employees.find(e => e.id === selectedEmployee);

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", user?.company_id],
    queryFn: () => base44.entities.Shift.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const WORK_DAYS_MAP = { sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6 };

  const shiftWorkDays = useMemo(() => {
    if (!selectedEmp?.shift_id) return null;
    const shift = shifts.find(s => s.id === selectedEmp.shift_id);
    if (!shift?.work_days?.length) return null;
    return new Set(shift.work_days.map(d => WORK_DAYS_MAP[d]).filter(d => d !== undefined));
  }, [selectedEmp, shifts]);

  const overtimeConfig = useMemo(() => {
    if (!selectedEmp?.shift_id) return null;
    const shift = shifts.find(s => s.id === selectedEmp.shift_id);
    if (!shift) return null;
    const dayRates = new Map();
    (shift.overtime_rules || []).forEach(r => {
      const dow = WORK_DAYS_MAP[r.day];
      if (dow !== undefined) dayRates.set(dow, r.rate);
    });
    return { dayRates, offDayRate: shift.overtime_offday_rate ?? 100 };
  }, [selectedEmp, shifts]);

  const shiftJornadaMin = useMemo(() => {
    if (!selectedEmp?.shift_id) return 480;
    const shift = shifts.find(s => s.id === selectedEmp.shift_id);
    if (!shift?.start_time || !shift?.end_time) return 480;
    const [sh, sm] = shift.start_time.split(":").map(Number);
    const [eh, em] = shift.end_time.split(":").map(Number);
    let total = (eh*60+em) - (sh*60+sm);
    if (total < 0) total += 1440;
    total -= (shift.break_minutes || 60);
    return Math.max(total, 0);
  }, [selectedEmp, shifts]);

  const { monthlySummary, dsrBySunday, dayResultMap } = useMemo(() => {
    if (!selectedEmployee || days.length === 0) return { monthlySummary: null, dsrBySunday: {}, dayResultMap: {} };
    const defaultWorkDays = new Set([1,2,3,4,5]);
    const workDays = shiftWorkDays || defaultWorkDays;
    const listByDate = {};
    timeRecords.forEach(r => {
      const day = r.timestamp?.substring(0, 10);
      if (!listByDate[day]) listByDate[day] = [];
      listByDate[day].push(r);
    });
    const dayResults = days.map(({ date, dateStr }) => {
      const dow = date.getDay();
      const recs = listByDate[dateStr] || [];
      const jornada = workDays.has(dow) ? shiftJornadaMin : 0;
      return { ...calcDayResult(dateStr, recs, jornada), dow };
    });
    applyInterjornada(dayResults, listByDate);
    const weeklyDsrMap = calcWeeklyDSRMap(dayResults);
    const dsrBySunday = {};
    Object.values(weeklyDsrMap).forEach(({ dsrMin, sundayDateStr }) => {
      if (sundayDateStr && dsrMin > 0) dsrBySunday[sundayDateStr] = dsrMin;
    });
    const summary = calcMonthlySummary(dayResults);
    // Map dayResult by dateStr for badge lookup
    const dayResultMap = {};
    dayResults.forEach(d => { dayResultMap[d.dateStr] = d; });
    return { monthlySummary: summary, dsrBySunday, dayResultMap };
  }, [days, timeRecords, selectedEmployee, shiftWorkDays, shiftJornadaMin]);

  const hasDayRecords = (dateStr) => Object.keys(recordsMap[dateStr] || {}).length > 0;
  const isDayEdited = (dateStr) => {
    const cur = edits[dateStr] || {};
    const orig = recordsMap[dateStr] || {};
    return TYPES.some(t => (cur[t] || "") !== (orig[t]?.timestamp?.substring(11, 16) || ""));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão Mensal de Pontos</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Selecione o funcionário e o mês para editar todos os dias de uma vez
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={v => { setSelectedEmployee(v); setEdits({}); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.employee_number ? `- ${emp.employee_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="w-40 text-center font-semibold text-gray-800 dark:text-gray-200 capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedEmployee && (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Selecione um funcionário para começar</p>
          </CardContent>
        </Card>
      )}

      {selectedEmployee && monthlySummary && (
        <MonthlySummaryCard summary={monthlySummary} />
      )}

      {selectedEmployee && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              {selectedEmp?.full_name} — {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              {loadingRecords && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 px-4 py-2 border-b bg-gray-50 dark:bg-gray-900">
              {TYPES.map(t => (
                <div key={t} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <div className={`w-2.5 h-2.5 rounded-full ${TYPE_DOT[t]}`} />
                  <span className="capitalize">{t}</span>
                </div>
              ))}
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[90px_1fr_1fr_1fr_1fr_100px] gap-2 px-4 py-2 text-xs font-semibold text-gray-500 border-b bg-gray-50 dark:bg-gray-800">
              <div>Dia</div>
              {TYPES.map(t => <div key={t} className="capitalize">{t}</div>)}
              <div>Ações</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {days.map(({ date, dateStr }) => {
                const weekend = isWeekend(date);
                const hasRec = hasDayRecords(dateStr);
                const edited = isDayEdited(dateStr);
                const saving = savingDays[dateStr];
                const saved = savedDays[dateStr];
                const dayEdits = edits[dateStr] || {};
                const dsrMin = dsrBySunday[dateStr];
                // Dia fora da escala mas com registros = HE 100%
                const dayResult = (monthlySummary && dayResultMap) ? dayResultMap[dateStr] : null;
                const isOffWithWork = dayResult?.label === "folga" && dayResult?.workedMin > 0;

                return (
                  <React.Fragment key={dateStr}>
                  <div
                    className={`px-4 py-2 ${weekend ? "bg-gray-50/60 dark:bg-gray-900/40" : ""} ${edited ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}
                  >
                    {/* Mobile label */}
                    <div className="flex items-center justify-between mb-2 md:hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {format(date, "EEE dd/MM", { locale: ptBR })}
                        </span>
                        {weekend && <Badge variant="outline" className="text-xs py-0 px-1">fim de semana</Badge>}
                        {isOffWithWork && <Badge className="text-xs py-0 px-1 bg-emerald-100 text-emerald-700 border-emerald-200">HE 100%</Badge>}
                        {hasRec && !edited && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                        {edited && <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          disabled={saving || !edited}
                          onClick={() => saveDay(dateStr)}
                          className="h-7 px-2 text-xs bg-gradient-to-r from-purple-600 to-blue-600"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        {hasRec && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={() => deleteDay(dateStr)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Desktop row */}
                    <div className="grid grid-cols-2 md:grid-cols-[90px_1fr_1fr_1fr_1fr_100px] gap-2 items-center">
                      {/* Day label — desktop only */}
                      <div className="hidden md:flex items-center gap-1.5">
                        <span className="text-sm font-medium capitalize">
                          {format(date, "EEE dd", { locale: ptBR })}
                        </span>
                        {hasRec && !edited && <CheckCircle className="w-3 h-3 text-green-500" />}
                        {edited && <AlertCircle className="w-3 h-3 text-yellow-500" />}
                        {saved && !edited && <CheckCircle className="w-3 h-3 text-blue-500" />}
                        {isOffWithWork && <Badge className="text-xs py-0 px-1 bg-emerald-100 text-emerald-700 border-emerald-200">HE 100%</Badge>}
                      </div>

                      {TYPES.map(t => (
                        <div key={t} className="relative">
                          <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-full ${TYPE_DOT[t]}`} />
                          <Input
                            type="time"
                            value={dayEdits[t] || ""}
                            onChange={e => updateTime(dateStr, t, e.target.value)}
                            className="pl-2 h-8 text-xs"
                          />
                        </div>
                      ))}

                      {/* Actions — desktop */}
                      <div className="hidden md:flex gap-1">
                        <Button
                          size="sm"
                          disabled={saving || !edited}
                          onClick={() => saveDay(dateStr)}
                          className="h-7 px-2 text-xs bg-gradient-to-r from-purple-600 to-blue-600 disabled:opacity-40"
                          title="Salvar este dia"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        {hasRec && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:bg-red-50" onClick={() => deleteDay(dateStr)} title="Excluir registros do dia">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {dsrMin && (
                    <div className="grid grid-cols-[90px_1fr_1fr_1fr_1fr_100px] gap-2 px-4 py-1.5 text-xs items-center bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
                      <div className="col-span-5 text-purple-700 dark:text-purple-300 font-medium">
                        DSR sobre HE — Lei 605/49
                      </div>
                      <div className="font-semibold text-purple-700 dark:text-purple-300">
                        +{formatMinutes(dsrMin)}
                      </div>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}