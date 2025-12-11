
class ApplicationService {
    constructor() {}
  
    get status() {
      return {
        name: this.constructor.name,
        timestamp: new Date().toISOString(),
      };
    }
  
}

export class CacheService extends ApplicationService {
  #logger;
  #sandbox;

  static bootstrap = true;

  /**
   * @param {ISandbox} sandbox
   */
  constructor(sandbox) {
    super();
    // this.#sandbox = sandbox;
    // this.#logger = sandbox.core.logger.getLoggerInstance();
  }
}
