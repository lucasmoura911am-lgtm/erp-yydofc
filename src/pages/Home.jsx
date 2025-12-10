import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Users, BarChart3, Shield, Timer, CheckCircle, LogIn, Zap, Lock, MapPin, AlertCircle, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loginType, setLoginType] = useState("admin");

  useEffect(() => {
    checkAuth();
  }, []);

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const allAnnouncements = await base44.entities.Announcement.list('-created_date');
      const now = new Date();
      return allAnnouncements.filter(ann => {
        if (!ann.active) return false;
        if (ann.expires_at) {
          const expiryDate = new Date(ann.expires_at);
          if (expiryDate < now) return false;
        }
        return true;
      });
    },
    initialData: [],
  });

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
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

  const getAnnouncementIcon = (type) => {
    switch (type) {
      case 'info': return <Info className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'success': return <CheckCircle2 className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getAnnouncementVariant = (type) => {
    switch (type) {
      case 'warning': return 'default';
      case 'error': return 'destructive';
      default: return 'default';
    }
  };

  const filteredAnnouncements = announcements.filter(ann => {
    if (ann.target_audience === 'all') return true;
    if (loginType === 'admin' && ann.target_audience === 'admin') return true;
    if (loginType === 'employee' && ann.target_audience === 'employee') return true;
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <p className="text-white text-lg font-medium">Carregando PontoFlex...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/20">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">PontoFlex</h1>
              <p className="text-sm text-white/80">Sistema de Controle de Ponto</p>
            </div>
          </div>
          <Badge variant="secondary" className="hidden md:flex bg-white/20 text-white border-white/30">
            v2.0
          </Badge>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left Side - Branding & Features */}
          <div className="space-y-8 text-white">
            <div className="space-y-4">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <Zap className="w-3 h-3 mr-1" />
                Sistema Corporativo
              </Badge>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Controle de Ponto
                <span className="block text-white/90">
                  Moderno e Completo
                </span>
              </h2>
              <p className="text-xl text-white/90 leading-relaxed">
                Gerencie a jornada de trabalho da sua equipe com tecnologia de ponta. 
                Reconhecimento facial, geolocalização e relatórios em tempo real.
              </p>
            </div>

            {/* Announcements */}
            {filteredAnnouncements.length > 0 && (
              <div className="space-y-3">
                {filteredAnnouncements.map((announcement) => (
                  <Alert 
                    key={announcement.id}
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white"
                  >
                    {getAnnouncementIcon(announcement.type)}
                    <AlertTitle className="text-white font-semibold">
                      {announcement.title}
                    </AlertTitle>
                    <AlertDescription className="text-white/90">
                      {announcement.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-300" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Reconhecimento Facial</h3>
                  <p className="text-sm text-white/80">Segurança e praticidade no registro</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Geolocalização</h3>
                  <p className="text-sm text-white/80">Registro automático de localização</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Dashboard Completo</h3>
                  <p className="text-sm text-white/80">Gráficos e análises em tempo real</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-orange-300" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">100% Seguro</h3>
                  <p className="text-sm text-white/80">Dados criptografados e protegidos</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">99.9%</div>
                <div className="text-sm text-white/80">Disponibilidade</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">24/7</div>
                <div className="text-sm text-white/80">Suporte</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">Cloud</div>
                <div className="text-sm text-white/80">Baseado</div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-2xl border-none bg-white/95 backdrop-blur-xl">
              <CardHeader className="space-y-1 pb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <LogIn className="w-8 h-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Bem-vindo de volta
                </CardTitle>
                <CardDescription className="text-center text-base">
                  Faça login para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={loginType} onValueChange={setLoginType} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-gray-100">
                    <TabsTrigger value="admin" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white">
                      <Shield className="w-4 h-4" />
                      Administrador
                    </TabsTrigger>
                    <TabsTrigger value="employee" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                      <Users className="w-4 h-4" />
                      Funcionário
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="admin" className="space-y-6">
                    <div className="space-y-5">
                      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-purple-900 mb-1">Acesso Administrativo</p>
                            <p className="text-sm text-purple-800">
                              Gerencie funcionários, visualize relatórios completos e configure o sistema.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Button
                          onClick={handleLogin}
                          className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                        >
                          <LogIn className="w-5 h-5 mr-2" />
                          Entrar como Administrador
                        </Button>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <div className="flex-1 h-px bg-gray-200"></div>
                          <span>Login seguro via Base44</span>
                          <div className="flex-1 h-px bg-gray-200"></div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-sm text-gray-900">O que você pode fazer:</h4>
                        <ul className="space-y-1.5 text-sm text-gray-600">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                            Cadastrar e gerenciar funcionários
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                            Visualizar todos os registros de ponto
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                            Gerar relatórios e exportar dados
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                            Configurar setores, cargos e escalas
                          </li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="employee" className="space-y-6">
                    <div className="space-y-5">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Timer className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-blue-900 mb-1">Acesso do Funcionário</p>
                            <p className="text-sm text-blue-800">
                              Registre ponto com reconhecimento facial e acompanhe seu histórico de marcações.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Button
                          onClick={handleLogin}
                          className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                        >
                          <LogIn className="w-5 h-5 mr-2" />
                          Entrar como Funcionário
                        </Button>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <div className="flex-1 h-px bg-gray-200"></div>
                          <span>Login seguro via Base44</span>
                          <div className="flex-1 h-px bg-gray-200"></div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-sm text-gray-900">O que você pode fazer:</h4>
                        <ul className="space-y-1.5 text-sm text-gray-600">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                            Registrar ponto com foto e localização
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                            Visualizar seu histórico de registros
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                            Acompanhar suas estatísticas mensais
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                            Ver seu índice de pontualidade
                          </li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <a 
                    href={createPageUrl('PublicClockIn')}
                    className="block w-full text-center py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
                  >
                    🚀 Bater Ponto Rápido (Sem Login)
                  </a>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Para funcionários: bata ponto apenas com sua matrícula
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-xs text-center text-gray-500 leading-relaxed">
                    <Lock className="w-3 h-3 inline mr-1" />
                    Ao fazer login, você concorda com nossos termos de uso e política de privacidade. 
                    Seus dados estão protegidos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 mt-12">
        <div className="text-center text-white/80">
          <p className="text-sm">© 2025 PontoFlex - Sistema de Controle de Ponto Eletrônico</p>
          <p className="text-xs mt-1 text-white/60">Desenvolvido com tecnologia Base44</p>
        </div>
      </footer>
    </div>
  );
}