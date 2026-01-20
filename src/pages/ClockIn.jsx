import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, MapPin, Clock, CheckCircle, Loader2, X, AlertCircle, RefreshCw } from "lucide-react";
import { format, parse, differenceInMinutes, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function ClockIn() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [shift, setShift] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [recordType, setRecordType] = useState("entrada");
  const [mood, setMood] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [location, setLocation] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRecord, setLastRecord] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadUserData();
    getLocation();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      if (!userData.employee_id) {
        const employees = await base44.entities.Employee.filter({ 
          user_email: userData.email 
        });
        
        if (employees.length > 0) {
          const emp = employees[0];
          setEmployee(emp);
          await base44.auth.updateMe({ employee_id: emp.id });
          await loadShift(emp.shift_id);
          await loadLastRecord(emp.id);
        } else {
          setNeedsSetup(true);
          return;
        }
      } else {
        const employeeData = await base44.entities.Employee.filter({ 
          id: userData.employee_id 
        });
        if (employeeData.length > 0) {
          const emp = employeeData[0];
          setEmployee(emp);
          await loadShift(emp.shift_id);
          await loadLastRecord(emp.id);
        } else {
          setNeedsSetup(true);
          return;
        }
      }
    } catch (error) {
      setError("Erro ao carregar dados do usuário");
      console.error(error);
    }
  };

  const loadShift = async (shiftId) => {
    if (!shiftId) return;
    try {
      const shifts = await base44.entities.Shift.filter({ id: shiftId });
      if (shifts.length > 0) {
        setShift(shifts[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar escala:", error);
    }
  };

  const loadLastRecord = async (empId) => {
    try {
      const records = await base44.entities.TimeRecord.filter(
        { employee_id: empId },
        '-timestamp',
        1
      );
      if (records.length > 0) {
        setLastRecord(records[0]);
        if (records[0].type === 'entrada') setRecordType('pausa');
        else if (records[0].type === 'pausa') setRecordType('retorno');
        else if (records[0].type === 'retorno') setRecordType('saida');
        else setRecordType('entrada');
      }
    } catch (error) {
      console.error("Erro ao carregar último registro:", error);
    }
  };

  const calculateStatus = (timestamp, type) => {
    if (!shift) {
      return { status: 'pontual', delayMinutes: 0 };
    }

    const recordTime = new Date(timestamp);
    const toleranceMinutes = shift.tolerance_minutes || 15;

    if (type === 'entrada') {
      const [startHour, startMinute] = shift.start_time.split(':').map(Number);
      const expectedTime = new Date(recordTime);
      expectedTime.setHours(startHour, startMinute, 0, 0);
      const diffMinutes = differenceInMinutes(recordTime, expectedTime);

      if (diffMinutes >= -toleranceMinutes && diffMinutes <= toleranceMinutes) {
        return { status: 'pontual', delayMinutes: 0 };
      } else if (diffMinutes > toleranceMinutes) {
        return { status: 'atrasado', delayMinutes: diffMinutes };
      } else {
        return { status: 'adiantado', delayMinutes: 0 };
      }
    } else if (type === 'saida') {
      const [endHour, endMinute] = shift.end_time.split(':').map(Number);
      const expectedTime = new Date(recordTime);
      expectedTime.setHours(endHour, endMinute, 0, 0);
      const diffMinutes = differenceInMinutes(recordTime, expectedTime);

      if (diffMinutes >= -toleranceMinutes && diffMinutes <= toleranceMinutes) {
        return { status: 'pontual', delayMinutes: 0 };
      } else if (diffMinutes > toleranceMinutes) {
        return { status: 'hora_extra', delayMinutes: 0 };
      } else {
        return { status: 'adiantado', delayMinutes: Math.abs(diffMinutes) };
      }
    }

    return { status: 'pontual', delayMinutes: 0 };
  };

  const updateHoursBank = async (employeeId, companyId, date) => {
    try {
      const dateStr = format(startOfDay(new Date(date)), 'yyyy-MM-dd');
      
      // Buscar todos os registros do dia
      const records = await base44.entities.TimeRecord.filter({
        employee_id: employeeId,
        company_id: companyId
      });

      const dayRecords = records.filter(r => {
        const recordDateStr = format(new Date(r.timestamp), 'yyyy-MM-dd');
        return recordDateStr === dateStr;
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Encontrar registros de entrada e saída (podem ter múltiplos)
      const entradas = dayRecords.filter(r => r.type === 'entrada');
      const saidas = dayRecords.filter(r => r.type === 'saida');

      // Só calcular se tiver pelo menos uma entrada E uma saída
      if (entradas.length === 0 || saidas.length === 0) {
        console.log(`Dia ${dateStr} incompleto: ${entradas.length} entradas, ${saidas.length} saídas`);
        return;
      }

      // Calcular total de minutos trabalhados
      let totalWorkedMinutes = 0;
      
      // Pegar primeira entrada e última saída
      const primeiraEntrada = entradas[0];
      const ultimaSaida = saidas[saidas.length - 1];
      
      const entradaTime = new Date(primeiraEntrada.timestamp);
      const saidaTime = new Date(ultimaSaida.timestamp);
      
      // Total bruto (entrada até saída)
      let grossMinutes = differenceInMinutes(saidaTime, entradaTime);

      // Subtrair pausas (tempo entre "pausa" e "retorno")
      const pausas = dayRecords.filter(r => r.type === 'pausa');
      const retornos = dayRecords.filter(r => r.type === 'retorno');
      
      let totalBreakMinutes = 0;
      
      // Calcular cada pausa que tem retorno correspondente
      for (let i = 0; i < Math.min(pausas.length, retornos.length); i++) {
        const pausaTime = new Date(pausas[i].timestamp);
        const retornoTime = new Date(retornos[i].timestamp);
        const breakDuration = differenceInMinutes(retornoTime, pausaTime);
        if (breakDuration > 0) {
          totalBreakMinutes += breakDuration;
        }
      }

      // Se não tem registros de pausa, usar pausa padrão da escala
      if (totalBreakMinutes === 0 && shift && shift.break_minutes) {
        totalBreakMinutes = shift.break_minutes;
      }

      // Minutos efetivamente trabalhados
      totalWorkedMinutes = grossMinutes - totalBreakMinutes;

      // Calcular minutos esperados da escala
      const expectedMinutes = shift ? 
        (differenceInMinutes(
          parse(shift.end_time, 'HH:mm', new Date()),
          parse(shift.start_time, 'HH:mm', new Date())
        ) - (shift.break_minutes || 0)) : 480; // Default: 8h

      // Saldo = trabalhado - esperado
      const balanceMinutes = totalWorkedMinutes - expectedMinutes;
      const overtimeMinutes = balanceMinutes > 0 ? balanceMinutes : 0;
      const missingMinutes = balanceMinutes < 0 ? Math.abs(balanceMinutes) : 0;

      // Verificar se já existe registro para este dia
      const existingBank = await base44.entities.HoursBank.filter({
        employee_id: employeeId,
        date: dateStr
      });

      const bankData = {
        worked_minutes: Math.max(0, totalWorkedMinutes),
        expected_minutes: expectedMinutes,
        balance_minutes: balanceMinutes,
        overtime_minutes: overtimeMinutes,
        missing_minutes: missingMinutes,
        notes: `${entradas.length} entrada(s), ${saidas.length} saída(s), ${totalBreakMinutes}min de pausa`
      };

      if (existingBank.length > 0) {
        await base44.entities.HoursBank.update(existingBank[0].id, bankData);
      } else {
        await base44.entities.HoursBank.create({
          employee_id: employeeId,
          company_id: companyId,
          date: dateStr,
          ...bankData
        });
      }

      console.log(`Banco de horas atualizado para ${dateStr}:`, bankData);
    } catch (error) {
      console.error("Erro ao atualizar banco de horas:", error);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
        }
      );
    }
  };

  const openCamera = async () => {
    try {
      setError(null);
      setShowCamera(true);
      setCameraReady(false);
      
      const constraints = { 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setCameraReady(true);
          }).catch(err => {
            console.error("Erro ao iniciar vídeo:", err);
            setError("Erro ao iniciar câmera");
          });
        };
      }
      
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setError("Erro ao acessar câmera. Verifique as permissões.");
      setShowCamera(false);
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    
    if (!video || !cameraReady || video.readyState < 2) {
      setError("⏳ Aguarde a câmera carregar completamente...");
      return;
    }

    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        setError("Erro ao preparar captura");
        return;
      }

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext('2d');
      
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      
      canvas.toBlob((blob) => {
        if (blob && blob.size > 1000) {
          setCapturedPhoto(blob);
          cleanup();
          setShowCamera(false);
          setCameraReady(false);
        } else {
          setError("Erro ao capturar. Tente novamente.");
        }
      }, 'image/jpeg', 0.95);
      
    } catch (err) {
      console.error("Erro ao capturar:", err);
      setError("Erro ao capturar imagem. Tente novamente.");
    }
  };

  const cleanup = () => {
    setCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setMood("");
    openCamera();
  };

  const handleClockIn = async () => {
    if (!employee) {
      setError("Cadastro não encontrado");
      return;
    }

    if (!capturedPhoto) {
      setError("Tire uma foto antes de registrar");
      return;
    }

    if (!mood) {
      setError("Selecione como você está se sentindo");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const photoFile = new File([capturedPhoto], `ponto-${Date.now()}.jpg`, { 
        type: 'image/jpeg' 
      });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ 
        file: photoFile 
      });

      const timestamp = new Date().toISOString();
      const { status, delayMinutes } = calculateStatus(timestamp, recordType);

      await base44.entities.TimeRecord.create({
        employee_id: employee.id,
        company_id: employee.company_id,
        timestamp: timestamp,
        type: recordType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        photo_url: file_url,
        status: status,
        delay_minutes: delayMinutes,
        verified: true,
        mood: mood
      });

      if (recordType === 'saida') {
        await updateHoursBank(employee.id, employee.company_id, timestamp);
      }

      setSuccess(true);
      setCapturedPhoto(null);
      setMood("");
      
      setTimeout(() => {
        setSuccess(false);
        loadUserData();
      }, 3000);

    } catch (error) {
      setError("Erro ao registrar ponto: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getMoodEmoji = (moodValue) => {
    const moods = {
      muito_feliz: "😄",
      feliz: "😊",
      neutro: "😐",
      triste: "😔",
      muito_triste: "😢"
    };
    return moods[moodValue] || "";
  };

  const getMoodLabel = (moodValue) => {
    const labels = {
      muito_feliz: "Muito Feliz",
      feliz: "Feliz",
      neutro: "Neutro",
      triste: "Triste",
      muito_triste: "Muito Triste"
    };
    return labels[moodValue] || "";
  };

  if (needsSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="w-6 h-6" />
                Cadastro Pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <p className="font-semibold mb-2">Você ainda não foi cadastrado como funcionário.</p>
                  <p className="mb-2">Entre em contato com o administrador para:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Criar seu cadastro de funcionário</li>
                    <li>Vincular seu e-mail ({user?.email}) ao cadastro</li>
                    <li>Definir seu cargo, setor e escala de trabalho</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-gradient-to-br from-purple-600 to-blue-600 text-white border-none shadow-2xl">
          <CardContent className="p-8 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-2">
              {format(currentTime, 'HH:mm:ss')}
            </h1>
            <p className="text-lg opacity-90">
              {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            {employee && (
              <div className="mt-4">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {employee.full_name}
                </Badge>
                {shift && (
                  <p className="text-sm mt-2 opacity-80">
                    Horário: {shift.start_time} às {shift.end_time}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {success && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              ✅ Ponto registrado com sucesso!
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Registrar Ponto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Registro</label>
              <Select value={recordType} onValueChange={setRecordType} disabled={loading || showCamera}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">🟢 Entrada</SelectItem>
                  <SelectItem value="saida">🔴 Saída</SelectItem>
                  <SelectItem value="pausa">⏸️ Pausa / Almoço</SelectItem>
                  <SelectItem value="retorno">▶️ Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>📍 Localização capturada</span>
              </div>
            )}

            {!showCamera && !capturedPhoto && (
              <Button
                onClick={openCamera}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
                disabled={loading}
              >
                <Camera className="w-5 h-5 mr-2" />
                📸 Abrir Câmera
              </Button>
            )}

            {showCamera && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center text-white">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                        <p className="text-lg font-semibold">Preparando câmera...</p>
                      </div>
                    </div>
                  )}
                  
                  {cameraReady && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-green-500 text-white">
                        ● Pronta
                      </Badge>
                    </div>
                  )}
                </div>
                
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    📸 Posicione-se na câmera e clique em "Capturar Foto"
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      cleanup();
                      setShowCamera(false);
                    }}
                    variant="outline"
                    size="lg"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={captureImage}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    size="lg"
                    disabled={!cameraReady}
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    📸 Capturar Foto
                  </Button>
                </div>
              </div>
            )}

            {capturedPhoto && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                  <img
                    src={URL.createObjectURL(capturedPhoto)}
                    alt="Foto capturada"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    😊 Como você está se sentindo hoje?
                  </Label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Selecione seu humor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="muito_feliz" className="text-base py-3">
                        <span className="text-2xl mr-2">😄</span> Muito Feliz
                      </SelectItem>
                      <SelectItem value="feliz" className="text-base py-3">
                        <span className="text-2xl mr-2">😊</span> Feliz
                      </SelectItem>
                      <SelectItem value="neutro" className="text-base py-3">
                        <span className="text-2xl mr-2">😐</span> Neutro
                      </SelectItem>
                      <SelectItem value="triste" className="text-base py-3">
                        <span className="text-2xl mr-2">😔</span> Triste
                      </SelectItem>
                      <SelectItem value="muito_triste" className="text-base py-3">
                        <span className="text-2xl mr-2">😢</span> Muito Triste
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={retakePhoto}
                    variant="outline"
                    size="lg"
                    disabled={loading}
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Tirar Novamente
                  </Button>
                  <Button
                    onClick={handleClockIn}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                    size="lg"
                    disabled={loading || !mood}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        ✅ Registrar Ponto
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {lastRecord && !success && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  📋 Último Registro
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {lastRecord.type === 'entrada' ? '🟢' : lastRecord.type === 'saida' ? '🔴' : lastRecord.type === 'pausa' ? '⏸️' : '▶️'} {lastRecord.type}
                    </Badge>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(lastRecord.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                    {lastRecord.mood && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {getMoodEmoji(lastRecord.mood)} {getMoodLabel(lastRecord.mood)}
                      </p>
                    )}
                  </div>
                  <Badge className={
                    lastRecord.status === 'pontual' ? 'bg-green-500' :
                    lastRecord.status === 'atrasado' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }>
                    {lastRecord.status === 'pontual' ? '✓ Pontual' : 
                     lastRecord.status === 'atrasado' ? `Atraso ${lastRecord.delay_minutes}min` : 
                     lastRecord.status}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}