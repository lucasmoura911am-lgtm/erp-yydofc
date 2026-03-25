import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Camera, MapPin, Loader2, RefreshCw, AlertCircle, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

const STEPS = ["Documento", "Assinatura", "Evidências", "Comprovante"];

export default function DigitalSignatureSign() {
  const params = new URLSearchParams(window.location.search);
  const signatureId = params.get("id");

  const [doc, setDoc] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Evidence states
  const [ipAddress, setIpAddress] = useState("");
  const [userAgent] = useState(navigator.userAgent);
  const [location, setLocation] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [protocol, setProtocol] = useState("");
  const [hash, setHash] = useState("");
  const [signatureImage, setSignatureImage] = useState(null);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!signatureId) { setError("ID do documento não informado"); setLoading(false); return; }
    base44.entities.DigitalSignature.filter({ id: signatureId }).then(res => {
      if (res.length === 0) { setError("Documento não encontrado"); setLoading(false); return; }
      setDoc(res[0]);
      setProtocol(res[0].protocol_number);
      setLoading(false);
    });
    // Fetch IP
    fetch("https://api.ipify.org?format=json").then(r => r.json()).then(d => setIpAddress(d.ip)).catch(() => setIpAddress("Não disponível"));
  }, [signatureId]);

  // Canvas drawing
  useEffect(() => {
    if (step !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    const getPos = (e, canvas) => {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const start = (e) => { e.preventDefault(); isDrawing.current = true; const p = getPos(e, canvas); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const draw = (e) => { e.preventDefault(); if (!isDrawing.current) return; const p = getPos(e, canvas); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSignature(true); };
    const end = () => { isDrawing.current = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", end);
    };
  }, [step]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const requestGPS = () => {
    if (!navigator.geolocation) { alert("Seu navegador não suporta GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => alert("Não foi possível obter localização. Por favor, permita o acesso à localização.")
    );
  };

  const openCamera = async () => {
    setShowCamera(true); setCameraReady(false);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    streamRef.current = stream;
    if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setCameraReady(true); }; }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
    streamRef.current?.getTracks().forEach(t => t.stop());
    setShowCamera(false);
  };

  const computeHash = async (text) => {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleFinish = async () => {
    if (!photo) { alert("Foto obrigatória! Por favor, tire uma foto."); return; }
    if (!location) { alert("Localização GPS obrigatória! Por favor, capture sua localização."); return; }
    setSaving(true);
    try {
      if (!signatureImage) { alert("Assinatura não encontrada. Volte e assine novamente."); setSaving(false); return; }
      const now = new Date().toISOString();

      const hashInput = `${doc.protocol_number}|${doc.employee_id}|${signatureImage}|${now}|${ipAddress}`;
      const sha256 = await computeHash(hashInput);

      let photoUrl = "";
      if (photo) {
        const blob = await fetch(photo).then(r => r.blob());
        const file = new File([blob], "foto-assinatura.jpg", { type: "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        photoUrl = file_url;
      }

      await base44.entities.DigitalSignature.update(doc.id, {
        status: "Assinado",
        signature_image: signatureImage,
        photo_url: photoUrl,
        signed_at: now,
        ip_address: ipAddress,
        user_agent: userAgent,
        latitude: location?.latitude,
        longitude: location?.longitude,
        hash_sha256: sha256
      });

      // Salvar na pasta do funcionário
      try {
        await base44.entities.EmployeeDocument.create({
          employee_id: doc.employee_id,
          company_id: doc.company_id,
          title: `[Assinado] ${doc.document_type} - ${doc.protocol_number}`,
          category: "Assinatura Digital",
          file_url: doc.file_url,
          notes: `Assinado em ${format(new Date(now), "dd/MM/yyyy HH:mm")} | IP: ${ipAddress} | Protocolo: ${doc.protocol_number} | GPS: ${location?.latitude?.toFixed(6)}, ${location?.longitude?.toFixed(6)}`
        });
      } catch (docErr) {
        console.warn("Não foi possível salvar na pasta do funcionário:", docErr);
      }

      setHash(sha256);
      setStep(3);
    } catch (err) {
      console.error("Erro ao finalizar assinatura:", err);
      alert("Erro ao salvar assinatura: " + (err.message || "Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = () => {
    const pdf = new jsPDF();
    const signedAt = doc?.signed_at ? format(new Date(doc.signed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

    pdf.setFillColor(88, 28, 135);
    pdf.rect(0, 0, 210, 30, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
    pdf.text("COMPROVANTE DE ASSINATURA DIGITAL", 105, 14, { align: "center" });
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text("Protocolo: " + protocol, 105, 23, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("DADOS DO DOCUMENTO", 14, 42);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Tipo: ${doc?.document_type}`, 14, 52);
    pdf.text(`Arquivo: ${doc?.file_name || "-"}`, 14, 60);
    pdf.text(`Data/Hora Assinatura: ${signedAt}`, 14, 68);

    pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("DADOS DO SIGNATÁRIO", 14, 82);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Nome: ${doc?.employee_name}`, 14, 92);
    pdf.text(`Cargo: ${doc?.employee_position || "-"}`, 14, 100);

    pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("EVIDÊNCIAS COLETADAS", 14, 114);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text(`IP: ${ipAddress}`, 14, 124);
    pdf.text(`GPS: ${location ? `${location.latitude}, ${location.longitude}` : "Não coletado"}`, 14, 132);
    pdf.text(`Dispositivo: ${userAgent.substring(0, 90)}`, 14, 140);
    pdf.text(`Hash SHA-256: ${hash}`, 14, 148);

    if (canvasRef.current) {
      const sigImg = canvasRef.current.toDataURL("image/png");
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text("ASSINATURA DIGITAL", 14, 164);
      pdf.addImage(sigImg, "PNG", 14, 168, 80, 30);
    }

    pdf.setFontSize(8); pdf.setTextColor(100, 100, 100);
    pdf.text("Este documento possui validade jurídica conforme MP 2.200-2/2001 (ICP-Brasil) e LGPD (Lei 13.709/2018).", 14, 218);
    pdf.text("A autenticidade pode ser verificada pelo protocolo acima.", 14, 224);

    pdf.save(`comprovante-${protocol}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;
  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-gray-600">{error}</p></div></div>;
  if (doc?.status === "Assinado" && step < 3) return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold">Documento já assinado</h2>
        <p className="text-gray-500">Este documento já foi assinado. Protocolo: <strong>{doc.protocol_number}</strong></p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-800">Assinatura Digital</h1>
          </div>
          <p className="text-gray-500 text-sm">Protocolo: <strong>{protocol}</strong></p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex-1 text-center text-xs py-1.5 rounded-full font-medium ${i === step ? "bg-purple-600 text-white" : i < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>{s}</div>
              {i < STEPS.length - 1 && <div className="w-2 h-px bg-gray-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0 – Documento */}
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle>Documento para Assinatura</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div><span className="text-gray-500">Tipo:</span> <strong>{doc?.document_type}</strong></div>
                <div><span className="text-gray-500">Arquivo:</span> <strong>{doc?.file_name}</strong></div>
                <div><span className="text-gray-500">Prazo:</span> <strong>{doc?.deadline}</strong></div>
                {doc?.message && <div className="mt-3 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400 text-blue-800">{doc.message}</div>}
              </div>
              {doc?.file_url && (
                <a href={doc.file_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full">📄 Visualizar Documento</Button>
                </a>
              )}
              <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setStep(1)}>Li e entendi o documento → Assinar</Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1 – Assinatura */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assinatura Digital</CardTitle>
                <Badge className={hasSignature ? "bg-green-500" : "bg-yellow-500"}>
                  {hasSignature ? "✓ Assinatura capturada" : "Aguardando assinatura"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">Assine no campo abaixo usando o mouse ou o dedo (mobile):</p>
              <canvas ref={canvasRef} width={560} height={200} className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none cursor-crosshair" />
              <div className="flex gap-3">
                <Button variant="outline" onClick={clearCanvas} className="flex gap-2"><RefreshCw className="w-4 h-4" /> Limpar</Button>
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={!hasSignature} onClick={() => { setSignatureImage(canvasRef.current.toDataURL("image/png")); setStep(2); }}>Confirmar Assinatura →</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 – Evidências */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Registro de Evidências</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span><strong>IP:</strong> {ipAddress || "Carregando..."}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span><strong>Data/Hora:</strong> {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="truncate"><strong>Dispositivo:</strong> {userAgent.substring(0, 60)}...</span>
                </div>
              </div>

              <Button
                variant="outline"
                className={`w-full flex items-center gap-2 ${location ? "border-green-500 text-green-700" : "border-red-400 text-red-600"}`}
                onClick={requestGPS}
              >
                <MapPin className="w-4 h-4" />
                {location ? `✓ GPS: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "⚠ Capturar Localização GPS (Obrigatório)"}
              </Button>

              {!showCamera && !photo && (
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2 border-red-400 text-red-600"
                  onClick={openCamera}
                >
                  <Camera className="w-4 h-4" /> ⚠ Tirar Foto (Obrigatório)
                </Button>
              )}
              {showCamera && (
                <div className="space-y-3">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" style={{ transform: "scaleX(-1)" }} />
                  <Button className="w-full" onClick={capturePhoto} disabled={!cameraReady}>
                    {cameraReady ? "📸 Capturar Foto" : <><Loader2 className="w-4 h-4 animate-spin mr-2" />Aguardando câmera...</>}
                  </Button>
                </div>
              )}
              {photo && (
                <div className="space-y-2">
                  <img src={photo} alt="Foto" className="w-full rounded-lg border" style={{ transform: "scaleX(-1)" }} />
                  <Button variant="outline" size="sm" onClick={() => { setPhoto(null); openCamera(); }}>Tirar novamente</Button>
                </div>
              )}

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleFinish}
                disabled={saving || !photo || !location}
              >
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finalizando...</> : "Concluir Assinatura"}
              </Button>
              {(!photo || !location) && (
                <p className="text-xs text-red-500 text-center">Foto e GPS são obrigatórios para concluir</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3 – Comprovante */}
        {step === 3 && (
          <Card className="border-green-300 bg-green-50">
            <CardHeader>
              <div className="text-center space-y-2">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                <CardTitle className="text-green-800 text-xl">Documento Assinado com Sucesso!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-4 space-y-3 text-sm border">
                <div className="flex justify-between"><span className="text-gray-500">Protocolo:</span><strong className="text-purple-700">{protocol}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">Documento:</span><span>{doc?.document_type}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Signatário:</span><span>{doc?.employee_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Data/Hora:</span><span>{format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">IP:</span><span>{ipAddress}</span></div>
                {location && <div className="flex justify-between"><span className="text-gray-500">GPS:</span><span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span></div>}
                <div className="break-all text-xs text-gray-400"><span className="text-gray-500">Hash SHA-256:</span> {hash}</div>
              </div>

              {canvasRef.current && (
                <div className="bg-white p-3 rounded-lg border">
                  <p className="text-xs text-gray-500 mb-2">Assinatura:</p>
                  <img src={canvasRef.current.toDataURL()} alt="Assinatura" className="max-h-20 mx-auto" />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>Validade Jurídica:</strong> Este documento possui validade jurídica conforme MP 2.200-2/2001 (ICP-Brasil) e LGPD (Lei 13.709/2018). O hash SHA-256 garante a integridade do registro.
              </div>

              <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={downloadPDF}>
                📄 Baixar Comprovante em PDF
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}