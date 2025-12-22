
## **Honeycomb |  A simply sweet cloud application runtime**

# Table of Contents
1. [Introduction](#introduction)
2. [HC2Gateway](#hc2-gateway)
3. [HC2 Instances](#hc2-instances)
   1. [HC2 Services In Depth](#hc2-services-in-depth)
4. [HC2 SDK](#hc2-sdk)


## Introducing Honeycomb Cloud Platform <a name="introduction"></a>

Honeycomb Cloud Platform (HCP) is a self-hosted, hardware-aware cloud platform designed to run real application workloads on infrastructure you own and understand. It provides a coherent runtime, orchestration, routing, and storage model without relying on opaque hyperscaler abstractions.

### The Problem Addressed

Modern cloud platforms optimize for scale and convenience at the cost of transparency, determinism, and control. As systems grow, they often become difficult to reason about, expensive to operate, and tightly coupled to vendor-specific primitives. HCP is designed to counter this trend by offering a simpler, more inspectable platform that makes infrastructure behavior explicit rather than hidden.

### Why It Exists
HCP exists to make infrastructure legible again. Its philosophy is that small, understandable systems—when composed carefully—can outperform large, monolithic platforms in reliability, adaptability, and operator confidence. Instead of abstracting hardware away entirely, HCP treats it as a first-class concern and builds upward from it.

### Who it's For

HCP is for engineers and teams who want deep control over their infrastructure, are comfortable operating their own systems, and value clarity over convenience. It is particularly suited to homelab-scale clouds, edge deployments, research systems, and organizations seeking independence from traditional cloud providers.

---

## Design Goals

### Simplicity over accidental complexity

HCP aims to minimize the number of moving parts required to run applications. Each component exists for a clear reason, with sharply defined responsibilities.

### Explicit control over infrastructure and deployment

Nothing in HCP happens “by magic.” Deployment, routing, storage, and runtime behavior are deliberate and inspectable, allowing operators to understand exactly how applications are running.

### Deterministic, inspectable systems

HCP favors deterministic behavior over adaptive heuristics. Systems should behave the same way given the same inputs, and their state should always be observable.

### Hardware-aware cloud primitives

Rather than pretending hardware does not matter, HCP is designed with the constraints and capabilities of physical machines in mind, including resource limits, topology, and failure characteristics.

### Small, composable components over monoliths

HCP is built from discrete components that can be reasoned about independently and composed together, rather than a single, tightly coupled control plane.

---

## High-Level Architecture

### How HCP is layered

At a high level, HCP is layered from hardware upward through abstraction, runtime, and application services. Each layer exposes clear contracts to the layer above it while remaining grounded in the realities of the layer below.

### Relationship between hardware, runtime, services, and storage

Physical hardware is abstracted by HC0, which provides a consistent substrate for the platform. HC2 provides the application runtime on top of this substrate. HC2 services run within that runtime and communicate through HC2Gateway. HC3 provides static, content-addressable storage used across the platform.

### How data and requests move through the platform

Requests typically enter the system through HC2Gateway, which routes them to the appropriate HC2 service. Services may read from or write to HC3 as needed, while HC2 and the HC2 Agent ensure the services are running on available hardware.

### Control plane vs. application plane

HCP maintains a conceptual separation between control responsibilities (orchestration, deployment, routing) and application execution. This separation keeps application logic simple while allowing the platform to manage lifecycle and infrastructure concerns.

---

## Core Platform Components

### HC2 | Cloud Application Runtime

#### Role of HC2 in Honeycomb Cloud

HC2 is the core runtime responsible for executing application services. It provides the environment in which services run and defines how they are started, managed, and observed.

#### What “runtime” means in the context of HCP

In HCP, the runtime is not a black box. HC2 defines clear expectations around process execution, resource usage, and service boundaries, making it easier to reason about application behavior.

#### Boundaries and Responsibilities

HC2 is responsible for running services, not orchestrating hardware or handling routing directly. Those concerns are delegated to other components to keep the runtime focused and predictable.

---

### HC2 Services

#### What constitutes an HC2 service

An HC2 service is an application component designed to run within the HC2 runtime. Services are treated as first-class units of deployment and operation.

#### How services are deployed and run conceptually

Services are deployed via the HC2 Agent and executed by the HC2 runtime. Their lifecycle is managed by the platform rather than ad hoc scripts or manual intervention.

#### How services are intended to scale and evolve

HCP favors deliberate scaling and evolution of services over automatic elasticity. Growth is explicit, controlled, and observable rather than reactive and opaque.

---

### HC2Gateway | Routing and Communications Broker

#### Why a dedicated proxy exists

HC2Gateway centralizes routing and communication concerns so services do not need to embed complex networking logic. This simplifies service design and improves consistency.

#### How it mediates service-to-service communication

HC2Gateway acts as an intermediary for requests between services, handling routing decisions, discovery, and isolation concerns.

#### Its role in discovery, routing, and isolation

By managing how services find and talk to one another, HC2Gateway enforces clear boundaries and reduces unintended coupling between components.

---

### HC2 Agent (Bumblebee) | Orchestration and Deployment

#### What Bumblebee is responsible for

The HC2 Agent, known as Bumblebee, is responsible for deploying services, standing up containers, and ensuring the runtime state matches the desired state.

#### How it interacts with the runtime and hardware

Bumblebee bridges the gap between intent and execution, coordinating with HC2 and the underlying hardware through HC0 to bring applications online.

#### Why orchestration is handled this way in HCP

Rather than embedding orchestration logic everywhere, HCP centralizes it in a single agent to reduce complexity and make system behavior easier to trace.

---

### HC3 | Content-Addressable Static Storage

#### What HC3 stores and why

HC3 stores deploymen artifacts using content-addressable identifiers, ensuring immutability and integrity.

#### Why content-addressable storage is a core primitive

Content-addressable storage makes artifacts verifiable, cacheable, and reusable, reducing ambiguity about what is running where.

#### How HC3 fits into application delivery and runtime needs

HC3 supports application deployment and runtime behavior by providing a stable, inspectable source of static content used across the platform.

---

### HC0 Hardware Abstraction Layer

#### Purpose of HC0

HC0 abstracts the underlying physical hardware into a consistent interface that the rest of the platform can depend on.

#### What hardware details it hides or exposes

HC0 hides unnecessary variability while still exposing meaningful hardware characteristics that matter for scheduling and performance.

#### Why HCP treats hardware as a first-class concern

By acknowledging hardware explicitly, HCP avoids the false assumption that all compute is interchangeable, leading to more predictable systems.

## Bare Metal Infrastructure

HCP ultimately runs on bare-metal infrastructure, currently centered around a Raspberry Pi cluster. While this physical layer is foundational to the platform’s philosophy, its design and operation will be documented separately as it continues to evolve.


## HC2Gateway <a name="hc2-gateway"></a>

> Gist: HC2Gateway is the ingress, routing, and service exposure layer for an HC2 instance, controlling how traffic—internal and external—reaches running services.

### Summary

HC2Gateway is the network-facing gateway for a single HC2 instance. It is responsible for receiving incoming requests, determining where those requests should go, and forwarding them to either the HC2 runtime itself or to one of the services registered under that instance. 

This platform component is also the sole mechanism by which HC2 services may be exposed to the public internet, making it a critical boundary between the platform’s internal topology and external traffic.

By centralizing ingress, discovery, and routing, HC2Gateway simplifies service design while enforcing clear and inspectable control over how traffic enters the system.

#### Purpose and Responsibilities

HC2Gateway exists to act as the authoritative front door for an HC2 instance. All inbound traffic—whether originating from within Honeycomb or from outside the platform—flows through it.

Its core responsibilities are to:

* Receive and accept HTTP traffic on behalf of an HC2 instance.

* Route requests to the appropriate destination, either the HC2 runtime itself or a registered HC2 service.

* Maintain awareness of which services are currently active and routable.

* Enforce the rule that services are not directly exposed to the network without passing through the gateway.

* Provide a single, consistent place to reason about ingress, routing, and service exposure.

HC2Gateway is deliberately not an application participant. It does not implement business logic, transform domain data, or make application-level decisions. 

Its job is to move traffic correctly and predictably, _not to interpret it_.

#### Lifecycle and Behavior

HC2Gateway is started as part of an HC2 instance’s operational footprint. On startup, it initializes its routing layer and establishes visibility into the current set of registered services associated with that instance.

As services are deployed, updated, or removed, HC2Gateway continuously updates its internal view of available service profiles. This allows it to make routing decisions based on the current state of the instance rather than static configuration.

During steady-state operation, HC2Gateway:

* Accepts incoming requests.

* Determines whether the request targets the HC2 instance itself or a specific service.

* Forwards the request to the appropriate destination without embedding service-specific assumptions.

HC2Gateway remains long-lived relative to individual services. Services may come and go, but the gateway persists as the stable routing surface for the instance.

#### Interactions with other HCP Components

HC2Gateway sits at the intersection of several core Honeycomb components:

* **HC2 Runtime**:
HC2Gateway proxies certain requests directly to the HC2 instance, acting as the access point for runtime-level endpoints and capabilities.

* **HC2 Services**:
Services do not expose themselves directly. Instead, they register with the HC2 instance, and HC2Gateway routes traffic to them based on that registration data.

* **HC2 Agent (Bumblebee)**:
While HC2Gateway does not orchestrate services itself, its routing state reflects the outcomes of Bumblebee’s deployment and lifecycle decisions.

* **Overall HCP topology**:
HC2Gateway defines the network boundary of an HC2 instance. From the outside, it represents “the instance,” even though internally that instance may be running many services. This positioning allows other components to remain simpler, as they can rely on the gateway to handle ingress and routing concerns.

#### Guarantees and Invariants

HC2Gateway upholds several important invariants within the platform:

1. There is a single authoritative ingress point per HC2 instance.

2. No HC2 service is reachable without going through HC2Gateway.

3. Routing decisions are based on explicit service registration data, not ad hoc configuration.

4. The gateway’s behavior is independent of service implementation details; services are treated as opaque routing targets.

5. These guarantees make it possible to reason about connectivity, exposure, and traffic flow without needing to inspect individual services.

#### Failure Modes and Edge Cases

**_Service registration data is incomplete or stale_**: If HC2Gateway’s view of registered services is incomplete or out of date, routing decisions may temporarily fail or default to rejecting requests for affected services. 
The gateway does not attempt to infer or guess service availability; it relies on explicit registration data. This bias toward correctness over optimism avoids accidentally routing traffic to unintended destinations.

**_Unavailable or unhealthy services_**:
When a service is unavailable or unhealthy, HC2Gateway will still attempt to route requests according to its current view of service state. Failed requests surface naturally as upstream errors rather than being masked or transformed by the gateway. This preserves transparency and ensures failures remain visible to operators and clients.

#### Operational and Mental Models

The simplest correct way to think about HC2Gateway is as the front door and traffic cop for an HC2 instance.

* It is the only door through which traffic enters.

* It does not decide what should happen to requests—only where they should go.

* It enforces separation between the outside world and internal services.

* It provides a stable, inspectable choke point for networking concerns.

If HC2 is “the building” and HC2 services are “the rooms,” HC2Gateway is the lobby desk: every visitor passes through it, directions are given there, and no one reaches a room without being routed correctly.

## HC2 Instance <a name="hc2-instances"></a>

> **Gist:** The HC2 instance is the authoritative control plane for a runtime domain, governing service identity, state, and admission into the instance.

### Summary

An HC2 instance is the central authority for a single Honeycomb runtime domain. It defines which services are allowed to exist within the instance, what state those services are in, and under what conditions they may join and begin receiving traffic. By owning service registration, persistent state, and certificate issuance, the HC2 instance provides a secure and deterministic foundation for service participation. Downstream components, most notably [HC2Gateway](#hc2-gateway), rely on the HC2 instance as the canonical source of truth when brokering communication between services.

---

#### Purpose and Responsibilities

The HC2 instance exists to serve as the **authoritative source of truth** for all services associated with a given runtime instance.

Its responsibilities include:

* Defining and enforcing the rules under which services may bootstrap and join the instance.
* Tracking service identity, registration status, and lifecycle state.
* Persisting service state in a durable key/value datastore.
* Issuing and signing service certificates that establish service identity.
* Validating service registration requests based on embedded certificate claims.
* Publishing authoritative service state changes for consumption by other components.

The HC2 instance does not route traffic and does not expose services directly. Its role is governance, validation, and state—not networking.

---

#### Lifecycle and Behavior

An HC2 instance begins life by initializing its persistent datastore and rehydrating any previously known service state. This persisted data is treated as canonical and forms the basis for all subsequent decisions.

When a service attempts to join the instance, it must complete a bootstrap and registration process governed by the HC2 instance. This process includes:

* Evaluation of whether the service is eligible to join.
* Validation of the service’s registration request and embedded claims.
* Acceptance or rejection of the service’s attempt to formally register.

Upon successful registration, the HC2 instance records the service’s state in the datastore and treats the service as a recognized participant in the instance. As services continue running, their state may be updated and persisted as needed, ensuring the instance maintains an accurate, durable view of the system.

---

#### Interactions with other Honeycomb components

**HC2 Services**
HC2 services interact with the HC2 instance via the [HC2Gateway](#hc2-gateway) during bootstrap and registration. Services do not self-assert membership; they request admission, which the HC2 instance explicitly grants or denies based on validation rules and certificate claims.

**HC2Gateway**
[HC2Gateway](#hc2-gateway) depends on the HC2 instance for authoritative service state. It builds its internal service profiles by *listening* for changes to specific collections or databases within the HC2 instance’s datastore. Importantly:

* [HC2Gateway](#hc2-gateway) has **read-only** access to this data.
* It cannot modify service state or registration records.
* All routing decisions are derived from HC2-owned data.

**Persistent Key/Value Store**
The HC2 instance uses a key/value store (currently CouchDB) to house service registration records and state. This datastore acts as the durable memory of the instance and the mechanism by which state changes are propagated to other components.

---

#### Guarantees and Invariants

The HC2 instance upholds several foundational guarantees:

* It is the **sole authority** for service identity and state within an instance.
* No service may formally join an instance without passing registration validation.
* All accepted service state is durably persisted and treated as canonical.
* Service certificates are issued and signed exclusively by the HC2 instance.
* Downstream consumers may observe service state but may not mutate it.

These invariants ensure that service participation is explicit, auditable, and resistant to accidental or unauthorized inclusion.

---

#### Failure modes and edge cases

**_Persisted service state is unavailable or inconsistent_:**
If the underlying datastore is unavailable or returns inconsistent data, the HC2 instance cannot safely validate service state. In such cases, the instance favors correctness over availability, preventing new services from joining until authoritative state can be confirmed.

**_Invalid or improperly signed service certificates_:**
If a service presents a registration request containing an invalid, expired, or incorrectly signed certificate, the HC2 instance rejects the request outright. Services are never partially admitted; registration is an all-or-nothing decision.

**_Service registration attempts with incomplete or contradictory claims_:**
Registration requests that fail to present coherent or complete claims are rejected. The HC2 instance does not attempt to infer intent or repair malformed registrations.

---

#### Operational or mental models

The most useful way to think about an HC2 instance is as a **local control plane with teeth**.

* It is not a scheduler or a router.
* It is a registry that enforces rules, not a passive database.
* Services do not declare themselves active; they are *recognized* as active.
* Certificates are not ornamental; they are the basis of trust and admission.
* Other components observe the instance; none override it.

If [HC2Gateway](#hc2-gateway) is the front door, the HC2 instance is the bouncer with the guest list and the guest list is cryptographically signed.

## HC2 Services

> **Gist:** HC2 services are the executable application units of HCP that must be explicitly admitted into an HC2 instance before they can receive traffic.


### Summary

HC2 services are the primary application workloads running on the Honeycomb Cloud Platform. Each service runs as a discrete execution unit and must formally bootstrap and register with an HC2 instance before it is considered part of the system. 

Services do not assume connectivity, trust, or exposure by default; instead, participation is explicitly granted by the HC2 instance based on validated identity and state. Once admitted, services may receive traffic through HC2Gateway and participate in controlled service-to-service communication.

---

#### Purpose and Responsibilities

HC2 services exist to encapsulate application logic while delegating infrastructure, identity, and exposure concerns to the platform.

Their responsibilities include:

* Implementing application-specific behavior and APIs.
* Initiating a bootstrap process to join an HC2 instance.
* Presenting verifiable identity claims during registration.
* Operating only within the bounds of instance-granted admission.
* Remaining agnostic to routing, exposure, and ingress mechanics.

HC2 services do not decide how traffic reaches them and do not directly manage their own discoverability.

---

#### Lifecycle and Behavior

An HC2 service begins life as an executable workload but is not immediately considered part of an [HC2](#hc2-instances) instance.

Its lifecycle includes:

* **Startup:** The service initializes its runtime environment.
* **Bootstrap:** The service prepares identity and registration data required to request admission.
* **Registration:** A formal registration request is submitted to the [HC2](#hc2-instances) instance.
* **Admission:** Upon successful validation, the service becomes a recognized member of the instance.
* **Execution:** The service runs normally and may receive traffic routed via [HC2Gateway](#hc2-gateway).
* **Termination:** The service shuts down or is removed, at which point it ceases to be routable.

Until admission is complete, the service is effectively isolated from the rest of the platform.

---

#### Interactions with other Honeycomb components

**HC2 Instance**
[HC2](#hc2-instances) services interact directly with the HC2 instance during bootstrap and registration. The instance evaluates the service’s identity, validates its claims, and determines whether it may join.

**Service Certificates**
Services rely on instance-issued service certificates to assert identity during registration. These certificates are embedded in registration requests and serve as the basis for trust.

**HC2Gateway**
Services connect to [HC2Gateway](#hc2-gateway) for admission or discovery. Once admitted, [HC2Gateway](#hc2-gateway) may route traffic to the service based on authoritative state published by the [HC2](#hc2-instances) instance.

---

#### Guarantees and Invariants

HC2 services operate under several platform-level guarantees:

* A service is not considered part of an [HC2](#hc2-instances) instance until registration succeeds.
* Services cannot expose themselves directly to internal or external networks.
* All service identity is rooted in certificates issued by the [HC2](#hc2-instances) instance.
* Platform-recognized service state is derived from instance records, not service self-reporting.
* Services are treated as opaque execution units by the platform.

These guarantees ensure that service participation is explicit, verifiable, and centrally governed.

---

#### Failure Modes and Edge Cases

**_Rejected registration due to invalid or missing certificates_:**
If a service attempts to register without a valid, instance-issued certificate, the registration is rejected and the service remains unadmitted.

**_Startup without successful admission:_**
A service may start successfully at the process level but still fail to join an HC2 instance. In this state, it runs in isolation and does not receive traffic.

**_Loss of routability due to deregistration or state invalidation_:**
If a service’s registration is revoked or its state is invalidated, HC2Gateway will no longer route traffic to it, even if the service process is still running.

---

#### Operational and Mental Models

The most useful way to think about HC2 services is as **identity-bound workloads** rather than autonomous network participants.

* Services request entry; they are not assumed to belong.
* Identity precedes connectivity.
* Admission precedes exposure.
* Execution is local, participation is granted.
* The platform decides when a service “exists” from a system perspective.

In practical terms, an HC2 service is not “live” when it starts—it is live when the HC2 instance says it is.

## HC2 Services In-Depth <a name="hc2-services-in-depth"></a>

### Purpose and Scope

This section provides a deeper examination of how Honeycomb Cloud services are defined, authenticated, registered, and made discoverable at runtime. It focuses on the core artifacts and concepts that underpin service identity and communication without delving into lower-level implementation details.

Honeycomb Cloud services are defined declaratively, authenticated cryptographically, registered through a gateway, and made discoverable via derived profiles. By strictly separating authored artifacts from derived operational state, the platform ensures clear ownership boundaries and predictable behavior.

The concepts below describe how services participate in the platform while remaining fully decoupled from the underlying control plane.

### Service Lifecycle Overview

At a high level, a Honeycomb Cloud service progresses through the following conceptual stages:

1. **Definition** – The service declares its identity and intent via a Service Manifest in its codebase.
2. **Deployment Preparation** – During a deployment run, the HC2 Agent ("Bumblebee") consumes the manifest and prepares the assets required for the service to operate.
3. **Identity Issuance** – Bumblebee requests a Service Certificate from a target HC2 instance and stores the resulting cryptographic material in HC3.
4. **Registration** – When the service starts, it registers itself through HC2Gateway, presenting its certificate as proof of identity.
5. **Operational Discovery** – Registration events are propagated via HC2 and used to derive Service Profiles inside HC2Gateway.
6. **Runtime Operation** – The service communicates with other services exclusively through HC2Gateway, which brokers traffic using Service Profiles.

Each stage produces or consumes one or more of the core artifacts described in the sections that follow.

---

### Service Manifests

#### Definition and Role

A **Service Manifest** is a JSON file located within a Honeycomb Cloud service’s codebase. It is a declarative description of the service that serves as the authoritative source of service identity and metadata.

Service Manifests are not runtime configuration files. Instead, they describe *what the service is* and *how it should be represented* within the Honeycomb Cloud ecosystem.

#### Contents

While the exact schema may evolve, a Service Manifest typically includes:

* Service name and logical identifier
* Versioning information
* Environment or deployment context
* Declared API interfaces or capabilities
* Metadata required to support certificate requests
* Additional descriptive attributes used by the platform

#### Usage

Service Manifests are primarily consumed by the HC2 Agent (Bumblebee) during deployment runs. Bumblebee uses the manifest to:

* Establish service identity
* Construct certificate signing requests
* Populate registration payloads
* Seed metadata that will later inform Service Profiles

> Developers author Service Manifests directly, but do not interact with them at runtime.

### 4. Service Certificates

#### Definition

A **Service Certificate** is a cryptographic asset that represents the authenticated identity of a Honeycomb Cloud service. Certificates are issued by an HC2 instance in response to a certificate signing request (CSR).

#### Creation Flow

* During a deployment run, Bumblebee generates a CSR based on Service Manifest data.
* Bumblebee submits the CSR to the target HC2 instance’s `/certs` endpoint.
* The HC2 instance issues a signed Service Certificate.

#### Storage and Injection

* Issued certificates are stored securely in HC3.
* At runtime, Bumblebee retrieves the appropriate certificate from HC3.
* The certificate is injected into the service container when the service starts.

#### Purpose

Service Certificates serve multiple roles:

* Establishing a verifiable service identity
* Authenticating registration requests made via HC2Gateway
* Providing a trust foundation for service-to-service communication

Certificates are treated as identity artifacts, not configuration or policy objects.

### 5. Service Registration Receipt

#### Definition

A **Service Registration Receipt** is the confirmation object returned upon successful registration of a Honeycomb Cloud service. It is issued in response to a service registration request made via HC2Gateway.

#### Contents

A registration receipt typically includes:

* Confirmation that registration succeeded
* Identifiers linking the receipt to the service identity
* Timestamps and relevant versioning data
* Normalized metadata derived during registration

#### Role in Honeycomb Cloud

The Service Registration Receipt acts as:

* Proof that the service is recognized by the platform
* An auditable record of service admission
* A trigger for downstream propagation of service state into HC3

Services may receive the receipt, but do not use it for discovery or routing decisions.

### 6. Service Profiles

#### Definition

A **Service Profile** is a derived, runtime representation of a registered Honeycomb Cloud service. Service Profiles are created within HC2Gateway based on registration notifications propagated from HC2 instances.

Unlike Service Manifests, Service Profiles are not authored by developers. They are synthesized artifacts that reflect the current operational state of a service.

#### Data Captured

Service Profiles typically capture:

* API interfaces and exposed methods
* Networking and routing information
* Service metadata and descriptive attributes
* Signals relevant to availability or reachability

#### Purpose

Service Profiles enable HC2Gateway to:

* Broker requests between services
* Route traffic based on declared interfaces
* Abstract away service location and topology
* Enforce consistent communication semantics

Services themselves are never aware of Service Profiles directly.

#### Lifecycle

Service Profiles are:

* Created upon successful service registration
* Updated in response to subsequent registration events
* Invalidated or removed when a service is no longer registered or reachable

HC2Gateway treats Service Profiles as ephemeral, derived state.

#### System Interactions and Data Flow

The core artifacts described above form a one-directional flow of information:

* **Service Manifest** → consumed by Bumblebee
* **Service Certificate** → issued by HC2, stored in HC3, injected at runtime
* **Service Registration Receipt** → returned to the service via HC2Gateway
* **Service Profile** → derived by HC2Gateway from HC3 notifications

Each artifact has a clearly bounded responsibility, ensuring that no single component becomes a source of implicit coupling.

#### Design Principles and Guarantees

The Services model is governed by several foundational principles:

* Services never communicate directly with HC2 instances
* HC2Gateway is the sole mediation point for service interaction
* Certificates establish identity, not behavior
* Service Profiles are derived state, not declarative input
* HC3 acts as the durable backbone for service state propagation

These guarantees allow services to remain simple, portable, and agnostic of the underlying control plane.

