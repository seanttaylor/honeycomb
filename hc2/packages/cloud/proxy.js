import { JsonRpcClient } from './rpc-client.js';
import { HC2Result, HC2ResultSource, HC2ErrorCode, HC2ServiceRegistration } from './interfaces.js';

/**
 * Canonical result wrapper for all hc2.my.* method invocations.
 * This constructor normalizes raw method outputs, errors, or exceptions
 * into the invariant HC2Result interface expected by SDK consumers.
 */
class HC2Result {
  /**
   * @param {Object} options
   * @param {String} options.service - target service name
   * @param {String} options.method - target method name
   * @param {'sdk'|'proxy'|'service'} options.source - originating layer
   * @param {Object} [options.data] - successful return value
   * @param {Object} [options.error] - error descriptor (if any)
   */
  constructor({ service, method, source, data, error }) {
    const hasError = Boolean(error);

    this.__metadata = Object.freeze({
      service,
      method,
      source,
      timestamp: new Date().toISOString(),
    });

    this.hasError = hasError;

    this.data = hasError ? null : data ?? {};

    this.error = hasError
      ? {
          code: error.code,
          message: error.message,
          source: error.source ?? source,
          retryable: error.retryable ?? false,
        }
      : null;

    Object.freeze(this);
  }

  /**
   * Factory helper for successful results
   * @param {Object} args
   * @param {String} args.service
   * @param {String} args.method
   * @param {'sdk'|'proxy'|'service'} args.source
   * @param {Object} args.data
   * @returns {HC2Result}
   */
  static success({ service, method, source = 'service', data }) {
    return new HC2Result({
      service,
      method,
      source,
      data,
    });
  }

  /**
   * Factory helper for error results
   * @param {Object} args
   * @param {String} args.service
   * @param {String} args.method
   * @param {'sdk'|'proxy'|'service'} args.source
   * @param {Object} args.error
   * @param {String} args.error.code
   * @param {String} args.error.title
   * @param {'sdk'|'proxy'|'service'} [args.error.source]
   * @param {Boolean} [args.error.retryable]
   * @returns {HC2Result}
   */
  static error({ service, method, source = 'sdk', error }) {
    return new HC2Result({
      service,
      method,
      source,
      error,
    });
  }

  /**
   * Adapts an exception or unknown failure into a safe {@link HC2Result}
   * This method must be used inside catch blocks to guarantee
   * the SDK never throws.
   * @param {Object} args
   * @param {String} args.service
   * @param {String} args.method
   * @param {'sdk'|'proxy'|'service'} args.source
   * @param {Error} args.exception
   * @returns {HC2Result}
   */
  static exception({ service, method, source = 'sdk', exception }) {
    return new HC2Result({
      service,
      method,
      source,
      error: {
        code: 'HC2_SDK_INTERNAL_ERROR',
        title: exception?.message || 'Unexpected SDK error',
        source,
        retryable: false,
      },
    });
  }
}




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
         * @returns {HC2Result}
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
            return HC2Result.error({ 
              service: serviceNameOrProp, 
              method: null, 
              source: HC2ResultSource.SDK, 
              error: {
                code: HC2ErrorCode.HC2_ROUTE_NOT_FOUND,
                message: 'Service not known to HC2Proxy SDK',
                retryable: true,
              }
            });
          } catch (ex) {
            console.error(
              `INTERNAL_ERROR (honeycomb.HC2.Proxy): **EXCEPTION ENCOUNTERED** while intializing HC2Proxy instance. See details -> ${ex.message}`
            );
            return HC2Result.exception({
              service: serviceNameOrProp, 
              method: null, 
              exception: ex
            });
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
   * @param {Object} reg.payload
   * @param {String} reg.payload.app
   * @param {Object} reg.payload.service
   * @param {HC2ServiceRegistration} reg.payload - the registration details of the service
   * @param {HC2ServiceCertificate} reg.payload.HC2ServiceCertificate - service certificate issued by an HC2 instance in stringified and base64-encoded 
   * @param {String} reg.signature - signature of the service requesting registration
   * @returns {Object} - the registration receipt
   */
  async register(reg) {
    const { service } = reg.payload;
    const HC2ServiceCertificate = JSON.parse(
      atob(reg.payload.HC2ServiceCertificate)
    );

    try {
      const certId = HC2ServiceCertificate.payload.metadata.certificateId;
      if (!HC2ServiceCertificate) {
        throw Error('Could not parse service certificate. It may be **undefined**')
      }

      const certVerificationReq = await fetch(`${this.#HC2_INSTANCE_URL}/api/v1/certs/${certId}/verify`, {
        method: 'POST',
        body: JSON.stringify(HC2ServiceCertificate),
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

      if (certVerificationReq.status >= 204) {
        console.info(`HC2 service certificate verified for service (${service.name})`);
      }

      const serviceRegistrationReq = await fetch(`${this.#HC2_INSTANCE_URL}/api/v1/services`, {
        method: 'POST',
        body: JSON.stringify(reg),
        headers: {
          'content-type': 'application/json',
          authorization: 'super-secret-credential'
        }
      });

      if (serviceRegistrationReq.status >= 400) {
        const response = serviceRegistrationReq.json();
        console.error(`INTERNAL_ERROR (honeycomb.HC2.Proxy): Service registration failed with status code (${serviceRegistrationReq.status}). See details -> ${response.title}`);
        return {};
      }

      const response = await serviceRegistrationReq.json();
      console.info(`HC2 service registration completed successfully on instance (${response.hc2InstanceId}) with service id (${response.serviceId}) and service alias (${response.alias})`);
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
