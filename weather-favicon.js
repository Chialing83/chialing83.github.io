// Turns the browser tab icon into the weather where the visitor is sitting.
//
// The lookup is best effort. When anything fails, or takes too long, the tab
// keeps the avatar declared in the markup. Showing no weather is better than
// showing weather that is not theirs.
//
// Icons are real PNG files rather than inline SVG. Safari ignores both SVG
// favicons and data URIs, so anything built in the page never reaches its tab.
(function () {
  'use strict';

  var CACHE_KEY = 'wx-favicon';
  var CACHE_MS = 30 * 60 * 1000;
  var TIMEOUT_MS = 3500;
  var DIR = 'icons/';

  // WMO weather codes, as returned by Open-Meteo.
  // https://open-meteo.com/en/docs
  function iconFor(code, isDay) {
    if (code === 0) return isDay ? 'sun' : 'moon';
    if (code === 1 || code === 2) return isDay ? 'partly' : 'moon';
    // Fog rides along with overcast. The fog emoji is unreadable at 16px
    if (code === 3 || code === 45 || code === 48) return 'cloud';
    // The umbrella carries real rain because it still reads at 16px. The rain
    // cloud turns to grey mush at that size, so it marks the lighter drizzle.
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code >= 61 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'bolt';
    return null;
  }

  function paint(name) {
    // Setting href on the existing link is not enough. Once a browser has
    // resolved an icon it tends to keep it, so drop every icon link and append
    // a fresh one. A new element is a new resource, which forces the repaint.
    var old = document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);

    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = DIR + name + '.png';
    document.head.appendChild(link);
  }

  function getJSON(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var hit = JSON.parse(raw);
      if (!hit || Date.now() - hit.ts > CACHE_MS) return null;
      return hit.name;
    } catch (e) {
      return null;
    }
  }

  function writeCache(name) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ name: name, ts: Date.now() }));
    } catch (e) {}
  }

  // Preferred: the visitor's own coordinates, from their IP.
  function locateByIP() {
    return getJSON('https://get.geojs.io/v1/ip/geo.json').then(function (d) {
      var lat = parseFloat(d.latitude);
      var lon = parseFloat(d.longitude);
      if (isNaN(lat) || isNaN(lon)) throw new Error('no coords');
      return { lat: lat, lon: lon };
    });
  }

  // Fallback: the timezone the browser already knows. Zone names carry a city,
  // so "America/Los_Angeles" is enough to land in the right metro area.
  function locateByTimezone() {
    var zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || zone.indexOf('/') === -1) throw new Error('no zone');
    var city = zone.split('/').pop().replace(/_/g, ' ');
    return getJSON(
      'https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&name=' +
        encodeURIComponent(city)
    ).then(function (d) {
      if (!d.results || !d.results.length) throw new Error('no match');
      return { lat: d.results[0].latitude, lon: d.results[0].longitude };
    });
  }

  // Test hook. "?sky=rain&night=1" paints a condition without waiting for the
  // real weather to oblige. Named conditions map onto the codes above.
  var PREVIEW = {
    clear: 0, partly: 1, overcast: 3, fog: 45,
    drizzle: 53, rain: 63, showers: 81, snow: 73, storm: 95
  };

  function previewed() {
    var q = new URLSearchParams(location.search);
    var name = q.get('sky');
    if (!name || !(name in PREVIEW)) return null;
    return iconFor(PREVIEW[name], q.get('night') !== '1');
  }

  function start() {
    var forced = previewed();
    if (forced) {
      paint(forced);
      return;
    }
    var cached = readCache();
    if (cached) {
      paint(cached);
      return;
    }
    locateByIP()
      .catch(locateByTimezone)
      .then(function (at) {
        return getJSON(
          'https://api.open-meteo.com/v1/forecast?current=weather_code,is_day&latitude=' +
            at.lat.toFixed(3) +
            '&longitude=' +
            at.lon.toFixed(3)
        );
      })
      .then(function (wx) {
        var now = wx && wx.current;
        if (!now) return;
        var name = iconFor(now.weather_code, now.is_day === 1);
        if (!name) return;
        writeCache(name);
        paint(name);
      })
      .catch(function () {
        // Leave the avatar in place.
      });
  }

  // Nothing here should compete with rendering the page
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
