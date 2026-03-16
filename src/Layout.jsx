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
  ChevronRight,
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
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen
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
  const [company, setCompany] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

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

  // Auto-expand the module containing the current route
  useEffect(() => {
    const modules = getNavigationModules();
    const expanded = {};
    modules.forEach(mod => {
      if (mod.items.some(item => item.url === location.pathname)) {
        expanded[mod.id] = true;
      }
    });
    setExpandedModules(prev => ({ ...prev, ...expanded }));
  }, [location.pathname]);

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

  const toggleModule = (id) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getNavigationModules = () => {
    const adminModules = [
      {
        id: "dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        items: [
          { title: "Visão Geral", url: "/Dashboard", icon: LayoutDashboard },
          { title: "Dashboard Supervisor", url: "/SupervisorDashboard", icon: BarChart3 },
        ]
      },
      {
        id: "attendance",
        title: "Controle de Ponto",
        icon: Clock,
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
        icon: Users,
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
        icon: Building2,
        items: [
          { title: "Setores", url: "/Departments", icon: Building2 },
          { title: "Cargos", url: "/Positions", icon: Briefcase },
          { title: "Escalas", url: "/Shifts", icon: Calendar },
        ]
      },
      {
        id: "tasks",
        title: "Plano de Trabalho",
        icon: ListTodo,
        items: [
          { title: "Dashboard de Tarefas", url: "/TasksDashboard", icon: ListTodo },
          { title: "Gestão de Tarefas", url: "/ManageTasks", icon: Edit3 },
        ]
      },
      {
        id: "hr",
        title: "Recursos Humanos",
        icon: FileText,
        items: [
          { title: "Gestão de Férias", url: "/ManageVacations", icon: Calendar },
          { title: "Gestão de Holerites", url: "/ManagePayslips", icon: FileText },
        ]
      },
      {
        id: "epi",
        title: "EPI",
        icon: HardHat,
        items: [
          { title: "Cadastro de EPIs", url: "/EPICatalog", icon: HardHat },
          { title: "Entrega de EPIs", url: "/EPIDeliveries", icon: PackageCheck },
          { title: "Fichas de EPI", url: "/EPIRecords", icon: ClipboardList },
        ]
      },
      {
        id: "safety",
        title: "Segurança do Trabalho",
        icon: ShieldCheck,
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
        icon: FileText,
        items: [
          { title: "Templates", url: "/DocumentTemplates", icon: FileText },
          { title: "Gerar Documento", url: "/GenerateDocument", icon: Edit3 },
          { title: "Documentos Gerados", url: "/GeneratedDocuments", icon: FileCheck },
        ]
      },
      {
        id: "benefits",
        title: "Benefícios",
        icon: DollarSign,
        items: [
          { title: "Configurar Benefícios", url: "/BenefitConfigs", icon: Settings },
          { title: "Gestão de Benefícios", url: "/EmployeeBenefits", icon: DollarSign },
        ]
      },
      {
        id: "clients",
        title: "Clientes e Contratos",
        icon: Building2,
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
        icon: BarChart3,
        items: [
          { title: "Relatórios Gerais", url: "/Reports", icon: FileText },
          { title: "Relatório de Humor", url: "/MoodReport", icon: FileText },
        ]
      },
      {
        id: "system",
        title: "Sistema",
        icon: Settings,
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
        icon: Building,
        items: [
          { title: "Empresas", url: "/Companies", icon: Building },
        ]
      }
    ];

    const employeeModules = [
      {
        id: "employee_dashboard",
        title: "Meu Painel",
        icon: LayoutDashboard,
        items: [
          { title: "Meu Dashboard", url: "/EmployeeDashboard", icon: LayoutDashboard },
          { title: "Bater Ponto", url: "/ClockIn", icon: Timer },
          { title: "Meus Registros", url: "/MyTimeRecords", icon: BarChart3 },
        ]
      },
      {
        id: "employee_tasks",
        title: "Minhas Atividades",
        icon: ListTodo,
        items: [
          { title: "Minhas Tarefas", url: "/MyTasks", icon: ListTodo },
          { title: "Justificar Falta", url: "/MyAbsenceJustifications", icon: FileCheck },
        ]
      },
      {
        id: "employee_docs",
        title: "Meus Documentos",
        icon: Folder,
        items: [
          { title: "Meus Documentos", url: "/MyDocuments", icon: Folder },
          { title: "Minhas Férias", url: "/MyVacations", icon: Calendar },
          { title: "Meus Holerites", url: "/MyPayslips", icon: FileText },
          { title: "Folha de Ponto Assinada", url: "/MySignedTimeReports", icon: FileText },
        ]
      }
    ];

    if (isSuperAdmin) return [...superAdminModules, ...adminModules];
    if (isAdmin) return adminModules;
    return employeeModules;
  };

  const navigationModules = getNavigationModules();

  const SidebarContent = ({ onLinkClick }) => (
    <div className="flex flex-col h-full">
      {/* Logo / Company */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-800 min-h-[64px]">
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-9 h-9 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
          />
        ) : (
          <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-white" />
          </div>
        )}
        {sidebarOpen && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
              {company?.name || "PontoFlex"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Funcionário"}
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {navigationModules.map((module) => {
          const isModuleActive = module.items.some(item => item.url === location.pathname);
          const isExpanded = expandedModules[module.id];
          const ModuleIcon = module.icon;

          return (
            <div key={module.id}>
              <button
                onClick={() => toggleModule(module.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-sm font-medium ${
                  isModuleActive
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <ModuleIcon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 truncate">{module.title}</span>
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                    }
                  </>
                )}
              </button>

              {sidebarOpen && isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-2">
                  {module.items.map((item) => {
                    const isActive = location.pathname === item.url;
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.title}
                        to={item.url}
                        onClick={onLinkClick}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                        }`}
                      >
                        <ItemIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + bottom actions */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-1">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          {sidebarOpen && <span>{darkMode ? "Modo Claro" : "Modo Escuro"}</span>}
        </button>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarImage src={user.photo_url} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs">
                    {user.full_name?.charAt(0) || user.email?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <span className="truncate font-medium text-left flex-1">
                    {user.full_name || user.email}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium truncate">{user.full_name || user.email}</p>
                <p className="text-xs text-gray-500">
                  {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Funcionário"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Sair do Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">

        {/* Desktop Sidebar */}
        <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"}`}>
          <SidebarContent onLinkClick={() => {}} />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex flex-col w-72 bg-white dark:bg-gray-900 shadow-xl">
              <SidebarContent onLinkClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm h-14 flex items-center px-4 gap-3">
            {/* Toggle sidebar */}
            <button
              onClick={() => { setSidebarOpen(p => !p); setMobileOpen(p => !p); }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5 lg:block hidden" /> : <PanelLeftOpen className="w-5 h-5 lg:block hidden" />}
              <Menu className="w-5 h-5 lg:hidden" />
            </button>

            {/* Current page breadcrumb / title */}
            <div className="flex-1 min-w-0">
              {company && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {company.name}
                </p>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}