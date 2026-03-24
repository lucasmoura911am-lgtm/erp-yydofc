import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, getDaysInMonth, isWeekend, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, FileText, Printer } from "lucide-react";
import MonthlySummaryCard from "@/components/timereport/MonthlySummaryCard";
import {
  calcDayResult,
  calcMonthlySummary,
  calcWeeklyDSRMap,
  formatMinutes,
  formatSaldo,
} from "@/lib/timeCalculations";

const DOW_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const WORK_DAYS_MAP = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
};

const DAY_TYPE_STYLE = {
  falta: "bg-red-50 dark:bg-red-900/20 text-red-700",
  atraso: "bg-orange-50 dark:bg-orange-900/20 text-orange-700",
  extra: "bg-green-50 dark:bg-green-900/20 text-green-700",
  normal: "text-gray-700 dark:text-gray-300",
  folga: "bg-gray-50 dark:bg-gray-900/30 text-gray-400",
};

export default function MonthlyTimeReport() {
  const [user, setUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  React.useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const selectedEmp = employees.find(e => e.id === selectedEmployee);

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", user?.company_id],
    queryFn: () => base44.entities.Shift.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const monthKey = format(currentMonth, "yyyy-MM");

  const { data: timeRecords = [], isLoading } = useQuery({
    queryKey: ["timeRecordsForReport", user?.company_id, selectedEmployee, monthKey],
    queryFn: async () => {
      const start = `${monthKey}-01`;
      const lastDay = getDaysInMonth(currentMonth);
      const end = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
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

  // Dias de trabalho da escala do funcionário (array de DOW números 0-6)
  const shiftWorkDays = useMemo(() => {
    if (!selectedEmp?.shift_id) return null; // null = usar padrão seg-sex
    const shift = shifts.find(s => s.id === selectedEmp.shift_id);
    if (!shift?.work_days?.length) return null;
    return new Set(shift.work_days.map(d => WORK_DAYS_MAP[d]).filter(d => d !== undefined));
  }, [selectedEmp, shifts]);

  const shiftJornadaMin = useMemo(() => {
    if (!selectedEmp?.shift_id) return 480;
    const shift = shifts.find(s => s.id === selectedEmp.shift_id);
    if (!shift?.start_time || !shift?.end_time) return 480;
    const [sh, sm] = shift.start_time.split(":").map(Number);
    const [eh, em] = shift.end_time.split(":").map(Number);
    let total = (eh * 60 + em) - (sh * 60 + sm);
    if (total < 0) total += 1440;
    total -= (shift.break_minutes || 60);
    return Math.max(total, 0);
  }, [selectedEmp, shifts]);

  const { days, summary, weeklyDsrMap } = useMemo(() => {
    if (!selectedEmployee) return { days: [], summary: null, weeklyDsrMap: {} };

    const count = getDaysInMonth(currentMonth);

    const recordsMap = {};
    timeRecords.forEach(r => {
      const day = r.timestamp?.substring(0, 10);
      if (!recordsMap[day]) recordsMap[day] = [];
      recordsMap[day].push(r);
    });

    // Padrão: seg-sex se não tiver escala
    const defaultWorkDays = new Set([1, 2, 3, 4, 5]);
    const workDays = shiftWorkDays || defaultWorkDays;

    const dayResults = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dow = d.getDay();
      const recs = recordsMap[dateStr] || [];

      // Jornada = 0 se não é dia de trabalho da escala
      const jornada = workDays.has(dow) ? shiftJornadaMin : 0;
      const result = calcDayResult(dateStr, recs, jornada);
      dayResults.push({ ...result, dow, date: d });
    }

    const weeklyDsrMap = calcWeeklyDSRMap(dayResults);
    const summary = calcMonthlySummary(dayResults);
    return { days: dayResults, summary, weeklyDsrMap };
  }, [timeRecords, selectedEmployee, currentMonth, shiftWorkDays, shiftJornadaMin]);

  const getTimeFromRecords = (records, type) => {
    const r = records?.find(r => r.type === type);
    return r ? r.timestamp?.substring(11, 16) : "--:--";
  };

  const recordsMap = useMemo(() => {
    const m = {};
    timeRecords.forEach(r => {
      const day = r.timestamp?.substring(0, 10);
      if (!m[day]) m[day] = [];
      m[day].push(r);
    });
    return m;
  }, [timeRecords]);

  // Mapa de domingo -> dsrMin para exibir linha de DSR na tabela
  const dsrBySunday = useMemo(() => {
    const m = {};
    Object.values(weeklyDsrMap || {}).forEach(({ dsrMin, sundayDateStr }) => {
      if (sundayDateStr && dsrMin > 0) m[sundayDateStr] = dsrMin;
    });
    return m;
  }, [weeklyDsrMap]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Relatório Mensal de Ponto
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Resumo completo com saldo líquido e DSR (Lei 605/49)
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
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
              <div className="w-44 text-center font-semibold capitalize text-gray-800 dark:text-gray-200">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {selectedEmployee && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedEmployee && (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Selecione um funcionário para gerar o relatório</p>
          </CardContent>
        </Card>
      )}

      {selectedEmployee && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tabela de dias */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  {selectedEmp?.full_name} — {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {/* Header */}
                <div className="grid grid-cols-[60px_45px_65px_65px_65px_65px_80px] gap-1 px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 dark:bg-gray-900 border-b">
                  <div>Data</div>
                  <div>Dia</div>
                  <div>Entrada</div>
                  <div>Pausa</div>
                  <div>Retorno</div>
                  <div>Saída</div>
                  <div>Saldo</div>
                </div>

                {isLoading ? (
                  <div className="py-12 text-center text-gray-400 text-sm">Carregando registros...</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {days.map(day => {
                      const recs = recordsMap[day.dateStr] || [];
                      const saldo = day.extraMin > 0 ? day.extraMin : -day.atrasoMin;
                      const isOff = day.label === "folga";
                      const style = isOff
                        ? DAY_TYPE_STYLE.folga
                        : DAY_TYPE_STYLE[day.label] || DAY_TYPE_STYLE.normal;
                      const dsrMin = dsrBySunday[day.dateStr];

                      return (
                        <React.Fragment key={day.dateStr}>
                          <div className={`grid grid-cols-[60px_45px_65px_65px_65px_65px_80px] gap-1 px-3 py-1.5 text-xs items-center ${style}`}>
                            <div className="font-medium">{format(day.date, "dd/MM")}</div>
                            <div className="text-gray-500">{DOW_LABEL[day.dow]}</div>
                            <div>{isOff ? "" : getTimeFromRecords(recs, "entrada")}</div>
                            <div>{isOff ? "" : getTimeFromRecords(recs, "pausa")}</div>
                            <div>{isOff ? "" : getTimeFromRecords(recs, "retorno")}</div>
                            <div>{isOff ? "" : getTimeFromRecords(recs, "saida")}</div>
                            <div className="font-semibold">
                              {isOff ? (
                                <span className="text-gray-400 font-normal">FOLGA</span>
                              ) : day.label === "falta" ? (
                                <span className="text-red-600">FALTA</span>
                              ) : (
                                <span className={saldo >= 0 ? "text-green-600" : "text-orange-600"}>
                                  {formatSaldo(saldo)}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Linha de DSR após o domingo com extras */}
                          {dsrMin && (
                            <div className="grid grid-cols-[60px_45px_65px_65px_65px_65px_80px] gap-1 px-3 py-1 text-xs items-center bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
                              <div className="col-span-6 text-purple-700 dark:text-purple-300 font-medium">
                                DSR sobre HE — Lei 605/49
                              </div>
                              <div className="font-semibold text-purple-700 dark:text-purple-300">+{formatMinutes(dsrMin)}</div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resumo lateral */}
          <div>
            <MonthlySummaryCard summary={summary} />
          </div>
        </div>
      )}
    </div>
  );
}