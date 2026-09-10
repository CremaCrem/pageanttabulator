import React, { useState, useRef } from 'react';
import { uploadFile, getApiBaseUrl } from '../../api/client';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, className = '' }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Must be an image file');
      return;
    }

    // Validate size (e.g. max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadFile('/api/upload', file);
      onChange(result.url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const previewUrl = value ? `${getApiBaseUrl()}${value}` : null;

  return (
    <div className={`flex flex-col items-start gap-4 ${className}`}>
      <div 
        className={`relative flex items-center justify-center w-32 h-32 rounded-lg border-2 border-dashed overflow-hidden
          ${previewUrl ? 'border-primary-300' : 'border-gray-300 bg-gray-50'}
        `}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-sm font-medium">No Image</span>
        )}
        
        {isUploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {previewUrl ? 'Change Photo' : 'Upload Photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <span className="text-red-500 text-xs">{error}</span>}
        <span className="text-gray-500 text-xs">JPEG, PNG, WebP up to 10MB</span>
      </div>
    </div>
  );
};
