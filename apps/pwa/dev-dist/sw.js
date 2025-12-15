/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-1ed862ea'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "3ca0b8505b4bec776b69afdba2768812"
  }, {
    "url": "/index.html",
    "revision": "0.npjuqcb92hc"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    allowlist: [/^\/$/],
    denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/, /^\/api\//, /^\/socket\.io\//]
  }));
  workbox.registerRoute(({
    request,
    url
  }) => {
    const isNavigation = request.mode === "navigate";
    const isDocument = request.destination === "document";
    const isRoot = url.pathname === "/" || url.pathname === "/index.html";
    const isHtml = url.pathname.endsWith(".html");
    return isNavigation || isDocument || isRoot || isHtml;
  }, new workbox.NetworkFirst({
    "cacheName": "html-cache",
    "networkTimeoutSeconds": 1,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url,
    request
  }) => {
    const pathname = url.pathname;
    return pathname.startsWith("/@") || pathname.startsWith("/src/") || pathname.includes("@vite") || pathname.includes("@react-refresh") || pathname.includes("vite-plugin-pwa") || pathname.endsWith(".tsx") || pathname.endsWith(".ts") || pathname.endsWith(".jsx") || pathname.endsWith(".js") && !pathname.includes("node_modules");
  }, new workbox.NetworkFirst({
    "cacheName": "vite-modules",
    "networkTimeoutSeconds": 1,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 1000,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/i, new workbox.CacheFirst({
    "cacheName": "static-resources",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 200,
      maxAgeSeconds: 31536000
    })]
  }), 'GET');
  workbox.registerRoute(({
    url
  }) => url.pathname.includes("manifest.webmanifest"), new workbox.NetworkFirst({
    "cacheName": "html-cache",
    "networkTimeoutSeconds": 1,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
