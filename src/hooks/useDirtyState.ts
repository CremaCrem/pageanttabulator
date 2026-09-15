import { useEffect } from 'react';
import { useDirtyStateContext } from '../context/DirtyStateContext';

export const useDirtyState = (isDirty: boolean) => {
  const { setIsDirty } = useDirtyStateContext();

  // Register dirty state with the global context
  useEffect(() => {
    setIsDirty(isDirty);
    return () => setIsDirty(false); // Clean up when the consuming page unmounts
  }, [isDirty, setIsDirty]);

  // Register browser beforeunload protection
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Standard requirement for modern browsers to trigger the native dialog
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
};
