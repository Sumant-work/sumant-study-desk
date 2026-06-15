let secureFiles = {};
let decryptKey = null;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type !== "MISSION2026_INIT") return;

  event.waitUntil((async () => {
    secureFiles = data.files || {};
    decryptKey = await crypto.subtle.importKey(
      "raw",
      data.rawKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    event.ports[0]?.postMessage({ ok: true });
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  const securePrefix = `${scope.pathname}secure/`;

  if (url.origin !== scope.origin || !url.pathname.startsWith(securePrefix)) {
    return;
  }

  event.respondWith(handleSecureRequest(url, scope));
});

async function handleSecureRequest(url, scope) {
  if (!decryptKey) {
    await requestKeyFromOpenHub();
    if (!decryptKey) {
      return new Response("Locked. Unlock the Mission2026 hub first.", {
        status: 423,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow, noarchive"
        }
      });
    }
  }

  const securePrefix = `${scope.pathname}secure/`;
  const route = decodeURIComponent(url.pathname.slice(securePrefix.length));
  const file = secureFiles[route];

  if (!file) {
    return new Response("Secure file not found.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  const encryptedUrl = new URL(file.blob, scope);
  const encryptedResponse = await fetch(encryptedUrl, { cache: "force-cache" });
  if (!encryptedResponse.ok) {
    return new Response("Encrypted blob missing.", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  const encryptedBytes = new Uint8Array(await encryptedResponse.arrayBuffer());
  const plain = await decryptFile(encryptedBytes);
  const headers = new Headers({
    "Content-Type": file.mime || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive"
  });

  return new Response(plain, { status: 200, headers });
}

async function requestKeyFromOpenHub() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    const reply = await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 1200);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data || null);
      };
      client.postMessage({ type: "MISSION2026_NEED_KEY" }, [channel.port2]);
    });

    if (reply?.rawKey && reply?.files) {
      secureFiles = reply.files;
      decryptKey = await crypto.subtle.importKey(
        "raw",
        reply.rawKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );
      return true;
    }
  }
  return false;
}

async function decryptFile(bytes) {
  const magic = "M26ENC1\n";
  const decoder = new TextDecoder();
  if (decoder.decode(bytes.slice(0, magic.length)) !== magic) {
    throw new Error("Invalid encrypted file");
  }

  const iv = bytes.slice(magic.length, magic.length + 12);
  const payload = bytes.slice(magic.length + 12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, decryptKey, payload);
}
