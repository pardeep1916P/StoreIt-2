"use client";

import React, { useState, useEffect } from "react";
import { getSharedFilesClient, downloadSharedFileClient } from "@/lib/actions/file.client";
import { FileData } from "@/types";
import { useToast } from "@/hooks/use-toast";
import Thumbnail from "@/components/Thumbnail";
import { convertFileSize, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { Card } from "./ui/card";
import Image from "next/image";

const SharedFilesList = () => {
  const [sharedFiles, setSharedFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadSharedFiles = async () => {
    try {
      setIsLoading(true);
      const result = await getSharedFilesClient();
      setSharedFiles(result.documents || []);
    } catch (error) {
      toast({
        title: "Failed to Load Shared Files ❌",
        description: "Could not retrieve files shared with you.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSharedFiles();
  }, []);

  const handleDownload = async (file: FileData) => {
    try {
      const result = await downloadSharedFileClient(file.$id);
      
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started! 📥",
        description: `Downloading ${file.name}`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Download Failed ❌",
        description: "Could not download the shared file",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (sharedFiles.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="mx-auto w-16 h-16 mb-4 text-gray-400">
          <Image
            src="/assets/icons/documents.svg"
            alt="No shared files"
            width={64}
            height={64}
          />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Shared Files</h3>
        <p className="text-gray-500">Files shared with you will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Files Shared With You</h2>
        <Button
          onClick={loadSharedFiles}
          variant="outline"
          size="sm"
          className="text-sm"
        >
          Refresh
        </Button>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sharedFiles.map((file) => (
          <div
            key={file.$id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start space-x-3">
              <Thumbnail
                type={file.type}
                extension={file.extension}
                url={file.url}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                  {file.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {convertFileSize(file.size)}
                </p>
                <p className="text-xs text-gray-500">
                  Shared {formatDateTime(file.$createdAt)}
                </p>
                <div className="mt-3">
                  <Button
                    onClick={() => handleDownload(file)}
                    size="sm"
                    className="w-full text-xs"
                  >
                    <Image
                      src="/assets/icons/download.svg"
                      alt="Download"
                      width={16}
                      height={16}
                      className="mr-2"
                    />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedFilesList;
