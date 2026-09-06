import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-modal p-6 max-w-sm w-full relative">
        <h2 className="text-xl font-bold text-neutral-900 mb-2">{title}</h2>
        <p className="text-neutral-600 mb-6">{message}</p>
        
        <div className="flex space-x-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-semibold rounded transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
