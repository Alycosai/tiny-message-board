// auth.js (ESM)
export function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      // fall through
    }

    const sep = decoded.indexOf(":");
    const user = sep >= 0 ? decoded.slice(0, sep) : "";
    const pass = sep >= 0 ? decoded.slice(sep + 1) : "";

    const envUser = process.env.BASIC_AUTH_USER;   // optional
    const envPass = process.env.BASIC_AUTH_PASS;   // required

    const passwordOnlyMode = !!envPass && !envUser;
    const userAndPassMode  = !!envPass && !!envUser;

    if (
      (passwordOnlyMode && pass === envPass) ||
      (userAndPassMode && user === envUser && pass === envPass)
    ) {
      req.user = user || "unknown";
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Messages Log", charset="UTF-8"');
  return res.status(401).send("Authentication required.");
}
