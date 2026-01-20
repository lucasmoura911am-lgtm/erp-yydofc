import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Plus, Trash2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManagePayslips() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "",
    competence: "",
    file: null
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: payslips = [] } = useQuery({
    queryKey: ['allPayslips', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Payslip.filter({ company_id: user.company_id }, '-created_date') : [],
    enabled: !!user?.company_id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', user?.company_id],
    queryFn: () => user?.company_id ? base44.entities.Employee.filter({ company_id: user.company_id }) : [],
    enabled: !!user?.company_id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Payslip.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allPayslips']);
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payslip.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['allPayslips']);
    },
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      competence: "",
      file: null
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.file) {
      alert("Selecione um arquivo");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: formData.file });
      
      await createMutation.mutateAsync({
        employee_id: formData.employee_id,
        company_id: user.company_id,
        competence: formData.competence,
        file_url: file_url,
        uploaded_by: user.email
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert("Erro ao fazer upload do holerite");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir este holerite?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const getEmployeeName = (id) => {
    const employee = employees.find(e => e.id === id);
    return employee ? employee.full_name : "Desconhecido";
  };

  const filteredPayslips = payslips.filter(payslip => {
    const employeeName = getEmployeeName(payslip.employee_id).toLowerCase();
    const competence = payslip.competence.toLowerCase();
    const search = searchTerm.toLowerCase();
    return employeeName.includes(search) || competence.includes(search);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestão de Holerites</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Faça upload dos contracheques dos funcionários
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Holerite
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por funcionário ou competência..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holerites Cadastrados ({filteredPayslips.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPayslips.map((payslip) => (
              <div key={payslip.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {getEmployeeName(payslip.employee_id)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{payslip.competence}</Badge>
                      <span className="text-xs text-gray-500">
                        Upload por {payslip.uploaded_by}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(payslip.file_url, '_blank')}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(payslip.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fazer Upload de Holerite</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                required
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
              <Label>Competência (MM/YYYY) *</Label>
              <Input
                type="text"
                placeholder="Ex: 01/2026"
                pattern="(0[1-9]|1[0-2])\/[0-9]{4}"
                value={formData.competence}
                onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivo do Holerite *</Label>
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".pdf"
                required
              />
              <p className="text-xs text-gray-500">Apenas arquivos PDF</p>
            </div>

            {formData.file && (
              <Alert className="bg-green-50">
                <AlertDescription className="text-green-800">
                  ✓ Arquivo selecionado: {formData.file.name}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-blue-600"
                disabled={uploading}
              >
                {uploading ? (
                  <>Fazendo Upload...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Fazer Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}