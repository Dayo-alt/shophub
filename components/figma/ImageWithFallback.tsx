import * as React from 'react';

type ImageWithFallbackProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

export function ImageWithFallback({ fallbackSrc, onError, ...props }: ImageWithFallbackProps) {
  const [errored, setErrored] = React.useState(false);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    setErrored(true);
    onError?.(e);
  };

  if (errored && fallbackSrc) {
    return <img {...props} src={fallbackSrc} onError={onError} />;
  }

  return <img {...props} onError={handleError} />;
}
