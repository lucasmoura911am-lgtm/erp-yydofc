import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, DollarSign, Download, Info } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, subMonths, setDate } from "date-fns";

export default function EmployeeBenefits() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MM/yyyy"));
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.Employee.filter({ company_id: user.company_id, status: "active" });
    },
    enabled: !!user?.company_id
  });

  const { data: benefits = [] } = useQuery({
    queryKey: ["employeeBenefits", user?.company_id, selectedMonth],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.EmployeeBenefit.filter({
        company_id: user.company_id,
        competence: selectedMonth
      });
    },
    enabled: !!user?.company_id
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["benefitConfigs", user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      return await base44.entities.BenefitConfig.filter({ company_id: user.company_id, active: true });
    },
    enabled: !!user?.company_id
  });

  // Calcula o período de apuração com base na data de corte
  const getPeriod = (competence, cutoffDay) => {
    const [month, year] = competence.split("/");
    const refDate = new Date(parseInt(year), parseInt(month) - 1, 1);

    if (!cutoffDay || cutoffDay === 0) {
      return {
        startDate: startOfMonth(refDate),
        endDate: endOfMonth(refDate)
      };
    }

    // Ex: corte dia 20: período = dia 21 do mês anterior até dia 20 do mês atual
    const endDate = setDate(refDate, cutoffDay);
    const prevMonth = subMonths(refDate, 1);
    const startDate = setDate(prevMonth, cutoffDay + 1);

    return { startDate, endDate };
  };

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const [month, year] = selectedMonth.split("/");
      const refDate = new Date(parseInt(year), parseInt(month) - 1, 1);

      for (const employee of employees) {
        const employeeState = employee.address_state;
        if (!employeeState) continue;

        const config = configs.find(c => c.state === employeeState);
        if (!config) continue;

        const cutoffDay = config.cutoff_day || 0;
        const { startDate, endDate } = getPeriod(selectedMonth, cutoffDay);

        // Buscar registros de ponto do período
        const timeRecords = await base44.entities.TimeRecord.filter({
          employee_id: employee.id,
          company_id: user.company_id
        });

        const periodRecords = timeRecords.filter(r => {
          const recordDate = new Date(r.timestamp);
          return recordDate >= startDate && recordDate <= endDate;
        });

        // Contar dias únicos com entrada
        const workedDates = new Set();
        periodRecords.forEach(r => {
          if (r.type === "entrada") {
            workedDates.add(format(new Date(r.timestamp), "yyyy-MM-dd"));
          }
        });

        const workedDays = workedDates.size;

        // Contar dias úteis no período
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        const workDays = allDays.filter(day => !isWeekend(day));
        const absences = Math.max(0, workDays.length - workedDays);

        // Calcular valores proporcionais
        const vrTotal = workedDays * (config.vr_daily_value || 0);
        const vaTotal = workedDays * (config.va_daily_value || 0);
        const vtTotal = workedDays * (config.vt_daily_value || 0);

        // Cesta: respeita a regra de faltas configurada por estado
        const maxAbsences = config.basket_max_absences ?? 0;
        const hasBasket = absences <= maxAbsences;
        const basketValue = hasBasket ? (config.basket_monthly_value || 0) : 0;

        const totalBenefits = vrTotal + vaTotal + vtTotal + basketValue;

        const existing = benefits.find(b => b.employee_id === employee.id);

        const benefitData = {
          employee_id: employee.id,
          company_id: user.company_id,
          competence: selectedMonth,
          state: employeeState,
          worked_days: workedDays,
          vr_unit_value: config.vr_daily_value || 0,
          vr_total_value: vrTotal,
          va_unit_value: config.va_daily_value || 0,
          va_total_value: vaTotal,
          vt_unit_value: config.vt_daily_value || 0,
          vt_total_value: vtTotal,
          basket_value: basketValue,
          has_basket: hasBasket,
          total_benefits: totalBenefits,
          absences,
          status: "calculado"
        };

        if (existing) {
          await base44.entities.EmployeeBenefit.update(existing.id, benefitData);
        } else {
          await base44.entities.EmployeeBenefit.create(benefitData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["employeeBenefits"]);
      toast.success("Benefícios calculados com sucesso!");
    }
  });

  const exportCSV = () => {
    if (benefits.length === 0) return;
    const csvData = benefits.map(b => {
      const emp = employees.find(e => e.id === b.employee_id);
      return {
        Nome: emp?.full_name || "",
        Estado: b.state,
        "Dias Trabalhados": b.worked_days,
        Faltas: b.absences,
        "VR Total": b.vr_total_value?.toFixed(2),
        "VA Total": b.va_total_value?.toFixed(2),
        "VT Total": b.vt_total_value?.toFixed(2),
        "Cesta": b.basket_value?.toFixed(2),
        "Total": b.total_benefits?.toFixed(2)
      };
    });

    const headers = Object.keys(csvData[0]);
    const csv = [
      headers.join(","),
      ...csvData.map(row => headers.map(h => row[h]).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beneficios-${selectedMonth.replace("/", "-")}.csv`;
    a.click();
  };

  // Info sobre período de apuração do primeiro config disponível (por estado)
  const getConfigForDisplay = (state) => configs.find(c => c.state === state);

  if (!user) return <div className="p-8">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Benefícios</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Calcule e gerencie VR, VA, VT e Cesta de Assiduidade com regras por estado
            </p>
          </div>
        </div>

        {/* Aviso sobre regras configuradas */}
        {configs.length > 0 && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 text-sm">
              <strong>Regras ativas:</strong>{" "}
              {configs.map(c => (
                <span key={c.id} className="mr-3">
                  <strong>{c.state}</strong>: cesta com até {c.basket_max_absences || 0} falta(s)
                  {c.cutoff_day ? `, corte dia ${c.cutoff_day}` : ""}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-3">
              <span className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Benefícios por Funcionário
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = subMonths(new Date(), i);
                      const value = format(date, "MM/yyyy");
                      return (
                        <SelectItem key={value} value={value}>
                          {format(date, "MM/yyyy")}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => calculateMutation.mutate()}
                  disabled={calculateMutation.isPending}
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  {calculateMutation.isPending ? "Calculando..." : "Calcular Benefícios"}
                </Button>
                {benefits.length > 0 && (
                  <Button variant="outline" onClick={exportCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benefits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Clique em "Calcular Benefícios" para gerar os valores do mês selecionado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Dias Trab.</TableHead>
                      <TableHead>Faltas</TableHead>
                      <TableHead>VR</TableHead>
                      <TableHead>VA</TableHead>
                      <TableHead>VT</TableHead>
                      <TableHead>Cesta</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {benefits.map((benefit) => {
                      const emp = employees.find(e => e.id === benefit.employee_id);
                      const cfg = getConfigForDisplay(benefit.state);
                      const maxAbs = cfg?.basket_max_absences ?? 0;
                      return (
                        <TableRow key={benefit.id}>
                          <TableCell className="font-medium">{emp?.full_name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{benefit.state}</Badge>
                          </TableCell>
                          <TableCell>{benefit.worked_days}</TableCell>
                          <TableCell>
                            <Badge variant={benefit.absences > maxAbs ? "destructive" : benefit.absences > 0 ? "secondary" : "default"}>
                              {benefit.absences}
                            </Badge>
                          </TableCell>
                          <TableCell>R$ {(benefit.vr_total_value || 0).toFixed(2)}</TableCell>
                          <TableCell>R$ {(benefit.va_total_value || 0).toFixed(2)}</TableCell>
                          <TableCell>R$ {(benefit.vt_total_value || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            {benefit.has_basket ? (
                              <span className="text-green-600 font-semibold">
                                R$ {(benefit.basket_value || 0).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-red-500 text-sm">Cortada ({benefit.absences} falta{benefit.absences !== 1 ? "s" : ""})</span>
                            )}
                          </TableCell>
                          <TableCell className="font-bold">
                            R$ {(benefit.total_benefits || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}