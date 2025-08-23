"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ShareNotificationProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

const ShareNotification: React.FC<ShareNotificationProps> = ({ 
  message, 
  onClose, 
  duration = 5000 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleViewSharedFiles = () => {
    // Scroll to shared files section
    const sharedFilesSection = document.querySelector('.dashboard-shared-files');
    if (sharedFilesSection) {
      sharedFilesSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    toast({
      title: "Shared Files 📁",
      description: "Scroll down to see files shared with you",
      duration: 3000,
    });
    
    handleClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-2">File Shared! 🎉</h4>
            <p className="text-sm text-gray-600 mb-3">{message}</p>
            <div className="flex space-x-2">
              <Button
                onClick={handleViewSharedFiles}
                size="sm"
                className="text-xs"
              >
                View Shared Files
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareNotification;
