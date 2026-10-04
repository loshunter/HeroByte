// A failed startup ends this document's app lifetime. Set before React cleanup:
// Konva can emit dragend while its nodes are destroyed, before passive effects
// disconnect the socket. Such callbacks must neither send nor queue commands.
let terminated = false;

export function markBootTerminated(): void {
  terminated = true;
}

export function isBootTerminated(): boolean {
  return terminated;
}
