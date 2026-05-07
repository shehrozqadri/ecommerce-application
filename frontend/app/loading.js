export default function Loading() {
  return (
    <div className="store-loading-full store-loading-buffer-screen" aria-live="polite" aria-busy="true">
      <div className="store-buffer-ring store-buffer-ring-lg" />
    </div>
  );
}
