const db = require("./fake-db");
// User input concatenated straight into SQL — classic AI happy-path bug
function getUser(username) {
  const query = "SELECT * FROM users WHERE name = '" + username + "'";
  return db.query(query);
}
module.exports = { getUser };
