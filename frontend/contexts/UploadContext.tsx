"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";

interface UploadContextType {
  onUploadComplete?: () => void;
  setUploadCompleteHandler: (handler: () => void) => void;
  showGlobalUploadPopup: (files: File[], isUploading: boolean, uploadProgress: { [key: string]: number }) => void;
  hideGlobalUploadPopup: () => void;
  globalUploadState: {
    files: File[];
    isUploading: boolean;
    uploadProgress: { [key: string]: number };
    visible: boolean;
  };
}

const UploadContext = createContext<UploadContextType>({});

export const UploadProvider = ({ children, onUploadComplete }: { children: ReactNode; onUploadComplete?: () => void }) => {
  const [customHandler, setCustomHandler] = useState<(() => void) | null>(null);
  const [globalUploadState, setGlobalUploadState] = useState<{
    files: File[];
    isUploading: boolean;
    uploadProgress: { [key: string]: number };
    visible: boolean;
  }>({
    files: [],
    isUploading: false,
    uploadProgress: {},
    visible: false
  });

  const setUploadCompleteHandler = useCallback((handler: () => void) => {
    setCustomHandler(() => handler);
  }, []);

  const handleUploadComplete = useCallback(() => {
    if (customHandler) {
      customHandler();
    } else if (onUploadComplete) {
      onUploadComplete();
    }
  }, [customHandler, onUploadComplete]);

  const showGlobalUploadPopup = useCallback((files: File[], isUploading: boolean, uploadProgress: { [key: string]: number }) => {
    setGlobalUploadState({
      files,
      isUploading,
      uploadProgress,
      visible: true
    });
  }, []);

  const hideGlobalUploadPopup = useCallback(() => {
    setGlobalUploadState(prev => ({
      ...prev,
      visible: false
    }));
  }, []);

  return (
    <UploadContext.Provider value={{ 
      onUploadComplete: handleUploadComplete, 
      setUploadCompleteHandler,
      showGlobalUploadPopup,
      hideGlobalUploadPopup,
      globalUploadState
    }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}; 