
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
      // 1. BASE SOURCE: High Resolution, Balanced Framerate
      // We capture 4K to serve both the AI (needs pixels) and User (needs clarity).
      const constraints: MediaStreamConstraints = {
        video: { 
            facingMode: 'environment',
            // Prefer 4K, fallback gracefully
            width: { ideal: 3840 }, 
            height: { ideal: 2160 },
            // Standard framerate for smooth preview
            frameRate: { ideal: 30, max: 30 } 
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

      // --- ISP BALANCED TUNING ---
      // Goal: Create a "Master Negative" that is good for display AND processing.
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        const advancedConstraints: any = [];

        // A. Focus: Continuous is non-negotiable for macro text shots.
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
           advancedConstraints.push({ focusMode: 'continuous' });
        }

        // B. Exposure: Continuous Auto
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
           advancedConstraints.push({ exposureMode: 'continuous' });
        }

        // C. Exposure Compensation: SLIGHT BIAS ONLY (+0.0 to +0.3 EV)
        // Previously we used +0.5EV which is great for OCR but washes out the UI preview.
        // We set it to neutral or very slightly bright. The AI pipeline will boost brightness digitally later.
        if (capabilities.exposureCompensation) {
            // Target +0.0 EV (Neutral) or slightly positive if scene is dark
            // We rely on post-processing for the heavy lifting now.
            const targetEV = 0; 
            advancedConstraints.push({ exposureCompensation: targetEV });
        }

        // D. White Balance: Continuous (Natural colors for user)
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
        }

        // Torch Check
        if (capabilities.torch) setHasTorch(true);

        // Apply Tuning
        if (advancedConstraints.length > 0) {
            await track.applyConstraints({ advanced: advancedConstraints });
        }

      } catch (e) {
        console.warn("ISP optimization failed", e);
      }

    } catch (err: any) {
      console.error("Camera start failed:", err);
      if (!mountedRef.current) return;
      setError('حدث خطأ في تشغيل الكاميرا. يرجى استخدام كاميرا النظام.');
    }
  }, []);

  const openNativeCamera = async (onCapture: (imageSrc: string) => void) => {
    try {
      const image = await Camera.getPhoto({
        quality: 100,
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

  const captureImage = useCallback(async (onCapture: (imageSrc: string) => void, shouldClose: boolean = true) => {
    if (isCapturing) return;
    
    // Rate Limiting
    const now = Date.now();
    if (!shouldClose && now - lastCaptureTime.current < 500) return;

    if (videoRef.current && streamRef.current) {
      setIsCapturing(true);
      lastCaptureTime.current = now;
      if (navigator.vibrate) navigator.vibrate(20);

      try {
        const track = streamRef.current.getVideoTracks()[0];
        let imageBlob: Blob | null = null;

        // --- METHOD 1: Native ImageCapture (RAW-like High Res) ---
        if ('ImageCapture' in window) {
            try {
                const imageCapture = new (window as any).ImageCapture(track);
                imageBlob = await imageCapture.takePhoto();
            } catch (err) {
                console.warn("ImageCapture API failed, falling back to Canvas", err);
            }
        }

        // --- METHOD 2: Canvas Fallback ---
        if (!imageBlob) {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                // Draw RAW (No filters applied here, we want clean source)
                context.filter = 'none';
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.95);
                onCapture(base64);
            }
        } else {
            const reader = new FileReader();
            reader.onloadend = () => {
                onCapture(reader.result as string);
            };
            reader.readAsDataURL(imageBlob);
        }

        if (navigator.vibrate) navigator.vibrate(40);
        if (!shouldClose) {
            setTimeout(() => { if (mountedRef.current) setIsCapturing(false); }, 500);
        }

      } catch (e) {
        console.error("Capture failed completely", e);
        setIsCapturing(false);
      }
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
