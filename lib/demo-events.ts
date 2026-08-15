export function notifyDemoAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("aura-demo-auth"));
}

export function watchDemoSession(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === "aura_demo_v1") callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("aura-demo-auth", callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("aura-demo-auth", callback);
  };
}
