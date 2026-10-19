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

export async function selectApiPort(host, requestedPort = "") {
  if (requestedPort) {
    const port = Number(requestedPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`API_PORT must be an integer between 1 and 65535; received '${requestedPort}'.`);
    }

    const availablePort = await bindPort(host, port);
    if (availablePort !== null) return { port: availablePort, usedFallback: false };
    console.error(`API_PORT=${port} is already in use; selecting an available port instead.`);
  }

  const port = await bindPort(host, 0);
  if (port === null) throw new Error(`Could not allocate an available API port on ${host}.`);
  return { port, usedFallback: Boolean(requestedPort) };
}

if (process.argv[1]?.endsWith("select-api-port.mjs")) {
  try {
    const [, , host = "127.0.0.1", requestedPort = ""] = process.argv;
    const result = await selectApiPort(host, requestedPort);
    console.log(result.port);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
