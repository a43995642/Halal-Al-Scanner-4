
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
      // 1. Improved constraints for better clarity (Point 1)
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

      // Check Capabilities for torch and focus
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = ((track.getCapabilities && track.getCapabilities()) || {}) as any;
        
        if (capabilities.torch) setHasTorch(true);
        
        // Ensure continuous focus if supported (Point 2)
        if (capabilities.focusMode?.includes('continuous')) {
           track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }).catch(() => {});
        }
      } catch (e) {
        console.warn("Capabilities check failed", e);
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
        quality: 90, // Point 1: Balanced high quality
        allowEditing: false,
        resultType: CameraResultType.Uri, // Point 1: Better memory management
        source: CameraSource.Camera,
        correctOrientation: true, // Point 5: Auto Orientation
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
    
    // Multi-shot Cooldown (300ms) (Point 4)
    const now = Date.now();
    if (!shouldClose && now - lastCaptureTime.current < 300) return;

    if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
      setIsCapturing(true);
      lastCaptureTime.current = now;

      // Soft Haptic Feedback (Point 3)
      if (navigator.vibrate) navigator.vibrate(15);

      const video = videoRef.current;
      
      // Delay (150ms) to allow focus to stabilize (Point 2)
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        if (context) {
          // Point 5: Enhancement for better OCR (Contrast/Brightness)
          context.filter = 'contrast(1.15) brightness(1.02)';
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9); // Quality 90% (Point 1)
          
          if (navigator.vibrate) navigator.vibrate(25);
          
          onCapture(imageDataUrl);
          
          if (!shouldClose) {
            // Allow next shot after safety pause
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
