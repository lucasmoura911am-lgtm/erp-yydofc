import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, BarChart3, Shield, Timer, CheckCircle } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PontoFlex</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sistema de Controle de Ponto</p>
            </div>
          </div>
          <Button
            onClick={handleLogin}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            <Shield className="w-5 h-5 mr-2" />
            Fazer Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Controle de Ponto
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              Inteligente e Moderno
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Sistema completo de gestão de ponto eletrônico com reconhecimento facial,
            geolocalização e relatórios em tempo real.
          </p>
          <Button
            onClick={handleLogin}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-6"
          >
            Acessar Sistema
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4">
                <Timer className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Registro Rápido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Bata ponto em segundos com reconhecimento facial e registro automático de localização.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Gestão Completa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Gerencie funcionários, setores, cargos e escalas de trabalho em um só lugar.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Relatórios Detalhados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Análises completas de presença, atrasos, horas extras e muito mais.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Controle de Pontualidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Acompanhe atrasos, faltas e pontualidade com gráficos e rankings.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Múltiplas Escalas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Configure diferentes escalas de trabalho para cada departamento ou funcionário.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Seguro e Confiável</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Dados protegidos com autenticação segura e backups automáticos.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-20">
        <Card className="border-none shadow-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <CardContent className="p-12 text-center">
            <h3 className="text-3xl font-bold mb-4">Pronto para começar?</h3>
            <p className="text-lg mb-8 opacity-90">
              Faça login e comece a usar o sistema de controle de ponto mais moderno.
            </p>
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100"
            >
              Acessar Agora
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <p>© 2025 PontoFlex - Sistema de Controle de Ponto Eletrônico</p>
        </div>
      </footer>
    </div>
  );
}