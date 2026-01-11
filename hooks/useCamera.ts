
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
      // 1. OCR-First Constraints
      // Request 4K resolution (3840x2160) or highest available.
      // High resolution is the #1 factor for OCR accuracy.
      // We prioritize resolution over frame rate.
      const constraints: MediaStreamConstraints = {
        video: { 
            facingMode: 'environment',
            width: { ideal: 3840 }, 
            height: { ideal: 2160 },
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

      // --- ADVANCED ISP TUNING FOR TEXT ---
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        const advancedConstraints: any = [];

        // A. Focus: Sharpness is critical.
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
           advancedConstraints.push({ focusMode: 'continuous' });
        }

        // B. Exposure: We want "balanced" to "slightly bright" for paper documents.
        // We use continuous auto-exposure but bias it slightly up.
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
           advancedConstraints.push({ exposureMode: 'continuous' });
        }

        // C. Exposure Compensation: +0.33 to +0.5 EV
        // Just enough to brighten paper background without washing out black text.
        // Avoid going too high to prevent ISO noise.
        if (capabilities.exposureCompensation) {
            const min = capabilities.exposureCompensation.min;
            const max = capabilities.exposureCompensation.max;
            const step = capabilities.exposureCompensation.step;
            
            let targetEV = 0.5; // Slight boost for text readability
            if (targetEV > max) targetEV = max;
            if (targetEV < min) targetEV = min;
            if (step > 0) {
                targetEV = Math.round((targetEV - min) / step) * step + min;
            }
            advancedConstraints.push({ exposureCompensation: targetEV });
        }

        // D. White Balance: Accurate white balance keeps paper looking white, not yellow/blue.
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
        quality: 100, // Max quality for OCR
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

        // --- METHOD 1: Native ImageCapture (The "Pro" Way) ---
        // Attempts to use the hardware ISP to take a real photo (HDR, Denoise, Sharpening).
        // This produces significantly better text clarity than grabbing a video frame.
        if ('ImageCapture' in window) {
            try {
                const imageCapture = new (window as any).ImageCapture(track);
                // takePhoto() triggers the still-image pipeline (higher res, better processing)
                imageBlob = await imageCapture.takePhoto();
                console.log("Captured via ImageCapture API (High Quality)");
            } catch (err) {
                console.warn("ImageCapture API failed, falling back to Canvas", err);
            }
        }

        // --- METHOD 2: Canvas Fallback (The "Fast" Way) ---
        // Used if ImageCapture is not supported or fails.
        // Optimized specifically for OCR: Grayscale + High Contrast.
        if (!imageBlob) {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            // Use intrinsic video size (likely 4K if negotiation succeeded)
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const context = canvas.getContext('2d');
            if (context) {
                // OCR PRE-PROCESSING FILTERS:
                // 1. Grayscale (100%): Removes color noise (chroma noise) which confuses OCR.
                // 2. Contrast (140%): Makes black text darker and white paper brighter.
                // 3. Brightness (105%): Compensates for contrast darkening.
                // 4. Sharpening: (Simulated via high resolution + contrast)
                context.filter = 'grayscale(100%) contrast(140%) brightness(105%)';
                
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Max quality JPEG
                const base64 = canvas.toDataURL('image/jpeg', 0.95);
                onCapture(base64);
            }
        } else {
            // Process the High-Quality Blob from Method 1
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
