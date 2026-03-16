import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronRight, Copy } from "lucide-react";

const EMPLOYEE_VARS = [
  ["full_name", "Nome Completo"],
  ["employee_number", "Matrícula"],
  ["cpf", "CPF"],
  ["rg", "RG"],
  ["rg_issue_date", "Data Emissão RG"],
  ["rg_issuer", "Órgão Emissor RG"],
  ["ctps_number", "CTPS Número"],
  ["ctps_series", "CTPS Série"],
  ["ctps_state", "CTPS UF"],
  ["pis_number", "PIS"],
  ["birth_date", "Data de Nascimento"],
  ["birth_place", "Local de Nascimento"],
  ["nationality_country", "Nacionalidade"],
  ["gender", "Sexo"],
  ["marital_status", "Estado Civil"],
  ["education_level", "Grau de Instrução"],
  ["father_name", "Nome do Pai"],
  ["mother_name", "Nome da Mãe"],
  ["phone", "Telefone Celular"],
  ["address_street", "Rua"],
  ["address_number", "Número"],
  ["address_complement", "Complemento"],
  ["address_neighborhood", "Bairro"],
  ["address_city", "Cidade"],
  ["address_state", "Estado"],
  ["address_zipcode", "CEP"],
  ["bank_name", "Banco"],
  ["bank_branch", "Agência"],
  ["bank_account", "Conta Bancária"],
  ["hire_date", "Data de Admissão"],
  ["salary", "Salário"],
  ["salary_type", "Tipo de Salário"],
  ["work_schedule", "Horário de Trabalho"],
  ["job_function", "Função"],
  ["category", "Categoria"],
  ["cbo", "CBO"],
  ["fgts_account", "Conta FGTS"],
  ["observations", "Observações"],
];

const COMPANY_VARS = [
  ["logo", "Logo da Empresa"],
  ["name", "Nome da Empresa"],
  ["cnpj", "CNPJ"],
  ["address", "Endereço"],
  ["work_start_time", "Horário Entrada Padrão"],
  ["work_end_time", "Horário Saída Padrão"],
];

const CONTRACT_VARS = [
  ["start_date", "Data de Início"],
  ["end_date", "Data de Término"],
  ["value", "Valor do Contrato"],
  ["contract_number", "Número do Contrato"],
  ["description", "Descrição"],
];

const SYSTEM_VARS = [
  ["today", "Data de Hoje"],
  ["today_extenso", "Data por Extenso"],
  ["city", "Cidade (da empresa)"],
];

const SECTIONS = [
  { id: "employee", label: "Colaborador", color: "bg-blue-500", prefix: "employee", vars: EMPLOYEE_VARS },
  { id: "company", label: "Empresa", color: "bg-green-500", prefix: "company", vars: COMPANY_VARS },
  { id: "contract", label: "Contrato", color: "bg-purple-500", prefix: "contract", vars: CONTRACT_VARS },
  { id: "system", label: "Sistema", color: "bg-orange-500", prefix: "system", vars: SYSTEM_VARS },
];

export default function VariablePanel({ onInsert }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState({ employee: true });

  const toggleSection = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Variáveis</p>
        <div className="relative">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-7 h-7 text-xs" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {SECTIONS.map((section) => {
          const filtered = section.vars.filter(([key, label]) =>
            !search || label.toLowerCase().includes(search.toLowerCase()) || key.includes(search.toLowerCase())
          );
          if (search && filtered.length === 0) return null;
          const isOpen = open[section.id] || !!search;

          return (
            <div key={section.id} className="border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-left"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${section.color}`} />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1">{section.label}</span>
                <span className="text-xs text-gray-400">{section.vars.length}</span>
                {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
              </button>

              {isOpen && (
                <div>
                  {filtered.map(([key, label]) => {
                    const variable = `{{${section.prefix}.${key}}}`;
                    return (
                      <button
                        key={key}
                        onClick={() => onInsert(variable)}
                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 group border-b border-gray-50 dark:border-gray-800"
                      >
                        <div className="text-xs text-gray-600 dark:text-gray-400 leading-tight">{label}</div>
                        <div className="text-xs text-blue-600 font-mono truncate">{variable}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100">
        <p className="text-xs text-blue-700 dark:text-blue-300">💡 Clique para inserir no cursor</p>
      </div>
    </div>
  );
}