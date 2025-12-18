/**
 * Declarative manifest describing a registered HC2 service and its externally
 * visible interface. This structure is used by HC2 and HC2Proxy to construct
 * service profiles, validate routing, and inform SDK clients of available
 * methods and connectivity details.
 *
 * @typedef {Object} HC2ServiceManifest
 *
 * @property {string} name
 * Canonical service name. This value is used as the primary lookup key in
 * routing tables and service profile indexes.
 *
 * @property {string} version
 * Semantic version of the service implementation.
 *
 * @property {string[]} dependsOn
 * List of other services this service depends on. Dependency resolution is
 * advisory and does not imply availability guarantees.
 *
 * @property {number[]} ports
 * List of ports exposed by the service container. These are informational and
 * may be used for diagnostics or deployment validation.
 *
 * @property {Object} api
 * Description of the service’s callable API surface.
 *
 * @property {string} api.description
 * Human-readable description of the service’s purpose and behavior.
 *
 * @property {Array<HC2ServiceMethod>} api.methods
 * List of RPC-callable methods exposed by the service.
 *
 * @property {Object} network
 * Network configuration describing how the service is reached by HC2Proxy.
 *
 * @property {boolean} network.internalOnly
 * Indicates whether the service is only accessible within the internal HC2
 * network and should not be exposed publicly.
 *
 * @property {string} network.publicHostName
 * Logical hostname used for addressing the service within the HC2 network.
 *
 * @property {string} network.rpcEndpoint
 * Fully-qualified RPC endpoint used by HC2Proxy to invoke service methods.
 */


/**
 * Definition of a single RPC method exposed by a service.
 *
 * @typedef {Object} HC2ServiceMethod
 *
 * @property {string} name
 * Method name as exposed to SDK consumers.
 *
 * @property {Object} params
 * JSON Schema–compatible description of the method’s input parameters.
 *
 * @property {string} params.type
 * Root JSON Schema type for the parameters object.
 *
 * @property {Object.<string, Object>} params.properties
 * Map of parameter names to their schema definitions.
 *
 * @property {string[]} [params.required]
 * List of required parameter names.
 *
 * @property {boolean} [params.additionalProperties]
 * Whether parameters beyond those explicitly defined are permitted.
 */

/**
 * @type {HC2ServiceManifest}
 */
export const HC2ServiceManifest = Object.freeze({});