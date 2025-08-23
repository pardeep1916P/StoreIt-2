"use client";

import { useState } from "react";
import { FileData } from "@/types";
import Link from "next/link";
import { Thumbnail } from "@/components/Thumbnail";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import ActionDropdown from "@/components/ActionDropdown";
import { InlinePreview } from "@/components/InlinePreview";

interface RecentFilesListProps {
  files: FileData[];
  onFileDelete?: (fileId: string) => void;
  onFileRename?: (fileId: string, newName: string) => void;
}

const RecentFilesList = ({ files, onFileDelete, onFileRename }: RecentFilesListProps) => {
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);

  const handleFileClick = (e: React.MouseEvent, file: FileData) => {
    e.preventDefault();
    
    if (file.type === 'image' || file.type === 'video' || file.type === 'audio' || file.type === 'document') {
      // Open preview modal for media files and documents
      setPreviewFile(file);
    } else {
      // For other files, open in new tab
      window.open(file.url, '_blank');
    }
  };

  return (
    <>
      <ul className="flex flex-col gap-0">
        {files.map((file: FileData) => {
          return (
            <div key={file.$id} className="flex items-center gap-1">
              <div
                className="flex flex-1 items-center gap-1 cursor-pointer"
                onClick={(e) => handleFileClick(e, file)}
              >
                <Thumbnail
                  type={file.type}
                  extension={file.extension}
                  url={file.url}
                />

                <div className="recent-file-details">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="recent-file-name">{file.name}</p>
                      {file.sharedBy && file.sharedBy !== file.owner && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-semibold border border-purple-200 shadow-sm">
                          Shared
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <FormattedDateTime
                        date={file.$createdAt}
                        className="caption"
                      />
                      <span className="caption text-light-200">•</span>
                      <p className="caption text-light-200 line-clamp-1 truncate">
                        {typeof file.owner === 'string' 
                          ? file.owner 
                          : file.owner?.fullName || "Unknown"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <ActionDropdown file={file} onFileDelete={onFileDelete} onFileRename={onFileRename} />
            </div>
          );
        })}
      </ul>
      
      {previewFile && (
        <InlinePreview 
          file={previewFile} 
          isOpen={!!previewFile} 
          onClose={() => setPreviewFile(null)} 
        />
      )}
    </>
  );
};

export default RecentFilesList; 