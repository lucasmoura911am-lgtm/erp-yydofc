import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Copy, ChevronDown, ChevronRight } from "lucide-react";

// Mapeamento de labels amigáveis para campos do Employee
const EMPLOYEE_FIELD_LABELS = {
  full_name: "Nome Completo",
  employee_number: "Matrícula",
  cpf: "CPF",
  rg: "RG",
  rg_issue_date: "Data Emissão RG",
  rg_issuer: "Órgão Emissor RG",
  rg_issuer_state: "UF RG",
  ctps_number: "CTPS Número",
  ctps_series: "CTPS Série",
  ctps_state: "CTPS UF",
  ctps_issue_date: "Data CTPS",
  pis_number: "PIS",
  pis_registration_date: "Data Cadastro PIS",
  voter_registration: "Título de Eleitor",
  voter_zone: "Zona Eleitoral",
  voter_section: "Seção Eleitoral",
  military_document: "Documento Militar",
  cnh: "CNH",
  professional_registration: "Registro Profissional",
  birth_date: "Data de Nascimento",
  birth_place: "Local de Nascimento",
  nationality_country: "Nacionalidade",
  gender: "Sexo",
  marital_status: "Estado Civil",
  race: "Cor/Raça",
  education_level: "Grau de Instrução",
  has_disability: "Possui Deficiência",
  disability_type: "Tipo de Deficiência",
  father_name: "Nome do Pai",
  mother_name: "Nome da Mãe",
  phone: "Telefone Celular",
  home_phone: "Telefone Residencial",
  address_street: "Rua",
  address_number: "Número",
  address_complement: "Complemento",
  address_neighborhood: "Bairro",
  address_city: "Cidade",
  address_state: "Estado",
  address_zipcode: "CEP",
  bank_name: "Banco",
  bank_branch: "Agência",
  bank_account: "Conta Bancária",
  hire_date: "Data de Admissão",
  salary: "Salário",
  salary_type: "Tipo de Salário",
  work_schedule: "Horário de Trabalho",
  break_schedule: "Horário de Intervalo",
  job_function: "Função",
  cbo: "CBO",
  category: "Categoria",
  fgts_account: "Conta FGTS",
  union_contribution: "Contribuição Sindical",
  observations: "Observações",
  termination_date: "Data de Demissão",
  termination_type: "Tipo de Desligamento",
  notice_date: "Data do Aviso",
};

const COMPANY_VARIABLES = [
  { key: "{{company.name}}", label: "Nome da Empresa" },
  { key: "{{company.cnpj}}", label: "CNPJ" },
  { key: "{{company.address}}", label: "Endereço" },
  { key: "{{company.work_start_time}}", label: "Horário de Entrada Padrão" },
  { key: "{{company.work_end_time}}", label: "Horário de Saída Padrão" },
];

const CONTRACT_VARIABLES = [
  { key: "{{contract.start_date}}", label: "Data de Início" },
  { key: "{{contract.end_date}}", label: "Data de Término" },
  { key: "{{contract.value}}", label: "Valor do Contrato" },
  { key: "{{contract.contract_number}}", label: "Número do Contrato" },
  { key: "{{contract.description}}", label: "Descrição" },
];

const SYSTEM_VARIABLES = [
  { key: "{{system.today}}", label: "Data de Hoje" },
  { key: "{{system.today_extenso}}", label: "Data por Extenso" },
  { key: "{{system.city}}", label: "Cidade (da empresa)" },
];

export default function VariablePanel({ onInsert }) {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState({ employee: true, company: false, contract: false, system: false });

  const employeeVars = Object.entries(EMPLOYEE_FIELD_LABELS).map(([key, label]) => ({
    key: `{{employee.${key}}}`,
    label,
  }));

  const toggle = (section) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const filterVars = (vars) =>
    vars.filter(
      (v) =>
        !search ||
        v.label.toLowerCase().includes(search.toLowerCase()) ||
        v.key.toLowerCase().includes(search.toLowerCase())
    );

  const Section = ({ id, title, color, vars }) => {
    const filtered = filterVars(vars);
    if (search && filtered.length === 0) return null;
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggle(id)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{title}</span>
            <Badge variant="outline" className="text-xs">{vars.length}</Badge>
          </div>
          {openSections[id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {(openSections[id] || !!search) && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((v) => (
              <button
                key={v.key}
                onClick={() => onInsert(v.key)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group text-left"
              >
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{v.label}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">{v.key}</p>
                </div>
                <Copy className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Variáveis Disponíveis</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Buscar variável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <Section id="employee" title="Colaborador" color="bg-blue-500" vars={employeeVars} />
        <Section id="company" title="Empresa" color="bg-green-500" vars={COMPANY_VARIABLES} />
        <Section id="contract" title="Contrato" color="bg-purple-500" vars={CONTRACT_VARIABLES} />
        <Section id="system" title="Sistema" color="bg-orange-500" vars={SYSTEM_VARIABLES} />
      </div>
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          💡 Clique em qualquer variável para inserir no editor
        </p>
      </div>
    </div>
  );
}