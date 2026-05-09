import net from "net";

export function findAvailablePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(preferred, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : preferred;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      const fallback = net.createServer();
      fallback.listen(0, () => {
        const addr = fallback.address();
        const port = typeof addr === "object" && addr ? addr.port : preferred + 1;
        fallback.close(() => resolve(port));
      });
    });
  });
}
