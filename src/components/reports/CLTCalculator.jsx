import { parseISO, differenceInMinutes, getDay, getHours, getWeek, getYear, getISOWeek } from "date-fns";

/**
 * CÁLCULO CLT COMPLETO CONFORME LEGISLAÇÃO BRASILEIRA
 * CLT Art. 58, 59, 67, 71, 73 | Lei 605/49 | CF Art. 7º XIII, XVI
 */
export function calculateCLTHours(timeRecords, shift, holidays = [], monthlySalary = 0) {
  const recordsByDay = {};
  
  timeRecords.forEach(record => {
    const date = record.timestamp.substring(0, 10);
    if (!recordsByDay[date]) {
      recordsByDay[date] = [];
    }
    recordsByDay[date].push(record);
  });

  const shiftStartTime = shift?.start_time || '08:00';
  const shiftEndTime = shift?.end_time || '17:00';
  const breakMinutes = shift?.break_minutes || 60;
  const toleranceMinutes = shift?.tolerance_minutes || 5;
  const dailyWorkMinutes = shift ? calculateShiftMinutes(shiftStartTime, shiftEndTime, breakMinutes) : 480; // 8h
  
  const workDaysMap = {
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
    'friday': 5, 'saturday': 6, 'sunday': 0
  };
  const shiftWorkDays = shift?.work_days?.map(d => workDaysMap[d]) || [1, 2, 3, 4, 5];

  // Totalizadores (todos em minutos para evitar arredondamento)
  let totalWorkedMinutes = 0;
  let totalDelayMinutes = 0;
  let overtime50Minutes = 0;
  let overtime100Minutes = 0;
  let nightMinutes = 0;
  let sundayHolidayMinutes = 0;
  let absenceMinutes = 0;
  let dsrReflexMinutes = 0;
  let intervalPenaltyMinutes = 0;
  let weeklyOvertimeMinutes = 0;

  // Agrupar por semana (ISO Week)
  const weekData = {};
  const dailyData = [];

  Object.entries(recordsByDay).forEach(([date, records]) => {
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = getDay(dateObj);
    const weekKey = `${getYear(dateObj)}-W${String(getISOWeek(dateObj)).padStart(2, '0')}`;
    const isSunday = dayOfWeek === 0;
    const isHoliday = holidays.includes(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkDay = shiftWorkDays.includes(dayOfWeek) && !isWeekend;
    
    if (!weekData[weekKey]) {
      weekData[weekKey] = {
        heMinutes: 0,
        workDaysCount: 0,
        workedDays: 0,
        sundaysCount: 0,
        hasFault: false,
        totalWorkedMinutes: 0
      };
    }

    const sortedRecords = records.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

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
    let intervalPenalty = 0;

    // ============ CÁLCULO DE HORAS TRABALHADAS ============
    if (entrada && pausa && retorno && saida) {
      const entradaTime = parseISO(entrada.timestamp);
      const pausaTime = parseISO(pausa.timestamp);
      const retornoTime = parseISO(retorno.timestamp);
      const saidaTime = parseISO(saida.timestamp);

      const morning = differenceInMinutes(pausaTime, entradaTime);
      const afternoon = differenceInMinutes(saidaTime, retornoTime);
      const intervalMin = differenceInMinutes(retornoTime, pausaTime);
      
      dayWorkedMinutes = Math.max(0, morning) + Math.max(0, afternoon);

      // CLT Art. 71 §4º: Se trabalhou > 6h e intervalo < 1h, pagar 1h inteira como HE 50%
      if (dayWorkedMinutes > 360 && intervalMin < 60) {
        intervalPenalty = 60;
        intervalPenaltyMinutes += 60;
        dayOT50 += 60;
      }

      // Atraso
      const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number);
      const shiftStart = new Date(date + 'T12:00:00');
      shiftStart.setHours(shiftHour, shiftMin, 0, 0);
      
      const delayRaw = differenceInMinutes(entradaTime, shiftStart);
      if (delayRaw > toleranceMinutes) {
        dayDelayMinutes = delayRaw;
      }

      // Adicional noturno (22h às 5h) - CLT Art. 73
      sortedRecords.forEach(record => {
        const recordTime = parseISO(record.timestamp);
        const hour = getHours(recordTime);
        if (hour >= 22 || hour < 5) {
          // Hora noturna reduzida: 52min30s = 1h noturna
          dayNight += 52.5; // minutos
        }
      });

    } else if (entrada && saida) {
      const entradaTime = parseISO(entrada.timestamp);
      const saidaTime = parseISO(saida.timestamp);
      
      let worked = differenceInMinutes(saidaTime, entradaTime);
      
      // CLT Art. 71: Se > 6h sem pausa, gerar penalidade de 1h HE 50%
      if (worked > 360) {
        intervalPenalty = 60;
        intervalPenaltyMinutes += 60;
        dayOT50 += 60;
        worked -= breakMinutes;
      } else if (worked > 240) {
        worked -= breakMinutes;
      }
      
      dayWorkedMinutes = Math.max(0, worked);
    }

    // ============ HORA EXTRA E FALTAS ============
    if (isSunday || isHoliday) {
      // Domingo/feriado = 100% adicional (CF Art. 7º XVI + Lei 605/49)
      if (dayWorkedMinutes > 0) {
        dayOT100 += dayWorkedMinutes;
        sundayHolidayMinutes += dayWorkedMinutes;
        weekData[weekKey].heMinutes += dayWorkedMinutes;
      }
      if (isSunday) {
        weekData[weekKey].sundaysCount++;
      }
    } else if (isWorkDay) {
      // Dia útil
      weekData[weekKey].workDaysCount++;
      
      if (dayWorkedMinutes === 0) {
        // FALTA INJUSTIFICADA - CLT Art. 58
        dayAbsence = dailyWorkMinutes;
        weekData[weekKey].hasFault = true; // Perde DSR da semana (Lei 605/49)
      } else if (dayWorkedMinutes < dailyWorkMinutes) {
        // FALTA PARCIAL
        dayAbsence = dailyWorkMinutes - dayWorkedMinutes;
      } else if (dayWorkedMinutes > dailyWorkMinutes) {
        // HORA EXTRA DIÁRIA (CLT Art. 59: max 2h/dia)
        const extra = Math.min(dayWorkedMinutes - dailyWorkMinutes, 120); // Limitar a 2h
        
        // HE 50% nas primeiras 2h (CF Art. 7º XVI)
        if (extra <= 120) {
          dayOT50 += extra;
        }
        
        weekData[weekKey].heMinutes += extra;
      }
      
      if (dayWorkedMinutes > 0) {
        weekData[weekKey].workedDays++;
      }
      weekData[weekKey].totalWorkedMinutes += dayWorkedMinutes;
    }

    // Totalizar
    totalWorkedMinutes += dayWorkedMinutes;
    totalDelayMinutes += dayDelayMinutes;
    overtime50Minutes += dayOT50;
    overtime100Minutes += dayOT100;
    absenceMinutes += dayAbsence;
    nightMinutes += dayNight;

    dailyData.push({
      date,
      workedMinutes: dayWorkedMinutes,
      delayMinutes: dayDelayMinutes,
      overtime50Minutes: dayOT50,
      overtime100Minutes: dayOT100,
      absenceMinutes: dayAbsence,
      nightMinutes: dayNight,
      intervalPenalty,
      isComplete: !!(entrada && pausa && retorno && saida),
    });
  });

  // ============ CÁLCULO SEMANAL DE HE (CLT Art. 7º XIII: 44h/semana) ============
  Object.values(weekData).forEach(week => {
    const weeklyLimit = 44 * 60; // 44h em minutos
    if (week.totalWorkedMinutes > weeklyLimit) {
      const weeklyExtra = week.totalWorkedMinutes - weeklyLimit;
      // Se HE semanal > HE diária, usar a mais benéfica ao trabalhador
      if (weeklyExtra > week.heMinutes) {
        weeklyOvertimeMinutes += (weeklyExtra - week.heMinutes);
        overtime50Minutes += (weeklyExtra - week.heMinutes);
      }
    }
  });

  // ============ CALCULAR DSR (reflexo de HE sobre domingo/feriado) - Lei 605/49 ============
  Object.values(weekData).forEach(week => {
    if (!week.hasFault && week.workedDays > 0 && week.sundaysCount > 0 && week.heMinutes > 0) {
      // DSR = (HE da semana ÷ dias úteis trabalhados) × domingos/feriados
      const dsrWeek = Math.round((week.heMinutes / week.workedDays) * week.sundaysCount);
      dsrReflexMinutes += dsrWeek;
    }
  });

  // ============ JORNADA PREVISTA (todos os dias úteis do período) ============
  const allDates = Object.keys(recordsByDay).map(d => new Date(d + 'T12:00:00'));
  let expectedTotalMinutes = 0;
  
  if (allDates.length > 0) {
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    
    const current = new Date(minDate);
    while (current <= maxDate) {
      const dayOfWeek = getDay(current);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (!isWeekend && shiftWorkDays.includes(dayOfWeek)) {
        expectedTotalMinutes += dailyWorkMinutes;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // ============ CÁLCULO DE VALORES (CLT: valorHora = salárioMensal ÷ 220) ============
  const hourlyRate = monthlySalary > 0 ? monthlySalary / 220 : 0;
  const he50Value = (overtime50Minutes / 60) * hourlyRate * 1.5;
  const he100Value = (overtime100Minutes / 60) * hourlyRate * 2.0;
  const nightValue = (nightMinutes / 60) * hourlyRate * 0.2; // 20% adicional noturno
  const dsrValue = (dsrReflexMinutes / 60) * hourlyRate * 1.5; // DSR sobre HE = HE 50%
  const sundayValue = (sundayHolidayMinutes / 60) * hourlyRate * 2.0;

  const daysWorked = Object.keys(recordsByDay).length;
  const averageDailyMinutes = daysWorked > 0 ? totalWorkedMinutes / daysWorked : 0;
  const maxDailyMinutes = 600; // 10h (CLT Art. 59: 2h extras + 8h normais)
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
    dsrReflexMinutes,
    intervalPenaltyMinutes,
    weeklyOvertimeMinutes,
    
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
    dsrReflexHours: formatMinutesToHours(dsrReflexMinutes),
    intervalPenaltyHours: formatMinutesToHours(intervalPenaltyMinutes),
    
    // Valores monetários
    he50Value,
    he100Value,
    nightValue,
    dsrValue,
    sundayValue,
    totalAdditionalsValue: he50Value + he100Value + nightValue + dsrValue + sundayValue,
    
    // Outros
    dsrDays: Math.round(dsrReflexMinutes / 480),
    dsrHours: Math.round(dsrReflexMinutes / 60),
    daysWorked,
    maxDailyMinutes,
    exceedsMaxJourney,
    hourlyRate,
    
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
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${hours}h ${mins.toString().padStart(2, '0')}min`;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}