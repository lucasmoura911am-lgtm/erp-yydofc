// Central definition of ALL navigation modules and their routes.
// Used by both the Layout sidebar and the Access Role editor.

export const ALL_MODULES = [
  // ── Dashboard ──────────────────────────────────────────────
  { id: "overview360", label: "Overview 360°", url: "/Overview360", group: "Dashboard" },
  { id: "dashboard", label: "Visão Geral", url: "/Dashboard", group: "Dashboard" },
  { id: "supervisor_dashboard", label: "Dashboard Supervisor", url: "/SupervisorDashboard", group: "Dashboard" },

  // ── Controle de Ponto ────────────────────────────────────────
  { id: "time_records", label: "Registros de Ponto", url: "/TimeRecords", group: "Controle de Ponto" },
  { id: "manage_time_records", label: "Gestão de Pontos", url: "/ManageTimeRecordsSimple", group: "Controle de Ponto" },
  { id: "hours_bank", label: "Banco de Horas", url: "/HoursBank", group: "Controle de Ponto" },
  { id: "signed_time_reports", label: "Folha de Ponto Assinada", url: "/ManageSignedTimeReports", group: "Controle de Ponto" },

  // ── Gestão de Pessoas ────────────────────────────────────────
  { id: "employees", label: "Funcionários", url: "/Employees", group: "Gestão de Pessoas" },
  { id: "employee_life_report", label: "Vida do Funcionário", url: "/EmployeeLifeReport", group: "Gestão de Pessoas" },
  { id: "employee_folder", label: "Pasta dos Colaboradores", url: "/EmployeeFolder", group: "Gestão de Pessoas" },
  { id: "teams", label: "Times", url: "/Teams", group: "Gestão de Pessoas" },
  { id: "supervisors", label: "Supervisores", url: "/Supervisors", group: "Gestão de Pessoas" },
  { id: "absence_justifications", label: "Justificativas de Falta", url: "/ManageAbsenceJustifications", group: "Gestão de Pessoas" },

  // ── Estrutura Organizacional ─────────────────────────────────
  { id: "departments", label: "Setores", url: "/Departments", group: "Estrutura Organizacional" },
  { id: "positions", label: "Cargos", url: "/Positions", group: "Estrutura Organizacional" },
  { id: "shifts", label: "Escalas", url: "/Shifts", group: "Estrutura Organizacional" },

  // ── Produtividade ────────────────────────────────────────────
  { id: "productivity_hub", label: "Dashboard Produtividade", url: "/ProductivityHub", group: "Produtividade" },
  { id: "work_activities", label: "Diário de Atividades", url: "/WorkActivities", group: "Produtividade" },
  { id: "productivity_kanban", label: "Kanban de Tarefas", url: "/ProductivityKanban", group: "Produtividade" },
  { id: "productivity_agenda", label: "Agenda de Compromissos", url: "/ProductivityAgenda", group: "Produtividade" },
  { id: "productivity_notices", label: "Avisos & Lembretes", url: "/ProductivityNotices", group: "Produtividade" },
  { id: "productivity_manager", label: "Visão do Gestor", url: "/ProductivityManager", group: "Produtividade" },

  // ── Operações Facilities ─────────────────────────────────────
  { id: "operations_dashboard", label: "Dashboard Operacional", url: "/OperationsDashboard", group: "Operações Facilities" },
  { id: "facilities_kanban", label: "Kanban de Lotações", url: "/FacilitiesKanban", group: "Operações Facilities" },
  { id: "post_coverage", label: "Coberturas de Posto", url: "/PostCoveragePage", group: "Operações Facilities" },
  { id: "purchase_orders", label: "Pedidos de Compra", url: "/PurchaseOrders", group: "Operações Facilities" },
  { id: "stock_control", label: "Controle de Estoque", url: "/StockControl", group: "Operações Facilities" },
  { id: "contract_stock", label: "Estoque por Contrato", url: "/ContractStockPage", group: "Operações Facilities" },
  { id: "client_tickets_manage", label: "Chamados dos Clientes", url: "/ClientTicketsManage", group: "Operações Facilities" },
  { id: "uniform_control", label: "Uniformes", url: "/UniformControl", group: "Operações Facilities" },
  { id: "epi_daily_logs", label: "Diário de EPI", url: "/EPIDailyLogs", group: "Operações Facilities" },
  { id: "maintenance", label: "Manutenção", url: "/MaintenancePage", group: "Operações Facilities" },
  { id: "occurrences", label: "Ocorrências", url: "/OccurrencesPage", group: "Operações Facilities" },

  // ── Plano de Trabalho ────────────────────────────────────────
  { id: "tasks_dashboard", label: "Dashboard de Tarefas", url: "/TasksDashboard", group: "Plano de Trabalho" },
  { id: "manage_tasks", label: "Gestão de Tarefas", url: "/ManageTasks", group: "Plano de Trabalho" },

  // ── RH ───────────────────────────────────────────────────────
  { id: "manage_vacations", label: "Gestão de Férias", url: "/ManageVacations", group: "Recursos Humanos" },
  { id: "manage_payslips", label: "Gestão de Holerites", url: "/ManagePayslips", group: "Recursos Humanos" },
  { id: "smart_payslips_dashboard", label: "Holerites Inteligentes", url: "/SmartPayslipsDashboard", group: "Recursos Humanos" },
  { id: "birthdays", label: "Aniversários & Datas", url: "/BirthdaysAndDates", group: "Recursos Humanos" },

  // ── EPI ──────────────────────────────────────────────────────
  { id: "epi_catalog", label: "Cadastro de EPIs", url: "/EPICatalog", group: "EPI" },
  { id: "epi_deliveries", label: "Entrega de EPIs", url: "/EPIDeliveries", group: "EPI" },
  { id: "epi_records", label: "Fichas de EPI", url: "/EPIRecords", group: "EPI" },

  // ── Segurança ────────────────────────────────────────────────
  { id: "safety_dashboard", label: "Dashboard Segurança", url: "/SafetyDashboard", group: "Segurança do Trabalho" },
  { id: "safety_programs", label: "Contratos e Programas", url: "/SafetyPrograms", group: "Segurança do Trabalho" },
  { id: "risk_inventory", label: "Inventário de Riscos", url: "/RiskInventoryPage", group: "Segurança do Trabalho" },
  { id: "risk_action_plan", label: "Plano de Ação (PGR)", url: "/RiskActionPlanPage", group: "Segurança do Trabalho" },
  { id: "health_activities", label: "Atividades de Saúde (PCMSO)", url: "/HealthActivitiesPage", group: "Segurança do Trabalho" },
  { id: "safety_reports", label: "Relatórios Segurança", url: "/SafetyReports", group: "Segurança do Trabalho" },

  // ── Documentos ───────────────────────────────────────────────
  { id: "document_templates", label: "Templates", url: "/DocumentTemplates", group: "Documentos" },
  { id: "generate_document", label: "Gerar Documento", url: "/GenerateDocument", group: "Documentos" },
  { id: "generated_documents", label: "Documentos Gerados", url: "/GeneratedDocuments", group: "Documentos" },

  // ── Benefícios ───────────────────────────────────────────────
  { id: "benefit_configs", label: "Configurar Benefícios", url: "/BenefitConfigs", group: "Benefícios" },
  { id: "employee_benefits", label: "Gestão de Benefícios", url: "/EmployeeBenefits", group: "Benefícios" },

  // ── CRM ──────────────────────────────────────────────────────
  { id: "crm_dashboard", label: "Dashboard Comercial", url: "/CRMDashboard", group: "CRM Comercial" },
  { id: "crm_kanban", label: "Pipeline (Kanban)", url: "/CRMKanban", group: "CRM Comercial" },
  { id: "crm_opportunities", label: "Oportunidades", url: "/CRMOpportunities", group: "CRM Comercial" },
  { id: "crm_leads", label: "Leads", url: "/CRMLeads", group: "CRM Comercial" },
  { id: "crm_accounts", label: "Empresas (Contas)", url: "/CRMAccounts", group: "CRM Comercial" },
  { id: "crm_contacts", label: "Contatos", url: "/CRMContacts", group: "CRM Comercial" },
  { id: "crm_proposals", label: "Propostas", url: "/CRMProposals", group: "CRM Comercial" },
  { id: "crm_activities", label: "Atividades CRM", url: "/CRMActivities", group: "CRM Comercial" },
  { id: "crm_goals", label: "Metas Comerciais", url: "/CRMGoals", group: "CRM Comercial" },

  // ── Financeiro ───────────────────────────────────────────────
  { id: "financial_dashboard", label: "Dashboard Financeiro", url: "/FinancialDashboard", group: "Financeiro" },
  { id: "accounts_payable", label: "Contas a Pagar", url: "/AccountsPayablePage", group: "Financeiro" },
  { id: "accounts_receivable", label: "Contas a Receber", url: "/AccountsReceivablePage", group: "Financeiro" },
  { id: "cash_flow", label: "Fluxo de Caixa", url: "/CashFlowPage", group: "Financeiro" },
  { id: "suppliers", label: "Fornecedores", url: "/SuppliersPage", group: "Financeiro" },
  { id: "financial_dre", label: "DRE", url: "/FinancialDRE", group: "Financeiro" },
  { id: "budget_vs_actual", label: "Orçamento x Realizado", url: "/BudgetVsActual", group: "Financeiro" },
  { id: "financial_settings", label: "Config. Financeiras", url: "/FinancialSettings", group: "Financeiro" },
  { id: "bank_reconciliation", label: "Conciliação Bancária", url: "/BankReconciliationPage", group: "Financeiro" },
  { id: "financial_reports", label: "Relatórios Financeiros", url: "/FinancialReports", group: "Financeiro" },

  // ── Recrutamento ─────────────────────────────────────────────
  { id: "recruitment_overview", label: "Visão Geral R&S", url: "/RecruitmentOverview", group: "Recrutamento & Seleção" },
  { id: "job_positions", label: "Vagas em Aberto", url: "/JobPositions", group: "Recrutamento & Seleção" },
  { id: "candidate_pool", label: "Banco de Currículos", url: "/CandidatePool", group: "Recrutamento & Seleção" },
  { id: "recruitment_kanban", label: "Kanban de Seleção", url: "/RecruitmentKanban", group: "Recrutamento & Seleção" },
  { id: "interviews", label: "Entrevistas", url: "/Interviews", group: "Recrutamento & Seleção" },

  // ── Clientes e Contratos ─────────────────────────────────────
  { id: "clients", label: "Clientes", url: "/Clients", group: "Clientes e Contratos" },
  { id: "client_documents", label: "Documentos do Cliente", url: "/ClientDocuments", group: "Clientes e Contratos" },
  { id: "contracts", label: "Contratos", url: "/Contracts", group: "Clientes e Contratos" },
  { id: "allocations", label: "Lotações", url: "/Allocations", group: "Clientes e Contratos" },
  { id: "allocation_reports", label: "Relatório de Alocações", url: "/AllocationReports", group: "Clientes e Contratos" },

  // ── Relatórios ───────────────────────────────────────────────
  { id: "reports", label: "Relatórios Gerais", url: "/Reports", group: "Relatórios" },
  { id: "mood_report", label: "Relatório de Humor", url: "/MoodReport", group: "Relatórios" },

  // ── Sistema ──────────────────────────────────────────────────
  { id: "announcements", label: "Avisos", url: "/Announcements", group: "Sistema" },
  { id: "settings", label: "Configurações", url: "/Settings", group: "Sistema" },
  { id: "users_management", label: "Usuários e Acessos", url: "/UsersManagement", group: "Sistema" },

  // ── Módulos de Funcionário ───────────────────────────────────
  { id: "employee_dashboard", label: "Meu Dashboard", url: "/EmployeeDashboard", group: "Painel do Funcionário" },
  { id: "clock_in", label: "Bater Ponto", url: "/ClockIn", group: "Painel do Funcionário" },
  { id: "my_time_records", label: "Meus Registros", url: "/MyTimeRecords", group: "Painel do Funcionário" },
  { id: "my_tasks", label: "Minhas Tarefas", url: "/MyTasks", group: "Painel do Funcionário" },
  { id: "my_absence_justifications", label: "Justificar Falta", url: "/MyAbsenceJustifications", group: "Painel do Funcionário" },
  { id: "my_documents", label: "Meus Documentos", url: "/MyDocuments", group: "Painel do Funcionário" },
  { id: "my_vacations", label: "Minhas Férias", url: "/MyVacations", group: "Painel do Funcionário" },
  { id: "my_payslips", label: "Meus Holerites", url: "/MyPayslips", group: "Painel do Funcionário" },
  { id: "my_smart_payslips", label: "Meus Holerites (IA)", url: "/MySmartPayslips", group: "Painel do Funcionário" },
  { id: "my_signed_time_reports", label: "Folha de Ponto Assinada", url: "/MySignedTimeReports", group: "Painel do Funcionário" },
];

export const getModulesByGroup = () => {
  const groups = {};
  ALL_MODULES.forEach(mod => {
    if (!groups[mod.group]) groups[mod.group] = [];
    groups[mod.group].push(mod);
  });
  return groups;
};

export const getModuleByUrl = (url) => ALL_MODULES.find(m => m.url === url);
export const getModuleById = (id) => ALL_MODULES.find(m => m.id === id);