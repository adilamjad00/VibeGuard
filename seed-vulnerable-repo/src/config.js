// AI-generated "config" with committed credentials.
//
// Every value here is synthetic and has never been valid anywhere.
//
// Why these look like real secrets rather than saying "FAKE_KEY": scanners
// match on structure and entropy, not on the word "key". gitleaks'
// generic-api-key rule wants an identifier containing key/secret/token/password
// assigned a 10–150 character value with Shannon entropy of at least 3.5. A
// friendly placeholder like "my-fake-key" fails the entropy test and is
// invisible — a fixture built from those proves nothing.
//
// Why there is no `sk-...` or `AKIA...` key here: provider-format credentials
// are caught by GitHub's own push protection, which refuses the commit before
// it can ever reach a scanner. That is the same class of detection VibeGuard
// performs, arriving one step earlier in the chain. High-entropy generic
// secrets are not covered by push protection, so they are what a real leak in
// an internal service usually looks like anyway.
module.exports = {
  apiKey: "Xq7vR2mK9pL4wN8sT5yB3zC6hJ1dF0gA",
  jwtSecret: "Zk4nQ8xW2vB6yH1mR9tL5cJ3fD7gS0pA",
  databasePassword: "T9wE3rY7uI1oP5aS8dF2gH6jK0lZ4xC",
  sessionToken: "b7C2dE9fG4hJ6kL1mN8pQ3rS5tU0vW7x",
};
