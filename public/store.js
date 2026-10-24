/* Shared Supabase data layer for Best Lekompo Mixtapes */
(function (global) {
  "use strict";
  var ADMIN_PASSWORD = "StarJoy Degzza for Vercel.!1";
  var videosCacheKey = "blm_mixtapes_cache";
  var cache = [];
  try {
    var savedCache = JSON.parse(sessionStorage.getItem(videosCacheKey) || "[]");
    if (Array.isArray(savedCache)) cache = savedCache;
  } catch (e) {}
  var votedKey = "blm_voter_key";
  var voterKey = localStorage.getItem(votedKey) || (crypto.randomUUID ? crypto.randomUUID() : "v_" + Date.now() + Math.random());
  localStorage.setItem(votedKey, voterKey);
  var adminKey = "blm_admin";
  function isVotingOpen() { var day = new Date().getDay(); return day === 6 || day === 0; }
  function toEmbedUrl(url) { if (!url) return ""; var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/); if (yt) return "https://www.youtube.com/embed/" + yt[1]; var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/); if (vm) return "https://player.vimeo.com/video/" + vm[1]; return /\/embed\/|player\./.test(url) ? url : ""; }
  function getVideos() { return cache; }
  var refreshInFlight = null;
  var lastSnapshot = "";
  async function refresh() {
    if (refreshInFlight) return refreshInFlight;
    var headers = {}; if (sessionStorage.getItem(adminKey) === "1") headers["x-admin-password"] = ADMIN_PASSWORD;
    refreshInFlight = fetch("/api/mixtapes", { cache: "no-store", headers: headers }).then(function (r) {
      if (!r.ok) throw new Error("load failed");
      return r.json();
    }).then(function (data) {
      var next = (data.mixtapes || []).map(function (v) { return { id:v.id, title:v.title, videoUrl:v.video_url, artwork:v.artwork, votes:v.votes || 0, createdAt:v.created_at }; });
      var snapshot = JSON.stringify(next);
      if (snapshot !== lastSnapshot) {
        cache = next;
        lastSnapshot = snapshot;
        try { sessionStorage.setItem(videosCacheKey, JSON.stringify(cache)); } catch (e) {}
        global.dispatchEvent(new Event("blm:updated"));
      }
      return cache;
    }).finally(function () { refreshInFlight = null; });
    return refreshInFlight;
  }
  async function addVideo(data) { var r = await fetch("/api/mixtapes", { method:"POST", headers:{"Content-Type":"application/json","x-admin-password":ADMIN_PASSWORD}, body:JSON.stringify({title:data.title,video_url:data.videoUrl || "",artwork:data.artwork || ""}) }); if (!r.ok) throw new Error("save failed"); await refresh(); }
  async function deleteVideo(id) { var r = await fetch("/api/mixtapes?id=" + encodeURIComponent(id), { method:"DELETE", headers:{"x-admin-password":ADMIN_PASSWORD} }); if (!r.ok) throw new Error("delete failed"); await refresh(); }
  function vote(id) {
    if (!isVotingOpen()) return Promise.resolve({ok:false,reason:"closed"});
    if (hasVotedAny()) return Promise.resolve({ok:false,reason:"already"});

    // Lock the weekly vote immediately so the interface never waits on the network.
    var week = new Date();
    week.setHours(0, 0, 0, 0);
    week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
    var weekKey = week.toISOString().slice(0, 10);
    localStorage.setItem("blm_voted_week", weekKey);
    global.dispatchEvent(new Event("blm:updated"));

    return fetch("/api/votes", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mixtape_id:id,voter_key:voterKey}), keepalive:true})
      .then(function (r) {
        if (r.status === 409) return {ok:false,reason:"already"};
        if (!r.ok) return {ok:false,reason:"error"};
        refresh().catch(function () {});
        return {ok:true};
      })
      .catch(function () {
        localStorage.removeItem("blm_voted_week");
        global.dispatchEvent(new Event("blm:updated"));
        return {ok:false,reason:"error"};
      });
  }
  function hasVotedAny() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return localStorage.getItem("blm_voted_week") === d.toISOString().slice(0, 10);
  }
  function hasVoted() { return hasVotedAny(); }
  function login(pw) { if (pw === ADMIN_PASSWORD) { sessionStorage.setItem(adminKey,"1"); return true; } return false; }
  function isLoggedIn() { return sessionStorage.getItem(adminKey) === "1"; }
  function logout() { sessionStorage.removeItem(adminKey); }
  global.BLM = {getVideos,refresh,addVideo,deleteVideo,vote,hasVoted,hasVotedAny,isVotingOpen,toEmbedUrl,login,isLoggedIn,logout};
  refresh().catch(function () { global.dispatchEvent(new Event("blm:updated")); });
  // Poll only while the tab is visible, and refresh immediately when users return.
  var pollTimer;
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      if (!document.hidden) refresh().catch(function () {});
    }, 5000);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clearInterval(pollTimer);
    else {
      refresh().catch(function () {});
      startPolling();
    }
  });
  startPolling();
})(window);
