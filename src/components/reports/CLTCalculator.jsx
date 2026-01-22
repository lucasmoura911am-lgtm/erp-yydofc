import { parseISO, differenceInMinutes, getDay, getHours } from "date-fns";

/**
 * Calcula horas CLT para um período mensal de registros de ponto
 * Inclui: HE 50%, HE 100%, Adicional Noturno, DSR, Feriado/Domingo
 * IMPORTANTE: Processa todos os registros, incluindo manuais e automáticos
 */
export function calculateCLTHours(timeRecords, shift, holidays = []) {
  // Agrupar todos os registros por dia (incluindo manuais)
  const recordsByDay = {};
  
  timeRecords.forEach(record => {
    const date = record.timestamp.substring(0, 10); // YYYY-MM-DD
    if (!recordsByDay[date]) {
      recordsByDay[date] = [];
    }
    recordsByDay[date].push(record);
  });

  // Horários padrão da escala
  const shiftStartHour = shift?.start_time ? parseInt(shift.start_time.split(':')[0]) : 8;
  const shiftEndHour = shift?.end_time ? parseInt(shift.end_time.split(':')[0]) : 17;
  const breakMinutes = shift?.break_minutes || 60;
  const dailyWorkMinutes = shift ? calculateShiftMinutes(shift.start_time, shift.end_time, breakMinutes) : 480; // 8h padrão

  let totalWorkedMinutes = 0;
  let overtime50Minutes = 0; // HE 50% (primeiras 2h extras)
  let overtime100Minutes = 0; // HE 100% (após 2h extras)
  let nightMinutes = 0; // Adicional noturno (22h às 5h)
  let sundayHolidayMinutes = 0; // Domingo/Feriado
  let dsrDays = 0; // Dias de descanso semanal remunerado

  Object.entries(recordsByDay).forEach(([date, records]) => {
    const dayOfWeek = getDay(new Date(date)); // 0 = Domingo, 6 = Sábado
    const isSunday = dayOfWeek === 0;
    const isHoliday = holidays.includes(date);
    
    // Ordenar registros por horário
    const sortedRecords = records.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calcular horas trabalhadas no dia
    let dayWorkedMinutes = 0;
    let dayNightMinutes = 0;
    let entrada = null;
    let saida = null;
    let pausaStart = null;
    let pausaEnd = null;

    sortedRecords.forEach(record => {
      const timestamp = parseISO(record.timestamp);
      const hour = getHours(timestamp);

      if (record.type === 'entrada') {
        entrada = timestamp;
      } else if (record.type === 'pausa' && entrada) {
        pausaStart = timestamp;
      } else if (record.type === 'retorno' && pausaStart) {
        pausaEnd = timestamp;
      } else if (record.type === 'saida' && entrada) {
        saida = timestamp;
      }

      // Contar minutos noturnos (22h às 5h)
      if (hour >= 22 || hour < 5) {
        dayNightMinutes += 60; // Simplificado: cada hora noturna
      }
    });

    // Calcular tempo trabalhado
    if (entrada && saida) {
      let worked = differenceInMinutes(saida, entrada);
      
      // Descontar pausa
      if (pausaStart && pausaEnd) {
        worked -= differenceInMinutes(pausaEnd, pausaStart);
      } else if (worked > 240) {
        // Se trabalhou mais de 4h, deduzir intervalo padrão
        worked -= breakMinutes;
      }

      dayWorkedMinutes = Math.max(0, worked);
      totalWorkedMinutes += dayWorkedMinutes;

      // Trabalho em domingo ou feriado (100% extra)
      if (isSunday || isHoliday) {
        sundayHolidayMinutes += dayWorkedMinutes;
      } else {
        // Calcular horas extras (dias normais)
        const extraMinutes = Math.max(0, dayWorkedMinutes - dailyWorkMinutes);
        
        if (extraMinutes > 0) {
          // Primeiras 2 horas = 50%
          const he50 = Math.min(extraMinutes, 120);
          overtime50Minutes += he50;
          
          // Após 2 horas = 100%
          if (extraMinutes > 120) {
            overtime100Minutes += (extraMinutes - 120);
          }
        }
      }

      // Adicional noturno
      nightMinutes += dayNightMinutes;
    }

    // Contar DSR (sábados/domingos que não trabalhou)
    if ((dayOfWeek === 0 || dayOfWeek === 6) && dayWorkedMinutes === 0) {
      dsrDays += 1;
    }
  });

  // Calcular jornada máxima (10h/dia é o máximo legal)
  const maxDailyMinutes = 600; // 10 horas
  const daysWorked = Object.keys(recordsByDay).length;
  const averageDailyMinutes = daysWorked > 0 ? totalWorkedMinutes / daysWorked : 0;
  const exceedsMaxJourney = averageDailyMinutes > maxDailyMinutes;

  return {
    totalWorkedMinutes,
    totalWorkedHours: formatMinutesToHours(totalWorkedMinutes),
    overtime50Minutes,
    overtime50Hours: formatMinutesToHours(overtime50Minutes),
    overtime100Minutes,
    overtime100Hours: formatMinutesToHours(overtime100Minutes),
    nightMinutes,
    nightHours: formatMinutesToHours(nightMinutes),
    sundayHolidayMinutes,
    sundayHolidayHours: formatMinutesToHours(sundayHolidayMinutes),
    dsrDays,
    dsrHours: dsrDays * 8, // Cada DSR = 8h
    exceedsMaxJourney,
    averageDailyMinutes,
    averageDailyHours: formatMinutesToHours(averageDailyMinutes),
    maxDailyMinutes,
    daysWorked,
    expectedMinutes: dailyWorkMinutes * daysWorked,
    expectedHours: formatMinutesToHours(dailyWorkMinutes * daysWorked),
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