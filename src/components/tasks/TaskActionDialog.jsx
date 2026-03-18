import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Loader2, MapPin, Clock } from "lucide-react";

/**
 * Shared dialog for starting (foto antes) or completing (foto depois) a task.
 * Props:
 *   open, onClose, task, mode: 'start' | 'complete', onSuccess(updatedData)
 */
export default function TaskActionDialog({ open, onClose, task, mode, onSuccess }) {
  const [photo, setPhoto] = useState(null);
  const [observation, setObservation] = useState("");
  const [uploading, setUploading] = useState(false);

  const isStart = mode === "start";

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhoto(file_url);
    } catch {
      alert("Erro ao fazer upload da foto. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!photo) {
      alert(isStart ? "Tire uma foto ANTES de iniciar!" : "Tire uma foto após concluir!");
      return;
    }

    const now = new Date().toISOString();
    let updateData;

    if (isStart) {
      updateData = {
        status: "em_andamento",
        started_at: now,
        photo_before_url: photo,
      };
    } else {
      updateData = {
        status: "concluida",
        completed_at: now,
        photo_after_url: photo,
        observation: observation || "",
      };
    }

    onSuccess(updateData);
    setPhoto(null);
    setObservation("");
  };

  const handleClose = () => {
    setPhoto(null);
    setObservation("");
    onClose();
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isStart ? "📸 Iniciar Tarefa — Foto ANTES" : "✅ Concluir Tarefa — Foto DEPOIS"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{task.title}</p>
            {task.description && (
              <p className="text-xs text-gray-500">{task.description}</p>
            )}
            <div className="flex gap-3 flex-wrap mt-1">
              {task.location && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" /> {task.location}
                </span>
              )}
              {(task.scheduled_start_time || task.scheduled_end_time) && (
                <span className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                  <Clock className="w-3 h-3" />
                  {task.scheduled_start_time || "?"}{task.scheduled_end_time ? ` – ${task.scheduled_end_time}` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Photo capture */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isStart ? "📷 Foto do local ANTES de iniciar *" : "📷 Foto do serviço CONCLUÍDO *"}
            </Label>

            {photo ? (
              <div className="space-y-2">
                <img src={photo} alt="Foto" className="w-full h-48 object-cover rounded-lg border" />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPhoto(null)}
                >
                  Trocar foto
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                      <p className="text-sm text-gray-500">Enviando foto...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="w-12 h-12 text-gray-300" />
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Toque para tirar foto
                      </p>
                      <p className="text-xs text-gray-400">Use a câmera do dispositivo</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading}
                  onChange={handlePhotoChange}
                />
              </label>
            )}
          </div>

          {/* Observation (only for complete) */}
          {!isStart && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Observação (opcional)</Label>
              <Textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={3}
                placeholder="Descreva o que foi executado..."
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!photo || uploading}
            className={`flex-1 ${isStart ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {isStart ? "▶ Iniciar" : "✅ Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}