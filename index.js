import sha256 from 'js-sha256';

class Sandbox extends EventTarget {
  #registry = {}; // module factories (moduleName -> factory)
  #policies = {}; // moduleName -> { allowedAPIs: [] }

  /**
   * @param {String[]} modules - module names to register for this sandbox instance
   * @param {Function} callback - app entrypoint, receives unrestricted sandbox
   * @param {Object} policies - maps moduleName -> { allowedAPIs: [string] }
   */
  constructor(modules, callback, policies = {}) {
    super();

    // Save policies (immutable-ish copy)
    this.#policies = Object.assign({}, policies);

    // --- CORE namespace (always available to both app and modules) ---
    const core = {
      createHash(str) {
        return sha256.create().update(str).hex();
      },
      generateUUID: this.generateUUID.bind(this),
      fetch: fetch,
      logger: {
        getLoggerInstance: () => console,
      },
    };

    // The app-visible 'my' object that will host lazy getters for all modules.
    // This object is the single source-of-truth backing modules, and module proxies
    // will forward to it when allowed.
    const my = {};

    // We'll collect factory functions and a list of bootstrap modules.
    const factories = {};
    const bootstrapList = [];

    // Phase 1: Build factories (no instantiation yet) and capture bootstrap intent.
    modules.forEach((moduleName) => {
      const moduleDefinition = Sandbox.modules[moduleName];

      if (!moduleDefinition) {
        console.error(
          `INTERNAL_ERROR (sandbox): Cannot create factory; module not found (${moduleName})`
        );
        return;
      }

      // If the module class declares bootstrap=true, mark it for autostart.
      if (moduleDefinition.bootstrap) {
        bootstrapList.push(moduleName);
      }

      // Create factory: when invoked, construct the module with a restricted sandbox
      factories[moduleName] = () => {
        // Each module's constructor receives a *restricted* sandbox view.
        // We call this.declare(...) here so the module never sees the full 'my'.
        const declared = this.declare(moduleName, core, my);
        return new Sandbox.modules[moduleName](declared);
      };
    });

    // Phase 2: Define lazy getters on the public 'my' object so every module name is addressable.
    Object.entries(factories).forEach(([moduleName, factory]) => {
      Object.defineProperty(my, moduleName, {
        configurable: true,
        enumerable: true,
        get: () => {
          // Store the instance on a private key so the getter can detect prior instantiation.
          const privateKey = `__${moduleName}`;

          if (!my[privateKey]) {
            try {
              my[privateKey] = factory();
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (sandbox): Could not create module (${moduleName}); ensure this module is registered via Sandbox.modules.of() and that it is INITIALIZED. See details -> ${ex.message}`
              );
            }
          }

          return my[privateKey];
        },
      });
    });

    // The unrestricted sandbox (what the application callback receives).
    // It exposes the full 'my' (unrestricted) and 'core'.
    const fullSandbox = {
      core,
      my,
      addEventListener: this.addEventListener.bind(this),
      dispatchEvent: this.dispatchEvent.bind(this),
      // Expose declare so the host app can obtain restricted views if necessary.
      declare: (moduleId) => this.declare(moduleId, core, my),
    };

    // Phase 3: Instantiate autostart/bootstrap modules by accessing the lazy getters.
    // Because getters already exist, any lazy lookup inside bootstrap constructors is safe.
    bootstrapList.forEach((moduleName) => {
      try {
        // Accessing fullSandbox.my[moduleName] triggers the getter -> factory -> instance.
        /* eslint-disable no-unused-expressions */
        fullSandbox.my[moduleName];
        /* eslint-enable no-unused-expressions */
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (sandbox): Failed to autostart bootstrap module (${moduleName}). ${ex.message}`
        );
      }
    });

    // Execute the app callback with the unrestricted sandbox.
    try {
      callback(fullSandbox);
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (sandbox): Exception in application callback. See details -> ${ex.message}`
      );
    }

    // Restrict external return surface: only expose a safe dispatchEvent method.
    return {
      dispatchEvent: this.dispatchEvent.bind(this),
    };
  }

  /**
   * Returns a restricted view of the sandbox for a specific moduleId.
   * Modules receive this view when they are constructed.
   *
   * Policy semantics (default-deny):
   * - If a policy entry exists for moduleId, allowedAPIs = policies[moduleId].allowedAPIs
   * - If no policy entry exists, allowedAPIs = [] (default deny)
   *
   * The returned object includes:
   * - core (always available)
   * - my (Proxy that throws POLICY_ERROR on unauthorized access)
   * - addEventListener / dispatchEvent bound to this Sandbox
   *
   * @param {String} moduleId
   * @param {Object} core - the core utilities object
   * @param {Object} my - the backing 'my' with lazy getters (unrestricted)
   */
  declare(moduleId, core, my) {
    // Pull allowed APIs for this module; default deny if none specified.
    const allowed =
      (this.#policies[moduleId] && this.#policies[moduleId].allowedAPIs) || [];

    // Freeze a shallow copy to avoid accidental mutation
    const allowedSet = new Set(Array.isArray(allowed) ? allowed.slice() : []);

    const restrictedMy = new Proxy(
      {},
      {
        get: (_, prop) => {
          // Non-string props (symbols etc.) should be forwarded if they are internal
          if (typeof prop !== 'string') {
            return undefined;
          }

          // Putting the module's own name in allowed is unnecessary; attempts to
          // access its own API via my.SelfService would be considered inter-module access.
          // Deny unless explicitly allowed.
          if (!allowedSet.has(prop)) {
            throw new Error(
              `POLICY_ERROR: Access to API "${prop}" denied for module "${moduleId}".` +
                ` Ensure a policy entry exists for "${moduleId}" granting access to this API.`
            );
          }

          // If the target service is not registered, surface a clear error.
          if (!Object.prototype.hasOwnProperty.call(my, prop)) {
            throw new Error(
              `INTERNAL_ERROR (Sandbox): The service (${prop}) does NOT exist. Ensure it has been registered via Sandbox.modules.of() and provided in the Sandbox modules list.`
            );
          }

          // Access the backing 'my' (this may trigger lazy construction).
          return my[prop];
        },
        // Prevent writes through the restricted view
        set: () => {
          throw new Error(
            `POLICY_ERROR: Cannot assign properties on sandbox.my from module "${moduleId}".`
          );
        },
        has: (_, prop) => {
          return (
            allowedSet.has(prop) &&
            Object.prototype.hasOwnProperty.call(my, prop)
          );
        },
        ownKeys: () => {
          // Only list allowed APIs that are registered
          return Object.keys(my).filter((k) => allowedSet.has(k));
        },
        getOwnPropertyDescriptor: (_, prop) => {
          if (
            allowedSet.has(prop) &&
            Object.prototype.hasOwnProperty.call(my, prop)
          ) {
            return {
              enumerable: true,
              configurable: true,
            };
          }
          return undefined;
        },
      }
    );

    // The restricted sandbox view returned to modules
    return {
      core,
      my: restrictedMy,
      addEventListener: this.addEventListener.bind(this),
      dispatchEvent: this.dispatchEvent.bind(this),
      // Keep generateUUID available directly (convenience)
      generateUUID: this.generateUUID.bind(this),
    };
  }

  /**
   * Generates a version 4 UUID (same helper as before)
   * @returns {String}
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Static modules registry. Same as previous versions.
   */
  static modules = {
    of: function (moduleName, moduleClass) {
      Sandbox.modules[moduleName] = moduleClass;
    },
  };
}

class ApplicationService {
  constructor() {}

  get status() {
    return {
      name: this.constructor.name,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * This service is just used as a sanity check to ensure the module system is working
 */
class NOOPService extends ApplicationService {
  #logger;
  #sandbox;

  /**
   * @param {ISandbox} sandbox
   */
  constructor(sandbox) {
    super();

    this.#sandbox = sandbox;
    this.#logger = sandbox.core.logger.getLoggerInstance();

    try {
      console.log('From NOOPService', sandbox.my.CacheService.status);
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (NOOPService): Exception encountered while starting the service. See details -> ${ex.message}`
      );
    }
  }
}

class FeedService extends ApplicationService {
  #logger;
  #sandbox;

  /**
   * @param {ISandbox} sandbox
   */
  constructor(sandbox) {
    super();
    this.#sandbox = sandbox;
    this.#logger = sandbox.core.logger.getLoggerInstance();
  }
}

class CacheService extends ApplicationService {
  #logger;
  #sandbox;

  static bootstrap = true;

  /**
   * @param {ISandbox} sandbox
   */
  constructor(sandbox) {
    super();
    this.#sandbox = sandbox;
    this.#logger = sandbox.core.logger.getLoggerInstance();
  }
}

/**
 * Example of creating a sandboxed application with Honeycomb 
 *
(async function main() {
  try {
    Sandbox.modules.of('NOOPService', NOOPService);
    Sandbox.modules.of('FeedService', FeedService);
    Sandbox.modules.of('CacheService', CacheService);

    // Define policies
    const policies = {
      // NOOPService: {
      //   allowedAPIs: ['CacheService'], // only Cache allowed
      // },
      FeedService: {
        allowedAPIs: ['NOOPService'], // can only call NOOPService
      },
    };

    new Sandbox(
      ['NOOPService', 'FeedService', 'CacheService'],
      (sandbox) => {
        console.log(sandbox.my.NOOPService.status); // works for app
      },
      policies
    );
  } catch (ex) {
    console.error(
      `INTERNAL_ERROR (Main): Exception encountered. See details -> ${ex.message}`
    );
  }
})();
*/
