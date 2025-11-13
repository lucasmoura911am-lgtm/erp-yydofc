import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Clock,
  Users,
  Building2,
  Briefcase,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Timer,
  BarChart3,
  FileText
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const adminNavigation = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Registros de Ponto",
    url: createPageUrl("TimeRecords"),
    icon: Clock,
  },
  {
    title: "Funcionários",
    url: createPageUrl("Employees"),
    icon: Users,
  },
  {
    title: "Setores",
    url: createPageUrl("Departments"),
    icon: Building2,
  },
  {
    title: "Cargos",
    url: createPageUrl("Positions"),
    icon: Briefcase,
  },
  {
    title: "Escalas",
    url: createPageUrl("Shifts"),
    icon: Calendar,
  },
  {
    title: "Relatórios",
    url: createPageUrl("Reports"),
    icon: FileText,
  },
];

const employeeNavigation = [
  {
    title: "Bater Ponto",
    url: createPageUrl("ClockIn"),
    icon: Timer,
  },
  {
    title: "Meus Registros",
    url: createPageUrl("MyTimeRecords"),
    icon: BarChart3,
  },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const handleLogout = () => {
    // Redirecionar para Home após logout
    base44.auth.logout(window.location.origin + createPageUrl('Home'));
  };

  const isAdmin = user?.role === 'admin';
  const navigation = isAdmin ? adminNavigation : employeeNavigation;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <style>{`
        :root {
          --primary: 262 83% 58%;
          --primary-foreground: 0 0% 100%;
          --secondary: 220 14% 96%;
          --secondary-foreground: 220 9% 46%;
          --background: 0 0% 100%;
          --foreground: 222 47% 11%;
          --muted: 220 14% 96%;
          --muted-foreground: 220 9% 46%;
          --accent: 220 14% 96%;
          --accent-foreground: 222 47% 11%;
          --border: 220 13% 91%;
          --card: 0 0% 100%;
          --card-foreground: 222 47% 11%;
        }
        
        .dark {
          --primary: 262 83% 58%;
          --primary-foreground: 0 0% 100%;
          --secondary: 217 33% 17%;
          --secondary-foreground: 210 40% 98%;
          --background: 224 71% 4%;
          --foreground: 213 31% 91%;
          --muted: 223 47% 11%;
          --muted-foreground: 215 16% 57%;
          --accent: 216 34% 17%;
          --accent-foreground: 210 40% 98%;
          --border: 216 34% 17%;
          --card: 224 71% 4%;
          --card-foreground: 213 31% 91%;
        }
      `}</style>
      
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gray-50 dark:bg-gray-950 transition-colors">
          {/* Sidebar Desktop */}
          <Sidebar className="hidden md:flex border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">PontoFlex</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Controle de Ponto</p>
                </div>
              </div>
            </SidebarHeader>
            
            <SidebarContent className="p-4">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2 mb-1">
                  {isAdmin ? 'Administração' : 'Menu'}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigation.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            asChild 
                            className={`mb-1 transition-all duration-200 ${
                              isActive 
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700' 
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                              <item.icon className="w-5 h-5" />
                              <span className="font-medium">{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {isAdmin && (
                <SidebarGroup className="mt-6">
                  <SidebarGroupLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2 mb-1">
                    Configurações
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild className="hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Link to={createPageUrl("Settings")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300">
                            <Settings className="w-5 h-5" />
                            <span className="font-medium">Configurações</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>

            <SidebarFooter className="border-t border-gray-200 dark:border-gray-800 p-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {darkMode ? 'Modo Claro' : 'Modo Escuro'}
                </Button>
                
                {user && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <Avatar>
                      <AvatarImage src={user.photo_url} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                        {user.full_name?.charAt(0) || user.email?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {user.full_name || user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {isAdmin ? 'Administrador' : 'Funcionário'}
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  Sair do Sistema
                </Button>
              </div>
            </SidebarFooter>
          </Sidebar>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Header */}
            <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </Button>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">PontoFlex</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDarkMode(!darkMode)}
                  >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="text-red-600"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Mobile Menu */}
              {mobileMenuOpen && (
                <div className="mt-4 pb-4 space-y-2">
                  {navigation.map((item) => {
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
                  {isAdmin && (
                    <Link
                      to={createPageUrl("Settings")}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Settings className="w-5 h-5" />
                      <span className="font-medium">Configurações</span>
                    </Link>
                  )}
                </div>
              )}
            </header>

            {/* Page Content */}
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}