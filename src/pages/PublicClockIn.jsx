import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Camera, Clock, CheckCircle, Loader2, X, AlertCircle, RefreshCw, MapPin } from "lucide-react";
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

export default function PublicClockIn() {
  const [step, setStep] = useState("matricula"); // matricula, camera, mood, success
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [employee, setEmployee] = useState(null);
  const [shift, setShift] = useState(null);
  const [recordType, setRecordType] = useState("entrada");
  const [mood, setMood] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [location, setLocation] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  React.useEffect(() => {
    getLocation();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, []);

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

  const searchEmployee = async () => {
    if (!employeeNumber.trim()) {
      setError("Digite sua matrícula");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const employees = await base44.entities.Employee.filter({
        employee_number: employeeNumber.trim(),
        status: "active"
      });

      if (employees.length === 0) {
        setError("Matrícula não encontrada ou funcionário inativo");
        setLoading(false);
        return;
      }

      const emp = employees[0];
      setEmployee(emp);

      if (emp.shift_id) {
        const shifts = await base44.entities.Shift.filter({ id: emp.shift_id });
        if (shifts.length > 0) {
          setShift(shifts[0]);
        }
      }

      const records = await base44.entities.TimeRecord.filter(
        { employee_id: emp.id },
        '-timestamp',
        1
      );
      
      if (records.length > 0) {
        const lastRecord = records[0];
        if (lastRecord.type === 'entrada') setRecordType('pausa');
        else if (lastRecord.type === 'pausa') setRecordType('retorno');
        else if (lastRecord.type === 'retorno') setRecordType('saida');
        else setRecordType('entrada');
      }

      setStep("camera");
      setLoading(false);

    } catch (error) {
      setError("Erro ao buscar funcionário: " + error.message);
      setLoading(false);
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
      
      const records = await base44.entities.TimeRecord.filter({
        employee_id: employeeId,
        company_id: companyId
      });

      const dayRecords = records.filter(r => {
        const recordDate = format(startOfDay(new Date(r.timestamp)), 'yyyy-MM-dd');
        return recordDate === dateStr;
      });

      const entrada = dayRecords.find(r => r.type === 'entrada');
      const saida = dayRecords.find(r => r.type === 'saida');
      const pausa = dayRecords.find(r => r.type === 'pausa');
      const retorno = dayRecords.find(r => r.type === 'retorno');

      if (!entrada || !saida) return;

      const entradaTime = new Date(entrada.timestamp);
      const saidaTime = new Date(saida.timestamp);
      let workedMinutes = differenceInMinutes(saidaTime, entradaTime);

      if (pausa && retorno) {
        const pausaTime = new Date(pausa.timestamp);
        const retornoTime = new Date(retorno.timestamp);
        const breakMinutes = differenceInMinutes(retornoTime, pausaTime);
        workedMinutes -= breakMinutes;
      } else if (shift && shift.break_minutes) {
        workedMinutes -= shift.break_minutes;
      }

      const expectedMinutes = shift ? 
        (differenceInMinutes(
          parse(shift.end_time, 'HH:mm', new Date()),
          parse(shift.start_time, 'HH:mm', new Date())
        ) - (shift.break_minutes || 0)) : 480;

      const balanceMinutes = workedMinutes - expectedMinutes;
      const overtimeMinutes = balanceMinutes > 0 ? balanceMinutes : 0;
      const missingMinutes = balanceMinutes < 0 ? Math.abs(balanceMinutes) : 0;

      const existingBank = await base44.entities.HoursBank.filter({
        employee_id: employeeId,
        date: dateStr
      });

      if (existingBank.length > 0) {
        await base44.entities.HoursBank.update(existingBank[0].id, {
          worked_minutes: workedMinutes,
          expected_minutes: expectedMinutes,
          balance_minutes: balanceMinutes,
          overtime_minutes: overtimeMinutes,
          missing_minutes: missingMinutes
        });
      } else {
        await base44.entities.HoursBank.create({
          employee_id: employeeId,
          company_id: companyId,
          date: dateStr,
          worked_minutes: workedMinutes,
          expected_minutes: expectedMinutes,
          balance_minutes: balanceMinutes,
          overtime_minutes: overtimeMinutes,
          missing_minutes: missingMinutes
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar banco de horas:", error);
    }
  };

  const openCamera = async () => {
    try {
      setError(null);
      setShowCamera(true);
      setCameraReady(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
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
          setStep("mood");
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
    setStep("camera");
    openCamera();
  };

  const handleClockIn = async () => {
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

      setStep("success");
      setLoading(false);

      setTimeout(() => {
        resetForm();
      }, 5000);

    } catch (error) {
      setError("Erro ao registrar ponto: " + error.message);
      console.error(error);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("matricula");
    setEmployeeNumber("");
    setEmployee(null);
    setShift(null);
    setRecordType("entrada");
    setMood("");
    setCapturedPhoto(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center text-white space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-2xl border border-white/30">
              <Clock className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-2">
            {format(currentTime, 'HH:mm:ss')}
          </h1>
          <p className="text-lg opacity-90">
            {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-2xl font-semibold mt-4">Registro de Ponto</p>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-300">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step: Matrícula */}
        {step === "matricula" && (
          <Card className="shadow-2xl">
            <CardHeader>
              <CardTitle className="text-center text-2xl">Digite sua Matrícula</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-base">Número de Matrícula</Label>
                <Input
                  type="text"
                  placeholder="Ex: 12345"
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchEmployee()}
                  className="h-14 text-xl text-center"
                  autoFocus
                />
              </div>
              
              {location && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                  <MapPin className="w-4 h-4" />
                  <span>Localização capturada</span>
                </div>
              )}

              <Button
                onClick={searchEmployee}
                className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  "Continuar"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Camera */}
        {step === "camera" && employee && (
          <Card className="shadow-2xl">
            <CardHeader>
              <CardTitle className="text-center">
                Olá, {employee.full_name}!
              </CardTitle>
              <p className="text-center text-sm text-gray-500">
                Tipo de registro: <Badge>{recordType}</Badge>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showCamera && !capturedPhoto && (
                <Button
                  onClick={openCamera}
                  className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
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
                        <Badge className="bg-green-500 text-white">● Pronta</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => {
                        cleanup();
                        setShowCamera(false);
                        setStep("matricula");
                        resetForm();
                      }}
                      variant="outline"
                      size="lg"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      onClick={captureImage}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                      size="lg"
                      disabled={!cameraReady}
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Capturar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Mood */}
        {step === "mood" && capturedPhoto && (
          <Card className="shadow-2xl">
            <CardHeader>
              <CardTitle className="text-center">Como você está se sentindo?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <img
                  src={URL.createObjectURL(capturedPhoto)}
                  alt="Foto"
                  className="w-full h-full object-cover"
                />
              </div>

              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="h-14 text-lg">
                  <SelectValue placeholder="Selecione seu humor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muito_feliz" className="text-lg py-4">
                    <span className="text-3xl mr-2">😄</span> Muito Feliz
                  </SelectItem>
                  <SelectItem value="feliz" className="text-lg py-4">
                    <span className="text-3xl mr-2">😊</span> Feliz
                  </SelectItem>
                  <SelectItem value="neutro" className="text-lg py-4">
                    <span className="text-3xl mr-2">😐</span> Neutro
                  </SelectItem>
                  <SelectItem value="triste" className="text-lg py-4">
                    <span className="text-3xl mr-2">😔</span> Triste
                  </SelectItem>
                  <SelectItem value="muito_triste" className="text-lg py-4">
                    <span className="text-3xl mr-2">😢</span> Muito Triste
                  </SelectItem>
                </SelectContent>
              </Select>
              
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
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
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
                      Registrar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <Card className="shadow-2xl bg-green-50 border-green-300">
            <CardContent className="py-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-green-800 mb-2">
                  Ponto Registrado!
                </h2>
                <p className="text-lg text-green-700">
                  {employee?.full_name}
                </p>
                <p className="text-gray-600 mt-2">
                  Tipo: <Badge className="bg-green-600">{recordType}</Badge>
                </p>
              </div>
              <Button
                onClick={resetForm}
                variant="outline"
                className="mt-4"
              >
                Registrar Outro Ponto
              </Button>
            </CardContent>
          </Card>
        )}
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}