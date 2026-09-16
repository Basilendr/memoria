// v2 : le nom de cache change exprès pour forcer la purge de l'ancien cache figé sur
// les appareils déjà visités (l'ancienne version servait indéfiniment la toute
// première page HTML mise en cache, même après de nouveaux déploiements — exactement
// le bug qui faisait revoir aux utilisateurs une vieille version du site).
const CACHE = "memoria-coquille-v2";
const FICHIERS = ["/", "/index.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evenement) => {
  if (evenement.request.method !== "GET") return;

  // La page elle-même : réseau en priorité, pour toujours servir la dernière version
  // déployée quand la connexion est là. Le cache ne sert que de secours hors-ligne —
  // jamais de source par défaut comme avant.
  const estNavigation = evenement.request.mode === "navigate" || evenement.request.destination === "document";
  if (estNavigation) {
    evenement.respondWith(
      fetch(evenement.request)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(evenement.request, copie));
          return reponse;
        })
        .catch(() => caches.match(evenement.request).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  // Fichiers statiques (icône, manifest) : changent rarement, cache d'abord reste
  // pertinent pour eux.
  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => reponse || fetch(evenement.request))
  );
});
