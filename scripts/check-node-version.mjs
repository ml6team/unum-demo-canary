import { pathToFileURL } from 'node:url';

export const SUPPORTED_NODE_MAJORS = [22, 24];

export function checkNodeVersion(version) {
  const bare = version.replace(/^v/, '');
  const major = Number.parseInt(bare.split('.')[0] ?? '', 10);
  if (SUPPORTED_NODE_MAJORS.includes(major)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: `Node ${bare} is not supported for local development. Use Node ${SUPPORTED_NODE_MAJORS.join(' or ')}.`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, message } = checkNodeVersion(process.versions.node);
  if (!ok) {
    console.error(message);
    process.exit(1);
  }
}
