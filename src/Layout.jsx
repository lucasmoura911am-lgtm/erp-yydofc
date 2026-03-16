import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
  LayoutDashboard,
  Clock,
  Users,
  Building2,
  Briefcase,
  Calendar,
  Settings,
  Timer,
  BarChart3,
  FileText,
  Building,
  Edit3,
  Shield,
  ListTodo,
  MapPin,
  FileCheck,
  UserCog,
  DollarSign,
  HardHat,
  PackageCheck,
  ClipboardList,
  Folder,
  Activity,
  TrendingUp,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      if (userData.company_id) {
        const companies = await base44.entities.Company.filter({ id: userData.company_id });
        if (companies.length > 0) setCompany(companies[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const handleLogout = () => {
    base44.auth.logout(window.location.origin + '/Dashboard');
  };

  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.email === 'admin@pontoflex.com';

  const getNavigationModules = () => {
    const adminModules = [
      {
        id: "dashboard",
        title: "Dashboard",
        items: [
          { title: "Visão Geral", url: "/Dashboard", icon: LayoutDashboard },
          { title: "Dashboard Supervisor", url: "/SupervisorDashboard", icon: BarChart3 },
        ]
      },
      {
        id: "attendance",
        title: "Controle de Ponto",
        items: [
          { title: "Registros de Ponto", url: "/TimeRecords", icon: Clock },
          { title: "Gestão de Pontos", url: "/ManageTimeRecordsSimple", icon: Edit3 },
          { title: "Banco de Horas", url: "/HoursBank", icon: Clock },
          { title: "Folha de Ponto Assinada", url: "/ManageSignedTimeReports", icon: FileText },
        ]
      },
      {
        id: "employees",
        title: "Gestão de Pessoas",
        items: [
          { title: "Funcionários", url: "/Employees", icon: Users },
          { title: "Pasta dos Colaboradores", url: "/EmployeeFolder", icon: Folder },
          { title: "Times", url: "/Teams", icon: Users },
          { title: "Supervisores", url: "/Supervisors", icon: Shield },
          { title: "Justificativas de Falta", url: "/ManageAbsenceJustifications", icon: FileCheck },
        ]
      },
      {
        id: "organization",
        title: "Estrutura Organizacional",
        items: [
          { title: "Setores", url: "/Departments", icon: Building2 },
          { title: "Cargos", url: "/Positions", icon: Briefcase },
          { title: "Escalas", url: "/Shifts", icon: Calendar },
        ]
      },
      {
        id: "tasks",
        title: "Plano de Trabalho",
        items: [
          { title: "Dashboard de Tarefas", url: "/TasksDashboard", icon: ListTodo },
          { title: "Gestão de Tarefas", url: "/ManageTasks", icon: Edit3 },
        ]
      },
      {
        id: "hr",
        title: "Recursos Humanos",
        items: [
          { title: "Gestão de Férias", url: "/ManageVacations", icon: Calendar },
          { title: "Gestão de Holerites", url: "/ManagePayslips", icon: FileText },
        ]
      },
      {
        id: "epi",
        title: "EPI",
        items: [
          { title: "Cadastro de EPIs", url: "/EPICatalog", icon: HardHat },
          { title: "Entrega de EPIs", url: "/EPIDeliveries", icon: PackageCheck },
          { title: "Fichas de EPI", url: "/EPIRecords", icon: ClipboardList },
        ]
      },
      {
        id: "safety",
        title: "Segurança do Trabalho",
        items: [
          { title: "Dashboard", url: "/SafetyDashboard", icon: ShieldCheck },
          { title: "Contratos e Programas", url: "/SafetyPrograms", icon: FileText },
          { title: "Inventário de Riscos", url: "/RiskInventoryPage", icon: AlertTriangle },
          { title: "Plano de Ação (PGR)", url: "/RiskActionPlanPage", icon: TrendingUp },
          { title: "Atividades de Saúde (PCMSO)", url: "/HealthActivitiesPage", icon: Activity },
          { title: "Relatórios", url: "/SafetyReports", icon: BarChart3 },
        ]
      },
      {
        id: "documents",
        title: "Documentos",
        items: [
          { title: "Templates", url: "/DocumentTemplates", icon: FileText },
          { title: "Gerar Documento", url: "/GenerateDocument", icon: Edit3 },
          { title: "Documentos Gerados", url: "/GeneratedDocuments", icon: FileCheck },
        ]
      },
      {
        id: "benefits",
        title: "Benefícios",
        items: [
          { title: "Configurar Benefícios", url: "/BenefitConfigs", icon: Settings },
          { title: "Gestão de Benefícios", url: "/EmployeeBenefits", icon: DollarSign },
        ]
      },
      {
        id: "clients",
        title: "Clientes e Contratos",
        items: [
          { title: "Clientes", url: "/Clients", icon: Building2 },
          { title: "Contratos", url: "/Contracts", icon: FileText },
          { title: "Lotações", url: "/Allocations", icon: MapPin },
          { title: "Relatório de Alocações", url: "/AllocationReports", icon: FileText },
        ]
      },
      {
        id: "reports",
        title: "Relatórios",
        items: [
          { title: "Relatórios Gerais", url: "/Reports", icon: FileText },
          { title: "Relatório de Humor", url: "/MoodReport", icon: FileText },
        ]
      },
      {
        id: "system",
        title: "Sistema",
        items: [
          { title: "Avisos", url: "/Announcements", icon: LayoutDashboard },
          { title: "Configurações", url: "/Settings", icon: Settings },
          { title: "Usuários e Acessos", url: "/UsersManagement", icon: UserCog },
        ]
      }
    ];

    const superAdminModules = [
      {
        id: "super_admin",
        title: "Administração Global",
        items: [
          { title: "Empresas", url: "/Companies", icon: Building },
        ]
      }
    ];

    const employeeModules = [
      {
        id: "employee_dashboard",
        title: "Meu Painel",
        items: [
          { title: "Meu Dashboard", url: "/EmployeeDashboard", icon: LayoutDashboard },
          { title: "Bater Ponto", url: "/ClockIn", icon: Timer },
          { title: "Meus Registros", url: "/MyTimeRecords", icon: BarChart3 },
        ]
      },
      {
        id: "employee_tasks",
        title: "Minhas Atividades",
        items: [
          { title: "Minhas Tarefas", url: "/MyTasks", icon: ListTodo },
          { title: "Justificar Falta", url: "/MyAbsenceJustifications", icon: FileCheck },
        ]
      },
      {
        id: "employee_docs",
        title: "Meus Documentos",
        items: [
          { title: "Meus Documentos", url: "/MyDocuments", icon: Folder },
          { title: "Minhas Férias", url: "/MyVacations", icon: Calendar },
          { title: "Meus Holerites", url: "/MyPayslips", icon: FileText },
          { title: "Folha de Ponto Assinada", url: "/MySignedTimeReports", icon: FileText },
        ]
      }
    ];

    if (isSuperAdmin) {
      return [...superAdminModules, ...adminModules];
    } else if (isAdmin) {
      return adminModules;
    } else {
      return employeeModules;
    }
  };

  const navigationModules = getNavigationModules();

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">PontoFlex</h1>
                {company && <p className="text-xs text-gray-500 dark:text-gray-400">{company.name}</p>}
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 max-w-4xl mx-8">
              {navigationModules.map((module) => (
                <DropdownMenu key={module.id}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                      {module.title}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs text-gray-500 uppercase">{module.title}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {module.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <DropdownMenuItem key={item.title} asChild>
                          <Link
                            to={item.url}
                            className={`flex items-center gap-2 cursor-pointer ${isActive ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : ''}`}
                          >
                            <item.icon className="w-4 h-4" />
                            {item.title}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="hidden sm:flex">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 px-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.photo_url} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm">
                          {user.full_name?.charAt(0) || user.email?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden md:block font-medium text-sm text-gray-900 dark:text-gray-100">
                        {user.full_name || user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div>
                        <p className="font-medium">{user.full_name || user.email}</p>
                        <p className="text-xs text-gray-500">
                          {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : 'Funcionário'}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair do Sistema
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Mobile Menu Button */}
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="p-4 space-y-4">
                {navigationModules.map((module) => (
                  <div key={module.id}>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2">
                      {module.title}
                    </div>
                    <div className="space-y-1">
                      {module.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <Link
                            key={item.title}
                            to={item.url}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}