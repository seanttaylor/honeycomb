/**
 * Canonical return envelope for **all** calls made through the `hc2.my.*` namespace.
 * This interface is *invariant*: every proxy call returns this shape regardless of
 * success, failure, routing state, or service availability. The SDK never throws;
 * all error conditions are represented as data.
 *
 * @typedef {Object} IHC2Result
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
 * @type {IHC2Result}
 */
export const IHC2Result = Object.freeze({});


/**
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
   * Indicates the result was produced entirely within the HC2Proxy SDK, prior to
   * any network or RPC interaction. Common causes include missing routing data,
   * invalid method access, or internal SDK errors.
   */
  SDK: 'sdk',

  /**
   * Proxy / transport-level source.
   * Indicates the SDK successfully resolved routing information and attempted
   * to contact the target service, but the failure occurred during transport,
   * routing, or RPC execution (e.g. service unavailable or timeout).
   */
  PROXY: 'proxy',

  /**
   * Service-level source.
   * Indicates the request was successfully delivered to the target service and
   * the result (success or error) was produced by the service itself.
   */
  SERVICE: 'service',
};

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
 * @type {HC2ServiceRegistration}
 */
export const HC2ServiceRegistration = Object.freeze({});