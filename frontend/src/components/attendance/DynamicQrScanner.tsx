import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, Zap, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { parseScannedQr, playScanSuccessSound } from '../../utils/qrAttendance';

interface DynamicQrScannerProps {
  sessionId: string;
  onScanSuccess: (qrPayload: string) => void;
  submitting?: boolean;
}

export default function DynamicQrScanner({
  sessionId,
  onScanSuccess,
  submitting = false
}: DynamicQrScannerProps) {
  const [scannerStarted, setScannerStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scannedSuccessfully, setScannedSuccessfully] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`);

  // Initialize and list cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera
          const backCam = devices.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('rear')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError('No cameras detected on this device.');
        }
      })
      .catch(err => {
        console.warn('Could not enumerate cameras:', err);
        // Fallback to environment facingMode
        setSelectedCameraId('environment');
      });
  }, []);

  // Start scanner function
  const startCamera = async (camIdOrFacing: string) => {
    let rejected = false;
    try {
      setCameraError(null);

      // Stop previous instance if running
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {
          // Ignore stop errors
        }
      }

      const html5QrCode = new Html5Qrcode(readerId.current);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrEdge = Math.max(200, Math.floor(minEdge * 0.72));
          return { width: qrEdge, height: qrEdge };
        },
        aspectRatio: 1.0
      };

      const cameraParam = camIdOrFacing === 'environment'
        ? { facingMode: 'environment' }
        : camIdOrFacing;

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          // Verify format
          const parsed = parseScannedQr(decodedText);
          if (parsed) {
            // Check session match
            if (parsed.sid && parsed.sid !== sessionId) {
              rejected = true;
              setCameraError('This QR code is for a different session!');
              setScannerStarted(false);
              html5QrCode.stop().catch(() => {});
              return;
            }

            // Audio & haptic feedback
            playScanSuccessSound();
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }

            setScannedSuccessfully(true);

            // Stop scanner to prevent repeat scans
            try {
              if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {});
              }
            } catch {
              // Ignore
            }

            onScanSuccess(decodedText);
          }
        },
        () => {
          // Frame scan error (expected for empty frames)
        }
      );

      if (!rejected) setScannerStarted(true);
    } catch (err: any) {
      console.error('Failed to start scanner:', err);
      setScannerStarted(false);
      setCameraError(
        err?.message ||
        'Could not access camera. Please allow camera permissions in browser settings.'
      );
    }
  };

  // Stop scanner
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore
      }
      setScannerStarted(false);
    }
  };

  // Switch camera if user has multiple
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    if (scannerStarted) {
      startCamera(nextCam.id);
    }
  };

  // Auto-start camera when selectedCameraId is ready
  useEffect(() => {
    if (selectedCameraId && !scannedSuccessfully) {
      startCamera(selectedCameraId);
    }

    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {
          // Ignore
        }
      }
    };
  }, [selectedCameraId]);

  return (
    <div className="flex flex-col items-center">
      {/* Viewfinder Frame */}
      <div className="relative w-full max-w-sm aspect-square bg-slate-950 rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-xl flex items-center justify-center">
        {/* html5-qrcode video container */}
        <div id={readerId.current} className="w-full h-full object-cover" />

        {/* Viewfinder Reticle Overlay */}
        {scannerStarted && !scannedSuccessfully && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Darkened edges */}
            <div className="relative w-56 h-56 border-2 border-indigo-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]">
              {/* Corner Targets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Laser Scanning Animation */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[scannerBeam_2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* Success Splash */}
        {scannedSuccessfully && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in z-20">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>
            <h4 className="font-bold text-xl mb-1">QR Captured!</h4>
            <p className="text-emerald-200 text-xs">
              {submitting ? 'Verifying with server…' : 'Dynamic token submitted!'}
            </p>
          </div>
        )}

        {/* Error / Permission Blocked View */}
        {cameraError && !scannerStarted && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-6 text-center z-10">
            <ShieldAlert className="w-12 h-12 text-amber-400 mb-3" />
            <h4 className="font-bold text-base mb-1">Camera Notice</h4>
            <p className="text-slate-300 text-xs mb-4 leading-relaxed max-w-xs">{cameraError}</p>
            <button
              onClick={() => startCamera(selectedCameraId || 'environment')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md"
            >
              <RefreshCw size={14} />
              Retry Camera
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar Below Camera */}
      <div className="w-full max-w-sm flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Sparkles size={14} className="text-indigo-500 animate-pulse" />
          <span>Point at projector QR</span>
        </div>

        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Flip Camera"
            >
              <RefreshCw size={12} />
              Flip
            </button>
          )}

          {scannerStarted ? (
            <button
              onClick={stopCamera}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <CameraOff size={12} />
              Pause
            </button>
          ) : (
            <button
              onClick={() => startCamera(selectedCameraId || 'environment')}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Camera size={12} />
              Start Camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
