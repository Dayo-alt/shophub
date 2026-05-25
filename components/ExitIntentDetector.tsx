import { useEffect, useRef } from 'react';

interface ExitIntentDetectorProps {
  onExitIntent: () => void;
  debounceMs?: number;
}

export function ExitIntentDetector({ onExitIntent, debounceMs = 5000 }: ExitIntentDetectorProps) {
  const lastTriggeredRef = useRef<number>(0);
  const isAtTopRef = useRef<boolean>(false);

  const handleExitIntent = () => {
    const now = Date.now();
    // Only trigger if:
    // 1. Last trigger was more than debounceMs ago, AND
    // 2. We weren't already at the top (to trigger on FIRST entry to top area)
    if (now - lastTriggeredRef.current > debounceMs && !isAtTopRef.current) {
      lastTriggeredRef.current = now;
      isAtTopRef.current = true;
      onExitIntent();
    }
  };

  useEffect(() => {
    // Detect mouse movement to top edge (user moving to browser UI)
    const handleMouseMove = (e: MouseEvent) => {
      // Check if mouse is in top 5px of screen
      if (e.clientY <= 5) {
        handleExitIntent();
      } else {
        // Mouse left the top area - reset for next entry
        isAtTopRef.current = false;
      }
    };

    // Detect tab close via beforeunload
    const handleBeforeUnload = () => {
      // Note: We can't actually prevent unload or show popup here
      // This is mainly for cleanup
    };

    // Detect Escape key (soft exit signal)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Only trigger if not in an input/textarea/contenteditable
        const target = e.target as HTMLElement;
        const isFormElement = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        const isContentEditable = target.contentEditable === 'true';
        
        if (!isFormElement && !isContentEditable) {
          handleExitIntent();
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [debounceMs]);

  // This component doesn't render anything
  return null;
}
