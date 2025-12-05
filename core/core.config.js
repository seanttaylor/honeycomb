import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import glob from 'fast-glob';


/**
 * Provider for all system-level config utilities.
 */
export const HCSystemConfigurationProvider = {
  /**
   * Loads the `.honeyrc.js` config file from the application root
   * @param {string} rootDir - Typically `process.cwd()`
   * @returns {Promise<Object>} The default export of .honeyrc.js
   */
  async loadConfig(rootDir = process.cwd()) {
    const configPath = path.resolve(rootDir, '.honeyrc.js');

    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Cannot find .honeyrc.js configuration file in application root (${rootDir}).`
      );
    }

    try {
      const moduleURL = pathToFileURL(configPath).href;
      const imported = await import(moduleURL);

      if (!('default' in imported)) {
        throw new Error(
          `.honeyrc.js configuration file must export a default object (e.g. "export default { ... }").`
        );
      }

      return Object.assign(imported.default, { __appRoot: rootDir });
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (core.config): **EXCEPTION ENCOUNTERED** while loading Honeycomb config. See details -> ${ex.message}`
      );
    }
  },
  /** 
   * Discover all services by scanning the configured service directory
   * @param {object} config - the configuration extracted from `.honeyrc.js`
   * @returns {Promise<string[]>} absolute paths to service files
   */
  async discoverServices(config) {

    if (!config || !config.__appRoot) {
        throw new Error(
         `Invalid config. Honeycomb configuration **MUST** include a __appRoot property. This property **SHOULD** be added by the loadConfig method.`
        );
    }

    try {
        const serviceConfig = config.services ?? {};
        const serviceDir = serviceConfig.dir
        ? path.resolve(config.__appRoot, serviceConfig.dir)
        : path.resolve(config.__appRoot, '/services'); // default fallback

        // Ensure directory exists
        const stat = fs.statSync(serviceDir);

        if (!stat.isDirectory()) {
            console.error(`INTERNAL_ERROR (core.config): Service directory (${serviceDir}) defined in .honeyrc.js does not exist or not a directory.`)
        }
        
        const patterns = serviceConfig.patterns ?? ['**/*.service.js', '**/*.svc.js'];
        
        // Build glob patterns relative to the service dir
        const globPatterns = patterns.map((p) => path.join(serviceDir, p).replace(/\\/g, '/'));
        
        const matches = await glob(globPatterns, {
            absolute: true,
            onlyFiles: true,
        });
        
        return matches;
    } catch(ex) {
        console.error(`INTERNAL_ERROR (core.config): **EXCEPTION ENCOUNTERED** during service discovery. Cannot build service map. See details -> ${ex.message} `);
        return;
    }
    }
};
