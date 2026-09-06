import { useState } from "react";

/** A product photo on its tinted ground, with an honest fallback when it does not load. */
export function ProductImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="photo">
      {failed ? (
        <span className="photo__missing">Image unavailable</span>
      ) : (
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
