"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";

// Utility function for debouncing
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};
import Sort from "@/components/Sort";
import { getFiles } from "@/lib/actions/file.actions";
import { getSharedFilesClient } from "@/lib/actions/file.client";
import Card from "@/components/Card";
import { getFileTypesParams, convertFileSize } from "@/lib/utils";
import { FileType, SearchParamProps } from "@/types";

const Page = ({ searchParams, params }: SearchParamProps) => {
  const [type, setType] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [sort, setSort] = useState<string>("");
  const [files, setFiles] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [categoryReady, setCategoryReady] = useState(false);
  
  // Request deduplication - prevent multiple simultaneous requests
  const [requestInProgress, setRequestInProgress] = useState(false);
  const [lastRequestKey, setLastRequestKey] = useState<string>('');

  // Handle async params
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      const resolvedSearchParams = await searchParams;
      
      const newType = (resolvedParams?.type as string) || "";
      const newSearchText = (resolvedSearchParams?.query as string) || "";
      const newSort = (resolvedSearchParams?.sort as string) || "";
      
      setType(newType);
      setSearchText(newSearchText);
      setSort(newSort);
      
      // Mark category as ready when type changes
      if (newType) {
        setCategoryReady(true);
      }
    };
    
    resolveParams();
  }, [params, searchParams]);

  const types = useMemo(() => getFileTypesParams(type) as FileType[], [type]);

  // Cache for file type normalization to avoid repeated processing
  const fileTypeCache = useMemo(() => new Map<string, string>(), []);
  
  // Debounced search to prevent excessive API calls
  const debouncedLoadFiles = useCallback(
    debounce(() => {
      if (categoryReady && types.length) {
        loadFiles();
      }
    }, 300),
    [categoryReady, types]
  );
  
  // Optimized file type normalization function
  const normalizeFileType = useMemo(() => (file: any): string => {
    // Check cache first
    const cacheKey = `${file.extension}-${file.fileType}-${file.type}`;
    if (fileTypeCache.has(cacheKey)) {
      return fileTypeCache.get(cacheKey)!;
    }
    
    let normalizedType = file.type;
    
    // PRIORITY 1: Check extension first for better accuracy
    if (file.extension) {
      const ext = file.extension.toLowerCase();
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
      if (file.fileType && typeof file.fileType === 'string') {
        const parts = file.fileType.split('/');
        if (parts.length > 0) {
          if (file.extension === 'csv') {
            normalizedType = 'document';
          } else {
            normalizedType = parts[0];
          }
        }
      }
    }
    
    // PRIORITY 3: Fallback to 'other' if still no type
    normalizedType = normalizedType || 'other';
    
    // Cache the result
    fileTypeCache.set(cacheKey, normalizedType);
    return normalizedType;
  }, [fileTypeCache]);

  const loadFiles = async () => {
    // Don't load files until we have the category type
    if (!categoryReady || !types.length) {
      return;
    }

    // Request deduplication - prevent multiple simultaneous requests
    const requestKey = `${type}-${searchText}-${sort}`;
    if (requestInProgress && lastRequestKey === requestKey) {
      return;
    }

    try {
      setRequestInProgress(true);
      setLastRequestKey(requestKey);
      setLoading(true);
      
      // PARALLEL API calls for maximum speed
      const [filesData, sharedFilesData] = await Promise.allSettled([
        getFiles({ types, searchText, sort }),
        getSharedFilesClient()
      ]);
      
      // Process results with error handling
      const regularFiles = filesData.status === 'fulfilled' ? (filesData.value?.documents || []) : [];
      const sharedFiles = sharedFilesData.status === 'fulfilled' ? (sharedFilesData.value?.documents || []) : [];
      
      // Process and filter shared files with optimized normalization
      const filteredSharedFiles = sharedFiles
        .map((sharedFile: any) => ({
          ...sharedFile,
          type: normalizeFileType(sharedFile),
          owner: sharedFile.owner || "Unknown"
        }))
        .filter((file: any) => types.includes(file.type));
      
      // Merge files
      const allFiles = {
        documents: [...regularFiles, ...filteredSharedFiles]
      };
      

      

      
      // Apply search filter if provided
      if (searchText) {
        allFiles.documents = allFiles.documents.filter(file =>
          file.name.toLowerCase().includes(searchText.toLowerCase())
        );
      }
      
      // Apply sorting
      if (sort) {
        allFiles.documents.sort((a, b) => {
          switch (sort) {
            case 'name':
              return a.name.localeCompare(b.name);
            case 'size':
              return b.size - a.size;
            case 'date':
              return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
            default:
              return 0;
          }
        });
      } else {
        // Default sort by date (newest first)
        allFiles.documents.sort((a, b) => 
          new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
        );
      }
      
      setFiles(allFiles);
    } catch (error) {
      setFiles({ documents: [] });
    } finally {
      setLoading(false);
      setRequestInProgress(false);
    }
  };

  useEffect(() => {
    if (categoryReady && types.length) {
      loadFiles();
    }
  }, [type, sort, categoryReady]);

  // Debounced search effect
  useEffect(() => {
    if (categoryReady && types.length) {
      debouncedLoadFiles();
    }
  }, [searchText, debouncedLoadFiles, categoryReady, types]);

  const handleFileDelete = (deletedFileId: string) => {
    // Optimistic update - remove file immediately for better UX
    setFiles((prevFiles: any) => ({
      ...prevFiles,
      documents: prevFiles.documents.filter((file: any) => file.$id !== deletedFileId)
    }));
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

  if (!categoryReady) {
    return (
      <div className="page-container">
        <section className="w-full">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-6"></div>
            <div className="flex justify-between items-center mb-8">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Show loading state only when actually loading files, not when category is resolving
  if (loading) {
    return (
      <div className="page-container">
        <section className="w-full">
          <h1 className="h1 capitalize">{type}</h1>
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </section>
      </div>
    );
  }

  // Calculate total storage for this category (only uploaded files, not shared)
  const totalStorage = files?.documents?.reduce((total: number, file: any) => {
    // Only count files that are not shared (i.e., files where owner === current user or no sharedBy)
    if (!file.sharedBy || file.sharedBy === file.owner) {
      return total + file.size;
    }
    return total;
  }, 0) || 0;

  return (
    <div className="page-container">
      <section className="w-full">
        <h1 className="h1 capitalize">{type}</h1>

        <div className="total-size-section">
          <p className="body-1">
            Total: <span className="h5">{convertFileSize(totalStorage)}</span>
          </p>

          <div className="sort-container">
            <p className="body-1 hidden text-light-200 sm:block">Sort by:</p>

            <Sort />
          </div>
        </div>
      </section>

      {/* Render the files */}
      {files?.documents && files.documents.length > 0 ? (
        <section className="file-list">
          {files.documents.map((file: any) => (
            <Card key={file.$id} file={file} onFileDelete={handleFileDelete} onFileRename={handleFileRename} />
          ))}
        </section>
      ) : (
        <p className="empty-list">No files available</p>
      )}
    </div>
  );
};

export default Page;
