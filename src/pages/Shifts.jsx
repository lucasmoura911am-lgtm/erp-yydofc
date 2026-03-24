import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Calendar, Clock, Percent } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const WEEK_DAYS = [
  { value: "monday",    label: "Segunda",  dow: 1 },
  { value: "tuesday",   label: "Terça",    dow: 2 },
  { value: "wednesday", label: "Quarta",   dow: 3 },
  { value: "thursday",  label: "Quinta",   dow: 4 },
  { value: "friday",    label: "Sexta",    dow: 5 },
  { value: "saturday",  label: "Sábado",   dow: 6 },
  { value: "sunday",    label: "Domingo",  dow: 0 },
];

const DEFAULT_OVERTIME = WEEK_DAYS.map(d => ({
  day: d.value,
  rate: d.value === "sunday" ? 100 : 50,
}));

export default function Shifts() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "17:00",
    break_minutes: 60,
    tolerance_minutes: 15,
    work_days: [],
    overtime_rules: DEFAULT_OVERTIME,
    overtime_offday_rate: null, // null = usar taxa do dia configurado
    use_custom_offday_rate: false,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", user?.company_id],
    queryFn: () => base44.entities.Shift.filter({ company_id: user.company_id }, "-created_date"),
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Shift.create(data),
    onSuccess: () => { queryClient.invalidateQueries(["shifts"]); setDialogOpen(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["shifts"]); setDialogOpen(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["shifts"]),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      start_time: "08:00",
      end_time: "17:00",
      break_minutes: 60,
      tolerance_minutes: 15,
      work_days: [],
      overtime_rules: DEFAULT_OVERTIME,
      overtime_offday_rate: null,
      use_custom_offday_rate: false,
    });
    setEditingShift(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      company_id: user.company_id,
      overtime_offday_rate: formData.use_custom_offday_rate ? (formData.overtime_offday_rate ?? 100) : null,
    };
    delete data.use_custom_offday_rate;
    if (editingShift) updateMutation.mutate({ id: editingShift.id, data });
    else createMutation.mutate(data);
  };

  const handleEdit = (shift) => {
    setEditingShift(shift);
    const existingRules = shift.overtime_rules || [];
    const mergedRules = DEFAULT_OVERTIME.map(def => {
      const found = existingRules.find(r => r.day === def.day);
      return found ? { ...found } : { ...def };
    });
    const hasCustomOffday = shift.overtime_offday_rate != null;
    setFormData({
      name: shift.name || "",
      start_time: shift.start_time || "08:00",
      end_time: shift.end_time || "17:00",
      break_minutes: shift.break_minutes ?? 60,
      tolerance_minutes: shift.tolerance_minutes ?? 15,
      work_days: shift.work_days || [],
      overtime_rules: mergedRules,
      overtime_offday_rate: shift.overtime_offday_rate ?? 100,
      use_custom_offday_rate: hasCustomOffday,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir esta escala?")) deleteMutation.mutate(id);
  };

  const toggleWorkDay = (day) => {
    setFormData(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day],
    }));
  };

  const updateOvertimeRate = (day, rate) => {
    setFormData(prev => ({
      ...prev,
      overtime_rules: prev.overtime_rules.map(r => r.day === day ? { ...r, rate: Number(rate) } : r),
    }));
  };

  const getEmployeeCount = (shiftId) => employees.filter(e => e.shift_id === shiftId).length;

  const getWorkDaysLabel = (days) => {
    if (!days || days.length === 0) return "Nenhum dia definido";
    return days.map(d => WEEK_DAYS.find(wd => wd.value === d)?.label).join(", ");
  };

  const getRateForDay = (shift, dayValue) => {
    const rule = shift.overtime_rules?.find(r => r.day === dayValue);
    return rule ? rule.rate : (dayValue === "sunday" ? 100 : 50);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Escalas de Trabalho</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as escalas de horário e taxas de hora extra</p>
        </div>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true); }}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Escala
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shifts.map((shift) => (
          <Card key={shift.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{shift.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{getEmployeeCount(shift.id)} funcionários</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(shift)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(shift.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{shift.start_time} - {shift.end_time}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Intervalo: {shift.break_minutes} min</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tolerância: {shift.tolerance_minutes} min</p>
              <p className="text-xs text-gray-500 mt-1">{getWorkDaysLabel(shift.work_days)}</p>
              {/* Overtime badges */}
              <div className="pt-1 flex flex-wrap gap-1">
                {WEEK_DAYS.map(wd => {
                  const rate = getRateForDay(shift, wd.value);
                  const isWorkDay = shift.work_days?.includes(wd.value);
                  return (
                    <Badge
                      key={wd.value}
                      variant="outline"
                      className={`text-xs px-1.5 py-0 ${isWorkDay ? "border-purple-300 text-purple-700 bg-purple-50" : "border-gray-200 text-gray-400"}`}
                    >
                      {wd.label.substring(0, 3)}: {rate}%
                    </Badge>
                  );
                })}
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${shift.overtime_offday_rate != null ? "border-orange-300 text-orange-700 bg-orange-50" : "border-gray-200 text-gray-400"}`}>
                  Folga: {shift.overtime_offday_rate != null ? `${shift.overtime_offday_rate}%` : "por dia"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Editar Escala" : "Nova Escala"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome da Escala *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de Entrada *</Label>
                <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Horário de Saída *</Label>
                <Input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} required />
              </div>
            </div>

            {/* Intervalo e tolerância */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intervalo (minutos)</Label>
                <Input type="number" value={formData.break_minutes} onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Tolerância (minutos)</Label>
                <Input type="number" value={formData.tolerance_minutes} onChange={(e) => setFormData({ ...formData, tolerance_minutes: parseInt(e.target.value) })} />
              </div>
            </div>

            {/* Dias de trabalho */}
            <div className="space-y-2">
              <Label>Dias de Trabalho</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEEK_DAYS.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={day.value}
                      checked={formData.work_days.includes(day.value)}
                      onCheckedChange={() => toggleWorkDay(day.value)}
                    />
                    <label htmlFor={day.value} className="text-sm font-medium">
                      {day.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Taxas de hora extra por dia */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-purple-600" />
                <Label className="text-base font-semibold">Taxas de Hora Extra</Label>
              </div>
              <p className="text-xs text-gray-500">Configure o percentual de adicional de hora extra para cada dia da semana.</p>

              <div className="rounded-lg border divide-y">
                {WEEK_DAYS.map((day) => {
                  const rule = formData.overtime_rules.find(r => r.day === day.value);
                  const rate = rule?.rate ?? (day.value === "sunday" ? 100 : 50);
                  const isWorkDay = formData.work_days.includes(day.value);
                  return (
                    <div key={day.value} className={`flex items-center justify-between px-3 py-2 ${isWorkDay ? "" : "opacity-50"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-20">{day.label}</span>
                        {isWorkDay ? (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">dia útil</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400 text-xs">folga</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={200}
                          step={5}
                          value={rate}
                          onChange={(e) => updateOvertimeRate(day.value, e.target.value)}
                          className="w-20 h-8 text-sm text-right"
                        />
                        <span className="text-sm text-gray-500 w-4">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Taxa para dias de folga (fora da escala) */}
              <div className="rounded-lg border px-3 py-3 bg-orange-50/50 dark:bg-orange-900/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Taxa específica para dias fora da escala</p>
                    <p className="text-xs text-gray-500">Se desativado, usa a taxa configurada para o dia da semana acima</p>
                  </div>
                  <Checkbox
                    checked={formData.use_custom_offday_rate}
                    onCheckedChange={(v) => setFormData({ ...formData, use_custom_offday_rate: !!v })}
                  />
                </div>
                {formData.use_custom_offday_rate && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm text-gray-600 flex-1">Taxa para folgas não programadas:</span>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      step={5}
                      value={formData.overtime_offday_rate ?? 100}
                      onChange={(e) => setFormData({ ...formData, overtime_offday_rate: parseInt(e.target.value) })}
                      className="w-20 h-8 text-sm text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                {editingShift ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}