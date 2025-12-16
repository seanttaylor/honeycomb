import { JsonRpcClient } from './rpc-client.js';

/**
 * HC2Result
 *
 * Canonical result wrapper for all hc2.my.* method invocations.
 * This constructor normalizes raw method outputs, errors, or exceptions
 * into the invariant HC2Result interface expected by SDK consumers.
 */
class HC2Result {
  /**
   * @param {Object} options
   * @param {String} options.service - Target service name
   * @param {String} options.method - Target method name
   * @param {'sdk'|'proxy'|'service'} options.source - Originating layer
   * @param {Object} [options.data] - Successful return value
   * @param {Object} [options.error] - Error descriptor (if any)
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
   * Factory helper for successful results.
   *
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
   * Factory helper for error results.
   *
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
   * Adapts an exception or unknown failure into a safe HC2Result.
   * This method must be used inside catch blocks to guarantee
   * the SDK never throws.
   *
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
 * Enumerates the possible origins of an {@link HC2Result}. This value appears in
 * the `__metadata.source` field and indicates **which layer of the HC2 system**
 * produced the result or error.
 *
 * This field is intended strictly for diagnostics, logging, and observability.
 * Consumers must not rely on it for control flow or business logic.
 *
 * @readonly
 * @enum {String}
 */
export const HC2ResultSource = {
  /**
   * SDK-level source.
   *
   * Indicates the result was produced entirely within the HC2Proxy SDK, prior to
   * any network or RPC interaction. Common causes include missing routing data,
   * invalid method access, or internal SDK errors.
   */
  SDK: 'sdk',

  /**
   * Proxy / transport-level source.
   *
   * Indicates the SDK successfully resolved routing information and attempted
   * to contact the target service, but the failure occurred during transport,
   * routing, or RPC execution (e.g. service unavailable or timeout).
   */
  PROXY: 'proxy',

  /**
   * Service-level source.
   *
   * Indicates the request was successfully delivered to the target service and
   * the result (success or error) was produced by the service itself.
   */
  SERVICE: 'service',
};

/**
 * Canonical return envelope for **all** calls made through the `hc2.my.*` namespace.
 * This interface is *invariant*: every proxy call returns this shape regardless of
 * success, failure, routing state, or service availability. The SDK never throws;
 * all error conditions are represented as data.
 *
 * @typedef {Object} HC2Result
 *
 * @property {Object} __metadata
 * A sealed, read-only object containing diagnostic and contextual information
 * about the proxy invocation. This data is intended for logging, tracing, and
 * debugging purposes only and must not be used for control flow.
 *
 * @property {String} __metadata.service
 * The name of the target service being invoked.
 *
 * @property {String} __metadata.method
 * The name of the service method being invoked.
 *
 * @property {'sdk'|'proxy'|'service'} __metadata.source
 * Indicates where the result was produced. `sdk` implies the call failed before
 * leaving the SDK (e.g. missing routing data). `proxy` indicates a failure during
 * routing or transport. `service` indicates the target service executed and
 * returned the result.
 *
 * @property {String} __metadata.timestamp
 * An ISO-8601 timestamp indicating when the result was produced.
 *
 * @property {Object|null} data
 * The successful return value of the service method. This will be an object when
 * `hasError` is `false` and **must be `null` when `hasError` is `true`**.
 *
 * @property {Boolean} hasError
 * Indicates whether the proxy call resulted in an error. This value is authoritative
 * and must be checked before accessing `data`.
 *
 * @property {Object|null} error
 * Detailed error information when `hasError` is `true`. This value is **always `null`
 * on success**.
 *
 * @property {String} error.code
 * A stable, machine-readable error code identifying the failure condition
 * (e.g. `HC2_ROUTE_NOT_FOUND`, `HC2_SERVICE_UNAVAILABLE`). Error codes are drawn
 * from a closed, SDK-defined set.
 *
 * @property {String} error.title
 * A short, human-readable summary of the error condition.
 *
 * @property {'sdk'|'proxy'|'service'} error.source
 * Indicates which layer produced the error.
 *
 * @property {Boolean} [error.retryable]
 * Indicates whether retrying the operation may succeed at a later time
 * (e.g. service not yet available during startup).
 */


/**
 * HC2ErrorCode
 *
 * Enumerates all stable, SDK-defined error codes that may appear in the
 * `error.code` field of an {@link HC2Result}. This is a **closed set**: consumers
 * should not assume the presence of any error codes outside those defined here.
 *
 * Error codes are grouped by the layer responsible for producing the error:
 * SDK, Proxy / Network, or Service.
 *
 * @readonly
 * @enum {String}
 */
export const HC2ErrorCode = {
  /**
   * SDK-level error.
   *
   * The SDK has no routing or metadata information for the requested service.
   * This typically indicates that the service has not yet been registered with
   * the HC2 instance or that routing metadata has not yet propagated into the SDK.
   */
  HC2_ROUTE_NOT_FOUND: 'HC2_ROUTE_NOT_FOUND',

  /**
   * SDK-level error.
   *
   * The requested method does not exist in the service’s published API schema.
   * This error is detected locally by the SDK before any RPC call is made.
   */
  HC2_METHOD_NOT_FOUND: 'HC2_METHOD_NOT_FOUND',

  /**
   * SDK-level error.
   *
   * An unexpected exception or invariant violation occurred within the SDK
   * itself. This indicates a bug in the HC2Proxy SDK implementation rather than
   * a user or service error.
   */
  HC2_SDK_INTERNAL_ERROR: 'HC2_SDK_INTERNAL_ERROR',

  /**
   * Proxy / network-level error.
   *
   * The target service is known and registered, but its RPC endpoint is not
   * reachable. This commonly occurs during service startup or restart windows.
   */
  HC2_SERVICE_UNAVAILABLE: 'HC2_SERVICE_UNAVAILABLE',

  /**
   * Proxy / network-level error.
   *
   * The RPC call to the target service exceeded the configured timeout before
   * a response was received.
   */
  HC2_RPC_TIMEOUT: 'HC2_RPC_TIMEOUT',

  /**
   * Proxy / network-level error.
   *
   * The target service returned a malformed response or an error that could not
   * be safely interpreted by the proxy or SDK.
   */
  HC2_RPC_ERROR: 'HC2_RPC_ERROR',

  /**
   * Service-level error (passthrough).
   *
   * The parameters supplied to the service method failed schema validation
   * according to the service’s declared API contract.
   */
  HC2_INVALID_PARAMS: 'HC2_INVALID_PARAMS',

  /**
   * Service-level error (passthrough).
   *
   * The target service executed the method but threw an exception or explicitly
   * returned an error condition.
   */
  HC2_SERVICE_ERROR: 'HC2_SERVICE_ERROR',
};

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

        // TODO: validate registration object
        // certificate response
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
        console.info(`HC2 service registration completed successfully on instance (${response.hc2InstanceId}) with serviceId (${response.serviceId}) and service alias (${response.serviceShortName})`);
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
