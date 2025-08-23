"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface SimplePasswordInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export const SimplePasswordInput = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = false,
}: SimplePasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

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
    </div>
  );
}; 