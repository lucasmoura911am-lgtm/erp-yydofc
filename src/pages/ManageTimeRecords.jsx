import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Upload, FileText, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManageTimeRecords() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "",
    timestamp: "",
    type: "entrada",
    status: "pontual",
    delay_minutes: 0,
    justification: "",
    justification_file_url: "",
    is_manual: false
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: timeRecords = [] } = useQuery({
    queryKey: ['timeRecords', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.TimeRecord.filter({ company_id: user.company_id }, '-timestamp') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TimeRecord.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeRecords']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TimeRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeRecords']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      timestamp: "",
      type: "entrada",
      status: "pontual",
      delay_minutes: 0,
      justification: "",
      justification_file_url: "",
      is_manual: false
    });
    setEditingRecord(null);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      employee_id: record.employee_id,
      timestamp: format(new Date(record.timestamp), "yyyy-MM-dd'T'HH:mm"),
      type: record.type,
      status: record.status,
      delay_minutes: record.delay_minutes || 0,
      justification: record.justification || "",
      justification_file_url: record.justification_file_url || "",
      is_manual: record.is_manual || false
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, justification_file_url: file_url });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert("Erro ao fazer upload do arquivo");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      ...formData,
      timestamp: new Date(formData.timestamp).toISOString(),
      company_id: user.company_id,
      edited_by: user.email,
      edited_at: new Date().toISOString(),
      delay_minutes: parseInt(formData.delay_minutes) || 0
    };

    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      data.is_manual = true;
      createMutation.mutate(data);
    }
  };

  const getEmployeeName = (id) => {
    const employee = employees.find(e => e.id === id);
    return employee ? employee.full_name : "Desconhecido";
  };

  const filteredRecords = timeRecords.filter(record => {
    const employee = employees.find(e => e.id === record.employee_id);
    const matchesSearch = employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee?.employee_number?.includes(searchTerm);
    
    // Extrair apenas a data (ignorando hora/timezone)
    const recordDate = new Date(record.timestamp);
    const recordDateStr = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
    const matchesDate = !dateFilter || recordDateStr === dateFilter;

    return matchesSearch && matchesDate;
  });

  const statusColors = {
    pontual: "bg-green-100 text-green-800",
    atrasado: "bg-orange-100 text-orange-800",
    adiantado: "bg-blue-100 text-blue-800",
    hora_extra: "bg-purple-100 text-purple-800",
    falta: "bg-red-100 text-red-800"
  };

  const typeColors = {
    entrada: "bg-blue-100 text-blue-800",
    saida: "bg-gray-100 text-gray-800",
    pausa: "bg-yellow-100 text-yellow-800",
    retorno: "bg-green-100 text-green-800"
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Pontos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Edite registros, adicione justificativas e corrija inconsistências
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Registro Manual
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros de Ponto ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{getEmployeeName(record.employee_id)}</p>
                        {record.is_manual && (
                          <Badge variant="outline" className="text-xs mt-1">Manual</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[record.type]}>
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[record.status]}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.delay_minutes > 0 ? (
                        <span className="text-orange-600 font-medium">{record.delay_minutes} min</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.justification ? (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          {record.justification_file_url && (
                            <a 
                              href={record.justification_file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Anexo
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(record)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Editar Registro" : "Registro Manual de Ponto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Funcionário *</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  disabled={!!editingRecord}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} - {emp.employee_number || "Sem matrícula"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data e Hora *</Label>
                <Input
                  type="datetime-local"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="pausa">Pausa</SelectItem>
                    <SelectItem value="retorno">Retorno</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pontual">Pontual</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="adiantado">Adiantado</SelectItem>
                    <SelectItem value="hora_extra">Hora Extra</SelectItem>
                    <SelectItem value="falta">Falta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Minutos de Atraso</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.delay_minutes}
                  onChange={(e) => setFormData({ ...formData, delay_minutes: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Justificativa</Label>
                <Textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  placeholder="Ex: Atestado médico, problema de transporte, etc."
                  rows={3}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Anexar Atestado/Comprovante</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploadingFile}
                  />
                  {uploadingFile && (
                    <span className="text-sm text-gray-500">Enviando...</span>
                  )}
                </div>
                {formData.justification_file_url && (
                  <Alert className="mt-2 bg-green-50">
                    <AlertDescription className="text-green-800">
                      ✓ Arquivo anexado: <a href={formData.justification_file_url} target="_blank" rel="noopener noreferrer" className="underline">Ver arquivo</a>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {editingRecord && (
              <Alert className="bg-blue-50">
                <AlertDescription className="text-blue-800">
                  <strong>Editado por:</strong> {editingRecord.edited_by || "Sistema"}<br />
                  {editingRecord.edited_at && (
                    <>
                      <strong>Em:</strong> {format(new Date(editingRecord.edited_at), "dd/MM/yyyy HH:mm")}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {editingRecord ? "Salvar Alterações" : "Criar Registro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}