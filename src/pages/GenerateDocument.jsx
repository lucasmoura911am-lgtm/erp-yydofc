import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Eye, Download, Printer, Save, User, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DocumentPreview, { resolveVariables } from "../components/documents/DocumentPreview";
import { toast } from "@/components/ui/use-toast";

const CATEGORIES = {
  contrato: "bg-blue-100 text-blue-800",
  termo: "bg-purple-100 text-purple-800",
  declaracao: "bg-green-100 text-green-800",
  notificacao: "bg-orange-100 text-orange-800",
  outro: "bg-gray-100 text-gray-800",
};

export default function GenerateDocument() {
  const [user, setUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedContract, setSelectedContract] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const qc = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", user?.company_id],
    queryFn: () => base44.entities.Employee.filter({ company_id: user.company_id, status: "active" }),
    enabled: !!user?.company_id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["doc-templates", user?.company_id],
    queryFn: () => base44.entities.DocumentTemplate.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ["company", user?.company_id],
    queryFn: async () => {
      const list = await base44.entities.Company.filter({ id: user.company_id });
      return list[0] || null;
    },
    enabled: !!user?.company_id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", user?.company_id],
    queryFn: () => base44.entities.Contract.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id,
  });

  const saveMut = useMutation({
    mutationFn: (data) => base44.entities.GeneratedDocument.create(data),
    onSuccess: () => { qc.invalidateQueries(["generated-docs"]); toast({ title: "Documento salvo!" }); },
  });

  const employee = employees.find((e) => e.id === selectedEmployee);
  const template = templates.find((t) => t.id === selectedTemplate);
  const contract = contracts.find((c) => c.id === selectedContract);

  const resolvedHtml = template && employee
    ? resolveVariables(template.html_content, employee, company, contract)
    : null;

  const handlePrint = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${template?.name}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; padding: 40px; color: #000; }
      @media print { .no-print { display:none; } }
    </style></head><body>
    ${resolvedHtml}
    <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
      <button onclick="window.print()" style="background:#6366f1;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;">
        🖨️ Imprimir / Salvar PDF
      </button>
    </div>
    </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${template?.name}</title></head><body style="font-family:Arial;padding:40px">${resolvedHtml}</body></html>`], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${template?.name}_${employee?.full_name}_${format(new Date(), "yyyy-MM-dd")}.html`;
    a.click();
  };

  const handleSave = async () => {
    if (!employee || !template) return;
    await saveMut.mutateAsync({
      employee_id: employee.id,
      template_id: template.id,
      template_name: template.name,
      employee_name: employee.full_name,
      company_id: user.company_id,
      generated_html: resolvedHtml,
      generated_date: format(new Date(), "yyyy-MM-dd"),
      generated_by: user.email,
    });
  };

  const canGenerate = !!employee && !!template;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gerar Documento</h1>
        <p className="text-gray-500 mt-1">Selecione um funcionário e um template para gerar o documento automaticamente</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" /> Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Funcionário *</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}
                        {e.employee_number && <span className="text-gray-400 ml-1">({e.employee_number})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Template *</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contrato (opcional)</Label>
                <Select value={selectedContract} onValueChange={setSelectedContract}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Nenhum</SelectItem>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contract_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Employee info card */}
          {employee && (
            <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200">
              <CardContent className="pt-4 space-y-1 text-sm">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{employee.full_name}</p>
                {employee.cpf && <p className="text-gray-600">CPF: {employee.cpf}</p>}
                {employee.employee_number && <p className="text-gray-600">Mat.: {employee.employee_number}</p>}
                {employee.hire_date && (
                  <p className="text-gray-600">
                    Admissão: {format(new Date(employee.hire_date), "dd/MM/yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Template info */}
          {template && (
            <Card className="bg-purple-50 dark:bg-purple-900/10 border-purple-200">
              <CardContent className="pt-4 text-sm">
                <Badge className={`mb-2 text-xs ${CATEGORIES[template.category] || "bg-gray-100 text-gray-800"}`}>
                  {template.category}
                </Badge>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{template.name}</p>
                {template.description && <p className="text-gray-600 mt-1">{template.description}</p>}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {canGenerate && (
            <div className="space-y-2">
              <Button onClick={() => setShowPreview(true)} className="w-full" variant="outline">
                <Eye className="w-4 h-4 mr-2" /> Visualizar Documento
              </Button>
              <Button onClick={handlePrint} className="w-full bg-gradient-to-r from-purple-600 to-blue-600">
                <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
              </Button>
              <Button onClick={handleDownloadHtml} className="w-full" variant="outline">
                <Download className="w-4 h-4 mr-2" /> Baixar HTML
              </Button>
              <Button onClick={handleSave} className="w-full" variant="outline">
                <Save className="w-4 h-4 mr-2" /> Salvar no Histórico
              </Button>
            </div>
          )}
        </div>

        {/* Preview area */}
        <div className="lg:col-span-2">
          {canGenerate ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  Pré-visualização — {template.name} / {employee.full_name}
                </span>
              </div>
              <DocumentPreview
                html={template.html_content}
                employee={employee}
                company={company}
                contract={contract}
              />
            </div>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center">
                <FileText className="w-20 h-20 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Selecione um funcionário e um template</p>
                <p className="text-gray-300 text-sm mt-1">O documento gerado aparecerá aqui</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Full-screen preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{template?.name} — {employee?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <DocumentPreview html={template?.html_content} employee={employee} company={company} contract={contract} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
            <Button onClick={handleDownloadHtml} variant="outline"><Download className="w-4 h-4 mr-2" />HTML</Button>
            <Button onClick={handlePrint} className="bg-gradient-to-r from-purple-600 to-blue-600"><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}