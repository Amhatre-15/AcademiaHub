import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Timer, Maximize2, Minimize2, ShieldCheck, Eye, EyeOff, Radio } from 'lucide-react';
import { type AttendanceCheckpoint } from '../../api/faculty';
import { generateDynamicQrToken, formatQrPayload } from '../../utils/qrAttendance';

interface DynamicQrDisplayProps {
  checkpoint: AttendanceCheckpoint;
  sessionId: string;
  serverTimeOffset?: number;
}

export default function DynamicQrDisplay({
  checkpoint,
  sessionId,
  serverTimeOffset = 0
}: DynamicQrDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentHash, setCurrentHash] = useState<string>('');
  const [currentSecond, setCurrentSecond] = useState<number>(0);
  const [millisecondTick, setMillisecondTick] = useState<number>(1000);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const expires = new Date(checkpoint.expiresAt).getTime();
    return Math.max(0, Math.floor((expires - (Date.now() + serverTimeOffset)) / 1000));
  });

  // Calculate overall countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const expires = new Date(checkpoint.expiresAt).getTime();
      const left = Math.max(0, Math.floor((expires - (Date.now() + serverTimeOffset)) / 1000));
      setRemainingSeconds(left);
    }, 1000);

    return () => clearInterval(timer);
  }, [checkpoint.expiresAt, serverTimeOffset]);

  // Millisecond ticker for smooth 1-second progress ring/bar animation
  useEffect(() => {
    let animFrame: number;
    const updateTick = () => {
      const now = Date.now() + serverTimeOffset;
      const ms = now % 1000;
      setMillisecondTick(ms);
      animFrame = requestAnimationFrame(updateTick);
    };
    animFrame = requestAnimationFrame(updateTick);

    return () => cancelAnimationFrame(animFrame);
  }, [serverTimeOffset]);

  // 1-Second rotating dynamic QR generator
  useEffect(() => {
    let isCancelled = false;

    const updateQr = async () => {
      if (!checkpoint.qrSecret) return;

      const now = Date.now() + serverTimeOffset;
      const sec = Math.floor(now / 1000);
      setCurrentSecond(sec);

      const token = await generateDynamicQrToken(checkpoint.qrSecret, checkpoint.id, sec);
      if (isCancelled || !token) return;

      setCurrentHash(token);

      const payload = formatQrPayload({
        sid: sessionId,
        cid: checkpoint.id,
        t: sec,
        hash: token,
        type: checkpoint.checkpointType
      });

      // Render on standard canvas
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, payload, {
          width: 256,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        }).catch(err => console.error('QR Render error:', err));
      }

      // Render on fullscreen projector canvas
      if (fullscreenCanvasRef.current) {
        QRCode.toCanvas(fullscreenCanvasRef.current, payload, {
          width: 480,
          margin: 3,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        }).catch(err => console.error('Fullscreen QR Render error:', err));
      }
    };

    // Run immediately
    updateQr();

    // Rotate precisely every 1000 milliseconds
    const interval = setInterval(updateQr, 1000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [checkpoint.id, checkpoint.qrSecret, sessionId, serverTimeOffset, isFullscreen]);

  return (
    <>
      {/* Standard Classroom Display Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-indigo-500/20">
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              Dynamic QR • 1s Rotation
            </span>
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-medium border border-indigo-400/20">
              {checkpoint.checkpointType} CHECKPOINT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all backdrop-blur-sm border border-white/10 shadow-sm"
              title="Expand for Classroom Projector"
            >
              <Maximize2 size={14} />
              Projector Mode
            </button>
          </div>
        </div>

        {/* Main Center Area: Dynamic QR Code */}
        <div className="flex flex-col items-center justify-center relative z-10 my-2">
          {/* QR Code Container with 1s Progress Border */}
          <div className="relative p-3 bg-white rounded-3xl shadow-2xl shadow-indigo-900/50 flex items-center justify-center">
            {/* Visual 1-second pulse effect */}
            <canvas
              ref={canvasRef}
              className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl transition-all"
            />

            {/* Central security watermark badge */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 bg-white/95 rounded-xl shadow-lg border border-slate-200 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* 1-Second Rotation Progress Meter */}
          <div className="w-64 sm:w-72 mt-4">
            <div className="flex justify-between items-center text-xs text-indigo-200 mb-1.5 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Rotating in {((1000 - millisecondTick) / 1000).toFixed(1)}s
              </span>
              <span className="opacity-75">Token: {currentHash.substring(0, 8)}...</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-indigo-500/20">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 h-full transition-all duration-75"
                style={{ width: `${(millisecondTick / 1000) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Status / Timer Bar */}
        <div className="mt-6 pt-5 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-500/30">
              <Timer className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <p className="text-xs text-indigo-300">Window Closes In</p>
              <p className="text-xl font-black font-mono tracking-tight text-white">
                {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
                {String(remainingSeconds % 60).padStart(2, '0')}
              </p>
            </div>
          </div>

          {/* Emergency Backup Code Toggle */}
          <div className="flex items-center gap-2">
            {checkpoint.code && (
              <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setShowBackupCode(!showBackupCode)}
                  className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
                >
                  {showBackupCode ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>Backup Code:</span>
                </button>
                {showBackupCode ? (
                  <span className="font-mono font-bold text-amber-300 tracking-wider text-sm">
                    {checkpoint.code}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono tracking-widest">••••</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Projector Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white select-none">
          <div className="absolute top-6 right-6">
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-slate-700 transition-all shadow-lg"
            >
              <Minimize2 size={18} />
              Exit Projector Mode (Esc)
            </button>
          </div>

          <div className="text-center max-w-xl mx-auto mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-sm tracking-wide border border-emerald-500/30 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE DYNAMIC ATTENDANCE QR • ROTATES EVERY 1s
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Scan with your AcademiaHub app
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Valid for live students in room only • Anti-proxy protected
            </p>
          </div>

          {/* Large Projector QR */}
          <div className="relative p-6 bg-white rounded-3xl shadow-2xl flex items-center justify-center my-2">
            <canvas
              ref={fullscreenCanvasRef}
              className="w-80 h-80 sm:w-96 sm:h-96 md:w-[440px] md:h-[440px] rounded-2xl"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* 1s Progress Meter in Fullscreen */}
          <div className="w-80 sm:w-96 md:w-[440px] mt-6">
            <div className="flex justify-between items-center text-sm text-slate-300 mb-2 font-mono">
              <span className="text-emerald-400 font-medium">
                Rotating in {((1000 - millisecondTick) / 1000).toFixed(1)}s
              </span>
              <span className="text-slate-400">Time window: {remainingSeconds}s remaining</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 h-full transition-all duration-75"
                style={{ width: `${(millisecondTick / 1000) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
