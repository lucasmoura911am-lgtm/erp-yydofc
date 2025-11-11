import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Users, BarChart3, Shield, Timer, CheckCircle, LogIn } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loginType, setLoginType] = useState("admin");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        // Redirecionar baseado no role
        if (user.role === 'admin') {
          navigate(createPageUrl('Dashboard'));
        } else {
          navigate(createPageUrl('ClockIn'));
        }
      }
    } catch (error) {
      console.log("Usuário não autenticado");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.origin + createPageUrl('Home'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-6rem)]">
          {/* Left Side - Branding */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <Clock className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">PontoFlex</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">Sistema de Controle de Ponto</p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                Controle de Ponto
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                  Inteligente e Moderno
                </span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Gerencie a jornada de trabalho da sua equipe com tecnologia de ponta, 
                reconhecimento facial e relatórios completos.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Reconhecimento Facial</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Registro de ponto com foto e verificação biométrica
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Relatórios em Tempo Real</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Dashboards completos com gráficos e estatísticas
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Gestão Completa</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Gerencie funcionários, setores, cargos e escalas
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-2xl border-none">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold text-center">Bem-vindo</CardTitle>
                <CardDescription className="text-center">
                  Faça login para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={loginType} onValueChange={setLoginType} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="admin" className="gap-2">
                      <Shield className="w-4 h-4" />
                      Administrador
                    </TabsTrigger>
                    <TabsTrigger value="employee" className="gap-2">
                      <Users className="w-4 h-4" />
                      Funcionário
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="admin" className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <p className="text-sm text-purple-900 dark:text-purple-200 text-center">
                          <Shield className="w-4 h-4 inline mr-2" />
                          Acesso para gerenciar funcionários, visualizar relatórios e configurar o sistema.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          placeholder="admin@empresa.com"
                          className="h-11"
                          disabled
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="admin-password">Senha</Label>
                        <Input
                          id="admin-password"
                          type="password"
                          placeholder="••••••••"
                          className="h-11"
                          disabled
                        />
                      </div>

                      <Button
                        onClick={handleLogin}
                        className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base font-semibold"
                      >
                        <LogIn className="w-5 h-5 mr-2" />
                        Entrar como Administrador
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="employee" className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-200 text-center">
                          <Timer className="w-4 h-4 inline mr-2" />
                          Acesso para registrar ponto e visualizar seu histórico de marcações.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="employee-email">Email</Label>
                        <Input
                          id="employee-email"
                          type="email"
                          placeholder="funcionario@empresa.com"
                          className="h-11"
                          disabled
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="employee-password">Senha</Label>
                        <Input
                          id="employee-password"
                          type="password"
                          placeholder="••••••••"
                          className="h-11"
                          disabled
                        />
                      </div>

                      <Button
                        onClick={handleLogin}
                        className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-base font-semibold"
                      >
                        <LogIn className="w-5 h-5 mr-2" />
                        Entrar como Funcionário
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Ao fazer login, você concorda com nossos termos de uso e política de privacidade.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-6 border-t border-gray-200 dark:border-gray-800">
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>© 2025 PontoFlex - Sistema de Controle de Ponto Eletrônico</p>
        </div>
      </footer>
    </div>
  );
}