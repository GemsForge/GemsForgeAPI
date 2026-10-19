import net from "node:net";

function bindPort(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(null));
    server.listen(port, host, () => {
      const selectedPort = server.address()?.port ?? null;
      server.close(() => resolve(selectedPort));
    });
  });
}

export const DEFAULT_API_PORT = 8180;

export async function selectApiPort(host, requestedPort = String(DEFAULT_API_PORT)) {
  if (requestedPort) {
    const port = Number(requestedPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`API_PORT must be an integer between 1 and 65535; received '${requestedPort}'.`);
    }

    const availablePort = await bindPort(host, port);
    if (availablePort !== null) return { port: availablePort, usedFallback: false };
    throw new Error(`API_PORT=${port} is already in use; stop the process using it or set API_PORT explicitly.`);
  }
  throw new Error("API_PORT must be configured for the local API.");
}

if (process.argv[1]?.endsWith("select-api-port.mjs")) {
  try {
    const [, , host = "127.0.0.1", requestedPort = String(DEFAULT_API_PORT)] = process.argv;
    const result = await selectApiPort(host, requestedPort);
    console.log(result.port);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
