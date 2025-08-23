// Source map error handling utility
// This helps suppress source map errors that commonly occur in development

export const suppressSourceMapErrors = () => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // Override console.error to filter out source map errors
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Filter out source map related errors
      if (
        message.includes('Failed to get source map') ||
        message.includes('Unknown url scheme') ||
        message.includes('GenericFailure') ||
        message.includes('source map')
      ) {
        return; // Don't log source map errors
      }
      
      // Log all other errors normally
      originalError.apply(console, args);
    };
    
    // Also handle unhandled promise rejections related to source maps
    window.addEventListener('unhandledrejection', (event) => {
      if (
        event.reason?.message?.includes('source map') ||
        event.reason?.message?.includes('Failed to get source map')
      ) {
        event.preventDefault(); // Prevent the error from showing
      }
    });
  }
};

// Auto-initialize when imported
suppressSourceMapErrors();
