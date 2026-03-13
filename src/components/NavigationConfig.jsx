import {
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
  UserCog
} from "lucide-react";

export const navigationModules = {
  admin: [
    {
      id: "dashboard",
      title: "Dashboard",
      items: [
        {
          title: "Visão Geral",
          url: "/Dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Dashboard Supervisor",
          url: "/SupervisorDashboard",
          icon: BarChart3,
        },
      ]
    },
    {
      id: "attendance",
      title: "Controle de Ponto",
      items: [
        {
          title: "Registros de Ponto",
          url: "/TimeRecords",
          icon: Clock,
        },
        {
          title: "Gestão de Pontos",
          url: "/ManageTimeRecordsSimple",
          icon: Edit3,
        },
        {
          title: "Banco de Horas",
          url: "/HoursBank",
          icon: Clock,
        },
        {
          title: "Folha de Ponto Assinada",
          url: "/ManageSignedTimeReports",
          icon: FileText,
        },
      ]
    },
    {
      id: "employees",
      title: "Gestão de Pessoas",
      items: [
        {
          title: "Funcionários",
          url: "/Employees",
          icon: Users,
        },
        {
          title: "Times",
          url: "/Teams",
          icon: Users,
        },
        {
          title: "Supervisores",
          url: "/Supervisors",
          icon: Shield,
        },
        {
          title: "Justificativas de Falta",
          url: "/ManageAbsenceJustifications",
          icon: FileCheck,
        },
      ]
    },
    {
      id: "organization",
      title: "Estrutura Organizacional",
      items: [
        {
          title: "Setores",
          url: "/Departments",
          icon: Building2,
        },
        {
          title: "Cargos",
          url: "/Positions",
          icon: Briefcase,
        },
        {
          title: "Escalas",
          url: "/Shifts",
          icon: Calendar,
        },
      ]
    },
    {
      id: "tasks",
      title: "Plano de Trabalho",
      items: [
        {
          title: "Dashboard de Tarefas",
          url: "/TasksDashboard",
          icon: ListTodo,
        },
        {
          title: "Gestão de Tarefas",
          url: "/ManageTasks",
          icon: Edit3,
        },
      ]
    },
    {
      id: "hr",
      title: "Recursos Humanos",
      items: [
        {
          title: "Gestão de Férias",
          url: "/ManageVacations",
          icon: Calendar,
        },
        {
          title: "Gestão de Holerites",
          url: "/ManagePayslips",
          icon: FileText,
        },
      ]
    },
    {
      id: "clients",
      title: "Clientes e Contratos",
      items: [
        {
          title: "Clientes",
          url: "/Clients",
          icon: Building2,
        },
        {
          title: "Contratos",
          url: "/Contracts",
          icon: FileText,
        },
        {
          title: "Lotações",
          url: "/Allocations",
          icon: MapPin,
        },
        {
          title: "Relatório de Alocações",
          url: "/AllocationReports",
          icon: FileText,
        },
      ]
    },
    {
      id: "reports",
      title: "Relatórios",
      items: [
        {
          title: "Relatórios Gerais",
          url: "/Reports",
          icon: FileText,
        },
        {
          title: "Relatório de Humor",
          url: "/MoodReport",
          icon: FileText,
        },
      ]
    },
    {
      id: "system",
      title: "Sistema",
      items: [
        {
          title: "Avisos",
          url: "/Announcements",
          icon: LayoutDashboard,
        },
        {
          title: "Configurações",
          url: "/Settings",
          icon: Settings,
        },
        {
          title: "Usuários e Acessos",
          url: "/UsersManagement",
          icon: UserCog,
        },
      ]
    }
  ],
  superAdmin: [
    {
      id: "super_admin",
      title: "Administração Global",
      items: [
        {
          title: "Empresas",
          url: "/Companies",
          icon: Building,
        },
      ]
    }
  ],
  employee: [
    {
      id: "employee_dashboard",
      title: "Meu Painel",
      items: [
        {
          title: "Meu Dashboard",
          url: "/EmployeeDashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Bater Ponto",
          url: "/ClockIn",
          icon: Timer,
        },
        {
          title: "Meus Registros",
          url: "/MyTimeRecords",
          icon: BarChart3,
        },
      ]
    },
    {
      id: "employee_tasks",
      title: "Minhas Atividades",
      items: [
        {
          title: "Minhas Tarefas",
          url: "/MyTasks",
          icon: ListTodo,
        },
        {
          title: "Justificar Falta",
          url: "/MyAbsenceJustifications",
          icon: FileCheck,
        },
      ]
    },
    {
      id: "employee_docs",
      title: "Meus Documentos",
      items: [
        {
          title: "Minhas Férias",
          url: "/MyVacations",
          icon: Calendar,
        },
        {
          title: "Meus Holerites",
          url: "/MyPayslips",
          icon: FileText,
        },
        {
          title: "Folha de Ponto Assinada",
          url: "/MySignedTimeReports",
          icon: FileText,
        },
      ]
    }
  ]
};

export const getNavigationForUser = (isSuperAdmin, isAdmin) => {
  if (isSuperAdmin) {
    return [...navigationModules.superAdmin, ...navigationModules.admin];
  } else if (isAdmin) {
    return navigationModules.admin;
  } else {
    return navigationModules.employee;
  }
};