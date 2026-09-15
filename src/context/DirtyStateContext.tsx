import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface DirtyStateContextType {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  handleNavigation: (path: string, navigateAction: () => void) => void;
}

const DirtyStateContext = createContext<DirtyStateContextType | undefined>(undefined);

export const DirtyStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDirty, setIsDirty] = useState(false);
  
  // Navigation guard state
  const [navConfirm, setNavConfirm] = useState<{ isOpen: boolean, action: (() => void) | null }>({ 
    isOpen: false, 
    action: null 
  });
  
  // Tauri window close guard state
  const [tauriConfirm, setTauriConfirm] = useState(false);

  // Tauri close protection
  useEffect(() => {
    if (!isTauri() || !isDirty) return;

    let unlisten: (() => void) | undefined;
    
    const setup = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested((event) => {
          // Prevent the native window close
          event.preventDefault();
          // Show our internal React confirmation dialog
          setTauriConfirm(true);
        });
      } catch (err) {
        console.error("Failed to setup Tauri close listener", err);
      }
    };
    
    setup();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [isDirty]);

  const handleNavigation = useCallback((_path: string, navigateAction: () => void) => {
    if (isDirty) {
      setNavConfirm({ isOpen: true, action: navigateAction });
    } else {
      navigateAction();
    }
  }, [isDirty]);

  const confirmNav = () => {
    if (navConfirm.action) {
      navConfirm.action();
    }
    setNavConfirm({ isOpen: false, action: null });
  };

  const confirmTauriClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      // Destroy bypasses onCloseRequested, successfully preventing an infinite confirmation loop
      await appWindow.destroy();
    } catch (e) {
      console.error("Failed to destroy window", e);
    }
  };

  return (
    <DirtyStateContext.Provider value={{ isDirty, setIsDirty, handleNavigation }}>
      {children}
      
      <ConfirmModal
        isOpen={navConfirm.isOpen}
        title="Unsaved Changes"
        message="You have unsaved changes. If you leave this page, they will be lost."
        confirmText="Leave Without Saving"
        cancelText="Stay"
        onConfirm={confirmNav}
        onCancel={() => setNavConfirm({ isOpen: false, action: null })}
        variant="destructive"
      />

      <ConfirmModal
        isOpen={tauriConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. If you close the application, they will be lost."
        confirmText="Discard and Close"
        cancelText="Stay"
        onConfirm={confirmTauriClose}
        onCancel={() => setTauriConfirm(false)}
        variant="destructive"
      />
    </DirtyStateContext.Provider>
  );
};

export const useDirtyStateContext = () => {
  const context = useContext(DirtyStateContext);
  if (!context) throw new Error('useDirtyStateContext must be used within DirtyStateProvider');
  return context;
};
