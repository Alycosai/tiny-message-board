// Simple Basic Auth for protected routes like /messages
module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, encoded] = authHeader.split(" ");

  if (scheme === "Basic" && encoded) {
    try {
      const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
      if (
        user === process.env.BASIC_AUTH_USER &&
        pass === process.env.BASIC_AUTH_PASS
      ) {
        req.user = user; // record who authenticated
        return next();
      }
    } catch {/* fall through */}
  }

  res.set("WWW-Authenticate", 'Basic realm="Restricted"');
  return res.status(401).send("Authentication required");
};
