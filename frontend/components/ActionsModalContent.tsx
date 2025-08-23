import { FileData } from "@/types";
import Thumbnail from "@/components/Thumbnail";
import FormattedDateTime from "@/components/FormattedDateTime";
import { convertFileSize, formatDateTime } from "@/lib/utils";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const ImageThumbnail = ({ file }: { file: FileData }) => (
  <div className="file-details-thumbnail">
    <Thumbnail type={file.type} extension={file.extension} url={file.url} />
    <div className="flex flex-col min-w-0 flex-1">
      <p 
        className="subtitle-2 mb-1 truncate" 
        title={file.name} 
        style={{ 
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {file.name}
      </p>
      <FormattedDateTime date={file.$createdAt} className="caption" />
    </div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex">
    <p className="file-details-label text-left">{label}</p>
    <p className="file-details-value text-left">{value}</p>
  </div>
);

export const FileDetails = ({ file }: { file: FileData }) => {
  return (
    <>
      <ImageThumbnail file={file} />
      <div className="space-y-4 px-2 pt-2">
        <DetailRow label="Format:" value={file.extension} />
        <DetailRow label="Size:" value={convertFileSize(file.size)} />
        <DetailRow label="Owner:" value={
          typeof file.owner === 'string' 
            ? file.owner 
            : file.owner?.fullName || "Unknown"
        } />
        <DetailRow label="Last edit:" value={formatDateTime(file.$createdAt)} />
      </div>
    </>
  );
};

interface Props {
  file: FileData;
  emails: string[];
  onInputChange: React.Dispatch<React.SetStateAction<string[]>>;
  onRemove: (email: string) => void;
}

export const ShareInput = ({ file, emails, onInputChange, onRemove }: Props) => {
  const [newEmail, setNewEmail] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleAddEmail = () => {
    const email = newEmail.trim();
    if (!email) return;
    
    if (emails?.includes(email)) {
      // Show error message for duplicate email
      setErrorMessage(`"${email}" is already shared with this file`);
      setTimeout(() => setErrorMessage(""), 3000); // Clear error after 3 seconds
      return;
    }
    
    const updatedEmails = [...(emails || []), email];

    onInputChange(updatedEmails);
    setNewEmail(""); // Clear input after adding
    setErrorMessage(""); // Clear any previous error
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddEmail();
    }
  };

  return (
    <>
      <ImageThumbnail file={file} />

      <div className="share-wrapper">
        <p className="subtitle-2 pl-1 text-light-100">
          Share file with other users
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            className="share-input-field flex-1"
          />
          <Button
            onClick={handleAddEmail}
            size="sm"
            className="px-4"
          >
            Add
          </Button>
        </div>
        
        {errorMessage && (
          <p className="text-red-500 text-xs mt-1 pl-1">
            {errorMessage}
          </p>
        )}
        <div className="pt-4">
          <div className="flex justify-between">
            <p className="subtitle-2 text-light-100">Shared with</p>
            <p className="subtitle-2 text-light-200">
              {(emails || []).length} users
            </p>
          </div>

          <ul className="pt-2">
            {(emails || []).length > 0 ? (
              (emails || []).map((email: string) => (
                <li
                  key={email}
                  className="flex items-center justify-between gap-2"
                >
                  <p className="subtitle-2">{email}</p>
                  <Button
                    onClick={() => onRemove(email)}
                    className="share-remove-user"
                  >
                    <Image
                      src="/assets/icons/remove.svg"
                      alt="Remove"
                      width={24}
                      height={24}
                      className="remove-icon"
                    />
                  </Button>
                </li>
              ))
            ) : (
              <li className="text-center py-2">
                <p className="caption text-light-200">No users shared yet</p>
              </li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
};
