/**
 * Biblioteca de cálculos de ponto — padrão CLT / Lei 605/49
 * Todas as operações internas em MINUTOS; exibição em HH:MM
 */

/** Converte "HH:MM:SS" ou timestamp ISO para minutos desde 00:00 */
export function toMinutes(timestamp) {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (isNaN(d)) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** Formata minutos absolutos em "HH:MM" */
export function formatMinutes(totalMinutes) {
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Formata saldo (positivo/negativo) em "+HH:MM" / "-HH:MM" / "00:00" */
export function formatSaldo(minutes) {
  if (minutes === 0) return "00:00";
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${formatMinutes(minutes)}`;
}

/**
 * Calcula os minutos trabalhados no dia a partir dos registros do dia.
 * records = array de TimeRecord do dia, cada um com { type, timestamp }
 * Suporta múltiplos pares entrada/saída mas usa a estrutura padrão:
 * entrada → pausa → retorno → saida
 */
export function calcWorkedMinutes(records) {
  const byType = {};
  records.forEach(r => { byType[r.type] = r; });

  const entrada = byType["entrada"]?.timestamp;
  const pausa = byType["pausa"]?.timestamp;
  const retorno = byType["retorno"]?.timestamp;
  const saida = byType["saida"]?.timestamp;

  if (!entrada || !saida) return 0;

  const entMin = toMinutes(entrada);
  const saiMin = toMinutes(saida);
  if (entMin === null || saiMin === null) return 0;

  let total = saiMin - entMin;
  if (total < 0) total += 1440; // virada de meia-noite

  // Desconta intervalo se tiver pausa+retorno
  if (pausa && retorno) {
    const pauMin = toMinutes(pausa);
    const retMin = toMinutes(retorno);
    if (pauMin !== null && retMin !== null) {
      let intervalo = retMin - pauMin;
      if (intervalo < 0) intervalo += 1440;
      total -= intervalo;
    }
  }

  return Math.max(0, total);
}

/**
 * Resultado por dia:
 * {
 *   dateStr, dow, workedMin, jornadaMin,
 *   extraMin, extra50Min, extra100Min,
 *   extraRateMap: { [rate]: minutes } — breakdown por taxa personalizada,
 *   atrasoMin, faltaMin,
 *   label: "falta" | "atraso" | "extra" | "normal" | "folga",
 *   hasRecords
 * }
 *
 * overtimeConfig: { dayRates: Map<dow, rate>, offDayRate: number }
 *   - dayRates: taxas por dia da semana (dow 0-6) para dias de trabalho
 *   - offDayRate: taxa para dias fora da escala (padrão 100)
 */
export function calcDayResult(dateStr, records, jornadaMin = 480, overtimeConfig = null) {
  const hasRecords = records.length > 0;
  const workedMin = calcWorkedMinutes(records);
  const dow = new Date(dateStr + "T00:00:00").getDay(); // 0=Dom

  let extraMin = 0;
  let extra50Min = 0;
  let extra100Min = 0;
  const extraRateMap = {};
  let atrasoMin = 0;
  let faltaMin = 0;
  let label = "normal";

  // Helper: aplica taxa ao extra
  const applyRate = (minutes, rate) => {
    extraRateMap[rate] = (extraRateMap[rate] || 0) + minutes;
    if (rate <= 50) extra50Min += minutes;
    else extra100Min += minutes;
  };

  // Dia sem jornada prevista (folga / fora da escala)
  if (jornadaMin === 0) {
    label = "folga";
    if (workedMin > 0) {
      extraMin = workedMin;
      // Se offDayRate for null/undefined, respeita a taxa configurada para o dia da semana
      let offRate;
      if (overtimeConfig?.offDayRate != null) {
        offRate = overtimeConfig.offDayRate;
      } else if (overtimeConfig?.dayRates?.has(dow)) {
        offRate = overtimeConfig.dayRates.get(dow);
      } else {
        offRate = dow === 0 ? 100 : 50; // fallback padrão
      }
      applyRate(workedMin, offRate);
    }
    return { dateStr, dow, workedMin, jornadaMin, extraMin, extra50Min, extra100Min, extraRateMap, atrasoMin, faltaMin, label, hasRecords };
  }

  if (!hasRecords || workedMin === 0) {
    faltaMin = jornadaMin;
    label = "falta";
  } else {
    const saldo = workedMin - jornadaMin;
    if (saldo > 0) {
      extraMin = saldo;
      // Taxa configurada para o dia, ou padrão: Domingo=100%, demais=50%
      let rate = 50;
      if (overtimeConfig?.dayRates?.has(dow)) {
        rate = overtimeConfig.dayRates.get(dow);
      } else if (dow === 0) {
        rate = 100;
      }
      applyRate(saldo, rate);
      label = "extra";
    } else if (saldo < 0) {
      atrasoMin = Math.abs(saldo);
      label = "atraso";
    }
  }

  return { dateStr, dow, workedMin, jornadaMin, extraMin, extra50Min, extra100Min, extraRateMap, atrasoMin, faltaMin, label, hasRecords };
}

/**
 * Aplica regra de Interjornada (CLT Art. 66) ao array de dayResults.
 * Intervalo mínimo entre jornadas = 11h (660 min).
 * Horas trabalhadas dentro da violação de interjornada viram extra100.
 * Modifica os objetos in-place e retorna o array.
 */
export function applyInterjornada(dayResults, recordsByDate) {
  for (let i = 1; i < dayResults.length; i++) {
    const prev = dayResults[i - 1];
    const curr = dayResults[i];
    if (!recordsByDate) continue;
    const prevRecs = recordsByDate[prev.dateStr] || [];
    const currRecs = recordsByDate[curr.dateStr] || [];
    const prevSaida = prevRecs.find(r => r.type === "saida")?.timestamp;
    const currEntrada = currRecs.find(r => r.type === "entrada")?.timestamp;
    if (!prevSaida || !currEntrada) continue;
    const saidaMin = toMinutes(prevSaida);
    const entradaMin = toMinutes(currEntrada);
    if (saidaMin === null || entradaMin === null) continue;
    // Intervalo entre saída do dia anterior e entrada do dia atual
    let intervalo = entradaMin + 1440 - saidaMin; // sempre positivo (dia seguinte)
    if (intervalo >= 1440) intervalo -= 1440; // segurança
    const MINIMO_INTERJORNADA = 660; // 11 horas
    if (intervalo < MINIMO_INTERJORNADA) {
      const violacaoMin = MINIMO_INTERJORNADA - intervalo;
      // As horas trabalhadas dentro da violação passam a ser extra100
      const horasViolacao = Math.min(violacaoMin, curr.workedMin);
      if (horasViolacao > 0 && curr.label !== "falta") {
        curr.extra100Min = (curr.extra100Min || 0) + horasViolacao;
        curr.extra50Min = Math.max(0, (curr.extra50Min || 0) - horasViolacao);
        curr.interjornadaMin = horasViolacao;
      }
    }
  }
  return dayResults;
}

/**
 * Calcula DSR sobre horas extras por semana — Lei 605/49
 * dayResults: array de calcDayResult() para o mês inteiro
 * Returns: totalDsrMin (number)
 */
export function calcDSR(dayResults) {
  const weeks = buildWeeks(dayResults);
  let totalDsrMin = 0;
  Object.values(weeks).forEach(weekDays => {
    const dsr = calcWeekDSR(weekDays);
    totalDsrMin += dsr;
  });
  return totalDsrMin;
}

/** Retorna map weekKey -> { dsrMin, sundayDateStr } para exibição por semana */
export function calcWeeklyDSRMap(dayResults) {
  const weeks = buildWeeks(dayResults);
  const result = {};
  Object.entries(weeks).forEach(([weekKey, weekDays]) => {
    const dsr = calcWeekDSR(weekDays);
    // Encontra o domingo da semana
    const sunday = weekDays.find(d => d.dow === 0);
    result[weekKey] = { dsrMin: dsr, sundayDateStr: sunday?.dateStr || null };
  });
  return result;
}

function buildWeeks(dayResults) {
  const weeks = {};
  dayResults.forEach(day => {
    const d = new Date(day.dateStr + "T00:00:00");
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const weekKey = monday.toISOString().substring(0, 10);
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push({ ...day, dow });
  });
  return weeks;
}

function calcWeekDSR(weekDays) {
  const diasUteis = weekDays.filter(d => d.dow >= 1 && d.dow <= 6 && d.jornadaMin > 0);
  const diasUteisComTrabalho = diasUteis.filter(d => d.workedMin > 0);
  const totalHeSemana = diasUteisComTrabalho.reduce((s, d) => s + d.extraMin, 0);
  const qtdDiasUteis = diasUteisComTrabalho.length;
  if (qtdDiasUteis > 0 && totalHeSemana > 0) {
    return Math.round(totalHeSemana / qtdDiasUteis);
  }
  return 0;
}

/**
 * Resumo mensal completo
 * dayResults: array de calcDayResult()
 * Returns objeto com todos os totais em minutos
 */
export function calcMonthlySummary(dayResults) {
  let totalWorkedMin = 0;
  let totalJornadaMin = 0;
  let totalExtraMin = 0;
  let totalExtra50Min = 0;
  let totalExtra100Min = 0;
  let totalAtrasoMin = 0;
  let totalFaltaMin = 0;
  let totalInterjornadaMin = 0;
  let diasTrabalhados = 0;
  let diasFalta = 0;
  let diasAtraso = 0;
  let diasInterjornada = 0;

  dayResults.forEach(d => {
    totalWorkedMin += d.workedMin;
    totalJornadaMin += d.jornadaMin;
    totalExtraMin += d.extraMin;
    totalExtra50Min += d.extra50Min || 0;
    totalExtra100Min += d.extra100Min || 0;
    totalAtrasoMin += d.atrasoMin;
    totalFaltaMin += d.faltaMin;
    if (d.interjornadaMin > 0) { totalInterjornadaMin += d.interjornadaMin; diasInterjornada++; }
    if (d.workedMin > 0) diasTrabalhados++;
    if (d.label === "falta") diasFalta++;
    if (d.label === "atraso") diasAtraso++;
  });

  const saldoLiquidoMin = totalExtraMin - totalAtrasoMin;

  // DSR: calcula por semana — cada semana com HE gera 1 dia de DSR
  const weeklyDsrMap = calcWeeklyDSRMap(dayResults);
  const dsrWeeks = Object.values(weeklyDsrMap).filter(w => w.dsrMin > 0);
  const dsrMin = dsrWeeks.reduce((s, w) => s + w.dsrMin, 0);
  const dsrDias = dsrWeeks.length; // quantas semanas geraram DSR = quantos dias de DSR

  return {
    totalWorkedMin,
    totalJornadaMin,
    totalExtraMin,
    totalExtra50Min,
    totalExtra100Min,
    totalAtrasoMin,
    totalFaltaMin,
    totalInterjornadaMin,
    saldoLiquidoMin,
    dsrMin,
    dsrDias,
    diasTrabalhados,
    diasFalta,
    diasAtraso,
    diasInterjornada,
  };
}