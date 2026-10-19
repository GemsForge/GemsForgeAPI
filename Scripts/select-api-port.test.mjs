import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { selectApiPort } from "./select-api-port.mjs";

test("allocates an available ephemeral loopback port by default", async () => {
  const { port, usedFallback } = await selectApiPort("127.0.0.1");
  assert.ok(port > 0);
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

test("falls back when an explicit port is occupied", async () => {
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const occupiedPort = reservation.address().port;
  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await selectApiPort("127.0.0.1", String(occupiedPort));
    assert.notEqual(result.port, occupiedPort);
    assert.ok(result.port > 0);
    assert.equal(result.usedFallback, true);
  } finally {
    console.error = originalError;
    await new Promise((resolve) => reservation.close(resolve));
  }
});

test("rejects malformed explicit ports", async () => {
  await assert.rejects(selectApiPort("127.0.0.1", "not-a-port"), /API_PORT must be an integer/);
});
