import { JsonRpcClient } from './rpc-client.js';

/**
 * @typedef {Object} HC2ServiceRegistration
 * @property {String} app - the high-level application this service is part of
 * @property {String} serviceName - the service name peer application services will use to access this service's APIs
 * @property {Number} version - the version number of the service
 * @property {Object} api the public API of the service
 * @property {Object[]} api.methods - List of methods defined on the service
 * @property {String} api.methods[].name - Method name
 * @property {Object} api.methods[].params - key/value pairs, maybe even a JSON Schema?
 * @property {String} callbackURL - URL the application service can be contacted for RPC calls
 * @property {String} HC2ServiceCertificate - the certificate signed by the HC2 instance the proxy will connect to
 */

/**
 *
 */
class ServiceProxy {
  #client;

  /**
   * @param {String} serviceName
   * @param {Object} api
   * @param {Object[]} api.methods
   * @param {String} api.callbackURL
   * @param {Object} rpcClient
   */
  constructor(serviceName, api, rpcClient) {
    const EXCLUDED_BUILTIN_METHODS = new Set([
      'toJSON',
      'toString',
      'valueOf',
      'inspect',
      'constructor',
    ]);

    return new Proxy(
      {},
      {
        get(target, methodName) {
          // allow symbol access (`console.log` uses util.inspect symbols)
          if (typeof methodName === 'symbol')
            return Reflect.get(target, methodName);

          if (EXCLUDED_BUILTIN_METHODS.has(methodName)) {
            return Reflect.get(target, methodName);
          }

          const schema = api.methods.find((el, idx) => {
            return methodName === el.name;
          });

          if (!schema) {
            console.error(
              `INTERNAL_ERROR (honeycomb.HC2.Proxy): Could not forward method call (${serviceName}.${methodName}) to the application service. No schema was identified for this method. See docs.`
            );
            return;
          }
          // When the method is invoked, send an RPC call.
          return async function (params = {}) {
            //TODO: Ensure any functions that are called with positional arguments are converted to an object
            try {
              return await rpcClient.call(
                `${serviceName}.${methodName}`,
                params
              );
            } catch (ex) {
              console.error(
                `INTERNAL_ERROR (honeycomb.HC2.Proxy): **EXCEPTION ENCOUNTERED** while forwarding method call (${serviceName}.${methodName}). See details -> ${ex.message}`
              );
            }
          };
        },
      }
    );
  }
}

export class HC2Proxy {
  app;
  my;
  #rpcClient;
  #HC2_INSTANCE_URL;
  #HC2_INSTANCE_ID;
  // cached routing data from the HC2 instance
  #INTERNAL_ROUTE_TABLE = new Map();
  #EXCLUDED_BUILTIN_METHODS;
  services = new Set();

  /**
   * @param {String} HC2_INSTANCE_URL - URL of the HC2 instance to connect to
   * @param {String} app - the application the proxy is associated with
   */
  constructor(HC2_INSTANCE_URL, app) {
    this.#rpcClient = new JsonRpcClient();
    const EXCLUDED_BUILTIN_METHODS = new Set([
      'toJSON',
      'toString',
      'valueOf',
      'inspect',
      'constructor',
    ]);

    const ctx = this;

    this.#HC2_INSTANCE_URL = HC2_INSTANCE_URL;
    this.#EXCLUDED_BUILTIN_METHODS = EXCLUDED_BUILTIN_METHODS;
    this.app = app;

    this.my = new Proxy(
      {},
      {
        /**
         * @param {Object} target
         * @param {String} serviceNameOrProp
         */
        get(target, serviceNameOrProp) {
          try {
            // allow symbol access (`console.log` uses util.inspect symbols)
            if (typeof serviceNameOrProp === 'symbol')
              return Reflect.get(target, serviceNameOrProp);

            if (EXCLUDED_BUILTIN_METHODS.has(serviceNameOrProp)) {
              return Reflect.get(target, serviceNameOrProp);
            }

            if (ctx.services.has(serviceNameOrProp)) {
              // create a service proxy **on demand**
              const schema = ctx.#INTERNAL_ROUTE_TABLE.get(serviceNameOrProp);
              return new ServiceProxy(
                serviceNameOrProp,
                schema,
                ctx.#rpcClient
              );
            }

            console.error(
              `INTERNAL_ERROR (honeycomb.HC2.Proxy): Could not find service (${serviceNameOrProp})`
            );
          } catch (ex) {
            console.error(
              `INTERNAL_ERROR (honeycomb.HC2.Proxy): **EXCEPTION ENCOUNTERED** while intializing HC2Proxy instance. See details -> ${ex.message}`
            );
          }
        },
      }
    );
  }

