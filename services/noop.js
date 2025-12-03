import { ApplicationService } from '../system.js';

/**
 * This service is just used as a sanity check to ensure
 * the module system is working
 */
export class NOOPService extends ApplicationService {
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
      console.log('Checking Cache status from NOOPService:', sandbox.my.CacheService.status);
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (NOOPService): Exception encountered while starting the service. See details -> ${ex.message}`
      );
    }
  }

  /**
   * 
   * @param {String} receiver 
   * @param {String} sender 
   * @returns {String} 
   */
  hello(receiver, sender) {
    // default behaviors are critical in methods that may be extended by plugins to ensure stability in case of exceptions
    return `[${this.constructor.name}] has a message for ${receiver} from: ${ sender ? sender : 'Someone special' }`;
  }
}
