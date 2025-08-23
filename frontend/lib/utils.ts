import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getAuthToken } from './actions/user.actions';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const parseStringify = (value: unknown) =>
  JSON.parse(JSON.stringify(value));

export const convertFileToUrl = (file: File) => URL.createObjectURL(file);

export const convertFileSize = (sizeInBytes: number | null | undefined, digits?: number) => {
  if (sizeInBytes === null || sizeInBytes === undefined || isNaN(sizeInBytes)) {
    return "0 Bytes";
  }
  
  if (sizeInBytes < 1024) {
    return sizeInBytes + " Bytes"; // Less than 1 KB, show in Bytes
  } else if (sizeInBytes < 1024 * 1024) {
    const sizeInKB = sizeInBytes / 1024;
    return sizeInKB.toFixed(digits || 1) + " KB"; // Less than 1 MB, show in KB
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return sizeInMB.toFixed(digits || 1) + " MB"; // Less than 1 GB, show in MB
  } else {
    const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
    return sizeInGB.toFixed(digits || 1) + " GB"; // 1 GB or more, show in GB
  }
};

export const calculatePercentage = (sizeInBytes: number | null | undefined, totalSizeInBytes?: number) => {
  if (sizeInBytes === null || sizeInBytes === undefined || isNaN(sizeInBytes)) {
    return 0;
  }
  
  const total = totalSizeInBytes || (2 * 1024 * 1024 * 1024); // 2GB in bytes default
  const percentage = (sizeInBytes / total) * 100;
  return Number(percentage.toFixed(2));
};

export const getFileType = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension) return { type: "other", extension: "" };

  const documentExtensions = [
    "pdf",
    "doc",
    "docx",
    "txt",
    "xls",
    "xlsx",
    "csv",
    "rtf",
    "ods",
    "ppt",
    "odp",
    "md",
    "html",
    "htm",
    "epub",
    "pages",
  ];
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "psd", "ai", "fig", "indd", "xd", "sketch", "afdesign", "afphoto"];
  const videoExtensions = ["mp4", "avi", "mov", "mkv", "webm"];
  const audioExtensions = ["mp3", "wav", "ogg", "flac"];

  if (documentExtensions.includes(extension))
    return { type: "document", extension };
  if (imageExtensions.includes(extension)) return { type: "image", extension };
  if (videoExtensions.includes(extension)) return { type: "video", extension };
  if (audioExtensions.includes(extension)) return { type: "audio", extension };

  return { type: "other", extension };
};

export const formatDateTime = (isoString: string | null | undefined) => {
  if (!isoString) return "—";

  const date = new Date(isoString);

  // Get hours and adjust for 12-hour format
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "pm" : "am";

  // Convert hours to 12-hour format
  hours = hours % 12 || 12;

  // Format the time and date parts
  const time = `${hours}:${minutes.toString().padStart(2, "0")}${period}`;
  const day = date.getDate();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[date.getMonth()];

  return `${time}, ${day} ${month}`;
};

export const getFileIcon = (
  extension: string | undefined,
  type: FileType | string,
) => {
  switch (extension) {
    // Document
    case "pdf":
      return "/assets/icons/file-pdf.svg";
    case "doc":
      return "/assets/icons/file-doc.svg";
    case "docx":
      return "/assets/icons/file-docx.svg";
    case "csv":
      return "/assets/icons/file-csv.svg";
    case "txt":
      return "/assets/icons/file-txt.svg";
    case "xls":
    case "xlsx":
      return "/assets/icons/file-document.svg";
    // Image
    case "svg":
      return "/assets/icons/file-image.svg";
    // Video
    case "mkv":
    case "mov":
    case "avi":
    case "wmv":
    case "mp4":
    case "flv":
    case "webm":
    case "m4v":
    case "3gp":
      return "/assets/icons/file-video.svg";
    // Audio
    case "mp3":
    case "mpeg":
    case "wav":
    case "aac":
    case "flac":
    case "ogg":
    case "wma":
    case "m4a":
    case "aiff":
    case "alac":
      return "/assets/icons/file-audio.svg";

    default:
      switch (type) {
        case "image":
          return "/assets/icons/file-image.svg";
        case "document":
          return "/assets/icons/file-document.svg";
        case "video":
          return "/assets/icons/file-video.svg";
        case "audio":
          return "/assets/icons/file-audio.svg";
        default:
          return "/assets/icons/file-other.svg";
      }
  }
};

// AWS S3 URL UTILS
// For AWS S3, we'll use direct URLs or presigned URLs
export const constructFileUrl = (s3Key: string) => {
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || 'storeit-user-files';
  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
};

