export class PluginNOOP {
    #logger;
    static target = 'NOOPService';
    static mode = 'pre_ex';
  
    constructor(sandbox) {
      this.#logger = sandbox.core.logger.getLoggerInstance();
      // plugin has access to sandboxed services
      this.#logger.log('What a feeling!');
    }
    
    /**
     * @param {String} receiver 
     * @returns String[]
     */
    hello(receiver) {
      // Example of plugin method throwing exception;
      // in `pre-ex and `override` modes the original 'unplugged' method executes after the exception is logged
      // in `post-ex` mode the exception is logged **after** executing the 'unplugged' method
      throw new Error('uh oh');
      //return [`smelly ${receiver}`, 'yo mama'];
    }
  }
  