"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { smartHttpClient } from '../utils';
import { getCurrentUser, getAuthToken } from './user.actions';

// Import types
import type { 
  UploadFileProps, 
  GetFilesProps, 
  FileType, 
  RenameFileProps, 
  UpdateFileUsersProps, 
  DeleteFileProps 
} from '../../types';

// Set to true for local development, false for production with AWS
const isDevelopmentMode = false;

const handleError = (error: unknown, message: string) => {
  throw error;
};

// Server-side upload function (runs on server)
export const uploadFile = async ({
  file,
  ownerId,
  accountId,
  path,
}: UploadFileProps) => {
  try {

    
    if (isDevelopmentMode) {
      // Development mode - mock file upload
      const mockFile = {
        id: `dev-file-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        userId: ownerId,
      };
      
      revalidatePath(path);
      return mockFile;
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData: base64Data,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    revalidatePath(path);
    return result;
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

const createQueries = (
  currentUser: any,
  types: string[],
  searchText: string,
  sort: string,
  limit?: number,
) => {
  const params = new URLSearchParams();
  
  if (types.length > 0) params.append('types', types.join(','));
  if (searchText) params.append('search', searchText);
  if (sort) params.append('sort', sort);
  if (limit) params.append('limit', limit.toString());

  return params.toString();
};

export const getFiles = async ({
  types = [],
  searchText = "",
  sort = "$createdAt-desc",
  limit,
}: GetFilesProps) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - return mock files with proper structure
      const mockFiles = [
        {
          $id: 'dev-file-1',
          $createdAt: new Date().toISOString(),
          name: 'sample-document.pdf',
          size: 1024 * 1024, // 1MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'pdf',
          bucketFileId: 'dev-bucket-1',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-2',
          $createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          name: 'sample-image.jpg',
          size: 512 * 1024, // 512KB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop&crop=center',
          extension: 'jpg',
          bucketFileId: 'dev-bucket-2',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-3',
          $createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          name: 'sample-video.mp4',
          size: 2048 * 1024, // 2MB
          type: 'video',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          extension: 'mp4',
          bucketFileId: 'dev-bucket-3',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-4',
          $createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          name: 'sample-audio.mp3',
          size: 256 * 1024, // 256KB
          type: 'audio',
          url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
          extension: 'mp3',
          bucketFileId: 'dev-bucket-4',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-5',
          $createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          name: 'sample-archive.zip',
          size: 1536 * 1024, // 1.5MB
          type: 'other',
          url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-zip-file.zip',
          extension: 'zip',
          bucketFileId: 'dev-bucket-5',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-6',
          $createdAt: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
          name: 'landscape-photo.jpg',
          size: 768 * 1024, // 768KB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop&crop=center',
          extension: 'jpg',
          bucketFileId: 'dev-bucket-6',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-7',
          $createdAt: new Date(Date.now() - 21600000).toISOString(), // 6 hours ago
          name: 'portrait-photo.jpg',
          size: 640 * 1024, // 640KB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=center',
          extension: 'jpg',
          bucketFileId: 'dev-bucket-7',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-8',
          $createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          name: 'presentation.pptx',
          size: 2048 * 1024, // 2MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'pptx',
          bucketFileId: 'dev-bucket-8',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-9',
          $createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          name: 'meeting-recording.mp4',
          size: 5120 * 1024, // 5MB
          type: 'video',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          extension: 'mp4',
          bucketFileId: 'dev-bucket-9',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-10',
          $createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          name: 'project-specs.docx',
          size: 1536 * 1024, // 1.5MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'docx',
          bucketFileId: 'dev-bucket-10',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-11',
          $createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
          name: 'team-photo.png',
          size: 1024 * 1024, // 1MB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop&crop=center',
          extension: 'png',
          bucketFileId: 'dev-bucket-11',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-12',
          $createdAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
          name: 'podcast-episode.mp3',
          size: 3072 * 1024, // 3MB
          type: 'audio',
          url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
          extension: 'mp3',
          bucketFileId: 'dev-bucket-12',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-13',
          $createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          name: 'data-backup.tar.gz',
          size: 4096 * 1024, // 4MB
          type: 'other',
          url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-zip-file.zip',
          extension: 'tar.gz',
          bucketFileId: 'dev-bucket-13',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-14',
          $createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          name: 'screenshot.png',
          size: 512 * 1024, // 512KB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&h=200&fit=crop&crop=center',
          extension: 'png',
          bucketFileId: 'dev-bucket-14',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-15',
          $createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          name: 'quick-notes.txt',
          size: 128 * 1024, // 128KB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'txt',
          bucketFileId: 'dev-bucket-15',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-16',
          $createdAt: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          name: 'logo-design.ai',
          size: 2560 * 1024, // 2.5MB
          type: 'other',
          url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-zip-file.zip',
          extension: 'ai',
          bucketFileId: 'dev-bucket-16',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-17',
          $createdAt: new Date(Date.now() - 15000).toISOString(), // 15 seconds ago
          name: 'video-tutorial.mp4',
          size: 8192 * 1024, // 8MB
          type: 'video',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          extension: 'mp4',
          bucketFileId: 'dev-bucket-17',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-18',
          $createdAt: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
          name: 'invoice.pdf',
          size: 768 * 1024, // 768KB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'pdf',
          bucketFileId: 'dev-bucket-18',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-19',
          $createdAt: new Date(Date.now() - 2000).toISOString(), // 2 seconds ago
          name: 'wallpaper.jpg',
          size: 2048 * 1024, // 2MB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop&crop=center',
          extension: 'jpg',
          bucketFileId: 'dev-bucket-19',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-20',
          $createdAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
          name: 'final-report.docx',
          size: 3072 * 1024, // 3MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'docx',
          bucketFileId: 'dev-bucket-20',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-21',
          $createdAt: new Date(Date.now() - 500).toISOString(), // 0.5 seconds ago
          name: 'design-mockup.psd',
          size: 4096 * 1024, // 4MB
          type: 'other',
          url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-zip-file.zip',
          extension: 'psd',
          bucketFileId: 'dev-bucket-21',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-22',
          $createdAt: new Date(Date.now() - 250).toISOString(), // 0.25 seconds ago
          name: 'product-catalog.pdf',
          size: 1536 * 1024, // 1.5MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'pdf',
          bucketFileId: 'dev-bucket-22',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-23',
          $createdAt: new Date(Date.now() - 100).toISOString(), // 0.1 seconds ago
          name: 'team-meeting.mp4',
          size: 6144 * 1024, // 6MB
          type: 'video',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          extension: 'mp4',
          bucketFileId: 'dev-bucket-23',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-24',
          $createdAt: new Date(Date.now() - 50).toISOString(), // 0.05 seconds ago
          name: 'logo-variants.png',
          size: 896 * 1024, // 896KB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop&crop=center',
          extension: 'png',
          bucketFileId: 'dev-bucket-24',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-25',
          $createdAt: new Date(Date.now() - 25).toISOString(), // 0.025 seconds ago
          name: 'client-feedback.docx',
          size: 2048 * 1024, // 2MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'docx',
          bucketFileId: 'dev-bucket-25',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-26',
          $createdAt: new Date(Date.now() - 10).toISOString(), // 0.01 seconds ago
          name: 'website-screenshot.png',
          size: 640 * 1024, // 640KB
          type: 'image',
          url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&h=200&fit=crop&crop=center',
          extension: 'png',
          bucketFileId: 'dev-bucket-26',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-27',
          $createdAt: new Date(Date.now() - 5).toISOString(), // 0.005 seconds ago
          name: 'database-backup.sql',
          size: 1024 * 1024, // 1MB
          type: 'other',
          url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-zip-file.zip',
          extension: 'sql',
          bucketFileId: 'dev-bucket-27',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-28',
          $createdAt: new Date(Date.now() - 2).toISOString(), // 0.002 seconds ago
          name: 'presentation-slides.pptx',
          size: 2560 * 1024, // 2.5MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'pptx',
          bucketFileId: 'dev-bucket-28',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-29',
          $createdAt: new Date(Date.now() - 1).toISOString(), // 0.001 seconds ago
          name: 'brand-guidelines.pdf',
          size: 1792 * 1024, // 1.75MB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'pdf',
          bucketFileId: 'dev-bucket-29',
          users: [],
          owner: { fullName: 'John Doe' },
        },
        {
          $id: 'dev-file-30',
          $createdAt: new Date().toISOString(), // Just now
          name: 'latest-update.txt',
          size: 256 * 1024, // 256KB
          type: 'document',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          extension: 'txt',
          bucketFileId: 'dev-bucket-30',
          users: [],
          owner: { fullName: 'John Doe' },
        },
      ];

      // Filter by types if specified
      let filteredFiles = mockFiles;
      if (types.length > 0) {
        filteredFiles = mockFiles.filter(file => types.includes(file.type as FileType));
      }

      // Filter by search text if specified
      if (searchText) {
        filteredFiles = filteredFiles.filter(file => 
          file.name.toLowerCase().includes(searchText.toLowerCase())
        );
      }

      // Sort files
      if (sort === "$createdAt-desc") {
        filteredFiles.sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
      } else if (sort === "$createdAt-asc") {
        filteredFiles.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
      } else if (sort === "name-asc") {
        filteredFiles.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sort === "name-desc") {
        filteredFiles.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sort === "size-desc") {
        filteredFiles.sort((a, b) => b.size - a.size);
      } else if (sort === "size-asc") {
        filteredFiles.sort((a, b) => a.size - b.size);
      }

      // Apply limit if specified
      if (limit) {
        filteredFiles = filteredFiles.slice(0, limit);
      }

      return { 
        documents: filteredFiles,
        total: filteredFiles.length
      };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User not found");

    const queryString = createQueries(currentUser, types, searchText, sort, limit);
    const url = `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/files${queryString ? `?${queryString}` : ''}`;

    const response = await smartHttpClient(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get files');
    }

    const files = await response.json();
    return { documents: files.documents || files, total: files.total || files.length };
  } catch (error) {
    handleError(error, "Failed to get files");
  }
};

export const renameFile = async ({
  fileId,
  name,
  extension,
  path,
}: RenameFileProps) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock rename
      revalidatePath(path);
      return { success: true };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const response = await smartHttpClient(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/files/${fileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${name}.${extension}`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to rename file');
    }

    const result = await response.json();
    revalidatePath(path);
    return result;
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock update
      revalidatePath(path);
      return { success: true };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const response = await smartHttpClient(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/files/${fileId}/share`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update file users');
    }

    const result = await response.json();
    revalidatePath(path);
    return result;
  } catch (error) {
    handleError(error, "Failed to update file users");
  }
};

export const downloadFile = async ({
  fileId,
}: {
  fileId: string;
}) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock download
      return { downloadUrl: 'mock-download-url' };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const response = await smartHttpClient(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId: fileId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    handleError(error, "Failed to get download URL");
  }
};

export const deleteFile = async ({
  fileId,
  bucketFileId,
  path,
}: DeleteFileProps) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - mock delete
      revalidatePath(path);
      return { success: true };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const response = await smartHttpClient(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }

    const result = await response.json();
    revalidatePath(path);
    return result;
  } catch (error) {
    handleError(error, "Failed to delete file");
  }
};

// ============================== TOTAL FILE SPACE USED
export async function getTotalSpaceUsed() {
  try {
    if (isDevelopmentMode) {
      // Development mode - calculate from actual files
      const files = await getFiles({ types: [], limit: 100 });
      
      // Check if files exist and have documents
      if (!files || !files.documents) {
        return {
          image: { size: 0, latestDate: null },
          document: { size: 0, latestDate: null },
          video: { size: 0, latestDate: null },
          audio: { size: 0, latestDate: null },
          other: { size: 0, latestDate: null },
          used: 0,
          all: 2 * 1024 * 1024 * 1024, // 2GB
        };
      }
      
      // Calculate storage by type
      const storageByType: Record<string, { size: number; latestDate: string | null }> = {
        image: { size: 0, latestDate: null },
        document: { size: 0, latestDate: null },
        video: { size: 0, latestDate: null },
        audio: { size: 0, latestDate: null },
        other: { size: 0, latestDate: null },
      };
      
      let totalUsed = 0;
      
      files.documents.forEach((file: any) => {
        const type = file.type as string;
        if (storageByType[type]) {
          storageByType[type].size += file.size;
          totalUsed += file.size;
          
          // Update latest date
          const fileDate = new Date(file.$createdAt);
          if (!storageByType[type].latestDate || fileDate > new Date(storageByType[type].latestDate)) {
            storageByType[type].latestDate = file.$createdAt;
          }
        }
      });
      
      return {
        ...storageByType,
        used: totalUsed,
        all: 2 * 1024 * 1024 * 1024, // 2GB
      };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User is not authenticated.");

    const response = await smartHttpClient(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/files/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get file stats');
    }

    const totalSpace = await response.json();
    return totalSpace;
  } catch (error) {
    handleError(error, "Error calculating total space used");
  }
}

// Get video streaming URL
export const getVideoStreamUrl = async ({ fileId }: { fileId: string }) => {
  try {
    if (isDevelopmentMode) {
      // Development mode - return mock streaming URL
      return {
        streamUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        fileName: 'sample-video.mp4',
        fileType: 'video',
        fileSize: 1024 * 1024
      };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    // Call the correct streaming endpoint that exists in the backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/files/${fileId}/stream`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Return null to indicate streaming is not available
      // This allows the component to fall back to the original URL
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    // Return null instead of throwing error
    // This allows the component to fall back to the original URL
    return null;
  }
};

// Debug function to check shared files status
export const debugSharedFiles = async () => {
  try {
    if (isDevelopmentMode) {
      return {
        message: 'Debug mode - mock data',
        totalFilesWithSharing: 2,
        files: [
          {
            fileId: 'debug-1',
            fileName: 'test-file.pdf',
            owner: 'user1',
            sharedWith: ['user2@example.com'],
            sharedWithCount: 1
          }
        ]
      };
    }

    const token = await getAuthToken();
    if (!token) throw new Error("No authentication token");

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/debug/shared-files`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Debug failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
};
