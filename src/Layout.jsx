import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { getNavigationForUser } from "@/lib/navigationConfig";
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
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [company, setCompany] = useState(null);
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

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      if (userData.company_id) {
        const companies = await base44.entities.Company.filter({ id: userData.company_id });
        if (companies.length > 0) {
          setCompany(companies[0]);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const handleLogout = () => {
    base44.auth.logout(window.location.origin + createPageUrl('Home'));
  };

  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.email === 'admin@pontoflex.com';
  
  const navigationModules = getNavigationForUser(isSuperAdmin, isAdmin);

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

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
          <Sidebar className="hidden md:flex border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
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
              {company && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Badge variant="outline" className="text-xs">
                    {company.name}
                  </Badge>
                </div>
              )}
            </SidebarHeader>
            
            <SidebarContent className="p-4 overflow-y-auto">
              {navigationModules.map((module) => (
                <Collapsible
                  key={module.id}
                  open={expandedModules[module.id] !== false}
                  onOpenChange={() => toggleModule(module.id)}
                  className="mb-4"
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <span>{module.title}</span>
                    {expandedModules[module.id] !== false ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1">
                    {module.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <Link
                          key={item.title}
                          to={item.url}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))}
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
                        {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : 'Funcionário'}
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
                <div className="mt-4 pb-4 space-y-4">
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