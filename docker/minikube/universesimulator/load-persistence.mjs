// Upserts into minikube's persistence the objects `make seed-simulation` read from the test
// server (`.build/persistence-items.json`, on stdin): SandBox, its villages and cargo depots,
// with their UUIDs. Runs inside the cluster (`kubectl exec … node -e`), where persistence answers
// on `service-persistence:3001`; persistence's POST is an upsert, so a rerun changes nothing.
const PERSISTENCE = 'http://service-persistence:3001';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const items = JSON.parse(Buffer.concat(chunks).toString('utf8'));

let written = 0;
for (const item of items) {
  const res = await fetch(`${PERSISTENCE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_uuid: item.object_uuid,
      object_type: item.object_type,
      object_data: item.object_data,
    }),
  });
  if (!res.ok) {
    console.error(
      `persistence answered ${res.status} for ${item.object_uuid}: ${await res.text()}`,
    );
    process.exit(1);
  }
  written += 1;
}
console.log(`  · ${written} objects upserted into minikube's persistence`);
