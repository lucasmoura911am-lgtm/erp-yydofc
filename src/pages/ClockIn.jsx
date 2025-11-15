import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, MapPin, Clock, CheckCircle, Loader2, X, AlertCircle, RefreshCw, User } from "lucide-react";
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
  const [showCamera, setShowCamera] = useState(false);
  const [location, setLocation] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRecord, setLastRecord] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readyCheckRef = useRef(null);

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
          setEmployee(employees[0]);
          await base44.auth.updateMe({ employee_id: employees[0].id });
          await loadLastRecord(employees[0].id);
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
          await loadLastRecord(employeeData[0].id);
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
        videoRef.current.srcObject = stream;
        
        // Esperar o vídeo carregar completamente
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(() => {
              // Aguardar 1.5 segundos após o play para garantir que frames estão disponíveis
              setTimeout(() => {
                setCameraReady(true);
                resolve();
              }, 1500);
            });
          };
        });
      }
      
      setShowCamera(true);
    } catch (err) {
      setError("Erro ao acessar câmera. Verifique as permissões.");
      console.error(err);
    }
  };

  const captureImage = async () => {
    const video = videoRef.current;
    
    if (!video) {
      setError("Vídeo não disponível");
      return;
    }

    // Verificações rigorosas
    if (!cameraReady) {
      setError("⏳ Aguarde a câmera ficar pronta...");
      return;
    }

    if (video.readyState !== 4) {
      setError("Câmera ainda não está totalmente pronta. Aguarde mais um segundo.");
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Dimensões do vídeo inválidas. Aguarde...");
      return;
    }

    console.log("Capturando - Dimensões:", video.videoWidth, "x", video.videoHeight);
    console.log("ReadyState:", video.readyState);

    try {
      // Criar canvas com as dimensões exatas do vídeo
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d', { alpha: false });
      
      // Preencher com branco primeiro (para debug)
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Desenhar o frame do vídeo
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Verificar brightness da imagem capturada
      const sampleSize = 100;
      const imageData = ctx.getImageData(
        canvas.width / 2 - sampleSize / 2, 
        canvas.height / 2 - sampleSize / 2, 
        sampleSize, 
        sampleSize
      );
      
      let totalBrightness = 0;
      let pixelCount = 0;
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        pixelCount++;
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      console.log("Brightness médio:", avgBrightness);
      
      if (avgBrightness < 15) {
        setError("❌ Imagem muito escura (brightness: " + avgBrightness.toFixed(1) + "). Melhore a iluminação ou limpe a câmera.");
        return;
      }
      
      if (avgBrightness > 250) {
        setError("❌ Imagem muito clara (brightness: " + avgBrightness.toFixed(1) + "). Reduza a luz direta na câmera.");
        return;
      }
      
      // Converter para blob com qualidade máxima
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError("Erro ao processar imagem");
          return;
        }

        console.log("Blob criado:", blob.size, "bytes");
        
        // Verificar se há rosto na foto
        setVerifyingFace(true);
        const faceDetected = await detectFace(blob);
        setVerifyingFace(false);
        
        if (!faceDetected) {
          setError("❌ Nenhum rosto detectado. Posicione seu rosto de frente para a câmera.");
          return;
        }
        
        setCapturedPhoto(blob);
        cleanup();
        setShowCamera(false);
      }, 'image/jpeg', 0.95);
      
    } catch (err) {
      console.error("Erro ao capturar:", err);
      setError("Erro ao capturar imagem: " + err.message);
    }
  };

  const detectFace = async (photoBlob) => {
    try {
      const photoFile = new File([photoBlob], 'temp.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: photoFile });
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: "Analise esta imagem. Responda com face_detected=true APENAS se houver um rosto humano CLARAMENTE VISÍVEL e bem iluminado. Se a imagem estiver preta, escura demais, ou sem rosto, responda face_detected=false.",
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            confidence: { type: "string" },
            image_quality: { type: "string" }
          }
        }
      });
      
      console.log("Detecção facial:", result);
      return result.face_detected;
    } catch (error) {
      console.error("Erro ao detectar rosto:", error);
      return true; // Em caso de erro, permite continuar
    }
  };

  const cleanup = () => {
    setCameraReady(false);
    if (readyCheckRef.current) {
      clearTimeout(readyCheckRef.current);
    }
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

    setLoading(true);
    setError(null);

    try {
      const photoFile = new File([capturedPhoto], `ponto-${Date.now()}.jpg`, { 
        type: 'image/jpeg' 
      });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ 
        file: photoFile 
      });

      await base44.entities.TimeRecord.create({
        employee_id: employee.id,
        company_id: employee.company_id,
        timestamp: new Date().toISOString(),
        type: recordType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        photo_url: file_url,
        status: "pontual",
        delay_minutes: 0,
        verified: true
      });

      setSuccess(true);
      setCapturedPhoto(null);
      
      setTimeout(() => {
        setSuccess(false);
        loadUserData();
      }, 3000);

    } catch (error) {
      setError("Erro ao registrar ponto");
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
              ✅ Ponto registrado com sucesso!
            </AlertDescription>
          </Alert>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Card principal */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Registrar Ponto
              <Badge variant="outline" className="ml-auto">
                <User className="w-3 h-3 mr-1" />
                Reconhecimento Facial
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tipo de registro */}
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

            {/* Localização */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>📍 Localização capturada</span>
              </div>
            )}

            {/* Interface da câmera */}
            {!showCamera && !capturedPhoto && (
              <Button
                onClick={openCamera}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
                disabled={loading}
              >
                <Camera className="w-5 h-5 mr-2" />
                📸 Tirar Foto com Reconhecimento Facial
              </Button>
            )}

            {/* Preview da câmera */}
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
                  
                  {/* Status da câmera */}
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="text-center text-white">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                        <p className="text-lg font-semibold">Preparando câmera...</p>
                        <p className="text-sm opacity-80">Aguarde alguns segundos</p>
                      </div>
                    </div>
                  )}
                  
                  {cameraReady && !verifyingFace && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-green-500 text-white">
                        ● Câmera Pronta
                      </Badge>
                    </div>
                  )}
                  
                  {verifyingFace && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <div className="text-center text-white">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                        <p className="text-lg font-semibold">Detectando rosto...</p>
                        <p className="text-sm opacity-80">Aguarde</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <User className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    👤 Posicione seu rosto de frente para a câmera. Aguarde a luz verde "Câmera Pronta" antes de capturar.
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
                    disabled={verifyingFace}
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={captureImage}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    size="lg"
                    disabled={verifyingFace || !cameraReady}
                  >
                    {verifyingFace ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : !cameraReady ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Preparando...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mr-2" />
                        📸 Capturar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Preview da foto capturada */}
            {capturedPhoto && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                  <img
                    src={URL.createObjectURL(capturedPhoto)}
                    alt="Foto capturada"
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">
                      ✓ Rosto Detectado
                    </Badge>
                  </div>
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
                        ✅ Registrar Ponto
                      </>
                    )}
                  </Button>
                </div>

                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    👆 Revise sua foto e clique em "Registrar Ponto" para confirmar.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Último registro */}
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
                  </div>
                  <Badge className={
                    lastRecord.status === 'pontual' ? 'bg-green-500' :
                    lastRecord.status === 'atrasado' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }>
                    {lastRecord.status === 'pontual' ? '✓ Pontual' : lastRecord.status}
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