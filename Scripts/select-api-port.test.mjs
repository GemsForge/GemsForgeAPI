import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { selectApiPort } from "./select-api-port.mjs";

test("uses the standard local API port by default", async () => {
  const { port, usedFallback } = await selectApiPort("127.0.0.1");
  assert.equal(port, 8180);
  assert.equal(usedFallback, false);
});

test("honors an available explicit port", async () => {
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));

  const result = await selectApiPort("127.0.0.1", String(port));
  assert.deepEqual(result, { port, usedFallback: false });
});

test("fails when an explicit port is occupied", async () => {
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const occupiedPort = reservation.address().port;
  try {
    await assert.rejects(
      selectApiPort("127.0.0.1", String(occupiedPort)),
      /is already in use; stop the process using it or set API_PORT explicitly/,
    );
  } finally {
    await new Promise((resolve) => reservation.close(resolve));
  }
});

test("rejects malformed explicit ports", async () => {
  await assert.rejects(selectApiPort("127.0.0.1", "not-a-port"), /API_PORT must be an integer/);
});
