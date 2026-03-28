const express = require("express");
const path = require("path");
const admin = require("firebase-admin");
const app = express();

app.use(express.json());

// Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://ttsitv-a56b5-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "v0id-4dm1n-k3y-9x2";

// serve main site
app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname, "..", "Views", "index.html"));
});

// serve admin page
app.get("/admin", function(req, res) {
  res.sendFile(path.join(__dirname, "..", "Views", "admin.html"));
});

// admin login
app.post("/admin/login", function(req, res) {
  if (req.body.password === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(401).json({ ok: false });
});

// submit report
app.post("/report", function(req, res) {
  var data = req.body;
  if (!data.reportedUid || !data.message) return res.status(400).json({ error: "missing fields" });
  db.ref("reports").push({
    reportedUid: data.reportedUid,
    reporterUid: data.reporterUid || "unknown",
    message: data.message,
    context: data.context || [],
    reportedCountry: data.reportedCountry || null,
    reportedUsername: data.reportedUsername || "",
    ts: Date.now(),
    status: "pending"
  }).then(function() { res.json({ ok: true }); });
});

// get reports
app.get("/admin/reports", function(req, res) {
  if (req.headers["x-admin-key"] !== ADMIN_PASSWORD) return res.status(401).json({ error: "unauthorized" });
  db.ref("reports").orderByChild("ts").once("value").then(function(snap) {
    if (!snap.exists()) return res.json([]);
    var reports = [];
    snap.forEach(function(child) { reports.unshift(Object.assign({ id: child.key }, child.val())); });
    res.json(reports);
  });
});

// ignore report
app.post("/admin/ignore/:id", function(req, res) {
  if (req.headers["x-admin-key"] !== ADMIN_PASSWORD) return res.status(401).json({ error: "unauthorized" });
  db.ref("reports/" + req.params.id).update({ status: "ignored" }).then(function() { res.json({ ok: true }); });
});

// ban user
app.post("/admin/ban/:uid", function(req, res) {
  if (req.headers["x-admin-key"] !== ADMIN_PASSWORD) return res.status(401).json({ error: "unauthorized" });
  var uid = req.params.uid;
  var reportId = req.body.reportId;
  db.ref("bans/" + uid).set({ banned: true, ts: Date.now() }).then(function() {
    if (reportId) return db.ref("reports/" + reportId).update({ status: "banned" });
  }).then(function() { res.json({ ok: true }); });
});

// unban user
app.post("/admin/unban/:uid", function(req, res) {
  if (req.headers["x-admin-key"] !== ADMIN_PASSWORD) return res.status(401).json({ error: "unauthorized" });
  db.ref("bans/" + req.params.uid).remove().then(function() { res.json({ ok: true }); });
});

// get bans
app.get("/admin/bans", function(req, res) {
  if (req.headers["x-admin-key"] !== ADMIN_PASSWORD) return res.status(401).json({ error: "unauthorized" });
  db.ref("bans").once("value").then(function(snap) { res.json(snap.exists() ? snap.val() : {}); });
});

module.exports = app;
