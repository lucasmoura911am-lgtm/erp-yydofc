import { parseISO, differenceInMinutes, getDay, getHours } from "date-fns";

/**
 * Calcula horas CLT para um período mensal de registros de ponto
 * REGRAS CLT OBRIGATÓRIAS:
 * 1. Horas trabalhadas = (pausa - entrada) + (saida - retorno)
 * 2. Tolerância: 5min entrada/saída, máximo 10min/dia
 * 3. Hora extra só se ultrapassar jornada diária
 * 4. Atraso NÃO gera hora extra
 * 5. HE 50% (primeiras 2h) + HE 100% (após 2h)
 */
export function calculateCLTHours(timeRecords, shift, holidays = []) {
  // Agrupar registros por dia
  const recordsByDay = {};
  
  timeRecords.forEach(record => {
    const date = record.timestamp.substring(0, 10); // YYYY-MM-DD
    if (!recordsByDay[date]) {
      recordsByDay[date] = [];
    }
    recordsByDay[date].push(record);
  });

  // Configurações da escala
  const shiftStartTime = shift?.start_time || '08:00';
  const shiftEndTime = shift?.end_time || '17:00';
  const breakMinutes = shift?.break_minutes || 60;
  const toleranceMinutes = shift?.tolerance_minutes || 5;
  const dailyWorkMinutes = shift ? calculateShiftMinutes(shiftStartTime, shiftEndTime, breakMinutes) : 480; // 8h padrão
  
  // Dias de trabalho da escala
  const workDaysMap = {
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
    'friday': 5, 'saturday': 6, 'sunday': 0
  };
  const shiftWorkDays = shift?.work_days?.map(d => workDaysMap[d]) || [1, 2, 3, 4, 5];

  // Totalizadores
  let totalWorkedMinutes = 0;
  let totalDelayMinutes = 0;
  let overtime50Minutes = 0;
  let overtime100Minutes = 0;
  let nightMinutes = 0;
  let sundayHolidayMinutes = 0;
  let absenceMinutes = 0;
  let dsrDays = 0;

  // Array com dados diários
  const dailyData = [];

  Object.entries(recordsByDay).forEach(([date, records]) => {
    const dayOfWeek = getDay(new Date(date + 'T12:00:00'));
    const isSunday = dayOfWeek === 0;
    const isHoliday = holidays.includes(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Ordenar registros por horário
    const sortedRecords = records.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Buscar marcações
    const entrada = sortedRecords.find(r => r.type === 'entrada');
    const pausa = sortedRecords.find(r => r.type === 'pausa');
    const retorno = sortedRecords.find(r => r.type === 'retorno');
    const saida = sortedRecords.find(r => r.type === 'saida');

    let dayWorkedMinutes = 0;
    let dayDelayMinutes = 0;
    let dayOT50 = 0;
    let dayOT100 = 0;
    let dayAbsence = 0;
    let dayNight = 0;

    // CÁLCULO DE HORAS TRABALHADAS
    if (entrada && pausa && retorno && saida) {
      // REGRA CORRETA: (pausa - entrada) + (saida - retorno)
      const entradaTime = parseISO(entrada.timestamp);
      const pausaTime = parseISO(pausa.timestamp);
      const retornoTime = parseISO(retorno.timestamp);
      const saidaTime = parseISO(saida.timestamp);

      const morning = differenceInMinutes(pausaTime, entradaTime);
      const afternoon = differenceInMinutes(saidaTime, retornoTime);
      
      dayWorkedMinutes = Math.max(0, morning) + Math.max(0, afternoon);

      // Calcular atraso (com tolerância CLT)
      const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number);
      const shiftStart = new Date(date + 'T12:00:00');
      shiftStart.setHours(shiftHour, shiftMin, 0, 0);
      
      const delayRaw = differenceInMinutes(entradaTime, shiftStart);
      
      // Aplicar tolerância da escala
      if (delayRaw > toleranceMinutes) {
        dayDelayMinutes = delayRaw;
      }

      // Calcular adicional noturno (22h às 5h)
      sortedRecords.forEach(record => {
        const hour = getHours(parseISO(record.timestamp));
        if (hour >= 22 || hour < 5) {
          dayNight += 60;
        }
      });

    } else if (entrada && saida) {
      // Apenas entrada e saída (sem pausa registrada)
      const entradaTime = parseISO(entrada.timestamp);
      const saidaTime = parseISO(saida.timestamp);
      
      let worked = differenceInMinutes(saidaTime, entradaTime);
      
      // Se trabalhou mais de 4h, deduzir intervalo
      if (worked > 240) {
        worked -= breakMinutes;
      }
      
      dayWorkedMinutes = Math.max(0, worked);
    }

    // CALCULAR HORA EXTRA E AUSÊNCIA
    if (!isWeekend) {
      // ATRASO NÃO ANULA HORA EXTRA
      // Se trabalhou mais que a jornada, tem hora extra independente de atraso
      if (dayWorkedMinutes > dailyWorkMinutes) {
        const extra = dayWorkedMinutes - dailyWorkMinutes;
        
        // HE 50% (primeiras 2 horas)
        dayOT50 = Math.min(extra, 120);
        
        // HE 100% (após 2 horas)
        if (extra > 120) {
          dayOT100 = extra - 120;
        }
      } else if (dayWorkedMinutes < dailyWorkMinutes && dayWorkedMinutes > 0) {
        // FALTA PARCIAL
        dayAbsence = dailyWorkMinutes - dayWorkedMinutes;
      } else if (dayWorkedMinutes === 0) {
        // AUSÊNCIA COMPLETA
        dayAbsence = dailyWorkMinutes;
      }
    } else if (isWeekend && dayWorkedMinutes > 0) {
      // Final de semana trabalhado = hora extra automática
      dayOT50 = Math.min(dayWorkedMinutes, 120);
      if (dayWorkedMinutes > 120) {
        dayOT100 = dayWorkedMinutes - 120;
      }
    }

    // Trabalho em domingo/feriado
    if ((isSunday || isHoliday) && dayWorkedMinutes > 0) {
      sundayHolidayMinutes += dayWorkedMinutes;
    }

    // DSR (descanso semanal remunerado)
    if (isWeekend && dayWorkedMinutes === 0) {
      dsrDays += 1;
    }

    // Totalizar
    totalWorkedMinutes += dayWorkedMinutes;
    totalDelayMinutes += dayDelayMinutes;
    overtime50Minutes += dayOT50;
    overtime100Minutes += dayOT100;
    absenceMinutes += dayAbsence;
    nightMinutes += dayNight;

    // Guardar dados do dia
    dailyData.push({
      date,
      workedMinutes: dayWorkedMinutes,
      delayMinutes: dayDelayMinutes,
      overtime50Minutes: dayOT50,
      overtime100Minutes: dayOT100,
      absenceMinutes: dayAbsence,
      nightMinutes: dayNight,
      isComplete: !!(entrada && pausa && retorno && saida),
    });
  });

  // Calcular TODAS as horas previstas de jornada (todos os dias úteis do período, trabalhados ou não)
  const allDates = Object.keys(recordsByDay).map(d => new Date(d + 'T12:00:00'));
  let expectedTotalMinutes = 0;
  
  if (allDates.length > 0) {
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    
    const current = new Date(minDate);
    while (current <= maxDate) {
      const dayOfWeek = getDay(current);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Contar TODOS os dias úteis do período (trabalhados ou não)
      if (!isWeekend && shiftWorkDays.includes(dayOfWeek)) {
        expectedTotalMinutes += dailyWorkMinutes;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // Cálculos consolidados
  const daysWorked = Object.keys(recordsByDay).length;
  const averageDailyMinutes = daysWorked > 0 ? totalWorkedMinutes / daysWorked : 0;
  const maxDailyMinutes = 600; // 10h (máximo legal CLT)
  const exceedsMaxJourney = averageDailyMinutes > maxDailyMinutes;

  return {
    // Minutos
    totalWorkedMinutes,
    totalDelayMinutes,
    overtime50Minutes,
    overtime100Minutes,
    nightMinutes,
    sundayHolidayMinutes,
    absenceMinutes,
    expectedMinutes: expectedTotalMinutes,
    averageDailyMinutes,
    
    // Formatado
    totalWorkedHours: formatMinutesToHours(totalWorkedMinutes),
    totalDelayHours: formatMinutesToHours(totalDelayMinutes),
    overtime50Hours: formatMinutesToHours(overtime50Minutes),
    overtime100Hours: formatMinutesToHours(overtime100Minutes),
    nightHours: formatMinutesToHours(nightMinutes),
    sundayHolidayHours: formatMinutesToHours(sundayHolidayMinutes),
    absenceHours: formatMinutesToHours(absenceMinutes),
    expectedHours: formatMinutesToHours(expectedTotalMinutes),
    averageDailyHours: formatMinutesToHours(averageDailyMinutes),
    
    // Outros
    dsrDays,
    dsrHours: dsrDays * 8,
    daysWorked,
    maxDailyMinutes,
    exceedsMaxJourney,
    
    // Dados diários
    dailyData,
  };
}

function calculateShiftMinutes(startTime, endTime, breakMinutes) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  
  return Math.max(0, endTotalMin - startTotalMin - breakMinutes);
}

function formatMinutesToHours(minutes) {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  return `${hours}h ${mins.toString().padStart(2, '0')}min`;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}