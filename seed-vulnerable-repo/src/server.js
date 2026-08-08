const express = require("express");
const { exec } = require("child_process");
const app = express();

// No auth check; user-controlled input into a shell command
app.get("/ping", (req, res) => {
  exec("ping -c 1 " + req.query.host, (err, out) => res.send(out));
});

// "Admin" route with no authorization at all
app.get("/admin/users", (req, res) => res.json({ users: ["all", "the", "data"] }));

app.listen(3000);
