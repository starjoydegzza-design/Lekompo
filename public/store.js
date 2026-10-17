/* Shared server-backed data layer for Best Lekompo Mixtapes. */
(function (global) {
  "use strict";
  var ADMIN_PASSWORD = "StarJoy Degzza for Vercel.!1";
  var weekStart = function (now) {
    var d = new Date(now || Date.now());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  var request = function (url, options) {
    return fetch(url, options || {}).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw { reason: body.error || "request" };
        return body;
      });
    });
  };
  var getVideos = function () { return request("/api/mixes"); };
  var getAdminVideos = function () {
    return request("/api/admin/mixes", { headers: { "x-admin-password": ADMIN_PASSWORD } });
  };
  var addVideo = function (data) {
    return request("/api/mixes", {
      method: "POST", headers: { "Content-Type": "application/json", "x-admin-password": ADMIN_PASSWORD },
      body: JSON.stringify(data)
    });
  };
  var deleteVideo = function (id) {
    return request("/api/mixes?id=" + encodeURIComponent(id), { method: "DELETE", headers: { "x-admin-password": ADMIN_PASSWORD } });
  };
  var vote = function (id) {
    return request("/api/votes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id }) })
      .then(function () { return { ok: true }; }).catch(function (error) { return { ok: false, reason: error.reason }; });
  };
  var isVotingOpen = function () { var day = new Date().getDay(); return day === 0 || day === 6; };
  var toEmbedUrl = function (url) {
    if (!url) return "";
    var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];
    var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return "https://player.vimeo.com/video/" + vm[1];
    return /\/embed\/|player\./.test(url) ? url : "";
  };
  var login = function (pw) { return pw === ADMIN_PASSWORD; };
  global.BLM = { getVideos: getVideos, getAdminVideos: getAdminVideos, addVideo: addVideo, deleteVideo: deleteVideo, vote: vote, isVotingOpen: isVotingOpen, toEmbedUrl: toEmbedUrl, login: login, weekStart: weekStart };
})(window);
