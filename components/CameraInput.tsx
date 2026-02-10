
import React, { useRef, ChangeEvent } from 'react';

interface CameraInputProps {
  onCapture: (base64Image: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const CameraInput: React.FC<CameraInputProps> = ({ 
  onCapture, 
  disabled = false, 
  children, 
  className = "" 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert file to Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result) {
        onCapture(result);
      }
    };
    reader.readAsDataURL(file);

    // Reset input value to allow capturing the same image again if needed
    event.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment" // This attribute forces the rear camera on mobile
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <div onClick={handleClick} className={className} role="button" tabIndex={0}>
        {children}
      </div>
    </>
  );
};
