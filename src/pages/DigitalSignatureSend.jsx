import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Upload, FileText, User, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const STEPS = ["Documento", "Colaborador", "Confirmação"];

export default function DigitalSignatureSend() {
  const [step, setStep] = useState(0);
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    document_type: "",
    file: null,
    file_name: "",
    deadline: "",
    message: ""
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
    base44.entities.Employee.filter({ status: "active" }).then(setEmployees);
  }, []);

  const filtered = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("Arquivo máximo 20MB"); return; }
    setForm(f => ({ ...f, file, file_name: file.name }));
  };

  const handleSend = async () => {
    setLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: form.file });

    const protocol = "ASS-" + Math.random().toString(36).substr(2, 7).toUpperCase();

    const emp = selectedEmployee;
    await base44.entities.DigitalSignature.create({
      protocol_number: protocol,
      company_id: emp.company_id,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_position: emp.position || "",
      document_type: form.document_type,
      file_url,
      file_name: form.file_name,
      deadline: form.deadline,
      message: form.message,
      status: "Pendente",
      sent_by: user?.email
    });

    // E-mail ao colaborador
    if (emp.email) {
      await base44.integrations.Core.SendEmail({
        to: emp.email,
        subject: `[${protocol}] Documento enviado para sua assinatura`,
        body: `Olá ${emp.full_name},\n\nUm documento foi enviado para sua assinatura digital.\n\nDocumento: ${form.document_type}\nPrazo: ${form.deadline}\n\n${form.message ? "Mensagem: " + form.message + "\n\n" : ""}Acesse o sistema para assinar.\n\nProtocolo: ${protocol}`
      });
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <CheckCircle className="w-20 h-20 text-green-500" />
      <h2 className="text-2xl font-bold text-green-700">Documento enviado com sucesso!</h2>
      <p className="text-gray-500">O colaborador foi notificado por e-mail e pode assinar no sistema.</p>
      <div className="flex gap-3">
        <Button onClick={() => { setSuccess(false); setStep(0); setForm({ document_type:"",file:null,file_name:"",deadline:"",message:"" }); setSelectedEmployee(null); }}>
          Enviar Outro
        </Button>
        <Link to="/DigitalSignatureAdmin"><Button variant="outline">Ver Todos</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/DigitalSignatureAdmin"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">Enviar Documento para Assinatura</h1>
          <p className="text-gray-500 text-sm">Preencha as etapas abaixo</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${i === step ? "bg-purple-600 text-white" : i < step ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{i+1}</span>}
              {s}
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0 */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Dados do Documento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {["Contrato de trabalho","NDA","Termo de responsabilidade","Política interna","Aditivo contratual","Outro"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Upload do Arquivo * (PDF, DOCX, imagem – máx 20MB)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors" onClick={() => document.getElementById('doc-upload').click()}>
                {form.file_name ? (
                  <div className="flex items-center justify-center gap-2 text-green-700"><CheckCircle className="w-5 h-5" />{form.file_name}</div>
                ) : (
                  <div className="text-gray-500"><Upload className="w-8 h-8 mx-auto mb-2" /><p>Clique para selecionar o arquivo</p></div>
                )}
                <input id="doc-upload" type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prazo para Assinar *</Label>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem ao Colaborador</Label>
              <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Ex: Por favor, leia atentamente antes de assinar..." rows={3} />
            </div>
            <Button className="w-full bg-purple-600 hover:bg-purple-700" disabled={!form.document_type || !form.file || !form.deadline} onClick={() => setStep(1)}>
              Próximo: Selecionar Colaborador
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Selecionar Colaborador</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar por nome ou setor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filtered.map(emp => (
                <div key={emp.id} onClick={() => setSelectedEmployee(emp)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedEmployee?.id === emp.id ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    {emp.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{emp.full_name}</p>
                    <p className="text-xs text-gray-500">{emp.department} {emp.position ? "· " + emp.position : ""}</p>
                  </div>
                  {selectedEmployee?.id === emp.id && <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />}
                </div>
              ))}
              {filtered.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum colaborador encontrado</p>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Voltar</Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={!selectedEmployee} onClick={() => setStep(2)}>
                Próximo: Confirmar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && selectedEmployee && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Confirmação do Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{form.document_type}</span></div>
                <div><span className="text-gray-500">Arquivo:</span> <span className="font-medium truncate">{form.file_name}</span></div>
                <div><span className="text-gray-500">Prazo:</span> <span className="font-medium">{form.deadline}</span></div>
                <div><span className="text-gray-500">Colaborador:</span> <span className="font-medium">{selectedEmployee.full_name}</span></div>
              </div>
              {form.message && <div className="text-sm"><span className="text-gray-500">Mensagem:</span> <span>{form.message}</span></div>}
            </div>
            <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">📧 Um e-mail será enviado automaticamente para o colaborador com instruções para assinar.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSend} disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : "Confirmar e Enviar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}