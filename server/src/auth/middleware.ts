import { Request, Response, NextFunction } from "express";
import { validateShareLink } from "./share-links.js";

// HA ingress passes the authenticated user via headers
// For host routes: require HA ingress header or local access
export function requireHost(req: Request, res: Response, next: NextFunction): void {
  // HA ingress sets X-Ingress-Path header for authenticated requests
  const ingressPath = req.headers["x-ingress-path"];
  const isLocal = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "172.30.32.2";

  if (ingressPath || isLocal) {
    next();
    return;
  }

  res.status(401).json({ error: "Host authentication required" });
}

// For guest routes: require a valid share link token
export function requireShareToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.params.token || req.query.token as string;

  if (!token) {
    res.status(401).json({ error: "Share token required" });
    return;
  }

  const result = validateShareLink(token);
  if (!result) {
    res.status(403).json({ error: "Invalid or expired share link" });
    return;
  }

  // Attach room info to request
  (req as Request & { shareLink?: typeof result }).shareLink = result;
  next();
}
