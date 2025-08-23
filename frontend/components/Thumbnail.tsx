"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { cn, getFileIcon } from "@/lib/utils";

interface Props {
  type: string;
  extension: string;
  url?: string;
  imageClassName?: string;
  className?: string;
}

export const Thumbnail = ({
  type,
  extension,
  url = "",
  imageClassName,
  className,
}: Props) => {
  const isImage = type === "image" && extension !== "svg";
  const isVideo = type === "video";
  const isAudio = type === "audio";
  const [videoThumbnail, setVideoThumbnail] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);



  // Generate video thumbnail
  useEffect(() => {
    if (isVideo && url && videoRef.current) {
      const video = videoRef.current;
      
      const generateThumbnail = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            setVideoThumbnail(thumbnailUrl);
          } catch (error) {
            // Fallback to video icon - thumbnail will not be generated
          }
        }
      };

      video.addEventListener('loadeddata', () => {
        // Seek to 1 second or 25% of the video duration
        video.currentTime = Math.min(1, video.duration * 0.25);
      });

      video.addEventListener('seeked', generateThumbnail);
      video.addEventListener('error', () => {
        // Video thumbnail generation failed, using fallback icon
      });

      return () => {
        video.removeEventListener('loadeddata', generateThumbnail);
        video.removeEventListener('seeked', generateThumbnail);
      };
    }
  }, [isVideo, url]);



  return (
    <figure className={cn("thumbnail relative", className)}>
      {/* Hidden video element for thumbnail generation */}
      {isVideo && (
        <video
          ref={videoRef}
          src={url}
          preload="metadata"
          muted
          crossOrigin="anonymous"
          style={{ position: 'absolute', visibility: 'hidden', width: '1px', height: '1px' }}
        />
      )}
      
      <Image
        src={
          isImage ? url : 
          isVideo && videoThumbnail ? videoThumbnail : 
          getFileIcon(extension, type)
        }
        alt="thumbnail"
        width={60}
        height={60}
        className={cn(
          "size-12 object-cover rounded-full transition-all duration-200",
          imageClassName,
          (isImage || (isVideo && videoThumbnail)) && "thumbnail-image",
        )}
        style={{ width: 'auto', height: 'auto' }}
        onError={(e) => {
          // Fallback to file icon if image/video fails to load
          const target = e.target as HTMLImageElement;
          target.src = getFileIcon(extension, type);
          target.classList.remove('thumbnail-image');
        }}
        onLoad={(e) => {
          // Add loaded class for styling
          const target = e.target as HTMLImageElement;
          target.classList.add('loaded');
        }}
      />
      
      {/* Video play icon overlay */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-full">
          <div className="w-4 h-4 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
            <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}
      
      {/* Audio play icon overlay */}
      {isAudio && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-full">
          <Image
            src="/assets/icons/file-audio.svg"
            alt="audio"
            width={16}
            height={16}
            className="w-4 h-4"
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>
      )}
    </figure>
  );
};
export default Thumbnail;
