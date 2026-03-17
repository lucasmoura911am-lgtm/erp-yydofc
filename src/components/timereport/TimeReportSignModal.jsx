import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, CheckCircle2, FileText, Loader2, Shield } from "lucide-react";
import SignatureCanvas from "@/components/payslips/SignatureCanvas";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function TimeReportSignModal({ report, employeeName, onClose }) {
  const [step, setStep] = useState("signature"); // signature | photo | confirm | done
  const [signatureData, setSignatureData] = useState(null);
  const [photoData, setPhotoData] = useState(null);
  const [loading, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const queryClient = useQueryClient();

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setError("Câmera não disponível. A foto é opcional.");
    }
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    setPhotoData(canvas.toDataURL("image/jpeg", 0.7));
    stopCamera();
    setStep("confirm");
  };

  const skipPhoto = () => {
    stopCamera();
    setStep("confirm");
  };

  const handleSignatureSave = (sig) => {
    setSignatureData(sig);
    setStep("photo");
    setTimeout(startCamera, 300);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      // Upload photo if exists
      let photoUrl = null;
      if (photoData) {
        const blob = await (await fetch(photoData)).blob();
        const file = new File([blob], "foto_assinatura.jpg", { type: "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        photoUrl = file_url;
      }

      // Get IP
      let ip = "desconhecido";
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch {}

      // Get GPS
      let gps = null;
      try {
        gps = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => resolve(null),
            { timeout: 5000 }
          );
        });
      } catch {}

      // Save signature data
      await base44.entities.SignedTimeReport.update(report.id, {
        status: "assinado",
        assinatura_digital: signatureData,
        foto_assinatura: photoUrl,
        ip_assinatura: ip,
        gps_assinatura: gps,
        data_assinatura: new Date().toISOString(),
        signed_at: new Date().toISOString(),
        user_agent_assinatura: navigator.userAgent
      });

      // Generate signed PDF with embedded signature, photo, IP and GPS
      try {
        await base44.functions.invoke("generateSignedTimeReport", { report_id: report.id });
      } catch (pdfErr) {
        console.warn("PDF assinado não gerado:", pdfErr.message);
      }

      queryClient.invalidateQueries(["mySignedTimeReports"]);
      queryClient.invalidateQueries(["signedTimeReports"]);
      setStep("done");
    } catch (e) {
      setError("Erro ao salvar assinatura: " + e.message);
    }
    setSaving(false);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Assinar Folha de Ponto
          </DialogTitle>
        </DialogHeader>

        {/* Report info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">{employeeName}</p>
            <p className="text-xs text-gray-500">Folha de Ponto — Competência: {report.competence}</p>
          </div>
          <Badge className="ml-auto bg-blue-100 text-blue-800" variant="outline">
            {report.competence}
          </Badge>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {/* Step: Signature */}
        {step === "signature" && (
          <SignatureCanvas onSave={handleSignatureSave} onCancel={handleClose} />
        )}

        {/* Step: Photo */}
        {step === "photo" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 font-medium">Tire uma selfie para confirmar sua identidade:</p>
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={skipPhoto}>Pular Foto</Button>
              <Button className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600" onClick={takePhoto}>
                <Camera className="w-4 h-4 mr-1" /> Capturar
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">Assinatura:</p>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img src={signatureData} alt="Assinatura" className="w-full" />
                </div>
              </div>
              {photoData && (
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium">Foto:</p>
                  <div className="border rounded-lg overflow-hidden bg-black">
                    <img src={photoData} alt="Foto" className="w-full object-cover" />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                ✓ Ao confirmar, você declara que os registros deste mês são corretos. Seu IP, GPS e data/hora serão registrados.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("signature")}>Reasinar</Button>
              <Button
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                {loading ? "Salvando..." : "Confirmar Assinatura"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Folha de Ponto Assinada!</h3>
            <p className="text-gray-500 mt-2">Sua assinatura foi registrada com sucesso.</p>
            <Button className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-600" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}