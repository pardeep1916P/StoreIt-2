"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Chart } from "@/components/Chart";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { Separator } from "@/components/ui/separator";
import Search from "@/components/Search";
import RecentFilesList from "@/components/RecentFilesList";
import { getFiles, getTotalSpaceUsed } from "@/lib/actions/file.actions";
import { getSharedFilesClient } from "@/lib/actions/file.client";
import { convertFileSize, getUsageSummary } from "@/lib/utils";
import { useUpload } from "@/contexts/UploadContext";

const Dashboard = () => {
  const router = useRouter();
  const { setUploadCompleteHandler } = useUpload();
  const [files, setFiles] = useState<any>(null);
  const [totalSpace, setTotalSpace] = useState<any>(null);
  const [loading, setLoading] = useState(true);



  const loadData = async () => {
    try {
      // Parallel requests for regular files and total space
      const [filesData, totalSpaceData] = await Promise.all([
        getFiles({ types: [], limit: 20 }), // Reduced limit for better performance
        getTotalSpaceUsed(),
      ]);
      
      // Fetch shared files separately
      let sharedFilesData = { documents: [] };
      try {
        sharedFilesData = await getSharedFilesClient();
      } catch (error) {
        // Continue with regular files even if shared files fail
      }
      
      // Process shared files to match the structure of regular files
      const processedSharedFiles = (sharedFilesData?.documents || []).map((sharedFile: any) => {
        
        // Normalize file type for proper categorization and preview
        let normalizedType = sharedFile.type;
            
            // PRIORITY 1: Check extension first for better accuracy
            if (sharedFile.extension) {
              const ext = sharedFile.extension.toLowerCase();
              if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
                normalizedType = 'image';
              } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
                normalizedType = 'video';
              } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
                normalizedType = 'audio';
              } else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'csv'].includes(ext)) {
                normalizedType = 'document';
              }
            }
            
            // PRIORITY 2: If no type from extension, try to get it from fileType
            if (!normalizedType || (normalizedType && normalizedType.includes('/'))) {
              if (sharedFile.fileType && typeof sharedFile.fileType === 'string') {
                // Handle cases like "image/jpeg", "video/mp4", etc.
                const parts = sharedFile.fileType.split('/');
                if (parts.length > 0) {
                  // For CSV files, prioritize "document" over "text"
                  if (sharedFile.extension === 'csv') {
                    normalizedType = 'document';
                  } else {
                    normalizedType = parts[0];
                  }
                }
              }
            }
            
            // PRIORITY 3: Fallback to 'other' if still no type
            normalizedType = normalizedType || 'other';
            
            // The backend now provides the actual sender's username in the owner field
            const finalOwner = sharedFile.owner || "Unknown";
            
            return {
              ...sharedFile,
              // Ensure type field is set correctly - OVERRIDE the original type
              type: normalizedType,
              // Owner field is now set by the backend
              owner: finalOwner
            };
      });
      
      // Merge regular files and shared files for display
      const allFiles = {
        documents: [
          ...(filesData?.documents || []),
          ...processedSharedFiles
        ]
      };
      
      // Sort by creation date (newest first)
      allFiles.documents.sort((a, b) => 
        new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
      );
      

      
      setFiles(allFiles);
      
      // Use only uploaded files for storage calculations (exclude shared files)
      setTotalSpace(totalSpaceData || {
        image: { size: 0, latestDate: null },
        document: { size: 0, latestDate: null },
        video: { size: 0, latestDate: null },
        audio: { size: 0, latestDate: null },
        other: { size: 0, latestDate: null },
        used: 0,
        all: 2 * 1024 * 1024 * 1024, // 2GB
      });
    } catch (error) {
      // Set fallback values on error
      setFiles({ documents: [] });
      setTotalSpace({
        image: { size: 0, latestDate: null },
        document: { size: 0, latestDate: null },
        video: { size: 0, latestDate: null },
        audio: { size: 0, latestDate: null },
        other: { size: 0, latestDate: null },
        used: 0,
        all: 2 * 1024 * 1024 * 1024, // 2GB
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileDelete = (deletedFileId: string) => {
    setFiles((prevFiles: any) => {
      // Find the deleted file to get its size and type
      const deletedFile = prevFiles.documents.find((file: any) => file.$id === deletedFileId);
      
      if (deletedFile) {
        // Update total space by subtracting the deleted file's size
        setTotalSpace((prevTotalSpace: any) => {
          if (!prevTotalSpace) return prevTotalSpace;
          
          const newTotalSpace = { ...prevTotalSpace };
          
          // Subtract from total used
          newTotalSpace.used = Math.max(0, newTotalSpace.used - deletedFile.size);
          
          // Subtract from specific type
          const fileType = deletedFile.type;
          if (newTotalSpace[fileType] && newTotalSpace[fileType].size) {
            newTotalSpace[fileType].size = Math.max(0, newTotalSpace[fileType].size - deletedFile.size);
          }
          
          return newTotalSpace;
        });
      }
      
      return {
        ...prevFiles,
        documents: prevFiles.documents.filter((file: any) => file.$id !== deletedFileId)
      };
    });
  };

  const handleFileRename = (fileId: string, newName: string) => {
    setFiles((prevFiles: any) => {
      if (!prevFiles) return prevFiles;
      
      return {
        ...prevFiles,
        documents: prevFiles.documents.map((file: any) => 
          file.$id === fileId ? { ...file, name: newName } : file
        )
      };
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set up the upload complete handler to refresh data instead of page reload
  useEffect(() => {
    setUploadCompleteHandler(() => {
      loadData();
    });
  }, [setUploadCompleteHandler]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Get usage summary - ensure totalSpace is available
  const usageSummary = getUsageSummary(totalSpace || null);

  return (
    <div className="dashboard-container">
      <section className="dashboard-left-section">
        <Chart used={totalSpace?.used || 0} />

        {/* Uploaded file type summaries */}
        <ul className="dashboard-summary-list">
          {usageSummary.map((summary) => (
            <Link
              href={summary.url}
              key={summary.title}
              className="dashboard-summary-card"
            >
              <div className="space-y-4">
                <div className="flex justify-between gap-3">
                  <Image
                    src={summary.icon}
                    width={180}
                    height={180}
                    alt="uploaded image"
                    className="summary-type-icon"
                    style={{ width: 'auto', height: 'auto' }}
                  />
                  <h4 className="summary-type-size">
                    {convertFileSize(summary.size) || 0}
                  </h4>
                </div>

                <h5 className="summary-type-title">{summary.title}</h5>
                <Separator className="bg-light-400" />
                <FormattedDateTime
                  date={summary.latestDate}
                  className="summary-type-date"
                />
              </div>
            </Link>
          ))}
        </ul>
      </section>

      {/* Recent files uploaded */}
      <section className="dashboard-recent-files">
        <h2 className="h3 xl:h2 text-light-100 mb-2 sm:mb-3 text-sm sm:text-base md:text-lg">
          Recent files
        </h2>
        <div className="recent-files-list">
          {files && files.documents && files.documents.length > 0 ? (
            <RecentFilesList files={files.documents} onFileDelete={handleFileDelete} onFileRename={handleFileRename} />
          ) : (
            <p className="empty-list">No files available</p>
          )}
        </div>
      </section>
      
    </div>
  );
};

export default Dashboard;
