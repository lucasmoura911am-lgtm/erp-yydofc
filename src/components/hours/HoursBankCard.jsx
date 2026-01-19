import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HoursBankCard({ hoursBank }) {
  const totalBalance = hoursBank.reduce((sum, record) => sum + (record.balance_minutes || 0), 0);
  const totalOvertime = hoursBank.reduce((sum, record) => sum + (record.overtime_minutes || 0), 0);
  const totalMissing = hoursBank.reduce((sum, record) => sum + (record.missing_minutes || 0), 0);

  const formatMinutes = (minutes) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <Card className="shadow-lg border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Banco de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-center mb-2">
              {totalBalance >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalBalance >= 0 ? '+' : '-'}{formatMinutes(totalBalance)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Saldo Total</p>
          </div>

          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              +{formatMinutes(totalOvertime)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Horas Extras</p>
          </div>

          <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">
              -{formatMinutes(totalMissing)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Horas Faltantes</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Últimos Registros
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {hoursBank.slice(0, 10).map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{new Date(record.date).toLocaleDateString('pt-BR')}</p>
                  <p className="text-xs text-gray-500">
                    Trabalhado: {formatMinutes(record.worked_minutes)} / Esperado: {formatMinutes(record.expected_minutes)}
                  </p>
                  {record.notes && (
                    <p className="text-xs text-gray-400 mt-1">{record.notes}</p>
                  )}
                </div>
                <Badge variant="outline" className={
                  record.balance_minutes > 0 ? 'bg-green-100 text-green-800' :
                  record.balance_minutes < 0 ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {record.balance_minutes >= 0 ? '+' : ''}{formatMinutes(record.balance_minutes)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}