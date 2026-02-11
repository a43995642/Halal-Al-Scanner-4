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
  
  // Zoom State
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [supportsZoom, setSupportsZoom] = useState(false);

  // Helper to stop all tracks on a stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        // Explicitly remove track to ensure Android releases the camera
        streamRef.current?.removeTrack(track); 
      });
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    
    if (!mountedRef.current) return;

    // Check Permissions first on Native
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera !== 'granted') {
             const request = await Camera.requestPermissions();
             if (request.camera !== 'granted' && request.camera !== 'limited') {
                 setError('يرجى منح إذن الكاميرا من إعدادات الهاتف لاستخدام التطبيق.');
                 return;
             }
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
      const constraints: MediaStreamConstraints = {
        video: { 
            facingMode: 'environment',
            width: { ideal: 3840 }, 
            height: { ideal: 2160 },
            frameRate: { ideal: 30, max: 30 },
            // Try to request zoom initially if supported by browser
            zoom: 1 
        } as any,
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
        // Promise handling for play() to avoid "The play() request was interrupted" error
        videoRef.current.play().catch(e => {
             if (mountedRef.current) console.warn("Video play interrupted:", e);
        });
      }

      // --- ISP BALANCED TUNING & ZOOM ---
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        const advancedConstraints: any = [];

        // Torch Support
        if (capabilities.torch) setHasTorch(true);

        // Zoom Support
        if (capabilities.zoom) {
            setSupportsZoom(true);
            setMinZoom(capabilities.zoom.min || 1);
            setMaxZoom(capabilities.zoom.max || 1);
            setZoom(capabilities.zoom.min || 1); // Reset zoom
        }

        // Auto Focus/Exposure/White Balance
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
           advancedConstraints.push({ focusMode: 'continuous' });
        }
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
           advancedConstraints.push({ exposureMode: 'continuous' });
        }
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
        }

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
    // Stop stream before opening native camera to release hardware resource
    stopStream();

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
    } finally {
      // Restart stream when coming back from native camera
      if (mountedRef.current) {
          startCamera();
      }
    }
  };

  const cleanupCamera = useCallback(() => {
    stopStream();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopStream]);

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

  const setZoomLevel = useCallback(async (zoomValue: number) => {
      if (!streamRef.current || !supportsZoom) return;
      const track = streamRef.current.getVideoTracks()[0];
      try {
          await track.applyConstraints({ advanced: [{ zoom: zoomValue }] as any });
          setZoom(zoomValue);
      } catch (e) {
          console.error("Zoom failed", e);
      }
  }, [supportsZoom]);

  const captureImage = useCallback(async (onCapture: (imageSrc: string) => void, shouldClose: boolean = true) => {
    if (isCapturing) return;
    
    const now = Date.now();
    if (!shouldClose && now - lastCaptureTime.current < 500) return;

    if (videoRef.current && streamRef.current) {
      setIsCapturing(true);
      lastCaptureTime.current = now;
      if (navigator.vibrate) navigator.vibrate(20);

      try {
        const track = streamRef.current.getVideoTracks()[0];
        let imageBlob: Blob | null = null;

        if ('ImageCapture' in window) {
            try {
                const imageCapture = new (window as any).ImageCapture(track);
                imageBlob = await imageCapture.takePhoto();
            } catch (err) {
                console.warn("ImageCapture API failed, falling back to Canvas", err);
            }
        }

        if (!imageBlob) {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
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
    zoom,
    minZoom,
    maxZoom,
    supportsZoom,
    setZoomLevel
  };
};