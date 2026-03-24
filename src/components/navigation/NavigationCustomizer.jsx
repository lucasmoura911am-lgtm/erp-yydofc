import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";

const LS_KEY = "nav_module_order_v2";

export function useNavigationOrder(defaultModules) {
  const [order, setOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Merge with any new modules not in saved order
      const savedIds = new Set(parsed.map(i => i.id));
      const newModules = defaultModules.filter(m => !savedIds.has(m.id)).map(m => ({ id: m.id, hidden: false }));
      return [...parsed, ...newModules];
    } catch { return null; }
  });

  const getOrderedModules = (modules) => {
    if (!order) return modules;
    const orderMap = {};
    order.forEach((item, idx) => { orderMap[item.id] = { idx, hidden: item.hidden }; });
    return modules
      .filter(m => !orderMap[m.id]?.hidden)
      .sort((a, b) => {
        const ai = orderMap[a.id]?.idx ?? 999;
        const bi = orderMap[b.id]?.idx ?? 999;
        return ai - bi;
      });
  };

  const saveOrder = (newOrder) => {
    setOrder(newOrder);
    localStorage.setItem(LS_KEY, JSON.stringify(newOrder));
  };

  const reset = () => { localStorage.removeItem(LS_KEY); setOrder(null); };

  return { getOrderedModules, saveOrder, order, reset };
}

export default function NavigationCustomizer({ open, onClose, modules, order, saveOrder, reset }) {
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    if (!open) return;
    const orderMap = {};
    (order || []).forEach((item, idx) => { orderMap[item.id] = { idx, hidden: item.hidden }; });
    const sorted = [...modules].sort((a, b) => {
      const ai = orderMap[a.id]?.idx ?? 999;
      const bi = orderMap[b.id]?.idx ?? 999;
      return ai - bi;
    });
    setItems(sorted.map(m => ({ id: m.id, title: m.title, icon: m.icon, hidden: orderMap[m.id]?.hidden || false })));
  }, [open, modules, order]);

  const handleDragStart = (idx) => setDragging(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (targetIdx) => {
    if (dragging === null || dragging === targetIdx) return;
    const next = [...items];
    const [moved] = next.splice(dragging, 1);
    next.splice(targetIdx, 0, moved);
    setItems(next);
    setDragging(null);
    setDragOver(null);
  };

  const toggleHidden = (idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, hidden: !it.hidden } : it));
  };

  const handleSave = () => {
    saveOrder(items.map((it, idx) => ({ id: it.id, hidden: it.hidden, idx })));
    onClose();
  };

  const handleReset = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Personalizar Menu</DialogTitle>
          <p className="text-xs text-gray-500">Arraste para reordenar • Clique no olho para ocultar</p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-1 py-2">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab transition-all ${
                  dragOver === idx ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20" : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                } ${item.hidden ? "opacity-40" : ""}`}
              >
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                {Icon && <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                <span className="text-sm flex-1 truncate">{item.title}</span>
                <button onClick={() => toggleHidden(idx)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  {item.hidden ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />Restaurar
          </Button>
          <Button className="flex-1" onClick={handleSave}>Salvar Ordem</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}