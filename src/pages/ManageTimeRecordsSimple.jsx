import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar, Save, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ManageTimeRecordsSimple() {
  const [user, setUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeSlots, setTimeSlots] = useState({
    entrada: "",
    pausa: "",
    retorno: "",
    saida: ""
  });
  const [existingRecords, setExistingRecords] = useState([]);

  const queryClient = useQueryClient();

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

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id,
  });

  useEffect(() => {
    if (selectedEmployee && selectedDate) {
      const dayRecords = timeRecords.filter(r => {
        const recordDate = format(new Date(r.timestamp), 'yyyy-MM-dd');
        return r.employee_id === selectedEmployee && recordDate === selectedDate;
      });

      setExistingRecords(dayRecords);

      const slots = { entrada: "", pausa: "", retorno: "", saida: "" };
      dayRecords.forEach(record => {
        const time = format(new Date(record.timestamp), 'HH:mm');
        if (record.type === 'entrada') slots.entrada = time;
        if (record.type === 'pausa') slots.pausa = time;
        if (record.type === 'retorno') slots.retorno = time;
        if (record.type === 'saida') slots.saida = time;
      });
      setTimeSlots(slots);
    }
  }, [selectedEmployee, selectedDate, timeRecords]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TimeRecord.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeRecords']);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TimeRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeRecords']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TimeRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeRecords']);
    },
  });

  const handleSaveAll = async () => {
    if (!selectedEmployee || !selectedDate) {
      alert('Selecione um funcionário e uma data');
      return;
    }

    const types = ['entrada', 'pausa', 'retorno', 'saida'];
    
    for (const type of types) {
      const time = timeSlots[type];
      if (!time) continue;

      const timestamp = `${selectedDate}T${time}:00`;
      const existing = existingRecords.find(r => r.type === type);

      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          data: { timestamp, is_manual: true, edited_by: user.email, edited_at: new Date().toISOString() }
        });
      } else {
        await createMutation.mutateAsync({
          employee_id: selectedEmployee,
          company_id: user.company_id,
          timestamp,
          type,
          is_manual: true,
          edited_by: user.email,
          edited_at: new Date().toISOString()
        });
      }
    }

    alert('Registros salvos com sucesso!');
  };

  const handleDeleteDay = async () => {
    if (confirm('Deseja excluir todos os registros deste dia?')) {
      for (const record of existingRecords) {
        await deleteMutation.mutateAsync(record.id);
      }
      setTimeSlots({ entrada: "", pausa: "", retorno: "", saida: "" });
    }
  };

  const selectedEmp = employees.find(e => e.id === selectedEmployee);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão Simplificada de Pontos</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Edite ou adicione todos os horários de um dia de uma vez
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Selecione Funcionário e Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} - {emp.employee_number || emp.cpf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedEmployee && selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Horários do Dia - {selectedEmp?.full_name}
              </div>
              {existingRecords.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteDay}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Dia
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                📌 <strong>{format(new Date(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Preencha os horários e clique em "Salvar Todos" para atualizar de uma vez
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Entrada
                </Label>
                <Input
                  type="time"
                  value={timeSlots.entrada}
                  onChange={(e) => setTimeSlots({ ...timeSlots, entrada: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Pausa
                </Label>
                <Input
                  type="time"
                  value={timeSlots.pausa}
                  onChange={(e) => setTimeSlots({ ...timeSlots, pausa: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Retorno
                </Label>
                <Input
                  type="time"
                  value={timeSlots.retorno}
                  onChange={(e) => setTimeSlots({ ...timeSlots, retorno: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Saída
                </Label>
                <Input
                  type="time"
                  value={timeSlots.saida}
                  onChange={(e) => setTimeSlots({ ...timeSlots, saida: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setTimeSlots({ entrada: "", pausa: "", retorno: "", saida: "" });
                }}
              >
                Limpar
              </Button>
              <Button
                onClick={handleSaveAll}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Todos os Horários
              </Button>
            </div>

            {existingRecords.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Registros existentes:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {existingRecords.map((record) => (
                    <div key={record.id} className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm">
                      <span className="font-semibold">{record.type}:</span> {format(new Date(record.timestamp), 'HH:mm')}
                      {record.is_manual && <span className="text-xs text-blue-600 ml-1">(manual)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedEmployee && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Selecione um funcionário
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Escolha um funcionário e uma data para gerenciar os horários
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}