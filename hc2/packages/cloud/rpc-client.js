export class JsonRpcClient {
    #URL;
    #token;
    #idCounter;
  
    /**
     * @param {Object} options
     * @param {String} options.URL
     * @param {String} options.token
     * @param {Boolean} options.reconnect
     *
     */
    constructor({
      URL = 'https://httpbin.io/anything',
      token = 'SXQgd2FzIHRoZSBiZXN0IG9mIHRpbWVzLCBpdCB3YXMgdGhlIHdvcnN0IG9mIHRpbWVz',
      reconnect = false,
    } = {}) {
      this.#URL = URL;
      this.#token = token;
      this.#idCounter = 0;
    }
  
    /**
     * @param {String} method - the service method being called
     * @param {Object} params - parameters required by the method called
     */
    async call(method, params) {
      try {
        const id = ++this.#idCounter;
        const body = {
          jsonrpc: '2.0',
          method,
          params,
          id,
        };
  
        const response = await fetch(`${this.#URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.#token}`,
          },
          body: JSON.stringify(body),
        });
  
        if (!response.ok) {
          console.error(
            `INTERNAL_ERROR (honeycomb.HC2): Method call (${method}) returned an HTTP error status (${response.status}). See details -> ${response.statusText} `
          );
          return;
        }
  
        const json = await response.json();
  
        if ('error' in json) {
          console.error(
            `INTERNAL_ERROR (honeycomb.HC2): Method call (${method}) returned with an error from the service. See details -> ${json.error.message} `
          );
          return;
        }
  
        return json.data;
      } catch (ex) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2): **EXCEPTION ENCOUNTERED** while forwarding method call (${method}). See details -> ${ex.message} `
        );
      }
    }
  }
  