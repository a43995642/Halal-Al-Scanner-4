
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const lastCaptureTime = useRef<number>(0);
  const mountedRef = useRef(true);
  
  // Camera Capabilities State
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Helper to stop all tracks on a stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
  };

  const startCamera = useCallback(async () => {
    setError('');
    
    if (!mountedRef.current) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Camera.requestPermissions();
        if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
           setError('يرجى منح إذن الكاميرا من إعدادات الهاتف لاستخدام التطبيق.');
           return;
        }
      } catch (e) {
        console.warn("Native permission request failed", e);
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (Capacitor.isNativePlatform()) {
        setError('تعذر فتح الكاميرا المباشرة. يرجى استخدام زر "كاميرا النظام".');
      } else {
        setError('المتصفح لا يدعم الكاميرا المباشرة.');
      }
      return;
    }

    try {
      // 1. Base Constraints - High Resolution for OCR
      const constraints: MediaStreamConstraints = {
        video: { 
            facingMode: 'environment',
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play interrupted:", e));
      }

      // --- SMART EXPOSURE & FOCUS OPTIMIZATION FOR OCR ---
      try {
        const track = stream.getVideoTracks()[0];
        // Cast to 'any' because TypeScript DOM lib often lacks advanced ImageCapture capabilities
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        const advancedConstraints: any = [];

        // A. Focus Priority: Sharpness is more important than brightness for OCR
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
           advancedConstraints.push({ focusMode: 'continuous' });
        }

        // B. Exposure Optimization:
        // We use 'continuous' auto-exposure to let the hardware balance the light.
        // However, we apply a positive Exposure Compensation to favor brighter images (better for paper/text),
        // but strictly capped to avoid washing out text or introducing ISO noise.
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
           advancedConstraints.push({ exposureMode: 'continuous' });
        }

        // C. Exposure Compensation (The Smart Adjustment):
        // If supported, slightly bump exposure (+0.5 EV is usually the sweet spot for text).
        // This avoids the "Dark Feed" issue without causing noise like high ISO would.
        if (capabilities.exposureCompensation) {
            const min = capabilities.exposureCompensation.min;
            const max = capabilities.exposureCompensation.max;
            const step = capabilities.exposureCompensation.step;
            
            // Target: +0.66 EV (Good for text clarity, keeps noise low)
            // Clamp value between device min/max
            let targetEV = 0.66;
            if (targetEV > max) targetEV = max;
            if (targetEV < min) targetEV = min;
            
            // Ensure step alignment if required
            if (step > 0) {
                targetEV = Math.round((targetEV - min) / step) * step + min;
            }

            advancedConstraints.push({ exposureCompensation: targetEV });
        }

        // D. White Balance: Accurate white balance helps OCR engines distinguish text from background
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
        }

        // D. Torch/Flash Capability Check
        if (capabilities.torch) setHasTorch(true);

        // Apply Constraints Batch
        if (advancedConstraints.length > 0) {
            await track.applyConstraints({ advanced: advancedConstraints });
            console.log("Applied Smart OCR Camera Constraints:", advancedConstraints);
        }

      } catch (e) {
        console.warn("Capabilities optimization failed (non-critical)", e);
      }
      // ---------------------------------------------------

    } catch (err: any) {
      console.error("Camera start failed:", err);
      if (!mountedRef.current) return;
      setError('حدث خطأ في تشغيل الكاميرا. يرجى استخدام كاميرا النظام.');
    }
  }, []);

  const openNativeCamera = async (onCapture: (imageSrc: string) => void) => {
    try {
      const image = await Camera.getPhoto({
        quality: 90, 
        allowEditing: false,
        resultType: CameraResultType.Uri, 
        source: CameraSource.Camera,
        correctOrientation: true, 
        saveToGallery: false,
      });

      if (image.webPath) {
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          onCapture(reader.result as string);
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {
      console.log('Native camera cancelled', e);
    }
  };

  const cleanupCamera = useCallback(() => {
    stopStream();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !isTorchOn }] as any });
      setIsTorchOn(!isTorchOn);
    } catch (e) {
      console.error("Torch toggle failed", e);
    }
  }, [hasTorch, isTorchOn]);

  const captureImage = useCallback((onCapture: (imageSrc: string) => void, shouldClose: boolean = true) => {
    if (isCapturing) return;
    
    // Multi-shot Cooldown (300ms)
    const now = Date.now();
    if (!shouldClose && now - lastCaptureTime.current < 300) return;

    if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
      setIsCapturing(true);
      lastCaptureTime.current = now;

      if (navigator.vibrate) navigator.vibrate(15);

      const video = videoRef.current;
      
      // Delay (150ms) to allow focus/exposure to stabilize before capture
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        if (context) {
          // Post-Processing for OCR:
          // 1. Slight Contrast Boost (1.15): Separates text from background.
          // 2. Minimal Brightness Boost (1.05): Ensures text isn't too dark, but avoids washing out.
          // We avoid high ISO/Brightness in camera settings to prevent noise, and apply clean adjustments here.
          context.filter = 'contrast(1.15) brightness(1.05)';
          
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // High Quality JPEG for analysis
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95); 
          
          if (navigator.vibrate) navigator.vibrate(25);
          
          onCapture(imageDataUrl);
          
          if (!shouldClose) {
            setTimeout(() => {
               if (mountedRef.current) setIsCapturing(false);
            }, 300);
          }
        } else {
          setIsCapturing(false);
        }
      }, 150); 
    }
  }, [isCapturing]);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    return () => {
      mountedRef.current = false;
      cleanupCamera();
    };
  }, [startCamera, cleanupCamera]);

  return {
    videoRef,
    error,
    isCapturing,
    captureImage,
    openNativeCamera,
    hasTorch,
    isTorchOn,
    toggleTorch,
  };
};
