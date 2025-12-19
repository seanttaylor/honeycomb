export class JsonRpcClient {
    #idCounter;

    constructor() {
      this.#idCounter = 0;
    }
  
      
    /**
     * @param {Object} options
     * @param {String} options.method
     * @param {Object} options.params
     * @param {String} options.endpoint
     * @param {Boolean} options.rethrowExceptions
     * @returns {Object}
     */
    async call({ method, params, endpoint, rethrowExceptions=true }) {
      try {
        const id = ++this.#idCounter;
        const body = {
          jsonrpc: '2.0',
          method,
          params,
          id,
        };
  
        const response = await fetch(`${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'super-secret-credential',
          },
          body: JSON.stringify(body),
        });
  
        if (!response.ok) {
          console.error(
            `INTERNAL_ERROR (honeycomb.HC2): Method call (${method}) returned an HTTP error status (${response.status}). See details -> ${response.statusText} `
          );
        }
  
        const json = await response.json();
  
        if ('error' in json) {
          console.error(
            `INTERNAL_ERROR (honeycomb.HC2): Method call (${method}) returned with an error from the service. See details -> ${json.error.message} `
          );
          return;
        }
  
        return json;
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2): **EXCEPTION ENCOUNTERED** while forwarding method call (${method}). See details -> ${ex.message} `
        );
        if (rethrowExceptions) {
          throw new Error(ex.message);
        }
      }
    }
  }
  