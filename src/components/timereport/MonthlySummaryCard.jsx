import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMinutes, formatSaldo } from "@/lib/timeCalculations";
import { Clock, TrendingUp, TrendingDown, AlertTriangle, CalendarX, Zap, Scale } from "lucide-react";

const Row = ({ icon: Icon, label, value, color = "text-gray-800", badge }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <Icon className={`w-4 h-4 ${color}`} />
      <span>{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
      <span className={`font-semibold text-sm ${color}`}>{value}</span>
    </div>
  </div>
);

export default function MonthlySummaryCard({ summary }) {
  if (!summary) return null;

  const {
    totalWorkedMin,
    totalExtraMin,
    totalAtrasoMin,
    totalFaltaMin,
    saldoLiquidoMin,
    dsrMin,
    diasTrabalhados,
    diasFalta,
    diasAtraso,
  } = summary;

  const saldoColor = saldoLiquidoMin > 0
    ? "text-green-600"
    : saldoLiquidoMin < 0
    ? "text-red-600"
    : "text-gray-600";

  const saldoBg = saldoLiquidoMin > 0
    ? "bg-green-50 border-green-200 dark:bg-green-900/20"
    : saldoLiquidoMin < 0
    ? "bg-red-50 border-red-200 dark:bg-red-900/20"
    : "bg-gray-50 dark:bg-gray-900";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-900 pb-3">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Scale className="w-4 h-4" />
          Resumo Mensal — Padrão CLT
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-0">
        <Row icon={Clock} label="Total Horas Trabalhadas" value={formatMinutes(totalWorkedMin)} color="text-blue-600" />
        <Row
          icon={TrendingUp}
          label="Horas Extras"
          value={totalExtraMin > 0 ? `+${formatMinutes(totalExtraMin)}` : "00:00"}
          color="text-green-600"
          badge={totalExtraMin > 0 ? "50%" : undefined}
        />
        <Row
          icon={TrendingDown}
          label="Atrasos / Déficit de Jornada"
          value={totalAtrasoMin > 0 ? `-${formatMinutes(totalAtrasoMin)}` : "00:00"}
          color={totalAtrasoMin > 0 ? "text-orange-600" : "text-gray-500"}
        />
        <Row
          icon={CalendarX}
          label="Faltas"
          value={totalFaltaMin > 0 ? formatMinutes(totalFaltaMin) : "00:00"}
          color={totalFaltaMin > 0 ? "text-red-600" : "text-gray-500"}
          badge={diasFalta > 0 ? `${diasFalta} dia${diasFalta > 1 ? "s" : ""}` : undefined}
        />
        <Row
          icon={Zap}
          label="DSR sobre Horas Extras (Lei 605/49)"
          value={dsrMin > 0 ? `+${formatMinutes(dsrMin)}` : "00:00"}
          color={dsrMin > 0 ? "text-purple-600" : "text-gray-500"}
          badge={dsrMin > 0 ? "DSR" : undefined}
        />

        {/* Saldo líquido em destaque */}
        <div className={`mt-3 rounded-lg border p-3 ${saldoBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className={`w-4 h-4 ${saldoColor}`} />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Saldo Líquido do Período
              </span>
            </div>
            <span className={`text-lg font-bold ${saldoColor}`}>
              {formatSaldo(saldoLiquidoMin)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Extras ({formatMinutes(totalExtraMin)}) − Atrasos ({formatMinutes(totalAtrasoMin)})
          </p>
        </div>

        {/* Dias */}
        <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{diasTrabalhados}</p>
            <p className="text-xs text-gray-500">Dias trabalhados</p>
          </div>
          <div className="flex-1 text-center border-x border-gray-100 dark:border-gray-800">
            <p className={`text-lg font-bold ${diasFalta > 0 ? "text-red-600" : "text-gray-400"}`}>{diasFalta}</p>
            <p className="text-xs text-gray-500">Faltas</p>
          </div>
          <div className="flex-1 text-center">
            <p className={`text-lg font-bold ${diasAtraso > 0 ? "text-orange-600" : "text-gray-400"}`}>{diasAtraso}</p>
            <p className="text-xs text-gray-500">Atrasos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}