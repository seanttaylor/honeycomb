
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

### **⚡ Plugin System (v5.1 and later)**

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

## Plugin System Overview

Honeycomb features a lightweight plugin mechanism that allows applications to **extend or alter the behavior of individual services at runtime**, without modifying the services themselves.

The core goals of this system are:

## **1. Externalized Behavior Modification**

Plugins allow functionality to be injected _from outside_ a service’s implementation.
This makes it possible to:

- add cross-cutting behavior (e.g., metrics, instrumentation)
- override or layer on new business rules
- modify the execution path of one or more methods
- patch or augment legacy services without editing their source

The intent is similar to traditional plugin systems found in editors, browsers, or audio software: a plugin is an external module that _hooks into_ the lifecycle or execution of another module.

## **2. Explicit Targeting**

Each plugin (defined as a class) explicitly declares **which service it modifies** via a static `target` property.

This makes plugin influence discoverable, auditable, and trackable when the application starts.
Nothing happens automatically or implicitly—plugins must be intentionally registered and explicitly tied to a specific service.

## **3. Controlled Execution Modes**

Plugins define a static `mode` indicating _how_ they interact with the target service:

- **pre_ex** — Run before a method executes
- **post_ex** — Run after a method completes
- **override** — Replace the method’s implementation entirely

These modes give plugin authors a clear, predictable model for how their extensions integrate into the service’s execution flow.

> Each plugin method returns either an `Array` instance ( for extending methods with positional args), an object (for named args or structured overrides), or `undefined` (for side-effects only). Anything other return type is rejected by the framework, ensuring predictable integration patterns.


## **4. Isolated Construction Context**

Plugins receive the same **restricted sandbox** that the service they extend receives.
They do _not_ gain access to host internals or the full `sandbox.my.*` namespace containing user-defined services.

This maintains Honeycomb’s security and policy model:
plugins extend services, but they do not bypass access restrictions.

## **5. Deterministic Application at Service Instantiation**

Plugins are applied **when a service instance is created**, inside the framework core that already mediates lifecycle events.

This ensures:

- plugins run _before_ any application code touches the service
- bootstrap modules are extended before autostart
- startup ordering is deterministic
- services never exist in a “pre-plugin” state visible to the host

Because instantiation is lazy (via getters on `sandbox.my`), plugin application happens exactly once per module instance.

## **6. Small Surface Area, Minimal Intrusion**

The plugin API is intentionally small:

- A single `plugin()` registration entry point
- A plugin class exposes a static `target` property
- A plugin class exposes a static `mode` property
- A constructor invoked with a policy-restricted sandbox

This keeps the system composable and predictable.
Plugins should be easy to write, easy to audit, and difficult to misuse.

## Architectural Philosophy

The plugin system balances two conflicting design values:

- **Plugins should be powerful enough to alter behavior.**
- **Plugins should not obscure or destabilize core service logic.**

The goal is not to create a general-purpose dependency injection framework or aspect-oriented programming engine.
Instead, Honeycomb plugins provide a **surgical** extension point—just enough power for application developers to adapt services while still respecting policies and boundaries.