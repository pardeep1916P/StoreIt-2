"use client";

import React, { useCallback, useState, useEffect } from "react";

import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn, convertFileToUrl, getFileType } from "@/lib/utils";
import Image from "next/image";
import Thumbnail from "@/components/Thumbnail";
import { MAX_FILE_SIZE } from "@/constants";
import { useToast } from "@/hooks/use-toast";
import { uploadFileClient } from "@/lib/actions/file.client";
import { usePathname } from "next/navigation";
import { useUpload } from "@/contexts/UploadContext";

interface Props {
  ownerId: string;
  accountId: string;
  className?: string;
  showButtonOnly?: boolean;
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
}

const FileUploader = ({ ownerId, accountId, className, showButtonOnly = false, onUploadStart, onUploadComplete }: Props) => {
  const path = usePathname();
  const { toast } = useToast();
  const { showGlobalUploadPopup, hideGlobalUploadPopup } = useUpload();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Check if we're on mobile
      const isMobile = window.innerWidth <= 768;
      
      if (showButtonOnly) {
        // For mobile button-only mode, always use global popup
        showGlobalUploadPopup(acceptedFiles, true, {});
        setIsUploading(true);
        
        // Close mobile menu immediately
        if (onUploadStart) {
          onUploadStart();
        }
      } else {
        // For desktop or non-button-only mode, use local state
        setFiles(acceptedFiles);
        setIsUploading(true);
      }

      const uploadPromises = acceptedFiles.map(async (file) => {
          if (file.size > MAX_FILE_SIZE) {
            setFiles((prevFiles) =>
              prevFiles.filter((f) => f.name !== file.name),
            );

            return toast({
              description: (
                <p className="body-2 text-white">
                  <span className="font-semibold">{file.name}</span> is too large.
                  Max file size is 50MB.
                </p>
              ),
              className: "error-toast",
            });
          }

          return uploadFileClient({ 
            file, 
            ownerId, 
            accountId, 
            path,
            onProgress: (progress) => {
              const newProgress = { ...uploadProgress, [file.name]: progress };
              setUploadProgress(newProgress);
              
              // Update global popup if in button-only mode
              if (showButtonOnly) {
                showGlobalUploadPopup(acceptedFiles, true, newProgress);
              }
            }
          }).then(
            (uploadedFile) => {
              if (uploadedFile) {
                setFiles((prevFiles) =>
                  prevFiles.filter((f) => f.name !== file.name),
                );
                // Clear progress for this file
                setUploadProgress(prev => {
                  const newProgress = { ...prev };
                  delete newProgress[file.name];
                  return newProgress;
                });
              }
            },
          );
        });

        Promise.all(uploadPromises).then(() => {
          setIsUploading(false);
          
          // Call the upload complete callback to refresh the file list
          if (onUploadComplete) {
            onUploadComplete();
          }
          
          // Update global popup to show completion
          if (showButtonOnly) {
            showGlobalUploadPopup(acceptedFiles, false, uploadProgress);
            
            // Hide global popup after delay
            setTimeout(() => {
              hideGlobalUploadPopup();
            }, 2000);
          } else {
            // Upload complete - popup will remain visible for a moment then clear
            setTimeout(() => {
              setFiles([]);
            }, 2000); // Show "Upload Complete" for 2 seconds then hide
          }
        });
    },
    [ownerId, accountId, path, onUploadStart],
  );

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop,
    onDropAccepted: (files) => {
    },
    onDropRejected: (rejections) => {
    }
  });

  const handleRemoveFile = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>,
    fileName: string,
  ) => {
    e.stopPropagation();
    setFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName));
  };

  // Render upload popup at root level for mobile
  const renderUploadPopup = () => {
    if (!files.length) return null;

    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // For mobile, render directly in the component but with absolute positioning
      return (
        <ul className="uploader-preview-list mobile-upload-popup">
          <h4 className="h4 text-light-100">
            {isUploading ? "Uploading..." : "Upload Complete"}
          </h4>

          {files.map((file, index) => {
            const { type, extension } = getFileType(file.name);

            return (
              <li
                key={`${file.name}-${index}`}
                className="uploader-preview-item"
              >
                <div className="flex items-center gap-3">
                  <Thumbnail
                    type={type}
                    extension={extension}
                    url={convertFileToUrl(file)}
                  />

                  <div className="preview-item-name">
                    <div className="flex flex-col gap-1">
                      <span>{file.name}</span>
                      {isUploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-brand h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress[file.name] || 0}%` }}
                          />
                        </div>
                      )}
                      {!isUploading && uploadProgress[file.name] === 100 && (
                        <span className="text-green-500 text-sm">✓ Complete</span>
                      )}
                    </div>
                  </div>
                </div>

                <Image
                  src="/assets/icons/remove.svg"
                  width={24}
                  height={24}
                  alt="Remove"
                  onClick={(e) => handleRemoveFile(e, file.name)}
                  style={{ width: 'auto', height: 'auto' }}
                />
              </li>
            );
          })}
        </ul>
      );
    }

    // For desktop, render normally
    return (
      <ul className="uploader-preview-list">
        <h4 className="h4 text-light-100">
          {isUploading ? "Uploading..." : "Upload Complete"}
        </h4>

        {files.map((file, index) => {
          const { type, extension } = getFileType(file.name);

          return (
            <li
              key={`${file.name}-${index}`}
              className="uploader-preview-item"
            >
              <div className="flex items-center gap-3">
                <Thumbnail
                  type={type}
                  extension={extension}
                  url={convertFileToUrl(file)}
                />

                <div className="preview-item-name">
                  <div className="flex flex-col gap-1">
                    <span>{file.name}</span>
                    {isUploading && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-brand h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[file.name] || 0}%` }}
                        />
                      </div>
                    )}
                    {!isUploading && uploadProgress[file.name] === 100 && (
                      <span className="text-green-500 text-sm">✓ Complete</span>
                    )}
                  </div>
                </div>
              </div>

              <Image
                src="/assets/icons/remove.svg"
                width={24}
                height={24}
                alt="Remove"
                onClick={(e) => handleRemoveFile(e, file.name)}
                style={{ width: 'auto', height: 'auto' }}
              />
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <div {...getRootProps()} className="cursor-pointer">
        <input {...getInputProps()} />
        <Button type="button" className={cn("uploader-button", className)}>
          <Image
            src="/assets/icons/upload.svg"
            alt="upload"
            width={24}
            height={24}
            style={{ width: 'auto', height: 'auto' }}
          />{" "}
          <p>Upload</p>
        </Button>
      </div>
      
      {/* Render popup outside the button container */}
      {!showButtonOnly && renderUploadPopup()}
      
      {/* For mobile, always render popup at root level */}
      {showButtonOnly && renderUploadPopup()}
    </>
  );
};

export default FileUploader;
