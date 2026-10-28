import fs from 'node:fs/promises';
import path from 'node:path';
import { generateKeyPairSync, sign, createPublicKey } from 'node:crypto';
import { parseArgs } from 'node:util';
import { validateManifest } from '../packages/core/update-policy.js';
import { verifyEnvelope } from '../apps/desktop/src/main/updates.mjs';

const { values } = parseArgs({ options: {
  config: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' }, 'key-file': { type: 'string' },
  'key-id': { type: 'string', default: 'production-1' }, 'generate-key': { type: 'string' },
} });
if (values['generate-key']) {
  const filename = path.resolve(values['generate-key']);
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  // Never overwrite an identity, and never print the private key to CI logs.
  await fs.writeFile(filename, privateKey, { mode: 0o600, flag: 'wx' });
  await fs.writeFile(`${filename}.public.json`, JSON.stringify({ [values['key-id']]: publicKey }, null, 2) + '\n', { flag: 'wx' });
  console.log(`Created private key and public trust-root file at the requested location. Keep the private key outside Git.`);
} else {
  if (!values.input || !values.output) throw new Error('Provide --input and --output.');
  const key = values['key-file'] ? await fs.readFile(values['key-file'], 'utf8') : process.env.UTUBE_UPDATE_PRIVATE_KEY;
  if (!key) throw new Error('Provide --key-file or UTUBE_UPDATE_PRIVATE_KEY.');
  const config = JSON.parse(await fs.readFile(values.config || new URL('../packages/core/update-config.json', import.meta.url), 'utf8'));
  const publicKey = createPublicKey(key);
  if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails.namedCurve !== 'prime256v1') throw new Error('Use an ECDSA P-256 update key.');
  const input = validateManifest(JSON.parse(await fs.readFile(values.input, 'utf8')));
  const payload = Buffer.from(JSON.stringify(input));
  const envelope = JSON.stringify({ keyId: values['key-id'], payload: payload.toString('base64'), signature: sign('sha256', payload, key).toString('base64') }) + '\n';
  verifyEnvelope(envelope, config);
  // Do not publish metadata that would roll clients back to an earlier status.
  try {
    const prior = verifyEnvelope(await fs.readFile(values.output, 'utf8'), config, input.issuedAt - 1);
    if (input.revision <= prior.revision) throw new Error('Manifest revisions must increase.');
  } catch (error) {
    if (error.message === 'Manifest revisions must increase.') throw error;
    if (error.code !== 'ENOENT') {
      // Expired signatures are still checked by the client high-water mark. The
      // generator uses millisecond revisions so routine renewals keep increasing.
      console.log('Replacing an expired or unreadable local manifest.');
    }
  }
  await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
  await fs.writeFile(values.output, envelope);
  console.log(`Signed update manifest revision ${input.revision}.`);
}
