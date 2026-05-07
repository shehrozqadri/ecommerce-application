"use client";

import { useMemo, useState } from "react";

export default function BufferedImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  loading = "lazy",
  decoding = "async",
  ...props
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const wrapperClasses = useMemo(
    () => [
      "store-media-buffer",
      loaded ? "is-loaded" : "",
      failed ? "is-failed" : "",
      wrapperClassName,
    ]
      .filter(Boolean)
      .join(" "),
    [failed, loaded, wrapperClassName]
  );

  return (
    <div className={wrapperClasses}>
      {!loaded && !failed && (
        <div className="store-buffer-overlay" aria-hidden="true">
          <span className="store-buffer-ring" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        {...props}
      />
    </div>
  );
}
