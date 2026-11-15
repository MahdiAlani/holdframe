import { CURRENT_VERSION, type Project } from './types';
import { ProjectValidationError, validateProject } from './validate';

export class UnsupportedVersionError extends Error {
  constructor(public readonly found: unknown) {
    super(
      typeof found === 'number' && found > CURRENT_VERSION
        ? `This project was saved by a newer version of holdframe (file version ${found}). ` +
            `This build reads up to version ${CURRENT_VERSION}. Update holdframe to open it.`
        : `Unrecognised project version: ${JSON.stringify(found)}.`,
    );
    this.name = 'UnsupportedVersionError';
  }
}

// Parses untrusted data into a current-version Project, or throws without side effects.
export function loadProject(data: unknown): Project {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ProjectValidationError('project', 'expected an object');
  }
  const version = (data as { version?: unknown }).version;
  if (version !== CURRENT_VERSION) throw new UnsupportedVersionError(version);
  return validateProject(data);
}
