import os from "os";

export function GET() {
  return Response.json({ status: "ok", pod: os.hostname() });
}