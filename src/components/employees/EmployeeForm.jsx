import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, FileText, Home, Briefcase, DollarSign, Calendar, Camera, Loader2 } from "lucide-react";

export default function EmployeeForm({ formData, setFormData, positions, departments, shifts, teams, supervisors }) {
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, photo_url: file_url });
    } catch (error) {
      alert('Erro ao enviar foto: ' + error.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <Tabs defaultValue="personal" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="personal" className="text-xs"><User className="w-3 h-3 mr-1" />Pessoal</TabsTrigger>
        <TabsTrigger value="documents" className="text-xs"><FileText className="w-3 h-3 mr-1" />Documentos</TabsTrigger>
        <TabsTrigger value="address" className="text-xs"><Home className="w-3 h-3 mr-1" />Endereço</TabsTrigger>
        <TabsTrigger value="work" className="text-xs"><Briefcase className="w-3 h-3 mr-1" />Trabalho</TabsTrigger>
        <TabsTrigger value="financial" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Financeiro</TabsTrigger>
        <TabsTrigger value="additional" className="text-xs"><Calendar className="w-3 h-3 mr-1" />Adicional</TabsTrigger>
      </TabsList>

      {/* Dados Pessoais */}
      <TabsContent value="personal" className="space-y-4 max-h-96 overflow-y-auto p-4">
        {/* Photo Upload Section */}
        <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Avatar className="w-24 h-24 ring-2 ring-gray-200 dark:ring-gray-700">
              <AvatarImage src={formData.photo_url} />
              <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-2xl">
                {formData.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="photo-upload"
              className="absolute bottom-0 right-0 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-blue-600" />
              )}
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Foto do Funcionário</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Clique no ícone da câmera para fazer upload da foto
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Formatos aceitos: JPG, PNG (máx. 5MB)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={formData.employee_number} onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Ex: Operacional" />
          </div>
          <div className="space-y-2">
            <Label>Sexo</Label>
            <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cor/Raça</Label>
            <Select value={formData.race} onValueChange={(value) => setFormData({ ...formData, race: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="branca">Branca</SelectItem>
                <SelectItem value="preta">Preta</SelectItem>
                <SelectItem value="parda">Parda</SelectItem>
                <SelectItem value="amarela">Amarela</SelectItem>
                <SelectItem value="indigena">Indígena</SelectItem>
                <SelectItem value="nao_declarada">Não Declarada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado Civil</Label>
            <Select value={formData.marital_status} onValueChange={(value) => setFormData({ ...formData, marital_status: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                <SelectItem value="casado">Casado(a)</SelectItem>
                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                <SelectItem value="uniao_estavel">União Estável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <Input type="date" value={formData.birth_date} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Local de Nascimento</Label>
            <Input value={formData.birth_place} onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })} placeholder="Cidade/UF" />
          </div>
          <div className="space-y-2">
            <Label>Nacionalidade</Label>
            <Input value={formData.nationality_country} onChange={(e) => setFormData({ ...formData, nationality_country: e.target.value })} placeholder="Brasil" />
          </div>
          <div className="space-y-2">
            <Label>Grau de Instrução</Label>
            <Select value={formData.education_level} onValueChange={(value) => setFormData({ ...formData, education_level: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fundamental_incompleto">Fundamental Incompleto</SelectItem>
                <SelectItem value="fundamental_completo">Fundamental Completo</SelectItem>
                <SelectItem value="medio_incompleto">Médio Incompleto</SelectItem>
                <SelectItem value="medio_completo">Médio Completo</SelectItem>
                <SelectItem value="superior_incompleto">Superior Incompleto</SelectItem>
                <SelectItem value="superior_completo">Superior Completo</SelectItem>
                <SelectItem value="pos_graduacao">Pós-Graduação</SelectItem>
                <SelectItem value="mestrado">Mestrado</SelectItem>
                <SelectItem value="doutorado">Doutorado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Telefone Celular</Label>
            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Telefone Residencial</Label>
            <Input value={formData.home_phone} onChange={(e) => setFormData({ ...formData, home_phone: e.target.value })} placeholder="(11) 3333-3333" />
          </div>
          <div className="space-y-2">
            <Label>Nome do Pai</Label>
            <Input value={formData.father_name} onChange={(e) => setFormData({ ...formData, father_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Nome da Mãe</Label>
            <Input value={formData.mother_name} onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Possui Deficiência?</Label>
            <Select value={formData.has_disability ? "sim" : "nao"} onValueChange={(value) => setFormData({ ...formData, has_disability: value === "sim" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.has_disability && (
            <div className="space-y-2">
              <Label>Tipo de Deficiência</Label>
              <Input value={formData.disability_type} onChange={(e) => setFormData({ ...formData, disability_type: e.target.value })} />
            </div>
          )}
        </div>
      </TabsContent>

      {/* Documentos */}
      <TabsContent value="documents" className="space-y-4 max-h-96 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} required placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label>RG</Label>
            <Input value={formData.rg} onChange={(e) => setFormData({ ...formData, rg: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data Emissão RG</Label>
            <Input type="date" value={formData.rg_issue_date} onChange={(e) => setFormData({ ...formData, rg_issue_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Órgão Emissor RG</Label>
            <Input value={formData.rg_issuer} onChange={(e) => setFormData({ ...formData, rg_issuer: e.target.value })} placeholder="SSP" />
          </div>
          <div className="space-y-2">
            <Label>UF Emissor RG</Label>
            <Select value={formData.rg_issuer_state} onValueChange={(value) => setFormData({ ...formData, rg_issuer_state: value })}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{brazilianStates.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CTPS (Número)</Label>
            <Input value={formData.ctps_number} onChange={(e) => setFormData({ ...formData, ctps_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Série CTPS</Label>
            <Input value={formData.ctps_series} onChange={(e) => setFormData({ ...formData, ctps_series: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>UF CTPS</Label>
            <Select value={formData.ctps_state} onValueChange={(value) => setFormData({ ...formData, ctps_state: value })}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{brazilianStates.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data Expedição CTPS</Label>
            <Input type="date" value={formData.ctps_issue_date} onChange={(e) => setFormData({ ...formData, ctps_issue_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>PIS/PASEP</Label>
            <Input value={formData.pis_number} onChange={(e) => setFormData({ ...formData, pis_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data Cadastro PIS</Label>
            <Input type="date" value={formData.pis_registration_date} onChange={(e) => setFormData({ ...formData, pis_registration_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Título de Eleitor</Label>
            <Input value={formData.voter_registration} onChange={(e) => setFormData({ ...formData, voter_registration: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Zona Eleitoral</Label>
            <Input value={formData.voter_zone} onChange={(e) => setFormData({ ...formData, voter_zone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Seção Eleitoral</Label>
            <Input value={formData.voter_section} onChange={(e) => setFormData({ ...formData, voter_section: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Documento Militar</Label>
            <Input value={formData.military_document} onChange={(e) => setFormData({ ...formData, military_document: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CNH</Label>
            <Input value={formData.cnh} onChange={(e) => setFormData({ ...formData, cnh: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Registro Profissional</Label>
            <Input value={formData.professional_registration} onChange={(e) => setFormData({ ...formData, professional_registration: e.target.value })} placeholder="CRM, OAB, etc" />
          </div>
        </div>
      </TabsContent>

      {/* Endereço */}
      <TabsContent value="address" className="space-y-4 max-h-96 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Rua</Label>
            <Input value={formData.address_street} onChange={(e) => setFormData({ ...formData, address_street: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={formData.address_number} onChange={(e) => setFormData({ ...formData, address_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input value={formData.address_complement} onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })} placeholder="Apto, Bloco, etc" />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={formData.address_neighborhood} onChange={(e) => setFormData({ ...formData, address_neighborhood: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={formData.address_city} onChange={(e) => setFormData({ ...formData, address_city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={formData.address_state} onValueChange={(value) => setFormData({ ...formData, address_state: value })}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{brazilianStates.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={formData.address_zipcode} onChange={(e) => setFormData({ ...formData, address_zipcode: e.target.value })} placeholder="00000-000" />
          </div>
        </div>
      </TabsContent>

      {/* Trabalho */}
      <TabsContent value="work" className="space-y-4 max-h-96 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Data de Admissão</Label>
            <Input type="date" value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={formData.position_id} onValueChange={(value) => setFormData({ ...formData, position_id: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{positions.map((pos) => <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Input value={formData.job_function} onChange={(e) => setFormData({ ...formData, job_function: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CBO</Label>
            <Input value={formData.cbo} onChange={(e) => setFormData({ ...formData, cbo: e.target.value })} placeholder="Código CBO" />
          </div>
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={formData.department_id} onValueChange={(value) => setFormData({ ...formData, department_id: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{departments.map((dept) => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Escala de Trabalho</Label>
            <Select value={formData.shift_id} onValueChange={(value) => setFormData({ ...formData, shift_id: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{shifts.map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Time/Equipe</Label>
            <Select value={formData.team_id} onValueChange={(value) => setFormData({ ...formData, team_id: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supervisor</Label>
            <Select value={formData.supervisor_email} onValueChange={(value) => setFormData({ ...formData, supervisor_email: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{supervisors.map((sup) => <SelectItem key={sup.email} value={sup.email}>{sup.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Horário de Trabalho</Label>
            <Input value={formData.work_schedule} onChange={(e) => setFormData({ ...formData, work_schedule: e.target.value })} placeholder="08:00 - 17:00" />
          </div>
          <div className="space-y-2">
            <Label>Horário de Intervalo</Label>
            <Input value={formData.break_schedule} onChange={(e) => setFormData({ ...formData, break_schedule: e.target.value })} placeholder="12:00 - 13:00" />
          </div>
          <div className="space-y-2">
            <Label>Email de Login</Label>
            <Input type="email" value={formData.user_email} onChange={(e) => setFormData({ ...formData, user_email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="on_leave">Afastado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      {/* Financeiro */}
      <TabsContent value="financial" className="space-y-4 max-h-96 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Salário</Label>
            <Input type="number" step="0.01" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) })} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Salário</Label>
            <Select value={formData.salary_type} onValueChange={(value) => setFormData({ ...formData, salary_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="horista">Horista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Banco</Label>
            <Input value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} placeholder="Nome do Banco" />
          </div>
          <div className="space-y-2">
            <Label>Agência</Label>
            <Input value={formData.bank_branch} onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })} placeholder="0000" />
          </div>
          <div className="space-y-2">
            <Label>Conta Bancária</Label>
            <Input value={formData.bank_account} onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })} placeholder="00000-0" />
          </div>
          <div className="space-y-2">
            <Label>Data Opção FGTS</Label>
            <Input type="date" value={formData.fgts_option_date} onChange={(e) => setFormData({ ...formData, fgts_option_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Conta FGTS</Label>
            <Input value={formData.fgts_account} onChange={(e) => setFormData({ ...formData, fgts_account: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data Retif. FGTS</Label>
            <Input type="date" value={formData.fgts_rectification_date} onChange={(e) => setFormData({ ...formData, fgts_rectification_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Contrib. Sindical</Label>
            <Input value={formData.union_contribution} onChange={(e) => setFormData({ ...formData, union_contribution: e.target.value })} />
          </div>
        </div>
      </TabsContent>

      {/* Adicional */}
      <TabsContent value="additional" className="space-y-4 max-h-96 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Desligamento</Label>
            <Input value={formData.termination_type} onChange={(e) => setFormData({ ...formData, termination_type: e.target.value })} placeholder="Demissão, Pedido, etc" />
          </div>
          <div className="space-y-2">
            <Label>Data da Saída</Label>
            <Input type="date" value={formData.termination_date} onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data Aviso Indenizado</Label>
            <Input type="date" value={formData.notice_date} onChange={(e) => setFormData({ ...formData, notice_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data de Projeção</Label>
            <Input type="date" value={formData.projection_date} onChange={(e) => setFormData({ ...formData, projection_date: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-3">
            <Label>Observações</Label>
            <Textarea value={formData.observations} onChange={(e) => setFormData({ ...formData, observations: e.target.value })} rows={4} placeholder="Observações gerais sobre o funcionário..." />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}