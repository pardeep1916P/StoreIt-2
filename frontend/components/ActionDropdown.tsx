"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import Image from "next/image";
import { FileData } from "@/types";
import { actionsDropdownItems } from "@/constants";
import Link from "next/link";
import { constructDownloadUrl } from "@/lib/utils";
import { downloadFile } from "@/lib/actions/file.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  renameFile,
  updateFileUsers,
} from "@/lib/actions/file.actions";
import { deleteFileClient, renameFileClient, shareFileClient } from "@/lib/actions/file.client";
import { usePathname } from "next/navigation";
import { FileDetails, ShareInput } from "@/components/ActionsModalContent";
import { InlinePreview } from "@/components/InlinePreview";
import { useToast } from "@/hooks/use-toast";

// Define the ActionType interface based on the actionsDropdownItems structure
interface ActionType {
  label: string;
  icon: string;
  value: string;
}

const ActionDropdown = ({ file, onFileDelete, onFileRename }: { 
  file: FileData; 
  onFileDelete?: (fileId: string) => void;
  onFileRename?: (fileId: string, newName: string) => void;
}) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [action, setAction] = useState<ActionType | null>(null);
  // Initialize name with just the base filename (without extension)
  const [name, setName] = useState(file.name.replace(/\.[^/.]+$/, ""));
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState<string[]>(file.users || []);

  // Debug emails state changes
  

  // Helper function to safely get file extension
  const getFileExtension = (): string => {
    const extension = file.extension || file.name.split('.').pop() || '';
    return extension;
  };

  const path = usePathname();

  const closeAllModals = () => {
    setIsModalOpen(false);
    setIsPreviewOpen(false);
    setIsDropdownOpen(false);
    setAction(null);
    // Reset name to the current file's base name (without extension)
    setName(file.name.replace(/\.[^/.]+$/, ""));
    //   setEmails([]);
  };

  const handleAction = async () => {
    if (!action) return;
    setIsLoading(true);
    let success = false;

    try {
      if (action.value === 'delete') {
        if (!file.$id) {
          throw new Error('File ID is missing');
        }
        await deleteFileClient(file.$id, file.bucketFileId);
        success = true;
      } else if (action.value === 'rename') {
        // Ensure the new name has the correct extension
        const extension = getFileExtension();
        const newFileName = name.trim() === "" ? file.name : `${name.trim()}.${extension}`;
        

        
        // Validate parameters before calling renameFileClient
        if (!file.$id) {
          throw new Error('File ID is missing');
        }
        if (!newFileName) {
          throw new Error('New file name is missing');
        }
        
        await renameFileClient(file.$id, newFileName);
        success = true;
      } else if (action.value === 'share') {
        if (!file.$id) {
          throw new Error('File ID is missing');
        }
        await shareFileClient(file.$id, emails);
        success = true;
      }
    } catch (error) {
      
      // Show error toast message
      if (action?.value === 'share') {
        toast({
          title: "Sharing Failed ❌",
          description: "Failed to share file. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      } else if (action?.value === 'rename') {
        toast({
          title: "Rename Failed ❌",
          description: "Failed to rename file. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      } else if (action?.value === 'delete') {
        toast({
          title: "Delete Failed ❌",
          description: "Failed to delete file. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      }
      
      success = false;
    }

    if (success) {
      closeAllModals();
      // Remove file from parent's state instead of page refresh
      if (action.value === 'delete' && onFileDelete) {
        onFileDelete(file.$id);
        // Show success toast message
        toast({
          title: "File Deleted Successfully! 🗑️",
          description: `File "${file.name}" has been deleted`,
          duration: 3000,
        });
      } else if (action.value === 'rename') {
        // For rename, update the file object locally instead of refreshing
        const extension = getFileExtension();
        const newFileName = name.trim() === "" ? file.name : `${name.trim()}.${extension}`;
        file.name = newFileName;
        // Call the rename callback if provided
        if (onFileRename) {
          onFileRename(file.$id, newFileName);
        }
        // Force a re-render by updating the component state
        setAction(null);
        // Show success toast message
        toast({
          title: "File Renamed Successfully! ✏️",
          description: `File renamed to: ${newFileName}`,
          duration: 3000,
        });
      } else if (action.value === 'share') {
        // For share, update the file object locally and show success
        file.users = [...emails]; // Update the file's shared users
        // Force a re-render by updating the component state
        setAction(null);
        // Show success toast message
        if (emails.length > 0) {
          const previousCount = (file.users || []).length;
          const newCount = emails.length;
          const change = newCount - previousCount;
          
          let description = `Shared with ${emails.length} user${emails.length === 1 ? '' : 's'}: ${emails.join(', ')}`;
          
          if (change > 0) {
            description = `Added ${change} new user${change === 1 ? '' : 's'}. Total: ${emails.length} user${emails.length === 1 ? '' : 's'}`;
          } else if (change < 0) {
            description = `Removed ${Math.abs(change)} user${Math.abs(change) === 1 ? '' : 's'}. Total: ${emails.length} user${emails.length === 1 ? '' : 's'}`;
          }
          
          toast({
            title: "File Sharing Updated! 🎉",
            description: description,
            duration: 4000,
          });
        } else {
          toast({
            title: "Sharing Updated",
            description: "File is no longer shared with any users",
            duration: 3000,
          });
        }
      } else {
        // For other actions, still refresh the page to show updated data
        window.location.reload();
      }
    }

    setIsLoading(false);
  };

  const handleRemoveUser = async (email: string) => {
    const updatedEmails = emails.filter((e) => e !== email);

    try {
      if (!file.$id) {
        throw new Error('File ID is missing');
      }
      await shareFileClient(file.$id, updatedEmails);
      setEmails(updatedEmails);
      // Update the file object locally
      file.users = updatedEmails;
      // Show success toast message
      toast({
        title: "User Removed",
        description: `Removed ${email} from file sharing`,
        duration: 3000,
      });
    } catch (error) {
      // Show error toast message
      toast({
        title: "Failed to Remove User ❌",
        description: "Failed to remove user from sharing. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const renderDialogContent = () => {
    if (!action) return null;

    const { value, label } = action;

    return (
      <DialogContent 
        className="shad-dialog button max-w-[500px] w-[90vw] overflow-hidden"
        style={{ maxWidth: '500px', width: '90vw' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DialogHeader 
          className="flex flex-col gap-3"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <DialogTitle className="text-center text-light-100">
            {label}
          </DialogTitle>
          {value === "rename" && (
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          {value === "details" && <FileDetails file={file} />}
          {value === "share" && (
            <ShareInput
              file={file}
              emails={emails}
              onInputChange={setEmails}
              onRemove={handleRemoveUser}
            />
          )}
          {value === "delete" && (
            <p className="delete-confirmation">
              Are you sure you want to delete{` `}
              <span className="delete-file-name">{file.name}</span>?
            </p>
          )}
        </DialogHeader>
        {["rename", "delete", "share"].includes(value) && (
          <DialogFooter 
            className="flex flex-col gap-3 md:flex-row"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Button onClick={closeAllModals} className="modal-cancel-button">
              Cancel
            </Button>
            <Button onClick={handleAction} className="modal-submit-button">
              <p className="capitalize">{value}</p>
              {isLoading && (
                <Image
                  src="/assets/icons/loader.svg"
                  alt="loader"
                  width={24}
                  height={24}
                  className="animate-spin"
                />
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    );
  };

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger 
          className="shad-no-focus"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Image
            src="/assets/icons/dots.svg"
            alt="dots"
            width={24}
            height={24}
            className="sm:w-[34px] sm:h-[34px] md:w-[34px] md:h-[34px]"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel className="max-w-[200px] truncate">
            {file.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actionsDropdownItems.map((actionItem) => (
            <DropdownMenuItem
              key={actionItem.value}
              className="shad-dropdown-item"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAction(actionItem);
                setIsDropdownOpen(false); // Close the dropdown

                if (actionItem.value === "preview") {
                  setIsPreviewOpen(true);
                } else if (
                  ["rename", "share", "delete", "details"].includes(
                    actionItem.value,
                  )
                ) {
                  setIsModalOpen(true);
                }
              }}
            >
                             {actionItem.value === "download" ? (
                 <button
                   onClick={async (e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     setIsDropdownOpen(false); // Close the dropdown
                     try {
                       if (!file.$id) {
                         throw new Error('File ID is missing');
                       }
                       // Get download URL from backend
                       const result = await downloadFile({ fileId: file.$id });
                       
                       if (!result.downloadUrl) {
                         throw new Error('No download URL received');
                       }
                       
                       // Direct download using the presigned URL (no fetch to avoid CORS)
                       const a = document.createElement('a');
                       a.href = result.downloadUrl;
                       a.download = file.name;
                       a.target = '_blank';
                       a.style.display = 'none';
                       document.body.appendChild(a);
                       a.click();
                       setTimeout(() => {
                         document.body.removeChild(a);
                       }, 100);
                     } catch (error) {
                       // Fallback: open in new tab
                       window.open(file.url, '_blank');
                     }
                   }}
                   className="flex items-center gap-2 w-full text-left"
                 >
                  <Image
                    src={actionItem.icon}
                    alt={actionItem.label}
                    width={20}
                    height={20}
                    className="sm:w-[30px] sm:h-[30px] md:w-[30px] md:h-[30px]"
                  />
                  {actionItem.label}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Image
                    src={actionItem.icon}
                    alt={actionItem.label}
                    width={20}
                    height={20}
                    className="sm:w-[30px] sm:h-[30px] md:w-[30px] md:h-[30px]"
                  />
                  {actionItem.label}
                </div>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {renderDialogContent()}
    </Dialog>
    
    {/* Only render InlinePreview when needed */}
    {isPreviewOpen && (
      <InlinePreview 
        file={file} 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
      />
    )}
    </>
  );
};
export default ActionDropdown;