  get services() {
    return this.services;
  }

  /**
   * Registers a Honeycomb application service with the HC2 instance specified in the constructor
   * @param {Object} reg
   * @param {HC2ServiceRegistration} reg.payload - the registration details of the service
   * @param {HC2ServiceCertificate} reg.payload.HC2ServiceCertificate 
   * @param {String} reg.signature - signature of the service requesting registration
   * @returns {Object} - the registration receipt
   */
  async register(reg) {
    try {
        const certId = reg.payload.HC2ServiceCertificate.payload.metadata.certificateId;

        // TODO: validate registration object
        // certificate response
        const certVerificationReq = await fetch(`${this.#HC2_INSTANCE_URL}/api/v1/certs/${certId}/verify`, {
            method: 'POST',
            body: JSON.stringify(reg),
            headers: {
              'content-type': 'application/json',
              authorization: 'super-secret-credential'
            }
        });

        if (certVerificationReq.status >= 400) {
            const response = await certVerificationReq.json();
            console.error(`INTERNAL_ERROR (honeycomb.HC2.Proxy): Service registration failed with status code (${certVerificationReq.status}). See details -> ${response.title}`);
            return {};
        }

        if (certVerificationReq.status >= 200 && certVerificationReq.status < 300) {
            console.info(`HC2 service certificate verified for service (${reg.payload.service})`);
        }


      /*
      
      const certificateResponse =
        await this.#HC2_INSTANCE.verifyHC2ServiceCertificate(reg);
      if (!certificateResponse.isVerified) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2.Proxy): Cannot complete registration for service (${reg.payload.service}). The HC2 service certificate could not be verified. See docs.`
        );
        return;
      }

      const validationReponse =
        this.#HC2_INSTANCE.validateCertificateClaims(reg);

      if (!validationReponse.isValid) {
        console.error(
          `INTERNAL_ERROR (honeycomb.HC2.Proxy): Cannot complete registration for service (${reg.payload.service}). The HC2 service certificate claims could not be validated. See docs.`
        );
        return;
      }*/

        const serviceRegistrationReq = await fetch(`${this.#HC2_INSTANCE_URL.href}/api/v1/services`, {
            method: 'POST',
            body: JSON.stringify(reg),
            headers: {
                contentType: 'application/json',
                authorization: 'super-secret-credential'
            }
        });

        if (serviceRegistrationReq.status >= 400) {
            const response = serviceRegistrationReq.json();
            console.error(`INTERNAL_ERROR (honeycomb.HC2.Proxy): Service registration failed with status code (${serviceRegistrationReq.status}). See details -> ${response.title}`);
            return {};
        }

        const response = await serviceRegistrationReq.json();


      /*
      const serviceRegistrationReceipt =
        await this.#HC2_INSTANCE.registerService(reg);
      //update HC2Proxy's local route table from HC2 instance's authoritative copy
      this.#INTERNAL_ROUTE_TABLE = new Map(this.#HC2_INSTANCE.routeTable);
      // track service registrations on the HC2 instance
      this.services = new Set(this.#HC2_INSTANCE.services);
      */

      return response;
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (honeycomb.HC2.Proxy): **EXCEPTION ENCOUNTERED** during service registration with HC2 instance (${
          this.#HC2_INSTANCE_URL
        }). See details -> ${ex.message}`
      );
    }
  }
}
