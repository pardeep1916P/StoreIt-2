"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OTPInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export const OTPInput = ({
  id,
  label,
  value,
  onChange,
  required = false,
}: OTPInputProps) => {
  const [otp, setOtp] = useState<string[]>(value.split('').slice(0, 6));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Update internal state when external value changes
    setOtp(value.split('').slice(0, 6));
  }, [value]);

  const handleChange = (index: number, inputValue: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(inputValue)) return;

    const newOtp = [...otp];
    newOtp[index] = inputValue;
    setOtp(newOtp);

    // Update parent component
    onChange(newOtp.join(''));

    // Auto-focus next input if current input is filled
    if (inputValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      onChange(newOtp.join(''));
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="space-y-1 sm:space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </Label>
             <div className="flex gap-1 sm:gap-2 md:gap-3 justify-center">
         {Array.from({ length: 6 }, (_, index) => (
           <Input
             key={index}
             ref={(el) => (inputRefs.current[index] = el)}
             type="text"
             inputMode="numeric"
             pattern="[0-9]*"
             maxLength={1}
             value={otp[index] || ''}
             onChange={(e) => handleChange(index, e.target.value)}
             onKeyDown={(e) => handleKeyDown(index, e)}
             onPaste={handlePaste}
                          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-center text-base sm:text-lg font-semibold border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand focus:border-2 transition-all duration-300 bg-white hover:border-gray-300 shadow-sm focus:shadow-md"
             required={required && index === 0}
           />
         ))}
       </div>
    </div>
  );
}; 