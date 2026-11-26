import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  PenTool, Highlighter, Eraser, RotateCcw, Download, Save, Sparkles, Check, Bookmark, Maximize2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { facultyApi } from '../../api/faculty';
import { studentApi } from '../../api/student';

interface StrokeData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  mode: 'pen' | 'highlighter' | 'eraser';
}

interface CollaborativeWhiteboardProps {
  sessionId: string;
  isFaculty?: boolean;
  sendMessage?: (msg: any) => void;
  lastWsMessage?: any;
  sessionTitle?: string;
  classId?: string;
  subjectId?: string;
}

const COLORS = [
  { name: 'Slate', value: '#1e293b' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Violet', value: '#7c3aed' },
];

export default function CollaborativeWhiteboard({
  sessionId,
  isFaculty = false,
  sendMessage,
  lastWsMessage,
  sessionTitle = 'Classroom Lecture',
  classId,
  subjectId,
}: CollaborativeWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Tool states
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(3);
  const [savingNote, setSavingNote] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Resize canvas to match container width & height cleanly
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Temporary backup of drawing
    const ctx = canvas.getContext('2d');
    const prevImage = ctx && canvas.width > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;

    canvas.width = rect.width * dpr;
    canvas.height = 480 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `480px`;

    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (prevImage) {
        ctx.putImageData(prevImage, 0, 0);
      } else {
        // Initial clean white canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, 480);
      }
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    loadSavedWhiteboard();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [resizeCanvas]);

  // Load existing whiteboard state if available
  const loadSavedWhiteboard = async () => {
    try {
      const state = isFaculty
        ? await facultyApi.whiteboard.get(sessionId)
        : await studentApi.whiteboard.get(sessionId);

      if (state && canvasRef.current) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvasRef.current!.width / (window.devicePixelRatio || 1), 480);
          }
        };
        img.src = state;
      }
    } catch {
      // Ignore initial load failure
    }
  };

  // Listen for real-time WebSocket strokes
  useEffect(() => {
    if (!lastWsMessage) return;

    if (lastWsMessage.type === 'WHITEBOARD_STROKE' && lastWsMessage.stroke) {
      drawStroke(lastWsMessage.stroke, false);
    }

    if (lastWsMessage.type === 'WHITEBOARD_CLEAR') {
      clearCanvasLocally();
    }
  }, [lastWsMessage]);

  const drawStroke = (stroke: StrokeData, shouldBroadcast = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(stroke.x0, stroke.y0);
    ctx.lineTo(stroke.x1, stroke.y1);

    if (stroke.mode === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = stroke.width * 4;
      ctx.globalAlpha = 1.0;
    } else if (stroke.mode === 'highlighter') {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * 3;
      ctx.globalAlpha = 0.35;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = 1.0;
    }

    ctx.stroke();
    ctx.restore();

    if (shouldBroadcast && isFaculty && sendMessage) {
      sendMessage({
        action: 'whiteboard_stroke',
        sessionId,
        stroke,
      });
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isFaculty) return; // Students view the stream
    isDrawing.current = true;
    lastPos.current = getCanvasCoordinates(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isFaculty || !isDrawing.current || !lastPos.current) return;
    const currentPos = getCanvasCoordinates(e);

    const stroke: StrokeData = {
      x0: lastPos.current.x,
      y0: lastPos.current.y,
      x1: currentPos.x,
      y1: currentPos.y,
      color: selectedColor,
      width: lineWidth,
      mode: activeTool,
    };

    drawStroke(stroke, true);
    lastPos.current = currentPos;
  };

  const handleMouseUp = () => {
    if (!isFaculty) return;
    isDrawing.current = false;
    lastPos.current = null;
    debouncedSaveToServer();
  };

  const clearCanvasLocally = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / dpr, 480);
  };

  const handleClearBoard = () => {
    if (!isFaculty) return;
    if (!confirm('Clear the entire collaborative whiteboard?')) return;
    clearCanvasLocally();
    if (sendMessage) {
      sendMessage({
        action: 'whiteboard_clear',
        sessionId,
      });
    }
    debouncedSaveToServer();
    toast.success('Whiteboard cleared');
  };

  // Debounced server snapshot saving for faculty
  const saveTimeoutRef = useRef<any>(null);
  const debouncedSaveToServer = () => {
    if (!isFaculty) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      try {
        await facultyApi.whiteboard.save(sessionId, dataUrl);
      } catch {
        // silent auto-save error
      }
    }, 1500);
  };

  // 1-Tap "Save Canvas to Student Notebook"
  const handleSaveToNotebook = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setSavingNote(true);
      const dataUrl = canvas.toDataURL('image/png');
      const today = new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const noteTitle = `Whiteboard Snapshot • ${sessionTitle} (${today})`;
      const noteContent = `## Live Classroom Whiteboard\n\n*Captured during live lecture session on ${today}.*\n\n![Whiteboard Diagram](${dataUrl})\n\n---\n*Add your personal notes and lecture thoughts below:* \n\n- `;

      await studentApi.notes.create({
        title: noteTitle,
        content: noteContent,
        classId,
        subjectId,
        sessionId,
      });

      setSavedSuccess(true);
      toast.success('Whiteboard snapshot saved directly into your Notebook! 📔', {
        duration: 3500,
        icon: '✨',
      });

      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      toast.error('Failed to save snapshot to notebook');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col" ref={containerRef}>
      {/* Whiteboard Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-sm">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Collaborative Whiteboard</h3>
              {isFaculty ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200/50">
                  Faculty Presenter
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Mirror
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isFaculty ? 'Draw diagrams, equations, and vectors live for all enrolled students' : 'Mirrors faculty drawing live in real time • 1-tap save to Notebook'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Faculty Drawing Controls */}
          {isFaculty && (
            <>
              {/* Tool Selector */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTool('pen')}
                  className={`p-1.5 rounded-lg transition-colors ${activeTool === 'pen' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Pen Tool"
                >
                  <PenTool className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('highlighter')}
                  className={`p-1.5 rounded-lg transition-colors ${activeTool === 'highlighter' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Highlighter Tool"
                >
                  <Highlighter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('eraser')}
                  className={`p-1.5 rounded-lg transition-colors ${activeTool === 'eraser' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Eraser"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>

              {/* Color Palette */}
              {activeTool !== 'eraser' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setSelectedColor(c.value)}
                      className={`w-5 h-5 rounded-full transition-transform ${selectedColor === c.value ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              )}

              {/* Stroke Width */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {[2, 4, 8].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setLineWidth(w)}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${lineWidth === w ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {w === 2 ? 'Fine' : w === 4 ? 'Med' : 'Bold'}
                  </button>
                ))}
              </div>

              {/* Clear Canvas */}
              <button
                type="button"
                onClick={handleClearBoard}
                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                title="Clear Board"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Student 1-Tap Save to Notebook Button */}
          {!isFaculty && (
            <button
              type="button"
              onClick={handleSaveToNotebook}
              disabled={savingNote}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved to Notebook!</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>{savingNote ? 'Saving...' : '1-Tap Save to Notebook'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Canvas Drawing Surface */}
      <div className="relative w-full bg-white overflow-hidden select-none cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full touch-none block"
        />

        {!isFaculty && (
          <div className="absolute bottom-3 right-3 bg-slate-900/70 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 pointer-events-none">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Streaming live from faculty canvas</span>
          </div>
        )}
      </div>
    </div>
  );
}
