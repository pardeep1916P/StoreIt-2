"use client";

import { useState } from "react";
import { FileData } from "@/types";
import Link from "next/link";
import Thumbnail from "@/components/Thumbnail";
import { convertFileSize } from "@/lib/utils";
import FormattedDateTime from "@/components/FormattedDateTime";
import ActionDropdown from "@/components/ActionDropdown";
import { InlinePreview } from "@/components/InlinePreview";

const Card = ({ file, onFileDelete, onFileRename }: { 
  file: FileData; 
  onFileDelete?: (fileId: string) => void;
  onFileRename?: (fileId: string, newName: string) => void;
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (file.type === 'image' || file.type === 'video' || file.type === 'audio' || file.type === 'document') {
      // Open preview modal for media files and documents
      setIsPreviewOpen(true);
    } else {
      // For other files, open in new tab
      window.open(file.url, '_blank');
    }
  };

  return (
    <>
      <div 
        className="file-card cursor-pointer"
        onClick={handleFileClick}
      >
      {/* Mobile Layout */}
      <div className="flex justify-between sm:hidden">
        <div className="flex items-start gap-1 flex-1 min-w-0">
          <Thumbnail
            type={file.type}
            extension={file.extension}
            url={file.url}
            className="!size-8 flex-shrink-0"
            imageClassName="!size-4"
          />
                     <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2">
               <p className="subtitle-2 line-clamp-1 text-xs truncate">{file.name}</p>
               {file.sharedBy && file.sharedBy !== file.owner && (
                 <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-semibold border border-purple-200 shadow-sm">
                   Shared
                 </span>
               )}
             </div>
             <div className="flex items-center gap-1 mt-1">
               <FormattedDateTime
                 date={file.$createdAt}
                 className="text-xs text-light-100"
               />
               <span className="text-xs text-light-200">•</span>
               <p className="text-xs text-light-200 line-clamp-1 truncate">
                 {typeof file.owner === 'string' 
                   ? file.owner 
                   : file.owner?.fullName || "Unknown"
                 }
               </p>
             </div>
           </div>
        </div>

        <div className="flex flex-col items-end justify-end">
          <ActionDropdown file={file} onFileDelete={onFileDelete} onFileRename={onFileRename} />
          <p className="text-xs text-light-100 mt-auto">{convertFileSize(file.size)}</p>
        </div>
      </div>

             {/* PC Layout */}
       <div className="hidden sm:flex sm:justify-between">
         <Thumbnail
           type={file.type}
           extension={file.extension}
           url={file.url}
           className="!size-20 flex-shrink-0"
           imageClassName="!size-11"
         />
         <div className="flex flex-col items-end justify-end">
           <ActionDropdown file={file} onFileDelete={onFileDelete} onFileRename={onFileRename} />
           <p className="text-xs text-light-100 mt-auto">{convertFileSize(file.size)}</p>
         </div>
       </div>

       <div className="file-card-details">
         <div className="hidden sm:block">
           <div className="flex items-center gap-2">
             <p className="subtitle-2 line-clamp-1 text-base truncate">{file.name}</p>
             {file.sharedBy && file.sharedBy !== file.owner && (
               <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-semibold border border-purple-200 shadow-sm">
                 Shared
               </span>
             )}
           </div>
         </div>
         <div className="hidden sm:flex sm:flex-col sm:gap-1">
           <FormattedDateTime
             date={file.$createdAt}
             className="body-2 text-light-100 text-sm"
           />
           <p className="caption line-clamp-1 text-light-200 text-xs truncate">
             By: {typeof file.owner === 'string' 
               ? file.owner 
               : file.owner?.fullName || "Unknown"
             }
           </p>
         </div>
       </div>
      </div>
      
      <InlinePreview 
        file={file} 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
      />
    </>
  );
};
export default Card;
