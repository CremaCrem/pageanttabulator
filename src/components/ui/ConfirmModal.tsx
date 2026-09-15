import React, { useEffect, useRef } from 'react';
import { Button } from './Button';

export type ConfirmVariant = 'normal' | 'warning' | 'destructive' | 'positive';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  loading?: boolean;
  variant?: ConfirmVariant;
  // deprecated prop for backwards compatibility during migration
  isDestructive?: boolean;
}

const FOCUSABLE_ELEMENTS = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  children,
  loading = false,
  variant,
  isDestructive,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const activeVariant = variant || (isDestructive ? 'destructive' : 'normal');

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Focus management: focus cancel by default for destructive/warning
      if (activeVariant === 'destructive' || activeVariant === 'warning') {
        cancelRef.current?.focus();
      } else {
        confirmRef.current?.focus();
      }
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen, activeVariant]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Tab') {
        if (!modalRef.current) return;
        
        const focusableElements = Array.from(modalRef.current.querySelectorAll(FOCUSABLE_ELEMENTS)) as HTMLElement[];
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, loading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-modal p-6 max-w-sm w-full relative" 
        role="dialog" 
        aria-modal="true" 
        tabIndex={-1}
        aria-labelledby="confirm-modal-title"
      >
        <h2 id="confirm-modal-title" className="text-xl font-bold text-neutral-900 mb-2">{title}</h2>
        <p className="text-neutral-600 mb-4">{message}</p>
        
        {children && <div className="mb-6">{children}</div>}

        <div className="flex space-x-3 mt-6">
          <Button 
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button 
            ref={confirmRef}
            variant={activeVariant === 'positive' ? 'primary' : activeVariant === 'normal' ? 'primary' : activeVariant}
            onClick={onConfirm}
            isLoading={loading}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
