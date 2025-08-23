"use client";

import React from "react";
import Image from "next/image";
import Thumbnail from "@/components/Thumbnail";
import { cn, convertFileToUrl, getFileType } from "@/lib/utils";
import { useUpload } from "@/contexts/UploadContext";

const GlobalUploadPopup = () => {
  const { globalUploadState, hideGlobalUploadPopup } = useUpload();
  const { files, isUploading, uploadProgress, visible } = globalUploadState;

    if (!visible || files.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999]">
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h4 className="h5 text-gray-900 font-medium">
            {isUploading ? "📤 Uploading..." : "✅ Upload Complete"}
          </h4>
          <button
            onClick={hideGlobalUploadPopup}
            className="p-2 hover:bg-gray-200/80 rounded-full transition-all duration-200 backdrop-blur-sm border border-gray-300/50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {files.map((file, index) => {
            const { type, extension } = getFileType(file.name);

            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-2 bg-gray-50/80 rounded-lg"
              >
                <Thumbnail
                  type={type}
                  extension={extension}
                  url={convertFileToUrl(file)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </span>
                    {isUploading && (
                      <div className="w-full bg-gray-200/60 rounded-full h-1.5">
                        <div 
                          className="bg-brand h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[file.name] || 0}%` }}
                        />
                      </div>
                    )}
                    {!isUploading && uploadProgress[file.name] === 100 && (
                      <span className="text-green-600 text-xs font-medium">✓ Complete</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GlobalUploadPopup;
