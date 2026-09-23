/* Shared localStorage data layer for Best Lekompo Mixtapes */
(function (global) {
  "use strict";

  var VIDEOS_KEY = "blm_videos";
  var VOTED_KEY = "blm_voted"; // ids this browser already voted for
  var ADMIN_KEY = "blm_admin"; // simple client session flag
  var WEEK_KEY = "blm_week"; // Monday-00:00 timestamp of the current week

  function safeParse(raw, fallback) {
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  /* Timestamp (ms) of the most recent Monday 00:00 relative to `now`. */
  function currentWeekStart(now) {
    var d = new Date(now);
    d.setHours(0, 0, 0, 0);
    var day = d.getDay(); // 0 = Sunday ... 6 = Saturday
    var daysSinceMonday = (day + 6) % 7; // Monday -> 0, Sunday -> 6
    d.setDate(d.getDate() - daysSinceMonday);
    return d.getTime();
  }

  /* Clears all mixes and this device's vote once a new week (Monday 00:00) begins. */
  function maybeWeeklyReset() {
    var thisWeek = currentWeekStart(Date.now());
    var stored = parseInt(global.localStorage.getItem(WEEK_KEY), 10);
    if (isNaN(stored)) {
      // First run on this device: record the week without wiping seeded data.
      global.localStorage.setItem(WEEK_KEY, String(thisWeek));
      return;
    }
    if (thisWeek > stored) {
      global.localStorage.removeItem(VIDEOS_KEY);
      global.localStorage.removeItem(VOTED_KEY);
      global.localStorage.setItem(WEEK_KEY, String(thisWeek));
    }
  }

  function getVideos() {
    return safeParse(global.localStorage.getItem(VIDEOS_KEY), []);
  }

  function saveVideos(list) {
    global.localStorage.setItem(VIDEOS_KEY, JSON.stringify(list));
  }

  function addVideo(data) {
    var list = getVideos();
    var video = {
      id: "v_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title: (data.title || "Untitled Mix").trim(),
      videoUrl: (data.videoUrl || "").trim(),
      artwork: data.artwork || "",
      votes: 0,
      createdAt: Date.now(),
    };
    list.unshift(video);
    saveVideos(list);
    return video;
  }

  function deleteVideo(id) {
    saveVideos(
      getVideos().filter(function (v) {
        return v.id !== id;
      })
    );
  }

  function getVotedIds() {
    return safeParse(global.localStorage.getItem(VOTED_KEY), []);
  }

  function hasVoted(id) {
    return getVotedIds().indexOf(id) !== -1;
  }

  /* One vote per person across the whole site (per device). */
  function hasVotedAny() {
    return getVotedIds().length > 0;
  }

  /* Voting is only open on the weekend: Saturday 00:00 through Sunday 23:59. */
  function isVotingOpen() {
    var day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    return day === 6 || day === 0;
  }

  function vote(id) {
    if (!isVotingOpen()) return { ok: false, reason: "closed" };
    if (hasVotedAny()) return { ok: false, reason: "already" };
    var list = getVideos();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].votes = (list[i].votes || 0) + 1;
        found = list[i];
        break;
      }
    }
    if (!found) return { ok: false, reason: "missing" };
    saveVideos(list);
    var voted = getVotedIds();
    voted.push(id);
    global.localStorage.setItem(VOTED_KEY, JSON.stringify(voted));
    return { ok: true, votes: found.votes };
  }

  /* Turn common video links into an embeddable URL. Returns "" if not recognized. */
  function toEmbedUrl(url) {
    if (!url) return "";
    url = url.trim();

    // YouTube
    var yt =
      url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];

    // Vimeo
    var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return "https://player.vimeo.com/video/" + vm[1];

    // Already an embed / iframe-friendly url
    if (/\/embed\/|player\./.test(url)) return url;

    return "";
  }

  /* ---- Admin session (client-side only, not real security) ---- */
  var ADMIN_PASSWORD = "StarJoy Degzza for Vercel.!1";

  function checkPassword(pw) {
    return pw === ADMIN_PASSWORD;
  }

  function login(pw) {
    if (checkPassword(pw)) {
      global.sessionStorage.setItem(ADMIN_KEY, "1");
      return true;
    }
    return false;
  }

  function isLoggedIn() {
    return global.sessionStorage.getItem(ADMIN_KEY) === "1";
  }

  function logout() {
    global.sessionStorage.removeItem(ADMIN_KEY);
  }

  // Run the weekly reset as soon as the store loads, before any page reads data.
  maybeWeeklyReset();

  global.BLM = {
    getVideos: getVideos,
    addVideo: addVideo,
    maybeWeeklyReset: maybeWeeklyReset,
    deleteVideo: deleteVideo,
    vote: vote,
    hasVoted: hasVoted,
    hasVotedAny: hasVotedAny,
    isVotingOpen: isVotingOpen,
    toEmbedUrl: toEmbedUrl,
    login: login,
    isLoggedIn: isLoggedIn,
    logout: logout,
  };
})(window);
