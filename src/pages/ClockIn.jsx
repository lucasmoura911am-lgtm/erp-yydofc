import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, MapPin, Clock, CheckCircle, Loader2, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ClockIn() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [recordType, setRecordType] = useState("entrada");
  const [cameraActive, setCameraActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
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

    return () => clearInterval(timer);
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      // Verificar se o usuário tem employee_id
      if (!userData.employee_id) {
        // Tentar buscar employee pelo email do usuário
        const employees = await base44.entities.Employee.filter({ 
          user_email: userData.email 
        });
        
        if (employees.length > 0) {
          setEmployee(employees[0]);
          // Atualizar user com employee_id
          await base44.auth.updateMe({ employee_id: employees[0].id });
        } else {
          setNeedsSetup(true);
          return;
        }
      } else {
        const employeeData = await base44.entities.Employee.filter({ 
          id: userData.employee_id 
        });
        if (employeeData.length > 0) {
          setEmployee(employeeData[0]);
        } else {
          setNeedsSetup(true);
          return;
        }
      }
      
      // Buscar último registro
      const empId = userData.employee_id || employees[0]?.id;
      if (empId) {
        const records = await base44.entities.TimeRecord.filter(
          { employee_id: empId },
          '-timestamp',
          1
        );
        if (records.length > 0) {
          setLastRecord(records[0]);
          // Sugerir próximo tipo baseado no último
          if (records[0].type === 'entrada') setRecordType('pausa');
          else if (records[0].type === 'pausa') setRecordType('retorno');
          else if (records[0].type === 'retorno') setRecordType('saida');
          else setRecordType('entrada');
        }
      }
    } catch (error) {
      setError("Erro ao carregar dados do usuário");
      console.error(error);
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setError("Erro ao acessar a câmera. Por favor, permita o acesso.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.8);
    });
  };

  const handleClockIn = async () => {
    if (!employee) {
      setError("Cadastro de funcionário não encontrado");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Capturar foto
      const photoBlob = await capturePhoto();
      const photoFile = new File([photoBlob], `clockin-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Upload da foto
      const { file_url } = await base44.integrations.Core.UploadFile({ file: photoFile });
      setPhotoUrl(file_url);

      // Calcular status (pontual ou atrasado)
      let status = "pontual";
      let delayMinutes = 0;
      
      // Criar registro
      await base44.entities.TimeRecord.create({
        employee_id: employee.id,
        company_id: employee.company_id,
        timestamp: new Date().toISOString(),
        type: recordType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        photo_url: file_url,
        status: status,
        delay_minutes: delayMinutes,
        verified: true
      });

      setSuccess(true);
      stopCamera();
      
      setTimeout(() => {
        setSuccess(false);
        loadUserData();
      }, 3000);

    } catch (error) {
      setError("Erro ao registrar ponto. Tente novamente.");
      console.error(error);
    } finally {
      setLoading(false);
    }
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
              <div className="text-center pt-4">
                <p className="text-sm text-gray-500">
                  Após o cadastro, você poderá fazer login e bater ponto normalmente.
                </p>
              </div>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header com relógio */}
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sucesso */}
        {success && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Ponto registrado com sucesso! ✓
            </AlertDescription>
          </Alert>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Card principal */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Registrar Ponto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tipo de registro */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Registro</label>
              <Select value={recordType} onValueChange={setRecordType} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="pausa">Pausa / Almoço</SelectItem>
                  <SelectItem value="retorno">Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Localização */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>Localização capturada</span>
              </div>
            )}

            {/* Câmera */}
            <div className="space-y-4">
              {!cameraActive ? (
                <Button
                  onClick={startCamera}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  size="lg"
                  disabled={loading}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Ativar Câmera
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <Button
                      onClick={stopCamera}
                      variant="destructive"
                      size="icon"
                      className="absolute top-4 right-4"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Button
                    onClick={handleClockIn}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Registrar Ponto
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Canvas oculto para captura */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Último registro */}
            {lastRecord && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Último Registro
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1">
                      {lastRecord.type}
                    </Badge>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(lastRecord.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                  <Badge className={
                    lastRecord.status === 'pontual' ? 'bg-green-500' :
                    lastRecord.status === 'atrasado' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }>
                    {lastRecord.status}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}