export const constructDownloadUrl = (s3Key: string) => {
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || 'storeit-user-files';
  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
};

// DASHBOARD UTILS
export const getUsageSummary = (totalSpace: any) => {
  // Handle null or undefined totalSpace
  if (!totalSpace) {
    return [
      {
        title: "Documents",
        size: 0,
        latestDate: null,
        icon: "/assets/icons/file-document-light.svg",
        url: "/documents",
      },
      {
        title: "Images",
        size: 0,
        latestDate: null,
        icon: "/assets/icons/file-image-light.svg",
        url: "/images",
      },
      {
        title: "Media",
        size: 0,
        latestDate: null,
        icon: "/assets/icons/file-video-light.svg",
        url: "/media",
      },
      {
        title: "Others",
        size: 0,
        latestDate: null,
        icon: "/assets/icons/file-other-light.svg",
        url: "/others",
      },
    ];
  }

  return [
    {
      title: "Documents",
      size: totalSpace.document?.size || 0,
      latestDate: totalSpace.document?.latestDate || null,
      icon: "/assets/icons/file-document-light.svg",
      url: "/documents",
    },
    {
      title: "Images",
      size: totalSpace.image?.size || 0,
      latestDate: totalSpace.image?.latestDate || null,
      icon: "/assets/icons/file-image-light.svg",
      url: "/images",
    },
    {
      title: "Media",
      size: (totalSpace.video?.size || 0) + (totalSpace.audio?.size || 0),
      latestDate:
        (totalSpace.video?.latestDate && totalSpace.audio?.latestDate) 
          ? (totalSpace.video.latestDate > totalSpace.audio.latestDate
            ? totalSpace.video.latestDate
            : totalSpace.audio.latestDate)
          : (totalSpace.video?.latestDate || totalSpace.audio?.latestDate || null),
      icon: "/assets/icons/file-video-light.svg",
      url: "/media",
    },
    {
      title: "Others",
      size: totalSpace.other?.size || 0,
      latestDate: totalSpace.other?.latestDate || null,
      icon: "/assets/icons/file-other-light.svg",
      url: "/others",
    },
  ];
};

export const getFileTypesParams = (type: string) => {
  switch (type) {
    case "documents":
      return ["document"];
    case "images":
      return ["image"];
    case "media":
      return ["video", "audio"];
    case "others":
      return ["other"];
    default:
      return ["document"];
  }
};

// Smart HTTP client for automatic token refresh (Server-side)
export const smartHttpClient = async (url: string, options: RequestInit, retryCount = 0): Promise<Response> => {
  try {
    // Add authorization header if token exists
    const token = await getAuthToken();
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    const response = await fetch(url, options);
    
    // If unauthorized and we haven't retried yet, try to refresh token
    if (response.status === 401 && retryCount === 0) {
      try {
        // Import refresh function dynamically to avoid circular dependency
        const { refreshAccessToken } = await import('./actions/user.actions');
        const newToken = await refreshAccessToken();
        
        // Retry the request with new token
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        };
        
        return await smartHttpClient(url, options, retryCount + 1);
      } catch (refreshError) {
        throw new Error('Authentication expired');
      }
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

// Client-side smart HTTP client for automatic token refresh (Browser)
export const smartHttpClientClient = async (url: string, options: RequestInit, retryCount = 0): Promise<Response> => {
  try {
    // Get token from cookies or localStorage
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const token = getCookie('aws-session') || localStorage.getItem('aws-session');
    
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    const response = await fetch(url, options);
    
    // If unauthorized and we haven't retried yet, try to refresh token
    if (response.status === 401 && retryCount === 0) {
      try {
        // Call refresh endpoint
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            refreshToken: getCookie('aws-refresh-token') || localStorage.getItem('aws-refresh-token') 
          }),
        });

        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh token');
        }

        const refreshResult = await refreshResponse.json();
        const newToken = refreshResult.token;
        
        // Update tokens in storage
        localStorage.setItem('aws-session', newToken);
        document.cookie = `aws-session=${newToken}; path=/; max-age=${24 * 60 * 60}`;
        
        // Retry the request with new token
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        };
        
        return await smartHttpClientClient(url, options, retryCount + 1);
      } catch (refreshError) {
        // Clear tokens and redirect to signin
        localStorage.removeItem('aws-session');
        localStorage.removeItem('aws-refresh-token');
        document.cookie = 'aws-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'aws-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Redirect to signin
        window.location.href = '/sign-in';
        throw new Error('Authentication expired');
      }
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};
