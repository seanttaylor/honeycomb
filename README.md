
## **Honeycomb |  A sandboxed application runtime & plugin framework**

Honeycomb is a small, self-contained sandbox runtime designed for hosting modular services inside a controlled execution environment. Each service runs with a restricted view of the world, governed by explicit security policies that define which APIs the service is allowed access. Services initialize lazily, can bootstrap automatically if declared, and communicate only through the API surfaces the permitted by the sandbox.

At the core of Honeycomb is a deterministic object model:

### **🧩 Modular Services (Modules)**

Services are registered once and instantiated on-demand via lazy getters. Each service receives a *restricted* sandbox that exposes:

* A `core` namespace with stable utilities
* A `my` namespace with user-defined APIs, which is proxied to enforce access policies
* Event dispatch/listening attached to the sandbox instance

This prevents accidental cross-service access and ensures every inter-service call is authorized.

### **🔐 Policy Enforcement (Default Deny)**

The sandbox applies a strict policy model:
If a service is not explicitly permitted to call another service, the access is rejected at the proxy boundary. Policies define the APIs a service may call and nothing else is reachable.

### **⚡ Plugin System**

Honeycomb supports behavioral extensions through plugins — declarative, class-based augmentations that attach to an existing service at construction time. Plugins may run:

* **before** a method (`pre_ex`)
* **after** a method (`post_ex`)
* **instead of** a method (`override`)

Each plugin method returns either an array ( for extending methods with positional args), an object (for named args or structured overrides), or `undefined` (for side-effects only). Anything else is rejected by the framework, ensuring predictable integration patterns.

### **🧵 Event Architecture**

All sandboxes are instances of `EventTarget`, enabling services and the host application to communicate through structured events without direct references or uncontrolled coupling.

### **🎛 Application Host API**

The application is started via a callback that receives an unrestricted sandbox capable of:

* Accessing every registered service
* Registering plugins before services instantiate
* Dispatching events into the runtime

The outside world, however, only receives a minimal surface: a safe `dispatchEvent` method and the ability to register plugins.

## Release Notes (version 5.0)

- Merges deferred autostart (v4.2) with strict policy enforcement (v5).
- Access to service API is **denied by default** for modules without a policy entry specifying authorization
- Service constructors receive a restricted sandbox produced by the internal `sandbox.declare()` method.

Usage notes:

- Access policies are the final positional argument to the `Sandbox()` constructor. Here is an example of the policies interface:

```
{
  ModuleName: {
    allowedAPIs: ['OtherService', 'YetAnotherService']
    },
  }
}
```


> **BREAKING CHANGE** -- services are constructed _by default_ with no access to peer services unless specified in an access policy.

### Migration & Operational Notes

Version 5 is restricted by default. Services that need to access peer services _must_ have explicit policy entries as follows:

```
const policies = {
  OrderService: { allowedAPIs: ['DataAccessLayer', 'NotificationService'] },
  DataAccessLayer: { allowedAPIs: [] }, // no outgoing service access
};
```

#### Access Policies

If a module has no entry in policies, it **cannot** access any namespaces in `my` services (i.e. `sandbox.my.*`) though it still has access to the framework core methods on (`sandbox.core.*`).

The application host (the callback to the `Sandbox` constructor) is unchanged: it receives the full unrestricted sandbox (so app wiring code will continue to work as before). 

The only place that changed is the module constructor parameter — modules now get a restricted sandbox.

##### Policy Enforcement

Access attempts to unauthorized modules throws an exception `POLICY_ERROR`; attempts to access unknown services throws an exception `INTERNAL_ERROR` with guidance.

#### Autostart

Services classes defined with `static bootstrap = true` will be constructed automatically during startup, but _only after all lazy getters have been defined_ — so the constructors of automatically starting modules can safely access other services if permitted by policy.