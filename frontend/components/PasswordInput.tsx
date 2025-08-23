"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Check, X } from "lucide-react";

interface PasswordInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  confirmPassword?: string;
  showStrength?: boolean;
  required?: boolean;
}

export const PasswordInput = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  confirmPassword,
  showStrength = false,
  required = false,
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Password criteria checker
  const getPasswordCriteria = (password: string) => {
    return {
      minLength: password.length >= 6,
      hasCapital: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
  };

  // Password confirmation checker
  const getConfirmationStatus = () => {
    if (!confirmPassword || !value) return null;
    return value === confirmPassword;
  };

  const criteria = getPasswordCriteria(value);
  const confirmationStatus = getConfirmationStatus();

  return (
    <div className="space-y-1 sm:space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </Label>
      <div className="relative">
                 <Input
           ref={inputRef}
           id={id}
           type={showPassword ? "text" : "password"}
           placeholder={placeholder}
           value={value}
           onChange={(e) => onChange(e.target.value)}
           onFocus={() => setIsFocused(true)}
           onBlur={() => setIsFocused(false)}
                       className="h-10 sm:h-12 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand focus:border-2 transition-all duration-300 bg-white hover:border-gray-300 shadow-sm focus:shadow-md"
           required={required}
         />
                   {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 z-10"
                             onClick={(e) => {
                 e.preventDefault();
                 const currentPosition = inputRef.current?.selectionStart || 0;
                 setShowPassword(!showPassword);
                 // Restore cursor position after state update
                 setTimeout(() => {
                   if (inputRef.current) {
                     inputRef.current.setSelectionRange(currentPosition, currentPosition);
                   }
                 }, 0);
               }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-500" />
              ) : (
                <Eye className="h-4 w-4 text-gray-500" />
              )}
            </Button>
          )}
      </div>
      
             {/* Password criteria indicator */}
       {showStrength && value && isFocused && (
         <div className="space-y-1 mt-2">
           <div className="flex items-center gap-2">
             {criteria.minLength ? (
               <Check className="h-3 w-3" style={{ color: '#10b981' }} />
             ) : (
               <X className="h-3 w-3" style={{ color: '#ef4444' }} />
             )}
             <span className="text-xs text-gray-600">Minimum 6 characters</span>
           </div>
           <div className="flex items-center gap-2">
             {criteria.hasCapital ? (
               <Check className="h-3 w-3" style={{ color: '#10b981' }} />
             ) : (
               <X className="h-3 w-3" style={{ color: '#ef4444' }} />
             )}
             <span className="text-xs text-gray-600">One capital letter</span>
           </div>
           <div className="flex items-center gap-2">
             {criteria.hasNumber ? (
               <Check className="h-3 w-3" style={{ color: '#10b981' }} />
             ) : (
               <X className="h-3 w-3" style={{ color: '#ef4444' }} />
             )}
             <span className="text-xs text-gray-600">One number</span>
           </div>
           <div className="flex items-center gap-2">
             {criteria.hasSpecial ? (
               <Check className="h-3 w-3" style={{ color: '#10b981' }} />
             ) : (
               <X className="h-3 w-3" style={{ color: '#ef4444' }} />
             )}
             <span className="text-xs text-gray-600">One special symbol</span>
           </div>
         </div>
       )}

             {/* Password confirmation indicator */}
       {confirmPassword !== undefined && value && confirmPassword && isFocused && (
         <div className="flex items-center gap-2 mt-1">
           {confirmationStatus ? (
             <>
               <Check className="h-4 w-4" style={{ color: '#10b981' }} />
               <span className="text-xs" style={{ color: '#059669' }}>Passwords match</span>
             </>
           ) : (
             <>
               <X className="h-4 w-4" style={{ color: '#ef4444' }} />
               <span className="text-xs" style={{ color: '#dc2626' }}>Passwords don't match</span>
             </>
           )}
         </div>
       )}
    </div>
  );
}; 